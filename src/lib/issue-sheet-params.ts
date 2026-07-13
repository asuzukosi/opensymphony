"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

export const ISSUE_SHEET_PARAM = "issue";

export type IssueSheetParams = {
  issueId: string | null;
  isOpen: boolean;
  openIssueSheet: (issueId: string) => void;
  closeIssueSheet: () => void;
};

export function useIssueSheetParams(): IssueSheetParams {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const issueId = searchParams.get(ISSUE_SHEET_PARAM);

  const openIssueSheet = useCallback(
    (nextIssueId: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set(ISSUE_SHEET_PARAM, nextIssueId);
      router.push(`${pathname}?${params.toString()}`);
    },
    [pathname, router, searchParams],
  );

  const closeIssueSheet = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(ISSUE_SHEET_PARAM);
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [pathname, router, searchParams]);

  return {
    issueId,
    isOpen: issueId != null,
    openIssueSheet,
    closeIssueSheet,
  };
}
