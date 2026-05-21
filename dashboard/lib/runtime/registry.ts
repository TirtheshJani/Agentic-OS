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
