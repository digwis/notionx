export function getEnv(primary: string, ...fallbacks: string[]): string | undefined {
  if (process.env[primary]) return process.env[primary];
  for (const name of fallbacks) {
    if (process.env[name]) return process.env[name];
  }
  return undefined;
}
