import type {
  RequestPermissionRequest,
  RequestPermissionResponse,
} from "@/runtime/acp/acp-protocol";
import {
  buildPermissionResponse,
  type PermissionStore,
} from "@/runtime/acp/permission-store";
import type { PermissionMode } from "@symphony/core";

export type { PermissionMode };

export interface PermissionRouterOptions {
  store: PermissionStore;
  getPermissionMode: () => PermissionMode;
}

export interface RoutePermissionRequestInput {
  issueId: string;
  request: RequestPermissionRequest;
}

export class PermissionRouter {
  constructor(private readonly options: PermissionRouterOptions) {}

  async routeRequest(input: RoutePermissionRequestInput): Promise<RequestPermissionResponse> {
    if (this.options.getPermissionMode() === "auto_approve") {
      return buildPermissionResponse(input.request, "approve");
    }

    const { waitForDecision } = this.options.store.enqueue({
      issueId: input.issueId,
      request: input.request,
    });

    return waitForDecision();
  }

  createRequestPermissionHandler(
    issueId: string,
  ): (request: RequestPermissionRequest) => Promise<RequestPermissionResponse> {
    return (request) => this.routeRequest({ issueId, request });
  }
}

export function createPermissionRouter(options: PermissionRouterOptions): PermissionRouter {
  return new PermissionRouter(options);
}
