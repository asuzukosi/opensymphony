import { open } from "@tauri-apps/plugin-dialog";

import { isIpcAvailable } from "@/lib/ipc/client";

export function fileNameFromPath(path: string): string {
  const parts = path.split(/[/\\]/);
  return parts[parts.length - 1] ?? path;
}

export async function pickTaskFiles(): Promise<string[]> {
  if (!isIpcAvailable()) {
    throw new Error("File selection is only available in the desktop app");
  }

  const selected = await open({
    multiple: true,
    title: "Attach files",
  });

  if (selected == null) {
    return [];
  }

  if (Array.isArray(selected)) {
    return selected.filter((path): path is string => typeof path === "string");
  }

  return [selected];
}
