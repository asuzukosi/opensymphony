export function isPendingLoad(isLoading: boolean, data: unknown): boolean {
  return isLoading && data === undefined;
}
