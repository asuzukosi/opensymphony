import { describe, expect, test } from "vitest";
import { coreReady } from "@core/index";

describe("core smoke", () => {
  test("returns readiness marker", () => {
    expect(coreReady()).toBe("core-ready");
  });
});
