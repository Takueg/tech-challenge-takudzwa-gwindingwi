/** Fails at startup on a bad PORT, rather than Express quietly listening somewhere else. */
export function parsePort(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const port = Number(value);
  if (value.trim() === "" || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`PORT must be a whole number from 1 to 65535, got "${value}"`);
  }
  return port;
}
