import { Sandbox } from "@nodeops-createos/sandbox";
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { SSEEventType, SSEEvent, sleep } from "@/types/api";
import {
  ComputerInteractionStreamerFacade,
  ComputerInteractionStreamerFacadeStreamProps,
} from "@/lib/streaming";
import { ActionResponse } from "@/types/api";
import { logDebug, logError } from "../logger";
import { GEMINI_MODEL } from "../config";
import { OpenAIComputerAction } from "@/types/geminiai";

const INSTRUCTIONS = `
You are Orbit QA, an intelligent autonomous browser testing and QA agent.
You interact with a real desktop browser inside a secure CreateOS Sandbox microVM.

Your mission is to execute requested user actions, test websites, explore user interfaces, inspect elements, verify workflows (like login, signup, checkout, forms), and report any bugs or unexpected behaviors.

Capabilities:
- You receive real-time screenshots from the CreateOS desktop environment.
- Use 'click', 'double_click', 'type', 'keypress', 'drag', 'scroll', 'wait', and 'finish' tools to control the system.
- Standard screen resolution is 1280x800. Choose coordinate (x, y) precisely based on what you see in the screenshot.
- After taking actions, inspect the screen to check if the page loaded or changed.
- When your goal is achieved or you have identified the test result/issue, call 'finish' with your final summary.
`;

const computerTools: FunctionDeclaration[] = [
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
          description: "Mouse button to click. Default is left.",
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
    description: "Type text into the focused input field.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        text: { type: Type.STRING, description: "The string text to type" },
      },
      required: ["text"],
    },
  },
  {
    name: "keypress",
    description:
      "Press a key or keyboard shortcut (e.g. Return, BackSpace, Tab, Escape, ctrl+c, alt+f4).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        keys: {
          type: Type.ARRAY,
          items: { type: Type.STRING },
          description: "List of key names to press together or in sequence.",
        },
      },
      required: ["keys"],
    },
  },
  {
    name: "drag",
    description: "Drag mouse cursor from start coordinate to end coordinate.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        path: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              x: { type: Type.INTEGER },
              y: { type: Type.INTEGER },
            },
            required: ["x", "y"],
          },
          description: "Sequence of points for the drag movement.",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "scroll",
    description: "Scroll at coordinates x, y with delta distance.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        x: { type: Type.INTEGER, description: "X coordinate" },
        y: { type: Type.INTEGER, description: "Y coordinate" },
        delta_x: { type: Type.INTEGER, description: "Horizontal scroll delta" },
        delta_y: {
          type: Type.INTEGER,
          description: "Vertical scroll delta (positive=down, negative=up)",
        },
      },
      required: ["x", "y", "delta_y"],
    },
  },
  {
    name: "wait",
    description:
      "Pause for milliseconds (e.g. waiting for page or animation to settle).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        ms: {
          type: Type.INTEGER,
          description: "Duration in milliseconds to wait",
        },
      },
    },
  },
  {
    name: "finish",
    description:
      "Declare the testing task complete or report final QA findings.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        summary: {
          type: Type.STRING,
          description: "Summary of the test run, results, and findings.",
        },
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

  private async captureScreenshot(): Promise<{
    base64: string;
    buffer: Buffer;
  }> {
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
        const btn = (
          action.button === "right"
            ? "right"
            : action.button === "middle"
              ? "middle"
              : "left"
        ) as "left" | "right" | "middle";
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
      case "drag": {
        if (action.path && action.path.length >= 2) {
          const start = action.path[0];
          const end = action.path[action.path.length - 1];
          await desktop.computer.mouse.drag({
            from: { x: start.x, y: start.y },
            to: { x: end.x, y: end.y },
          });
        }
        break;
      }
      case "scroll": {
        await desktop.computer.mouse.move({ x: action.x, y: action.y });
        const dir = (action.delta_y || 0) >= 0 ? "down" : "up";
        const amt = Math.max(
          1,
          Math.abs(Math.round((action.delta_y || 100) / 100)),
        );
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
      case "screenshot":
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

    // Initial conversation contents
    const contents: any[] = [];

    // Push previous textual conversation
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

        // 1. Take a screenshot of the CreateOS desktop
        const { base64 } = await this.captureScreenshot();

        // Add screenshot to current user turn for Gemini vision
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

        // 2. Query Gemini model with tools
        const response = await this.ai.models.generateContent({
          model: GEMINI_MODEL,
          contents,
          config: {
            systemInstruction: this.instructions,
            tools: [{ functionDeclarations: computerTools }],
            temperature: 0.2,
          },
        });

        const candidate = response.candidates?.[0];
        const parts = candidate?.content?.parts || [];

        // Yield any reasoning/text content
        for (const part of parts) {
          if (part.text) {
            yield {
              type: SSEEventType.REASONING,
              content: part.text,
            };
          }
        }

        // Look for function calls
        const functionCalls = parts
          .filter((p) => p.functionCall)
          .map((p) => p.functionCall!);

        if (!functionCalls || functionCalls.length === 0) {
          // Model completed without further tool calls
          const finalText = parts
            .map((p) => p.text || "")
            .join(" ")
            .trim();
          yield {
            type: SSEEventType.DONE,
            content: finalText || "Task complete.",
          };
          return;
        }

        const functionResponses: any[] = [];

        // Save model's turn
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

          // Map function call to OpenAIComputerAction shape for UI compatibility
          let uiAction: any = { type: callName, ...args };
          if (callName === "click") {
            uiAction = {
              type: "click",
              x: args.x,
              y: args.y,
              button: args.button || "left",
            };
          } else if (callName === "type") {
            uiAction = {
              type: "type",
              text: args.text,
            };
          } else if (callName === "keypress") {
            uiAction = {
              type: "keypress",
              keys: args.keys,
            };
          }

          yield {
            type: SSEEventType.ACTION,
            action: uiAction as OpenAIComputerAction,
          };

          // Execute action on CreateOS sandbox
          await this.executeAction(uiAction);

          yield {
            type: SSEEventType.ACTION_COMPLETED,
          };

          functionResponses.push({
            functionResponse: {
              name: callName,
              response: { status: "success", executed: true },
            },
          });
        }

        // Add function responses back to contents
        contents.push({
          role: "user",
          parts: functionResponses,
        });

        // Small wait between turns
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
