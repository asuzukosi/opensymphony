import { describe, expect, test } from "vitest";
import { dbReady } from "@/index";

describe("db smoke", () => {
  test("returns readiness marker", () => {
    expect(dbReady()).toBe("db-ready");
  });
});
