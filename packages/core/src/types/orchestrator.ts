export interface CandidateSelectionInput {
  projectId: string;
  maxCount: number;
}

export interface ScheduleRetryInput {
  issueId: string;
  attemptNumber: number;
  baseDelayMs: number;
  maxDelayMs: number;
  errorMessage?: string;
}

export interface StartRunInput {
  runAttemptId: string;
  issueId: string;
  attemptNumber: number;
}

export interface AttachSessionInput {
  sessionId: string;
  runAttemptId: string;
  runtimeKind: string;
  sessionRef?: string;
}
