import { mkdir, writeFile } from "node:fs/promises";
import { isAbsolute, join, relative, sep } from "node:path";
import type { RetryRecord } from "./provider.js";

export type AttemptOutcome = "pass" | "fail" | "error";

export type RetrievedHitRecord = {
  chunkId: string;
  score: number;
  prefix: string;
};

export type AttemptRecord = {
  taskId: string;
  run: number;
  provider: string;
  model: string;
  temperature: number;
  thinkingSetting: string | null;
  date: string;
  rawModelOutput: string;
  outcome: AttemptOutcome;
  /** True only when outcome === "pass". */
  pass: boolean;
  failureReason: string | null;
  finishReason: string | null;
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number | null;
  costUsd: number | null;
  systemPromptHash: string;
  retries: RetryRecord[];
  contextMode: "full" | "rag";
  topK: number | null;
  docsPath: string;
  docsCorpusHash: string;
  retrieved: RetrievedHitRecord[];
  /** Characters in the documentation block of the user message. */
  contextChars: number;
};

export type TaskSummary = {
  id: string;
  passes: number;
  /** Scored runs only (excludes errors). */
  scoredRuns: number;
  errors: number;
  /** How many scored runs passed, e.g. "2/3". Errors excluded. */
  consistency: string;
  passRate: string;
};

export type AggregateResult = {
  label: string;
  provider: string;
  model: string;
  temperature: number;
  thinkingSetting: string | null;
  date: string;
  systemPromptHash: string;
  pricingSourceUrl: string;
  pricingLookupDate: string;
  runsPerTask: number;
  contextMode: "full" | "rag";
  topK: number | null;
  docsPath: string;
  docsCorpusHash: string;
  tasks: TaskSummary[];
  overallPasses: number;
  overallScoredRuns: number;
  overallErrors: number;
  overallPassRate: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalThinkingTokens: number;
  totalCostUsd: number | null;
  attempts: AttemptRecord[];
  incomplete?: boolean;
  incompleteReason?: string;
};

/** First line of every dry-run / stub artifact. */
export const STUB_BANNER = "STUB - NOT REAL RESULTS";

/** First line when the circuit breaker stops a live/stub run early. */
export const INCOMPLETE_BANNER = "INCOMPLETE RUN (stopped after 3 consecutive errors)";

export const CIRCUIT_BREAKER_LIMIT = 3;

export type OutputDirs =
  | { ok: true; resultsDir: string; rawDir: string; stub: boolean }
  | { ok: false; reason: string };

/**
 * Dry-run → results/dry-run/.
 * Smoke labels (smoke*) → results/<label>/ (gitignored; never top-level baseline).
 * Live → results/ (+ raw/).
 * Live runs may not use the label "dry-run".
 */
export function resolveOutputDirs(
  repoRoot: string,
  options: { dryRun: boolean; label: string },
): OutputDirs {
  if (!options.dryRun && options.label === "dry-run") {
    return {
      ok: false,
      reason: 'refuse: label "dry-run" is reserved for stub output; pick another --label',
    };
  }
  if (options.dryRun) {
    const resultsDir = join(repoRoot, "results", "dry-run");
    return { ok: true, resultsDir, rawDir: join(resultsDir, "raw"), stub: true };
  }
  if (options.label.startsWith("smoke")) {
    const resultsDir = join(repoRoot, "results", options.label);
    return { ok: true, resultsDir, rawDir: join(resultsDir, "raw"), stub: false };
  }
  const resultsDir = join(repoRoot, "results");
  return { ok: true, resultsDir, rawDir: join(resultsDir, "raw"), stub: false };
}

/**
 * Docs path recorded in results: always relative to the repo root, POSIX separators.
 * Never an absolute filesystem path.
 */
export function toRepoRelativeDocsPath(repoRoot: string, docsPath: string): string {
  const rel = isAbsolute(docsPath) ? relative(repoRoot, docsPath) : docsPath;
  const normalized = rel.split(sep).join("/");
  if (!normalized || normalized === ".") return ".";
  // If docsPath lies outside the repo, do not keep an absolute or `../` escape.
  if (isAbsolute(normalized) || normalized.startsWith("../") || normalized === "..") {
    return sanitizeAbsolutePaths(docsPath);
  }
  return normalized;
}

/**
 * Replace absolute filesystem paths (and known home/tmp roots) so results never
 * embed machine-local paths. Repo-root prefix is stripped to a relative remnant when possible.
 */
export function sanitizeAbsolutePaths(text: string, repoRoot?: string): string {
  let out = text ?? "";
  if (repoRoot) {
    const root = repoRoot.replace(/[/\\]+$/, "");
    const rootPosix = root.split(sep).join("/");
    if (rootPosix.length > 1) {
      out = out.split(rootPosix + "/").join("");
      out = out.split(rootPosix).join(".");
      // Also handle native separators if present in the string.
      if (sep !== "/") {
        out = out.split(root + sep).join("");
        out = out.split(root).join(".");
      }
    }
  }
  // Unix absolute paths (incl. /Users/..., /tmp/..., /home/...).
  out = out.replace(/(^|[\s"'`=(])(\/(?:Users|home|tmp|var|private|opt|Library|Volumes)\/[^\s"'`]+)/g, "$1[PATH]");
  // Other absolute Unix paths with at least two segments.
  out = out.replace(/(^|[\s"'`=(])(\/[A-Za-z0-9._-]+(?:\/[^\s"'`]+)+)/g, "$1[PATH]");
  // Windows paths: C:\... or \\server\share\...
  out = out.replace(/(^|[\s"'`=(])([A-Za-z]:\\[^\s"'`]+)/g, "$1[PATH]");
  out = out.replace(/(^|[\s"'`=(])(\\\\[^\s"'`]+)/g, "$1[PATH]");
  return out;
}

/** Replace known secret values with [REDACTED], then strip absolute paths. */
export function redactSecrets(text: string, secrets: string[], repoRoot?: string): string {
  let out = text;
  for (const secret of secrets) {
    if (!secret || secret.length < 4) continue;
    if (out.includes(secret)) {
      out = out.split(secret).join("[REDACTED]");
    }
  }
  return sanitizeAbsolutePaths(out, repoRoot);
}

function scrubAttemptRecord(
  record: AttemptRecord,
  secrets: string[],
  repoRoot?: string,
): AttemptRecord {
  return {
    ...record,
    docsPath: sanitizeAbsolutePaths(record.docsPath, repoRoot),
    rawModelOutput: redactSecrets(record.rawModelOutput, secrets, repoRoot),
    failureReason:
      record.failureReason == null
        ? null
        : redactSecrets(record.failureReason, secrets, repoRoot),
    retries: record.retries.map((r) => ({
      ...r,
      message: redactSecrets(r.message, secrets, repoRoot),
    })),
  };
}

export function nextConsecutiveErrors(
  previous: number,
  outcome: AttemptOutcome,
): number {
  return outcome === "error" ? previous + 1 : 0;
}

function assertNoKeyLeak(json: string): void {
  if (/AIza[0-9A-Za-z_-]{10,}|sk-[a-zA-Z0-9]{10,}/.test(json)) {
    throw new Error("refuse: refusing to write results that look like they contain an API key");
  }
}

function writePrefix(options: { stub?: boolean; incomplete?: boolean }): string {
  const lines: string[] = [];
  if (options.incomplete) lines.push(INCOMPLETE_BANNER);
  if (options.stub) lines.push(STUB_BANNER);
  return lines.length ? `${lines.join("\n")}\n` : "";
}

export async function writeRawAttempt(
  rawDir: string,
  record: AttemptRecord,
  options: {
    stub?: boolean;
    incomplete?: boolean;
    secrets?: string[];
    repoRoot?: string;
  } = {},
): Promise<void> {
  await mkdir(rawDir, { recursive: true });
  const name = `${record.taskId}-run${record.run}-${Date.now()}.json`;
  const secrets = options.secrets ?? [];
  const redacted = scrubAttemptRecord(record, secrets, options.repoRoot);
  const json = redactSecrets(
    JSON.stringify(redacted, null, 2) + "\n",
    secrets,
    options.repoRoot,
  );
  assertNoKeyLeak(json);
  const body = writePrefix(options) + json;
  await writeFile(join(rawDir, name), body, "utf8");
}

export async function writeAggregates(
  resultsDir: string,
  label: string,
  aggregate: AggregateResult,
  options: {
    stub?: boolean;
    incomplete?: boolean;
    secrets?: string[];
    repoRoot?: string;
  } = {},
): Promise<{ jsonPath: string; mdPath: string }> {
  await mkdir(resultsDir, { recursive: true });
  const jsonPath = join(resultsDir, `${label}.json`);
  const mdPath = join(resultsDir, `${label}.md`);
  const secrets = options.secrets ?? [];
  const safeAgg: AggregateResult = {
    ...aggregate,
    docsPath: sanitizeAbsolutePaths(aggregate.docsPath, options.repoRoot),
    incomplete: options.incomplete || aggregate.incomplete,
    incompleteReason: options.incomplete
      ? INCOMPLETE_BANNER
      : aggregate.incompleteReason,
    attempts: aggregate.attempts.map((a) =>
      scrubAttemptRecord(a, secrets, options.repoRoot),
    ),
  };
  const json = redactSecrets(
    JSON.stringify(safeAgg, null, 2) + "\n",
    secrets,
    options.repoRoot,
  );
  assertNoKeyLeak(json);
  const md = redactSecrets(renderMarkdown(safeAgg), secrets, options.repoRoot);
  assertNoKeyLeak(md);
  const prefix = writePrefix(options);
  await writeFile(jsonPath, prefix + json, "utf8");
  await writeFile(mdPath, prefix + md, "utf8");
  return { jsonPath, mdPath };
}

export function buildAggregate(
  label: string,
  provider: string,
  model: string,
  temperature: number,
  thinkingSetting: string | null,
  systemPromptHash: string,
  pricingSourceUrl: string,
  pricingLookupDate: string,
  runsPerTask: number,
  attempts: AttemptRecord[],
): AggregateResult {
  const taskIds = [...new Set(attempts.map((a) => a.taskId))];
  const tasks = taskIds.map((id) => {
    const rows = attempts.filter((a) => a.taskId === id);
    const scored = rows.filter((a) => a.outcome !== "error");
    const passes = scored.filter((a) => a.outcome === "pass").length;
    const errors = rows.filter((a) => a.outcome === "error").length;
    const consistency = `${passes}/${scored.length}`;
    return {
      id,
      passes,
      scoredRuns: scored.length,
      errors,
      consistency,
      passRate: consistency,
    };
  });

  const scoredAll = attempts.filter((a) => a.outcome !== "error");
  const overallPasses = scoredAll.filter((a) => a.outcome === "pass").length;
  const overallScoredRuns = scoredAll.length;
  const overallErrors = attempts.filter((a) => a.outcome === "error").length;
  const totalInputTokens = attempts.reduce((s, a) => s + a.inputTokens, 0);
  const totalOutputTokens = attempts.reduce((s, a) => s + a.outputTokens, 0);
  const totalThinkingTokens = attempts.reduce((s, a) => s + (a.thinkingTokens ?? 0), 0);
  const costs = attempts.map((a) => a.costUsd);
  const totalCostUsd = costs.every((c) => c !== null)
    ? costs.reduce((s, c) => s + (c as number), 0)
    : null;

  const first = attempts[0];
  return {
    label,
    provider,
    model,
    temperature,
    thinkingSetting,
    date: new Date().toISOString(),
    systemPromptHash,
    pricingSourceUrl,
    pricingLookupDate,
    runsPerTask,
    contextMode: first?.contextMode ?? "full",
    topK: first?.topK ?? null,
    docsPath: first?.docsPath ?? "",
    docsCorpusHash: first?.docsCorpusHash ?? "",
    tasks,
    overallPasses,
    overallScoredRuns,
    overallErrors,
    overallPassRate: `${overallPasses}/${overallScoredRuns}`,
    totalInputTokens,
    totalOutputTokens,
    totalThinkingTokens,
    totalCostUsd,
    attempts,
  };
}

function renderMarkdown(a: AggregateResult): string {
  const lines: string[] = [];
  lines.push(`# Eval results: ${a.label}`);
  lines.push("");
  if (a.incomplete) {
    lines.push(`- **Incomplete:** ${a.incompleteReason ?? INCOMPLETE_BANNER}`);
  }
  lines.push(`- Provider: \`${a.provider}\``);
  lines.push(`- Model: \`${a.model}\``);
  lines.push(`- Temperature: ${a.temperature}`);
  lines.push(`- Thinking: ${a.thinkingSetting ?? "(none)"}`);
  lines.push(`- Date: ${a.date}`);
  lines.push(`- System prompt hash: \`${a.systemPromptHash}\``);
  lines.push(`- Pricing: ${a.pricingSourceUrl} (lookup ${a.pricingLookupDate})`);
  lines.push(`- Runs per task: ${a.runsPerTask}`);
  lines.push(`- Context: \`${a.contextMode}\`${a.topK != null ? ` (top-k ${a.topK})` : ""}`);
  lines.push(`- Docs path: \`${a.docsPath}\``);
  lines.push(`- Docs corpus hash: \`${a.docsCorpusHash}\``);
  lines.push(`- Overall (errors excluded): **${a.overallPassRate}**`);
  lines.push(`- Errors (excluded from pass rate): **${a.overallErrors}**`);
  lines.push(
    `- Tokens: ${a.totalInputTokens} in / ${a.totalOutputTokens} out / ${a.totalThinkingTokens} thinking`,
  );
  if (a.totalCostUsd !== null) {
    lines.push(`- Estimated cost: $${a.totalCostUsd.toFixed(6)}`);
  }
  lines.push("");
  lines.push("| Task | Consistency (passes/scored) | Errors |");
  lines.push("|------|-----------------------------|--------|");
  for (const t of a.tasks) {
    lines.push(`| ${t.id} | ${t.consistency} | ${t.errors} |`);
  }
  lines.push("");
  lines.push("## Attempts");
  lines.push("");
  lines.push(
    "| Task | Run | Outcome | Finish | Input | Output | Thinking | Retries | Reason |",
  );
  lines.push("|------|-----|---------|--------|-------|--------|----------|---------|--------|");
  for (const r of a.attempts) {
    lines.push(
      `| ${r.taskId} | ${r.run} | ${r.outcome} | ${r.finishReason ?? ""} | ${r.inputTokens} | ${r.outputTokens} | ${r.thinkingTokens ?? ""} | ${r.retries.length} | ${r.failureReason ?? ""} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}
