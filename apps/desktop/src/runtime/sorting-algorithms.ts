import path from "node:path";
import { fileURLToPath } from "node:url";

export type SortingAlgorithmResults = {
  bubbleSort: number[];
  heapSort: number[];
  insertionSort: number[];
  mergeSort: number[];
  quickSort: number[];
  selectionSort: number[];
};

export function bubbleSort(numbers: number[]): number[] {
  const sorted = [...numbers];

  for (let end = sorted.length - 1; end > 0; end -= 1) {
    for (let index = 0; index < end; index += 1) {
      if (sorted[index] > sorted[index + 1]) {
        [sorted[index], sorted[index + 1]] = [sorted[index + 1], sorted[index]];
      }
    }
  }

  return sorted;
}

export function selectionSort(numbers: number[]): number[] {
  const sorted = [...numbers];

  for (let start = 0; start < sorted.length; start += 1) {
    let smallestIndex = start;

    for (let index = start + 1; index < sorted.length; index += 1) {
      if (sorted[index] < sorted[smallestIndex]) {
        smallestIndex = index;
      }
    }

    [sorted[start], sorted[smallestIndex]] = [sorted[smallestIndex], sorted[start]];
  }

  return sorted;
}

export function insertionSort(numbers: number[]): number[] {
  const sorted = [...numbers];

  for (let index = 1; index < sorted.length; index += 1) {
    const value = sorted[index];
    let insertIndex = index - 1;

    while (insertIndex >= 0 && sorted[insertIndex] > value) {
      sorted[insertIndex + 1] = sorted[insertIndex];
      insertIndex -= 1;
    }

    sorted[insertIndex + 1] = value;
  }

  return sorted;
}

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

export function quickSort(numbers: number[]): number[] {
  if (numbers.length <= 1) {
    return [...numbers];
  }

  const [pivot, ...rest] = numbers;
  const lower = rest.filter((value) => value <= pivot);
  const higher = rest.filter((value) => value > pivot);

  return [...quickSort(lower), pivot, ...quickSort(higher)];
}

export function heapSort(numbers: number[]): number[] {
  const heap = [...numbers];

  for (let index = Math.floor(heap.length / 2) - 1; index >= 0; index -= 1) {
    heapify(heap, heap.length, index);
  }

  for (let end = heap.length - 1; end > 0; end -= 1) {
    [heap[0], heap[end]] = [heap[end], heap[0]];
    heapify(heap, end, 0);
  }

  return heap;
}

function heapify(heap: number[], size: number, rootIndex: number): void {
  let largestIndex = rootIndex;
  const leftIndex = rootIndex * 2 + 1;
  const rightIndex = rootIndex * 2 + 2;

  if (leftIndex < size && heap[leftIndex] > heap[largestIndex]) {
    largestIndex = leftIndex;
  }

  if (rightIndex < size && heap[rightIndex] > heap[largestIndex]) {
    largestIndex = rightIndex;
  }

  if (largestIndex !== rootIndex) {
    [heap[rootIndex], heap[largestIndex]] = [heap[largestIndex], heap[rootIndex]];
    heapify(heap, size, largestIndex);
  }
}

export function getSortingAlgorithmResults(numbers: number[]): SortingAlgorithmResults {
  return {
    bubbleSort: bubbleSort(numbers),
    heapSort: heapSort(numbers),
    insertionSort: insertionSort(numbers),
    mergeSort: mergeSort(numbers),
    quickSort: quickSort(numbers),
    selectionSort: selectionSort(numbers),
  };
}

export function parseNumberArgs(argv: string[]): number[] {
  const parsed = argv.map((value) => Number(value));

  if (parsed.some((value) => Number.isNaN(value) || !Number.isFinite(value))) {
    throw new Error("All arguments must be valid numbers.");
  }

  return parsed;
}

export function runSortingAlgorithmsCli(
  argv: string[],
  logger: (message: string) => void = console.log,
): void {
  const input = parseNumberArgs(argv);
  const results = getSortingAlgorithmResults(input);

  logger(
    JSON.stringify(
      {
        input,
        results,
      },
      null,
      2,
    ),
  );
}

function isDirectEntryExecution(): boolean {
  const currentFile = fileURLToPath(import.meta.url);
  const invokedPath = process.argv[1];
  if (!invokedPath) return false;
  return path.resolve(invokedPath) === currentFile;
}

if (isDirectEntryExecution()) {
  try {
    runSortingAlgorithmsCli(process.argv.slice(2));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    console.error(message);
    process.exit(1);
  }
}
