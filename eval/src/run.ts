#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { estimateCostUsd, loadPricing } from "./cost.js";
import {
  buildContextUserMessage,
  validateContextFlags,
  type ContextMode,
} from "./context.js";
import {
  defaultDocsContentDir,
  hashDocsSources,
  loadDocsCorpus,
  loadDocsPages,
} from "./docs.js";
import {
  createAnthropicModel,
  createStubModel,
  loadSystemPrompt,
} from "./model.js";
import {
  completeWithRetry,
  CompletionQualityError,
  createGoogleProvider,
  requireProviderApiKey,
  sleep,
  wrapModelClient,
  type EvalProvider,
  type ProviderName,
} from "./provider.js";
import {
  buildAggregate,
  CIRCUIT_BREAKER_LIMIT,
  INCOMPLETE_BANNER,
  nextConsecutiveErrors,
  redactSecrets,
  resolveOutputDirs,
  writeAggregates,
  writeRawAttempt,
  type AttemptRecord,
  type AttemptOutcome,
} from "./results.js";
import { scoreModelOutput } from "./score.js";
import { loadTasks, parseTaskIds, selectTasks } from "./tasks.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EVAL_ROOT = join(__dirname, "..");
const REPO_ROOT = join(EVAL_ROOT, "..");

const DEFAULT_HARD_CAP = 50;
/** Default pause between live API calls (`--delay-ms`). */
export const DEFAULT_DELAY_MS = 2000;
const DEFAULT_GOOGLE_MODEL = "gemini-3.5-flash-lite";
const DEFAULT_ANTHROPIC_MODEL = "claude-haiku-5-5";
const DEFAULT_TOP_K = 3;

type CliOptions = {
  docsDir: string;
  provider: ProviderName;
  model: string;
  temperature: number;
  runs: number;
  label: string;
  dryRun: boolean;
  hardCap: number;
  delayMs: number;
  thinkingLevel: string;
  yes: boolean;
  taskIds: string[] | null;
  context: ContextMode;
  topK: number;
};

function parseCli(argv: string[]): CliOptions {
  let provider: ProviderName = "google";
  let modelExplicit = false;
  let contextRaw = "full";
  const opts: CliOptions = {
    docsDir: defaultDocsContentDir(REPO_ROOT),
    provider: "google",
    model: DEFAULT_GOOGLE_MODEL,
    temperature: 0,
    runs: 3,
    label: "baseline",
    dryRun: false,
    hardCap: DEFAULT_HARD_CAP,
    delayMs: DEFAULT_DELAY_MS,
    thinkingLevel: "minimal",
    yes: false,
    taskIds: null,
    context: "full",
    topK: DEFAULT_TOP_K,
  };

  for (let i = 2; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === "--dry-run") {
      opts.dryRun = true;
      continue;
    }
    if (a === "--yes" || a === "-y") {
      opts.yes = true;
      continue;
    }
    if (a === "--docs") {
      opts.docsDir = resolve(argv[++i]!);
      continue;
    }
    if (a === "--provider") {
      const p = argv[++i]!;
      if (p !== "google" && p !== "anthropic") {
        throw new Error(`unknown provider: ${p} (use google or anthropic)`);
      }
      provider = p;
      opts.provider = p;
      if (!modelExplicit) {
        opts.model = p === "google" ? DEFAULT_GOOGLE_MODEL : DEFAULT_ANTHROPIC_MODEL;
      }
      continue;
    }
    if (a === "--model") {
      opts.model = argv[++i]!;
      modelExplicit = true;
      continue;
    }
    if (a === "--temperature") {
      opts.temperature = Number(argv[++i]);
      continue;
    }
    if (a === "--runs") {
      opts.runs = Number(argv[++i]);
      continue;
    }
    if (a === "--label") {
      opts.label = argv[++i]!;
      continue;
    }
    if (a === "--hard-cap") {
      opts.hardCap = Number(argv[++i]);
      continue;
    }
    if (a === "--delay-ms") {
      opts.delayMs = Number(argv[++i]);
      continue;
    }
    if (a === "--thinking-level") {
      opts.thinkingLevel = argv[++i]!;
      continue;
    }
    if (a === "--tasks") {
      opts.taskIds = parseTaskIds(argv[++i]!);
      continue;
    }
    if (a === "--context") {
      contextRaw = argv[++i]!;
      continue;
    }
    if (a === "--top-k") {
      opts.topK = Number(argv[++i]);
      continue;
    }
    throw new Error(`unknown option: ${a}`);
  }

  const ctx = validateContextFlags({ context: contextRaw, topK: opts.topK });
  if (!ctx.ok) {
    throw new Error(ctx.reason);
  }
  opts.context = ctx.context;

  if (opts.dryRun) {
    opts.provider = "stub";
  }
  return opts;
}

async function confirm(message: string): Promise<boolean> {
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(message);
    return answer.trim().toLowerCase() === "y";
  } finally {
    rl.close();
  }
}

async function createLiveProvider(
  opts: CliOptions,
): Promise<{ provider: EvalProvider; apiKey: string }> {
  const liveName: ProviderName = opts.provider === "google" ? "google" : "anthropic";
  const checked = requireProviderApiKey(liveName);
  if (!checked.ok) {
    console.error(checked.reason);
    process.exit(2);
  }

  if (liveName === "google") {
    return {
      provider: await createGoogleProvider(
        opts.model,
        opts.temperature,
        checked.key,
        opts.thinkingLevel,
      ),
      apiKey: checked.key,
    };
  }
  const anthropic = await createAnthropicModel(opts.model, opts.temperature, checked.key);
  return { provider: wrapModelClient("anthropic", anthropic, null), apiKey: checked.key };
}

function safeLog(line: string, secrets: string[]): void {
  console.log(redactSecrets(line, secrets));
}

async function main(): Promise<void> {
  const opts = parseCli(process.argv);

  if (process.env.CI && !opts.dryRun) {
    console.error("refuse: CI is set; eval runner must not run in CI");
    process.exit(2);
  }

  const allTasks = await loadTasks(join(EVAL_ROOT, "tasks.json"));
  const selected = selectTasks(allTasks, {
    label: opts.label,
    dryRun: opts.dryRun,
    taskIds: opts.taskIds,
  });
  if (!selected.ok) {
    console.error(selected.reason);
    process.exit(2);
  }
  const tasks = selected.tasks;
  const plannedCalls = tasks.length * opts.runs;

  if (plannedCalls > opts.hardCap) {
    console.error(
      `refuse: planned calls ${plannedCalls} exceed hard cap ${opts.hardCap}`,
    );
    process.exit(2);
  }

  const pricing = await loadPricing(join(EVAL_ROOT, "pricing.json"));
  const { text: systemPrompt, hash: systemPromptHash } = await loadSystemPrompt(
    join(EVAL_ROOT, "system-prompt.txt"),
  );
  const docsRoot = join(REPO_ROOT, "docs");
  const docsCorpus = await loadDocsCorpus(opts.docsDir, docsRoot);
  const docsPages = await loadDocsPages(opts.docsDir, docsRoot);
  const docsCorpusHash = await hashDocsSources(opts.docsDir, docsRoot);

  const approxContext =
    opts.context === "full" ? docsCorpus.length : Math.ceil(docsCorpus.length / 4);
  const approxInPerCall = Math.ceil((systemPrompt.length + approxContext + 200) / 4);
  const approxOutPerCall = 40;
  const estIn = approxInPerCall * plannedCalls;
  const estOut = approxOutPerCall * plannedCalls;
  const estCost = estimateCostUsd(pricing, opts.model, estIn, estOut);

  let secrets: string[] = [];
  let provider: EvalProvider;
  if (opts.dryRun) {
    provider = wrapModelClient("stub", createStubModel(), null);
  } else {
    // --yes skips the interactive confirm; without it, type y at the prompt.
    if (!opts.yes) {
      const ok = await confirm("Type y to proceed with live API calls: ");
      if (!ok) {
        console.error("aborted");
        process.exit(1);
      }
    }
    const live = await createLiveProvider(opts);
    provider = live.provider;
    secrets = live.apiKey ? [live.apiKey] : [];
  }

  console.log(`Provider: ${opts.dryRun ? "stub" : opts.provider}`);
  console.log(`Model: ${opts.dryRun ? "stub-dry-run" : opts.model}`);
  console.log(`Context: ${opts.context}${opts.context === "rag" ? ` (top-k ${opts.topK})` : ""}`);
  console.log(`Docs: ${opts.docsDir}`);
  console.log(`Docs corpus hash: ${docsCorpusHash}`);
  console.log(`Planned calls: ${plannedCalls} (${tasks.length} tasks × ${opts.runs} runs)`);
  console.log(`Delay between calls (--delay-ms): ${opts.dryRun ? 0 : opts.delayMs}ms`);
  console.log(`Estimated tokens: ~${estIn} input / ~${estOut} output`);
  console.log(
    `Estimated cost (from pricing.json): ${
      estCost.missingPrice ? "(no price row for model)" : `~$${estCost.usd.toFixed(4)}`
    }`,
  );
  console.log(`Dry-run: ${opts.dryRun}`);
  console.log(`Label: ${opts.label}`);
  console.log(`System prompt hash: ${systemPromptHash}`);

  const out = resolveOutputDirs(REPO_ROOT, { dryRun: opts.dryRun, label: opts.label });
  if (!out.ok) {
    console.error(out.reason);
    process.exit(2);
  }
  const { resultsDir, rawDir, stub } = out;

  const attempts: AttemptRecord[] = [];
  const delayMs = opts.dryRun ? 0 : opts.delayMs;
  let consecutiveErrors = 0;
  let stoppedEarly = false;

  // Tasks and runs must be sequential: checkCommand uses process.chdir (process-global).
  // Do not fan out tasks or runs in parallel. Live calls also wait delayMs between calls.
  let callIndex = 0;
  outer: for (const task of tasks) {
    for (let run = 1; run <= opts.runs; run++) {
      if (callIndex > 0 && delayMs > 0) {
        await sleep(delayMs);
      }
      callIndex++;

      const { userMessage: user, retrieved, contextChars } = buildContextUserMessage(task, {
        mode: opts.context,
        docsCorpus,
        pages: docsPages,
        topK: opts.topK,
      });

      let outcome: AttemptOutcome;
      let rawText = "";
      let failureReason: string | null = null;
      let finishReason: string | null = null;
      let inputTokens = 0;
      let outputTokens = 0;
      let thinkingTokens: number | null = null;
      let retries: AttemptRecord["retries"] = [];

      try {
        const completed = await completeWithRetry(provider, systemPrompt, user);
        retries = completed.retries.map((r) => ({
          ...r,
          message: redactSecrets(r.message, secrets),
        }));
        rawText = completed.result.text;
        inputTokens = completed.result.inputTokens;
        outputTokens = completed.result.outputTokens;
        thinkingTokens = completed.result.thinkingTokens ?? null;
        finishReason = completed.result.finishReason ?? null;

        const scored = await scoreModelOutput(task, rawText);
        if (scored.ok) {
          outcome = "pass";
        } else {
          outcome = "fail";
          failureReason = scored.reason;
        }
      } catch (err) {
        outcome = "error";
        failureReason = err instanceof Error ? err.message : String(err);
        rawText = "";
        if (err instanceof CompletionQualityError) {
          finishReason = err.finishReason;
        }
      }

      failureReason =
        failureReason == null ? null : redactSecrets(failureReason, secrets);
      rawText = redactSecrets(rawText, secrets);

      const { usd, missingPrice } = estimateCostUsd(
        pricing,
        opts.dryRun ? "gemini-3.5-flash-lite" : opts.model,
        inputTokens,
        outputTokens,
      );

      const record: AttemptRecord = {
        taskId: task.id,
        run,
        provider: provider.name,
        model: provider.modelId,
        temperature: opts.temperature,
        thinkingSetting: provider.thinkingSetting,
        date: new Date().toISOString(),
        rawModelOutput: rawText,
        outcome,
        pass: outcome === "pass",
        failureReason,
        finishReason,
        inputTokens,
        outputTokens,
        thinkingTokens,
        costUsd: missingPrice ? null : usd,
        systemPromptHash,
        retries,
        contextMode: opts.context,
        topK: opts.context === "rag" ? opts.topK : null,
        docsPath: opts.docsDir,
        docsCorpusHash,
        retrieved,
        contextChars,
      };
      attempts.push(record);
      await writeRawAttempt(rawDir, record, { stub, secrets });
      safeLog(
        `${task.id} run ${run}: ${outcome.toUpperCase()}${
          failureReason ? ` — ${failureReason}` : ""
        }${retries.length ? ` (retries: ${retries.length})` : ""}`,
        secrets,
      );

      consecutiveErrors = nextConsecutiveErrors(consecutiveErrors, outcome);
      if (consecutiveErrors >= CIRCUIT_BREAKER_LIMIT) {
        stoppedEarly = true;
        safeLog(`Circuit breaker: ${INCOMPLETE_BANNER}`, secrets);
        break outer;
      }
    }
  }

  const aggregate = buildAggregate(
    opts.label,
    provider.name,
    provider.modelId,
    opts.temperature,
    provider.thinkingSetting,
    systemPromptHash,
    pricing.sourceUrl,
    pricing.lookupDate,
    opts.runs,
    attempts,
  );
  if (stoppedEarly) {
    aggregate.incomplete = true;
    aggregate.incompleteReason = INCOMPLETE_BANNER;
  }
  const { jsonPath, mdPath } = await writeAggregates(resultsDir, opts.label, aggregate, {
    stub,
    incomplete: stoppedEarly,
    secrets,
  });
  safeLog(`Wrote ${jsonPath}`, secrets);
  safeLog(`Wrote ${mdPath}`, secrets);
  console.log(`Overall (errors excluded): ${aggregate.overallPassRate}`);
  console.log(`Errors: ${aggregate.overallErrors}`);
  if (stoppedEarly) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
