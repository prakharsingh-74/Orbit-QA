/**
 * Type definitions for Orbit QA API, test artifacts, and SSE events
 */

export interface TestResultData {
  status: "idle" | "running" | "passed" | "failed";
  targetUrl?: string;
  objective?: string;
  failedStep?: string;
  expected?: string;
  actual?: string;
  error?: string;
  diagnosis?: string;
  confidence?: number;
  playwrightCode?: string;
  diffPatch?: string;
  screenshot?: string;
  logs: string[];
}

export enum SSEEventType {
  UPDATE = "update",
  ACTION = "action",
  REASONING = "reasoning",
  DONE = "done",
  ERROR = "error",
  SANDBOX_CREATED = "sandbox_created",
  ACTION_COMPLETED = "action_completed",
  TEST_UPDATE = "test_update",
  SCREENSHOT = "screenshot",
  LOG = "log",
}

export interface BaseSSEEvent {
  type: SSEEventType;
}

export interface ActionEvent extends BaseSSEEvent {
  type: SSEEventType.ACTION;
  action: any;
}

export interface ReasoningEvent extends BaseSSEEvent {
  type: SSEEventType.REASONING;
  content: string;
}

export interface DoneEvent extends BaseSSEEvent {
  type: SSEEventType.DONE;
  content?: string;
}

export interface ErrorEvent extends BaseSSEEvent {
  type: SSEEventType.ERROR;
  content: string;
}

export interface SandboxCreatedEvent extends BaseSSEEvent {
  type: SSEEventType.SANDBOX_CREATED;
  sandboxId: string;
  vncUrl: string;
}

export interface ActionCompletedEvent extends BaseSSEEvent {
  type: SSEEventType.ACTION_COMPLETED;
}

export interface TestUpdateEvent extends BaseSSEEvent {
  type: SSEEventType.TEST_UPDATE;
  data: Partial<TestResultData>;
}

export interface ScreenshotEvent extends BaseSSEEvent {
  type: SSEEventType.SCREENSHOT;
  base64: string;
}

export interface LogEvent extends BaseSSEEvent {
  type: SSEEventType.LOG;
  line: string;
}

export type SSEEvent =
  | ActionEvent
  | ReasoningEvent
  | DoneEvent
  | ErrorEvent
  | SandboxCreatedEvent
  | ActionCompletedEvent
  | TestUpdateEvent
  | ScreenshotEvent
  | LogEvent;

export async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ActionResponse {
  action: string;
  data?: any;
}
