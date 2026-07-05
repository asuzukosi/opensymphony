import { fileURLToPath } from "node:url";

export const DEMO_ACP_SERVER_PATH = fileURLToPath(
  new URL("../../../../scripts/demo-acp-server.mjs", import.meta.url),
);
