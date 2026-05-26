import { describe, expect, test } from "vitest";
import { uiReady } from "../src/index";

describe("ui smoke", () => {
  test("returns readiness marker", () => {
    expect(uiReady()).toBe("ui-ready");
  });
});
