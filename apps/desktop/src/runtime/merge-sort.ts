import path from "node:path";
import { fileURLToPath } from "node:url";

export function mergeSort(numbers: number[]): number[] {
  if (numbers.length <= 1) {
    return [...numbers];
  }

  const middle = Math.floor(numbers.length / 2);
  const left = mergeSort(numbers.slice(0, middle));
  const right = mergeSort(numbers.slice(middle));

  return merge(left, right);
}

function merge(left: number[], right: number[]): number[] {
  const merged: number[] = [];
  let leftIndex = 0;
  let rightIndex = 0;

  while (leftIndex < left.length && rightIndex < right.length) {
    if (left[leftIndex] <= right[rightIndex]) {
      merged.push(left[leftIndex]);
      leftIndex += 1;
    } else {
      merged.push(right[rightIndex]);
      rightIndex += 1;
    }
  }

  return merged.concat(left.slice(leftIndex), right.slice(rightIndex));
}

export function parseNumberArgs(argv: string[]): number[] {
  const parsed = argv.map((value) => Number(value));

  if (parsed.some((value) => Number.isNaN(value) || !Number.isFinite(value))) {
    throw new Error("All arguments must be valid numbers.");
  }

  return parsed;
}

export function runMergeSortCli(argv: string[], logger: (message: string) => void = console.log): void {
  logger(JSON.stringify(mergeSort(parseNumberArgs(argv))));
}

function isDirectEntryExecution(): boolean {
  const currentFile = fileURLToPath(import.meta.url);
  const invokedPath = process.argv[1];
  if (!invokedPath) return false;
  return path.resolve(invokedPath) === currentFile;
}

if (isDirectEntryExecution()) {
  try {
    runMergeSortCli(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    console.error(message);
    process.exit(1);
  }
}
