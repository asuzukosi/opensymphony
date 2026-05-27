import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { Readable, Writable } from "node:stream";
import { ndJsonStream, type Stream } from "@/runtime/acp/acp-protocol";

export interface ACPStdioStreamHandle {
  readonly stream: Stream;
  /** ends protocol writes to the child stdin without killing the process. */
  close(): void;
}

export interface PipedStdio {
  readonly stdin: NodeJS.WritableStream;
  readonly stdout: NodeJS.ReadableStream;
}

function assertPipedStdio(stdio: PipedStdio): void {
  if (!stdio.stdin || !stdio.stdout) {
    throw new Error("ACP stdio bridge requires piped stdin and stdout");
  }
}

/**
 * bridges a child process's piped stdin/stdout to the SDK {@link ndJsonStream}.
 *
 * symphony writes ACP json-rpc to child stdin and reads agent messages from stdout.
 * stderr stays outside this stream and should be handled separately for diagnostics.
 */
export function createACPStdioStream(
  child: ChildProcessWithoutNullStreams,
): ACPStdioStreamHandle {
  return bridgeStdioToACPStream(child);
}

export function bridgeStdioToACPStream(stdio: PipedStdio): ACPStdioStreamHandle {
  assertPipedStdio(stdio);

  const output = Writable.toWeb(stdio.stdin as Writable);
  const input = Readable.toWeb(stdio.stdout as Readable) as ReadableStream<Uint8Array>;
  const stream = ndJsonStream(output, input);

  return {
    stream,
    close() {
      stdio.stdin.end();
    },
  };
}
