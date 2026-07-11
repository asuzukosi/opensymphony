const ACTIVE_PROJECT_STORAGE_KEY = "opensymphony:active-project-id";

export function readStoredActiveProjectId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return localStorage.getItem(ACTIVE_PROJECT_STORAGE_KEY);
}

export function writeStoredActiveProjectId(projectId: string | null): void {
  if (typeof window === "undefined") {
    return;
  }
  if (projectId == null) {
    localStorage.removeItem(ACTIVE_PROJECT_STORAGE_KEY);
    return;
  }
  localStorage.setItem(ACTIVE_PROJECT_STORAGE_KEY, projectId);
}

export function resolveActiveProjectId(
  projects: { id: string }[],
  storedProjectId: string | null,
): string | null {
  if (storedProjectId != null && projects.some((project) => project.id === storedProjectId)) {
    return storedProjectId;
  }
  return projects[0]?.id ?? null;
}
