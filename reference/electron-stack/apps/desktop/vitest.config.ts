import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@core\//,
        replacement: `${path.resolve(__dirname, "../../packages/core/src")}/`,
      },
      {
        find: /^@db\//,
        replacement: `${path.resolve(__dirname, "../../packages/db/src")}/`,
      },
      { find: "@", replacement: path.resolve(__dirname, "src") },
    ],
  },
  test: {
    include: ["test/**/*.test.{ts,tsx}"],
    environment: "node",
    setupFiles: ["test/setup-react.ts"],
  },
});
