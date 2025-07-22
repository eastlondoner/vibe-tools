/**
 * Scan process.env for keys that start with "VIBE_TOOLS_" and copy their values
 * to the same key without that prefix. Prefixed values always override.
 *
 * Example:
 *   VIBE_TOOLS_OPENAI_API_KEY => OPENAI_API_KEY
 */
export function applyVibePrefixedOverrides(
  env: Record<string, string | undefined> = process.env,
  prefix = 'VIBE_TOOLS_'
): void {
  const overrideCount = { count: 0 };
  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith(prefix)) continue;
    const targetKey = key.slice(prefix.length);
    if (value === undefined) continue;
    const oldValue = env[targetKey];
    env[targetKey] = value; // always override
    overrideCount.count++;
    console.log(
      `[VIBE_TOOLS_PREFIX] Overrode ${targetKey}: ${oldValue ? 'existing' : 'new'} -> ${value?.slice(0, 8)}...`
    );
  }
  if (overrideCount.count > 0) {
    console.log(
      `[VIBE_TOOLS_PREFIX] Applied ${overrideCount.count} prefixed environment variable overrides`
    );
  }
}
