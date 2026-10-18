import { Sandbox } from "@nodeops-createos/sandbox";
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { SSEEventType, SSEEvent, sleep, TestResultData } from "@/types/api";
import {
  ComputerInteractionStreamerFacade,
  ComputerInteractionStreamerFacadeStreamProps,
} from "@/lib/streaming";
import { ActionResponse } from "@/types/api";
import { logDebug, logError } from "../logger";
import { GEMINI_MODEL } from "../config";

const INSTRUCTIONS = `
You are Orbit QA, an intelligent autonomous browser testing and QA agent.
You interact with a real desktop browser and terminal environment inside a secure CreateOS Sandbox microVM.

Your mission:
1. Navigate to the requested website URL or launch the application.
2. Formulate and execute Playwright tests or browser interactions to test the workflow (e.g. signup, login, navigation, form validation, buttons).
3. Detect any visual bugs, console errors, broken assertions, or validation failures.
4. If a failure or bug is detected:
   - Generate the reproducible Playwright test script.
   - Diagnose the root cause with evidence.
   - If source code is involved, propose a targeted code patch diff.
5. Report the full findings clearly.

Available Tools:
- 'navigate': Open a target URL in browser
- 'click', 'double_click', 'type', 'keypress', 'drag', 'scroll', 'wait'
- 'run_bash': Run a shell command in the CreateOS container (e.g. npx playwright test, curl, ls, node)
- 'record_test_result': Update the Inspector with test outcome, failure details, Playwright code, logs, and proposed diff patch
- 'finish': Conclude the QA test session with summary
`;

const orbitTools: FunctionDeclaration[] = [
  {
    name: "navigate",
    description: "Navigate browser to a URL",
    parameters: {
      type: Type.OBJECT,
      properties: {
        url: { type: Type.STRING, description: "Target URL to open" },
      },
      required: ["url"],
    },
  },
  {
    name: "click",
    description: "Click at specific coordinates (x, y) on the screen.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        x: { type: Type.INTEGER, description: "X coordinate (0 to 1280)" },
        y: { type: Type.INTEGER, description: "Y coordinate (0 to 800)" },
        button: {
          type: Type.STRING,
          enum: ["left", "right", "middle"],
          description: "Mouse button. Default is left.",
        },
      },
      required: ["x", "y"],
    },
  },
  {
    name: "double_click",
    description: "Double click at specific coordinates (x, y) on the screen.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        x: { type: Type.INTEGER, description: "X coordinate" },
        y: { type: Type.INTEGER, description: "Y coordinate" },
      },
      required: ["x", "y"],
    },
  },
  {
    name: "type",
    description: "Type text into the focused field.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING, description: "Text to type" },
      },
      required: ["text"],
    },
  },
  {
    name: "keypress",
    description: "Press keyboard keys (e.g. Return, BackSpace, Tab, Escape).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        keys: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "Keys to press",
        },
      },
      required: ["keys"],
    },
  },
  {
    name: "scroll",
    description: "Scroll mouse at x, y.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        x: { type: Type.INTEGER },
        y: { type: Type.INTEGER },
        delta_y: { type: Type.INTEGER, description: "Vertical scroll (positive=down, negative=up)" },
      },
      required: ["x", "y", "delta_y"],
    },
  },
  {
    name: "wait",
    description: "Pause for milliseconds.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        ms: { type: Type.INTEGER, description: "Milliseconds" },
      },
    },
  },
  {
    name: "run_bash",
    description: "Execute a bash shell command inside the CreateOS sandbox container and get stdout/stderr.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        command: { type: Type.STRING, description: "The shell command to run" },
      },
      required: ["command"],
    },
  },
  {
    name: "record_test_result",
    description: "Publish test findings, failure details, generated Playwright script, and proposed fix diff to the Inspector.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        status: { type: Type.STRING, enum: ["passed", "failed"] },
        failedStep: { type: Type.STRING, description: "The specific step that failed" },
        expected: { type: Type.STRING, description: "Expected behavior" },
        actual: { type: Type.STRING, description: "Actual behavior observed" },
        diagnosis: { type: Type.STRING, description: "Root cause diagnosis" },
        confidence: { type: Type.NUMBER, description: "Confidence score 0.0 to 1.0" },
        playwrightCode: { type: Type.STRING, description: "Reproducible Playwright test script" },
        diffPatch: { type: Type.STRING, description: "Proposed code patch in diff format" },
      },
      required: ["status"],
    },
  },
  {
    name: "finish",
    description: "Conclude test run.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING, description: "Final test summary" },
      },
      required: ["summary"],
    },
  },
];

export class GeminiComputerStreamer implements ComputerInteractionStreamerFacade {
  public instructions: string;
  public desktop: Sandbox;
  public resolution: [number, number];
  private ai: GoogleGenAI;

  constructor(desktop: Sandbox, resolution: [number, number]) {
    this.desktop = desktop;
    this.resolution = resolution;
    this.instructions = INSTRUCTIONS;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing.");
    }

    this.ai = new GoogleGenAI({ apiKey });
  }

  private async captureScreenshot(): Promise<{ base64: string; buffer: Buffer }> {
    const raw = await this.desktop.computer.screenshot();
    const buffer = Buffer.from(raw);
    return {
      base64: buffer.toString("base64"),
      buffer,
    };
  }

  async executeAction(action: any): Promise<ActionResponse | void> {
    const desktop = this.desktop;

    switch (action.type) {
      case "click": {
        const btn = (action.button === "right" ? "right" : action.button === "middle" ? "middle" : "left") as "left" | "right" | "middle";
        await desktop.computer.mouse.click({
          x: action.x,
          y: action.y,
          button: btn,
          count: 1,
        });
        break;
      }
      case "double_click": {
        await desktop.computer.mouse.click({
          x: action.x,
          y: action.y,
          button: "left",
          count: 2,
        });
        break;
      }
      case "type": {
        await desktop.computer.keyboard.type({
          text: action.text,
          delay_in_ms: 25,
        });
        break;
      }
      case "keypress": {
        for (const key of action.keys) {
          await desktop.computer.keyboard.press({ keys: [key] });
        }
        break;
      }
      case "scroll": {
        await desktop.computer.mouse.move({ x: action.x, y: action.y });
        const dir = (action.delta_y || 0) >= 0 ? "down" : "up";
        const amt = Math.max(1, Math.abs(Math.round((action.delta_y || 100) / 100)));
        await desktop.computer.mouse.scroll({
          direction: dir,
          amount: amt,
        });
        break;
      }
      case "wait": {
        await sleep(action.ms || 500);
        break;
      }
      case "navigate": {
        // Launch or open browser URL in CreateOS
        try {
          await (desktop as any).runCommand("sh", ["-c", `DISPLAY=:0 /usr/bin/google-chrome --no-sandbox --disable-dev-shm-usage --disable-gpu --window-size=1280,800 "${action.url}" >/dev/null 2>&1 &`]);
        } catch {
          // ignore if runCommand fails
        }
        await sleep(1500);
        break;
      }
      default:
        break;
    }
  }

  async *stream({
    messages,
    signal,
  }: ComputerInteractionStreamerFacadeStreamProps): AsyncGenerator<SSEEvent> {
    const traceId = `gemini-${Date.now()}`;
    let turnIndex = 0;
    const maxTurns = 20;

    logDebug("GEMINI_STREAM_START", { traceId, model: GEMINI_MODEL });

    const contents: any[] = [];
    for (const msg of messages) {
      contents.push({
        role: msg.role === "assistant" ? "model" : "user",
        parts: [{ text: msg.content }],
      });
    }

    try {
      while (turnIndex < maxTurns) {
        if (signal.aborted) {
          yield {
            type: SSEEventType.DONE,
            content: "Task stopped by user",
          };
          return;
        }

        turnIndex++;

        // 1. Capture genuine CreateOS desktop screenshot
        const { base64 } = await this.captureScreenshot();

        // Broadcast screenshot to UI
        yield {
          type: SSEEventType.SCREENSHOT,
          base64: `data:image/png;base64,${base64}`,
        };

        contents.push({
          role: "user",
          parts: [
            { text: "Here is the current screen of the CreateOS desktop:" },
            {
              inlineData: {
                mimeType: "image/png",
                data: base64,
              },
            },
          ],
        });

        // 2. Query Gemini with vision and tools
        const response = await this.ai.models.generateContent({
          model: GEMINI_MODEL,
          contents,
          config: {
            systemInstruction: this.instructions,
            tools: [{ functionDeclarations: orbitTools }],
            temperature: 0.2,
          },
        });

        const candidate = response.candidates?.[0];
        const parts = candidate?.content?.parts || [];

        for (const part of parts) {
          if (part.text) {
            yield {
              type: SSEEventType.REASONING,
              content: part.text,
            };
          }
        }

        const functionCalls = parts
          .filter((p) => p.functionCall)
          .map((p) => p.functionCall!);

        if (!functionCalls || functionCalls.length === 0) {
          const finalText = parts.map((p) => p.text || "").join(" ").trim();
          yield {
            type: SSEEventType.DONE,
            content: finalText || "Task complete.",
          };
          return;
        }

        const functionResponses: any[] = [];
        contents.push({
          role: "model",
          parts,
        });

        for (const call of functionCalls) {
          const callName = call.name;
          const args = (call.args || {}) as any;

          if (callName === "finish") {
            yield {
              type: SSEEventType.DONE,
              content: args.summary || "Workflow finished successfully.",
            };
            return;
          }

          if (callName === "record_test_result") {
            yield {
              type: SSEEventType.TEST_UPDATE,
              data: {
                status: args.status,
                failedStep: args.failedStep,
                expected: args.expected,
                actual: args.actual,
                diagnosis: args.diagnosis,
                confidence: args.confidence,
                playwrightCode: args.playwrightCode,
                diffPatch: args.diffPatch,
                screenshot: `data:image/png;base64,${base64}`,
              },
            };

            yield {
              type: SSEEventType.LOG,
              line: `[Orbit QA Inspector] Test status: ${args.status.toUpperCase()} - ${args.failedStep || "Step evaluation complete"}`,
            };

            functionResponses.push({
              functionResponse: {
                name: callName,
                response: { status: "recorded", success: true },
              },
            });
            continue;
          }

          if (callName === "run_bash") {
            yield {
              type: SSEEventType.LOG,
              line: `$ ${args.command}`,
            };

            let cmdResult = { stdout: "", stderr: "", exit_code: 0 };
            try {
              const res = await (this.desktop as any).runCommand("sh", ["-c", args.command]);
              cmdResult = res?.result || res || { stdout: "", stderr: "", exit_code: 0 };
              if (cmdResult.stdout) {
                yield { type: SSEEventType.LOG, line: cmdResult.stdout };
              }
              if (cmdResult.stderr) {
                yield { type: SSEEventType.LOG, line: `[STDERR] ${cmdResult.stderr}` };
              }
            } catch (err: any) {
              cmdResult = { stdout: "", stderr: err.message, exit_code: 1 };
              yield { type: SSEEventType.LOG, line: `[ERROR] ${err.message}` };
            }

            functionResponses.push({
              functionResponse: {
                name: callName,
                response: cmdResult,
              },
            });
            continue;
          }

          let uiAction: any = { type: callName, ...args };
          yield {
            type: SSEEventType.ACTION,
            action: uiAction,
          };

          await this.executeAction(uiAction);

          yield {
            type: SSEEventType.ACTION_COMPLETED,
          };

          yield {
            type: SSEEventType.LOG,
            line: `[Action] Executed ${callName} ${JSON.stringify(args)}`,
          };

          functionResponses.push({
            functionResponse: {
              name: callName,
              response: { status: "success", executed: true },
            },
          });
        }

        contents.push({
          role: "user",
          parts: functionResponses,
        });

        await sleep(300);
      }

      yield {
        type: SSEEventType.DONE,
        content: "Completed maximum autonomous steps.",
      };
    } catch (err: any) {
      logError("GEMINI_STREAMER_ERROR", err);
      yield {
        type: SSEEventType.ERROR,
        content: err?.message || "An error occurred during Gemini execution.",
      };
      yield {
        type: SSEEventType.DONE,
      };
    }
  }
}
