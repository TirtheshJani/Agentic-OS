// dashboard/lib/usage/pricing.ts
// Per-MTok pricing for cost ESTIMATES (spec 0018). Subscription (Max plan /
// AI Pro) usage does not bill per token; the UI labels every figure
// "estimated". Longest-prefix match; unknown models yield null, never a guess.
// Cache rates: writes 1.25x input (5-min TTL), reads 0.1x input.
import type { ModelUsage } from "@/lib/sessions/parseClaude";

interface PriceRow {
  modelPrefix: string;
  inPerMTok: number;
  outPerMTok: number;
  cacheWritePerMTok: number;
  cacheReadPerMTok: number;
}

const PRICING: PriceRow[] = [
  { modelPrefix: "claude-fable-5", inPerMTok: 10, outPerMTok: 50, cacheWritePerMTok: 12.5, cacheReadPerMTok: 1 },
  { modelPrefix: "claude-opus-4", inPerMTok: 5, outPerMTok: 25, cacheWritePerMTok: 6.25, cacheReadPerMTok: 0.5 },
  { modelPrefix: "claude-sonnet-4", inPerMTok: 3, outPerMTok: 15, cacheWritePerMTok: 3.75, cacheReadPerMTok: 0.3 },
  { modelPrefix: "claude-haiku-4", inPerMTok: 1, outPerMTok: 5, cacheWritePerMTok: 1.25, cacheReadPerMTok: 0.1 },
];

export function priceFor(model: string): PriceRow | null {
  let best: PriceRow | null = null;
  for (const row of PRICING) {
    if (model.startsWith(row.modelPrefix) && (!best || row.modelPrefix.length > best.modelPrefix.length)) {
      best = row;
    }
  }
  return best;
}

/** Estimated USD for a per-model usage map; null when any model is unpriced. */
export function estimateCost(models: Record<string, ModelUsage>): number | null {
  let total = 0;
  let any = false;
  for (const [model, u] of Object.entries(models)) {
    const p = priceFor(model);
    if (!p) return null;
    any = true;
    total +=
      (u.in / 1_000_000) * p.inPerMTok +
      (u.out / 1_000_000) * p.outPerMTok +
      (u.cacheWrite / 1_000_000) * p.cacheWritePerMTok +
      (u.cacheRead / 1_000_000) * p.cacheReadPerMTok;
  }
  return any ? total : null;
}
