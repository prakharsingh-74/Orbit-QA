export const SANDBOX_TIMEOUT_MS = 300_000; // 5 minutes in milliseconds

// Resolution boundaries used by the sandbox and optional screenshot scaling.
export const MAX_RESOLUTION_WIDTH = 1280;
export const MAX_RESOLUTION_HEIGHT = 800;
export const MIN_RESOLUTION_WIDTH = 640;
export const MIN_RESOLUTION_HEIGHT = 480;

// Default resolution used when none is specified
// Matching CreateOS default desktop:1 screen geometry
export const DEFAULT_RESOLUTION: [number, number] = [1280, 800];

// Primary Vision / Reasoning model for Orbit QA
export const GEMINI_MODEL = "gemini-3.5-flash";
