export function requireProjectId(projectId: string | null | undefined): string {
  if (projectId == null) {
    throw new Error("no active project");
  }
  return projectId;
}
