import { defineConfig } from "vite";
import path from "node:path";

export default defineConfig({
  root: "src",
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
});
