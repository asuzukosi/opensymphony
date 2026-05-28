import { describe, expect, test, vi } from "vitest";
import {
  getSortingAlgorithmResults,
  parseNumberArgs,
  runSortingAlgorithmsCli,
} from "../src/runtime/sorting-algorithms";

describe("getSortingAlgorithmResults", () => {
  test("returns ascending results for the popular sorting algorithms", () => {
    expect(getSortingAlgorithmResults([9, 3, 7, 1, 5])).toEqual({
      bubbleSort: [1, 3, 5, 7, 9],
      heapSort: [1, 3, 5, 7, 9],
      insertionSort: [1, 3, 5, 7, 9],
      mergeSort: [1, 3, 5, 7, 9],
      quickSort: [1, 3, 5, 7, 9],
      selectionSort: [1, 3, 5, 7, 9],
    });
  });

  test("does not mutate the input array", () => {
    const values = [4, 2, 8, 6];

    getSortingAlgorithmResults(values);

    expect(values).toEqual([4, 2, 8, 6]);
  });
});

describe("parseNumberArgs", () => {
  test("converts argv strings into numbers", () => {
    expect(parseNumberArgs(["10", "-3", "2.5"])).toEqual([10, -3, 2.5]);
  });

  test("throws when any argument is not a valid number", () => {
    expect(() => parseNumberArgs(["2", "nope", "1"])).toThrow(
      "All arguments must be valid numbers.",
    );
  });
});

describe("runSortingAlgorithmsCli", () => {
  test("logs each algorithm result from argv", () => {
    const logger = vi.fn();

    runSortingAlgorithmsCli(["9", "3", "7", "1"], logger);

    expect(logger).toHaveBeenCalledWith(
      JSON.stringify(
        {
          input: [9, 3, 7, 1],
          results: {
            bubbleSort: [1, 3, 7, 9],
            heapSort: [1, 3, 7, 9],
            insertionSort: [1, 3, 7, 9],
            mergeSort: [1, 3, 7, 9],
            quickSort: [1, 3, 7, 9],
            selectionSort: [1, 3, 7, 9],
          },
        },
        null,
        2,
      ),
    );
  });
});
