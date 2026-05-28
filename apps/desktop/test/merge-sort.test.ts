import { describe, expect, test, vi } from "vitest";
import { mergeSort, runMergeSortCli } from "../src/runtime/merge-sort";

describe("mergeSort", () => {
  test("returns the numbers in ascending order", () => {
    expect(mergeSort([9, 3, 7, 1, 5])).toEqual([1, 3, 5, 7, 9]);
  });

  test("does not mutate the input array", () => {
    const values = [4, 2, 8, 6];

    expect(mergeSort(values)).toEqual([2, 4, 6, 8]);
    expect(values).toEqual([4, 2, 8, 6]);
  });
});

describe("runMergeSortCli", () => {
  test("logs the sorted numbers from argv", () => {
    const logger = vi.fn();

    runMergeSortCli(["9", "3", "7", "1"], logger);

    expect(logger).toHaveBeenCalledWith("[1,3,7,9]");
  });

  test("throws when any argument is not a valid number", () => {
    expect(() => runMergeSortCli(["2", "nope", "1"], vi.fn())).toThrow(
      "All arguments must be valid numbers.",
    );
  });
});
