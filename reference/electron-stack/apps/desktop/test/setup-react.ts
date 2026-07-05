declare global {
  // vitest + happy-dom need this for react act() in hook tests
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

import { beforeEach } from "vitest";

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
});

export {};