import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

export type AttemptRecord = {
  taskId: string;
  run: number;
  model: string;
  temperature: number;
  date: string;
  rawModelOutput: string;
  pass: boolean;
  failureReason: string | null;
  inputTokens: number;
  outputTokens: number;
  costUsd: number | null;
  systemPromptHash: string;
};

export type TaskSummary = {
  id: string;
  passes: number;
  runs: number;
  /** How many of this task's runs passed, e.g. "2/3". */
  consistency: string;
  passRate: string;
};

export type AggregateResult = {
  label: string;
  model: string;
  temperature: number;
  date: string;
  systemPromptHash: string;
  pricingSourceUrl: string;
  pricingLookupDate: string;
  runsPerTask: number;
  tasks: TaskSummary[];
  overallPasses: number;
  overallRuns: number;
  overallPassRate: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCostUsd: number | null;
  attempts: AttemptRecord[];
};

export async function writeRawAttempt(rawDir: string, record: AttemptRecord): Promise<void> {
  await mkdir(rawDir, { recursive: true });
  const name = `${record.taskId}-run${record.run}-${Date.now()}.json`;
  await writeFile(join(rawDir, name), JSON.stringify(record, null, 2) + "\n", "utf8");
}

export async function writeAggregates(
  resultsDir: string,
  label: string,
  aggregate: AggregateResult,
): Promise<{ jsonPath: string; mdPath: string }> {
  await mkdir(resultsDir, { recursive: true });
  const jsonPath = join(resultsDir, `${label}.json`);
  const mdPath = join(resultsDir, `${label}.md`);
  await writeFile(jsonPath, JSON.stringify(aggregate, null, 2) + "\n", "utf8");
  await writeFile(mdPath, renderMarkdown(aggregate), "utf8");
  return { jsonPath, mdPath };
}

export function buildAggregate(
  label: string,
  model: string,
  temperature: number,
  systemPromptHash: string,
  pricingSourceUrl: string,
  pricingLookupDate: string,
  runsPerTask: number,
  attempts: AttemptRecord[],
): AggregateResult {
  const taskIds = [...new Set(attempts.map((a) => a.taskId))];
  const tasks = taskIds.map((id) => {
    const rows = attempts.filter((a) => a.taskId === id);
    const passes = rows.filter((a) => a.pass).length;
    const consistency = `${passes}/${rows.length}`;
    return {
      id,
      passes,
      runs: rows.length,
      consistency,
      passRate: consistency,
    };
  });
  const overallPasses = attempts.filter((a) => a.pass).length;
  const overallRuns = attempts.length;
  const totalInputTokens = attempts.reduce((s, a) => s + a.inputTokens, 0);
  const totalOutputTokens = attempts.reduce((s, a) => s + a.outputTokens, 0);
  const costs = attempts.map((a) => a.costUsd);
  const totalCostUsd = costs.every((c) => c !== null)
    ? costs.reduce((s, c) => s + (c as number), 0)
    : null;

  return {
    label,
    model,
    temperature,
    date: new Date().toISOString(),
    systemPromptHash,
    pricingSourceUrl,
    pricingLookupDate,
    runsPerTask,
    tasks,
    overallPasses,
    overallRuns,
    overallPassRate: `${overallPasses}/${overallRuns}`,
    totalInputTokens,
    totalOutputTokens,
    totalCostUsd,
    attempts,
  };
}

function renderMarkdown(a: AggregateResult): string {
  const lines: string[] = [];
  lines.push(`# Eval results: ${a.label}`);
  lines.push("");
  lines.push(`- Model: \`${a.model}\``);
  lines.push(`- Temperature: ${a.temperature}`);
  lines.push(`- Date: ${a.date}`);
  lines.push(`- System prompt hash: \`${a.systemPromptHash}\``);
  lines.push(`- Pricing: ${a.pricingSourceUrl} (lookup ${a.pricingLookupDate})`);
  lines.push(`- Runs per task: ${a.runsPerTask}`);
  lines.push(`- Overall: **${a.overallPassRate}**`);
  lines.push(`- Tokens: ${a.totalInputTokens} in / ${a.totalOutputTokens} out`);
  if (a.totalCostUsd !== null) {
    lines.push(`- Estimated cost: $${a.totalCostUsd.toFixed(6)}`);
  }
  lines.push("");
  lines.push("| Task | Consistency (passes/runs) |");
  lines.push("|------|---------------------------|");
  for (const t of a.tasks) {
    lines.push(`| ${t.id} | ${t.consistency} |`);
  }
  lines.push("");
  lines.push("## Attempts");
  lines.push("");
  lines.push("| Task | Run | Pass | Input tokens | Output tokens | Reason |");
  lines.push("|------|-----|------|--------------|---------------|--------|");
  for (const r of a.attempts) {
    lines.push(
      `| ${r.taskId} | ${r.run} | ${r.pass ? "yes" : "no"} | ${r.inputTokens} | ${r.outputTokens} | ${r.failureReason ?? ""} |`,
    );
  }
  lines.push("");
  return lines.join("\n");
}
