import { open } from "@tauri-apps/plugin-dialog";

import { isIpcAvailable } from "@/lib/ipc/client";

export async function pickWorkspaceFolder(
  defaultPath?: string,
): Promise<string | null> {
  if (!isIpcAvailable()) {
    throw new Error("Folder selection is only available in the desktop app");
  }

  const selected = await open({
    directory: true,
    multiple: false,
    defaultPath: defaultPath?.trim() || undefined,
    title: "Select agent workspace folder",
  });

  if (selected == null) {
    return null;
  }

  return typeof selected === "string" ? selected : null;
}
