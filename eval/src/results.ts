import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RetryRecord } from "./provider.js";

export type AttemptOutcome = "pass" | "fail" | "error";

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
  inputTokens: number;
  outputTokens: number;
  thinkingTokens: number | null;
  costUsd: number | null;
  systemPromptHash: string;
  retries: RetryRecord[];
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
};

export async function writeRawAttempt(rawDir: string, record: AttemptRecord): Promise<void> {
  await mkdir(rawDir, { recursive: true });
  const name = `${record.taskId}-run${record.run}-${Date.now()}.json`;
  const json = JSON.stringify(record, null, 2) + "\n";
  // Never persist API key material if it somehow leaked into fields.
  if (/AIza[0-9A-Za-z_-]{10,}|sk-[a-zA-Z0-9]{10,}/.test(json)) {
    throw new Error("refuse: refusing to write results that look like they contain an API key");
  }
  await writeFile(join(rawDir, name), json, "utf8");
}

export async function writeAggregates(
  resultsDir: string,
  label: string,
  aggregate: AggregateResult,
): Promise<{ jsonPath: string; mdPath: string }> {
  await mkdir(resultsDir, { recursive: true });
  const jsonPath = join(resultsDir, `${label}.json`);
  const mdPath = join(resultsDir, `${label}.md`);
  const json = JSON.stringify(aggregate, null, 2) + "\n";
  if (/AIza[0-9A-Za-z_-]{10,}|sk-[a-zA-Z0-9]{10,}/.test(json)) {
    throw new Error("refuse: refusing to write results that look like they contain an API key");
  }
  await writeFile(jsonPath, json, "utf8");
  await writeFile(mdPath, renderMarkdown(aggregate), "utf8");
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
  lines.push(`- Provider: \`${a.provider}\``);
  lines.push(`- Model: \`${a.model}\``);
  lines.push(`- Temperature: ${a.temperature}`);
  lines.push(`- Thinking: ${a.thinkingSetting ?? "(none)"}`);
  lines.push(`- Date: ${a.date}`);
  lines.push(`- System prompt hash: \`${a.systemPromptHash}\``);
  lines.push(`- Pricing: ${a.pricingSourceUrl} (lookup ${a.pricingLookupDate})`);
  lines.push(`- Runs per task: ${a.runsPerTask}`);
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
    "| Task | Run | Outcome | Input | Output | Thinking | Retries | Reason |",
  );
  lines.push("|------|-----|---------|-------|--------|----------|---------|--------|");
  for (const r of a.attempts) {
    lines.push(
      `| ${r.taskId} | ${r.run} | ${r.outcome} | ${r.inputTokens} | ${r.outputTokens} | ${r.thinkingTokens ?? ""} | ${r.retries.length} | ${r.failureReason ?? ""} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}
