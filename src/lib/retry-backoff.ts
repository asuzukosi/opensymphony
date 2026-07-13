export function backoffMsToSeconds(ms: number): number {
  return ms / 1000;
}

export function backoffSecondsToMs(seconds: number): number {
  return Math.round(seconds * 1000);
}
