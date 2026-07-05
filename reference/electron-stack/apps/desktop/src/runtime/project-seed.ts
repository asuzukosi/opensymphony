import type { SeedProjectInput, SqliteDatabase } from "@symphony/db";
import { seedProjectWithDefaultStates } from "@symphony/db";

export function buildProjectSeedInput(projectId: string): SeedProjectInput {
  const slug =
    projectId
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "project";

  return {
    id: projectId,
    name: projectId,
    slug,
  };
}

export function ensureProjectSeededOnce(
  db: SqliteDatabase,
  projectId: string,
  seededProjectIds: Set<string>,
): void {
  if (seededProjectIds.has(projectId)) {
    return;
  }

  seedProjectWithDefaultStates(db, buildProjectSeedInput(projectId));
  seededProjectIds.add(projectId);
}
