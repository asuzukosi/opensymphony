"use client";

import { usePlatformStatuses } from "@/hooks/use-platform-statuses";
import { useProjectPlatforms } from "@/hooks/use-project-platforms";

export function useIssuePlatformPicker(projectId: string | null) {
  const { platformIds, isLoading: platformsLoading } = useProjectPlatforms(projectId);
  const { isPlatformInstalled, isLoading: statusesLoading } = usePlatformStatuses();

  return {
    platformIds,
    isPlatformInstalled,
    isLoading: platformsLoading || statusesLoading,
  };
}
