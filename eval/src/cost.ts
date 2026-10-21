import { readFile } from "node:fs/promises";

export type PricingFile = {
  sourceUrl: string;
  lookupDate: string;
  currency: string;
  unit: string;
  models: Record<
    string,
    {
      inputPerMTok: number;
      outputPerMTok: number;
      notes?: string;
    }
  >;
};

export async function loadPricing(path: string): Promise<PricingFile> {
  return JSON.parse(await readFile(path, "utf8")) as PricingFile;
}

export function estimateCostUsd(
  pricing: PricingFile,
  modelId: string,
  inputTokens: number,
  outputTokens: number,
): { usd: number; missingPrice: boolean } {
  const row = pricing.models[modelId];
  if (!row) {
    return { usd: 0, missingPrice: true };
  }
  const usd =
    (inputTokens / 1_000_000) * row.inputPerMTok + (outputTokens / 1_000_000) * row.outputPerMTok;
  return { usd, missingPrice: false };
}
