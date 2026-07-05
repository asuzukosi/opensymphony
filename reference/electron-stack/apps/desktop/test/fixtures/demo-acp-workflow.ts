import { fileURLToPath } from "node:url";

export const DEMO_ACP_SERVER_PATH = fileURLToPath(
  new URL("../../../../scripts/demo-acp-server.mjs", import.meta.url),
);

export function demoAcpWorkflowBlock(extraLines: string[] = []): string {
  const argsJson = JSON.stringify([DEMO_ACP_SERVER_PATH]);
  const lines = [
    "acp:",
    `  command: ${process.execPath}`,
    `  args: ${argsJson}`,
    ...extraLines,
  ];
  return lines.join("\n");
}
