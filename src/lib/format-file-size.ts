export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function formatFileTypeLabel(mimeType: string | null, fileName: string): string {
  if (mimeType?.includes("pdf")) {
    return "PDF";
  }
  const extension = fileName.includes(".") ? fileName.split(".").pop()?.toUpperCase() : null;
  return extension ?? "File";
}
