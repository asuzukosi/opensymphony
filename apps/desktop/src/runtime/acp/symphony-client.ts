import {
  ClientSideConnection,
  type Agent,
  type Client,
  type RequestPermissionRequest,
  type RequestPermissionResponse,
  type SessionNotification,
  type Stream,
} from "@/runtime/acp/acp-protocol";
import { buildPermissionResponse } from "@/runtime/acp/permission-store";

export type SymphonyClientHandlers = {
  sessionUpdate?: Client["sessionUpdate"];
  requestPermission?: Client["requestPermission"];
};

export interface SymphonyACPConnection {
  readonly connection: ClientSideConnection;
  readonly client: SymphonyACPClient;
}

export class SymphonyACPClient implements Client {
  constructor(private readonly handlers: SymphonyClientHandlers = {}) {}

  async sessionUpdate(params: SessionNotification): Promise<void> {
    await this.handlers.sessionUpdate?.(params);
  }

  async requestPermission(
    params: RequestPermissionRequest,
  ): Promise<RequestPermissionResponse> {
    if (this.handlers.requestPermission) {
      return this.handlers.requestPermission(params);
    }

    return buildPermissionResponse(params, "approve");
  }
}

export function createSymphonyACPConnection(
  stream: Stream,
  handlers: SymphonyClientHandlers = {},
): SymphonyACPConnection {
  const client = new SymphonyACPClient(handlers);
  const connection = new ClientSideConnection((_agent: Agent) => client, stream);

  return { connection, client };
}
