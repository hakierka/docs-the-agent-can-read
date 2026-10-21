#!/usr/bin/env node
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { estimateCostUsd, loadPricing } from "./cost.js";
import { defaultDocsContentDir, loadDocsCorpus } from "./docs.js";
import {
  buildUserMessage,
  createAnthropicModel,
  createStubModel,
  loadSystemPrompt,
  type ModelClient,
} from "./model.js";
import { buildAggregate, writeAggregates, writeRawAttempt, type AttemptRecord } from "./results.js";
import { scoreModelOutput } from "./score.js";
import { loadTasks } from "./tasks.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const EVAL_ROOT = join(__dirname, "..");
const REPO_ROOT = join(EVAL_ROOT, "..");

const DEFAULT_HARD_CAP = 50;

type CliOptions = {
  docsDir: string;
  model: string;
  temperature: number;
  runs: number;
  label: string;
  dryRun: boolean;
  hardCap: number;
  yes: boolean;
};

function parseCli(argv: string[]): CliOptions {
  const opts: CliOptions = {
    docsDir: defaultDocsContentDir(REPO_ROOT),
    model: "claude-haiku-5-5",
    temperature: 0,
    runs: 3,
    label: "baseline",
    dryRun: false,
    hardCap: DEFAULT_HARD_CAP,
    yes: false,
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
    if (a === "--model") {
      opts.model = argv[++i]!;
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
    throw new Error(`unknown option: ${a}`);
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

async function main(): Promise<void> {
  const opts = parseCli(process.argv);

  if (process.env.CI) {
    console.error("refuse: CI is set; eval runner must not run in CI");
    process.exit(2);
  }

  const tasks = await loadTasks(join(EVAL_ROOT, "tasks.json"));
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
  const docsCorpus = await loadDocsCorpus(opts.docsDir, join(REPO_ROOT, "docs"));

  // Rough pre-estimate: corpus + prompt size (chars/4) × calls
  const approxInPerCall = Math.ceil((systemPrompt.length + docsCorpus.length + 200) / 4);
  const approxOutPerCall = 40;
  const estIn = approxInPerCall * plannedCalls;
  const estOut = approxOutPerCall * plannedCalls;
  const estCost = estimateCostUsd(
    pricing,
    opts.dryRun ? "claude-haiku-5-5" : opts.model,
    estIn,
    estOut,
  );

  console.log(`Planned calls: ${plannedCalls} (${tasks.length} tasks × ${opts.runs} runs)`);
  console.log(`Estimated tokens: ~${estIn} input / ~${estOut} output`);
  console.log(
    `Estimated cost (from pricing.json): ${
      estCost.missingPrice ? "(no price row for model)" : `~$${estCost.usd.toFixed(4)}`
    }`,
  );
  console.log(`Dry-run: ${opts.dryRun}`);
  console.log(`Label: ${opts.label}`);
  console.log(`System prompt hash: ${systemPromptHash}`);

  let model: ModelClient;
  if (opts.dryRun) {
    model = createStubModel();
  } else {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      console.error("refuse: ANTHROPIC_API_KEY is missing");
      process.exit(2);
    }
    if (!opts.yes) {
      const ok = await confirm("Type y to proceed with live API calls: ");
      if (!ok) {
        console.error("aborted");
        process.exit(1);
      }
    }
    model = await createAnthropicModel(opts.model, opts.temperature, key);
  }

  const attempts: AttemptRecord[] = [];
  const rawDir = join(REPO_ROOT, "results", "raw");
  const resultsDir = join(REPO_ROOT, "results");

  // Tasks and runs must be sequential: checkCommand uses process.chdir (process-global).
  // Do not fan out tasks or runs in parallel.
  for (const task of tasks) {
    for (let run = 1; run <= opts.runs; run++) {
      const user = buildUserMessage(task, docsCorpus);
      const completion = await model.complete(systemPrompt, user);
      const scored = await scoreModelOutput(task, completion.text);
      const { usd, missingPrice } = estimateCostUsd(
        pricing,
        opts.dryRun ? "claude-haiku-5-5" : opts.model,
        completion.inputTokens,
        completion.outputTokens,
      );

      const record: AttemptRecord = {
        taskId: task.id,
        run,
        model: model.id,
        temperature: opts.temperature,
        date: new Date().toISOString(),
        rawModelOutput: completion.text,
        pass: scored.ok,
        failureReason: scored.ok ? null : scored.reason,
        inputTokens: completion.inputTokens,
        outputTokens: completion.outputTokens,
        costUsd: missingPrice ? null : usd,
        systemPromptHash,
      };
      attempts.push(record);
      await writeRawAttempt(rawDir, record);
      console.log(
        `${task.id} run ${run}: ${record.pass ? "PASS" : "FAIL"}${
          record.failureReason ? ` — ${record.failureReason}` : ""
        }`,
      );
    }
  }

  const aggregate = buildAggregate(
    opts.label,
    model.id,
    opts.temperature,
    systemPromptHash,
    pricing.sourceUrl,
    pricing.lookupDate,
    opts.runs,
    attempts,
  );
  const { jsonPath, mdPath } = await writeAggregates(resultsDir, opts.label, aggregate);
  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
  console.log(`Overall: ${aggregate.overallPassRate}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
