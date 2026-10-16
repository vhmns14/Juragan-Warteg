// Used by the single-file build: no service worker there.
export function registerSW(_opts?: unknown): (reload?: boolean) => Promise<void> {
  return async () => undefined;
}
