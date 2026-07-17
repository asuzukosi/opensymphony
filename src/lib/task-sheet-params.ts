"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export const TASK_SHEET_PARAM = "task";

export type TaskSheetParams = {
  taskId: string | null;
  isOpen: boolean;
  openTaskSheet: (taskId: string) => void;
  closeTaskSheet: () => void;
};

export function useTaskSheetParams(): TaskSheetParams {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const taskId = searchParams.get(TASK_SHEET_PARAM);

  const openTaskSheet = useCallback(
    (nextTaskId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(TASK_SHEET_PARAM, nextTaskId);
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  const closeTaskSheet = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(TASK_SHEET_PARAM);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [pathname, router, searchParams]);

  return {
    taskId,
    isOpen: taskId != null,
    openTaskSheet,
    closeTaskSheet,
  };
}
