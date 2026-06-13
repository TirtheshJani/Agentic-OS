import type { Runtime } from "@/lib/runtime/types";

const registry = new Map<string, Runtime>();

export function registerRuntime(runtime: Runtime): void {
  registry.set(runtime.id, runtime);
}

export function getRuntime(id: string): Runtime | null {
  return registry.get(id) ?? null;
}

export function listRuntimes(): Runtime[] {
  return Array.from(registry.values());
}

export function resetRegistryForTesting(): void {
  registry.clear();
}

/**
 * First registered runtime, other than the excluded ids, whose detect()
 * reports available. Detection errors count as unavailable. Returns null when
 * no other runtime is usable. Backs the LLM-routing fallback (spec 0009): the
 * path that routes around an unavailable or failed primary runtime.
 */
export async function firstAvailableRuntime(excludeIds: string[] = []): Promise<Runtime | null> {
  for (const runtime of registry.values()) {
    if (excludeIds.includes(runtime.id)) continue;
    try {
      if ((await runtime.detect()).available) return runtime;
    } catch {
      // Treat a detection failure as unavailable and keep looking.
    }
  }
  return null;
}

export interface RuntimeResolution {
  runtime: Runtime;
  runtimeId: string;
  /** True when the requested runtime was unavailable and we routed to another. */
  fellBack: boolean;
}

/**
 * Resolve which runtime to actually run, honoring the default-off LLM-routing
 * fallback (`settings.autonomy.llmRouting`, spec 0009).
 *
 * Fallback disabled: the requested runtime is used verbatim via a registry
 * lookup only (no availability probe), so behavior is identical to having no
 * fallback at all. Returns null when it is not registered.
 *
 * Fallback enabled: an available primary is used as-is; an unavailable or
 * unregistered primary routes to the first other registered runtime whose
 * detect() reports available. If nothing else is available the primary is
 * still returned when registered (best effort — the spawn may fail and trip
 * the spawn-time fallback), else null.
 */
export async function resolveRuntime(
  requestedId: string,
  fallbackEnabled: boolean,
): Promise<RuntimeResolution | null> {
  const primary = getRuntime(requestedId);
  if (!fallbackEnabled) {
    return primary ? { runtime: primary, runtimeId: requestedId, fellBack: false } : null;
  }
  if (primary) {
    let available = false;
    try {
      available = (await primary.detect()).available;
    } catch {
      available = false;
    }
    if (available) return { runtime: primary, runtimeId: requestedId, fellBack: false };
  }
  const alt = await firstAvailableRuntime([requestedId]);
  if (alt) return { runtime: alt, runtimeId: alt.id, fellBack: true };
  return primary ? { runtime: primary, runtimeId: requestedId, fellBack: false } : null;
}
