"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { IssueDetailSheet } from "@/components/issue/issue-detail-sheet";

type IssueSheetContextValue = {
  issueId: string | null;
  isOpen: boolean;
  openIssueSheet: (issueId: string) => void;
  closeIssueSheet: () => void;
};

const IssueSheetContext = createContext<IssueSheetContextValue | null>(null);

type IssueSheetProviderProps = {
  children: ReactNode;
};

export function IssueSheetProvider({ children }: IssueSheetProviderProps) {
  const [issueId, setIssueId] = useState<string | null>(null);

  const openIssueSheet = useCallback((nextIssueId: string) => {
    setIssueId(nextIssueId);
  }, []);

  const closeIssueSheet = useCallback(() => {
    setIssueId(null);
  }, []);

  const value = useMemo(
    (): IssueSheetContextValue => ({
      issueId,
      isOpen: issueId != null,
      openIssueSheet,
      closeIssueSheet,
    }),
    [closeIssueSheet, issueId, openIssueSheet],
  );

  return (
    <IssueSheetContext.Provider value={value}>
      {children}
      <IssueDetailSheet />
    </IssueSheetContext.Provider>
  );
}

export function useIssueSheet(): IssueSheetContextValue {
  const context = useContext(IssueSheetContext);
  if (context == null) {
    throw new Error("useIssueSheet must be used within IssueSheetProvider");
  }
  return context;
}
