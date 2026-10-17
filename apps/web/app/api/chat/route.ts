import { CreateosSandboxClient, Sandbox } from "@nodeops-createos/sandbox";
import { SSEEvent, SSEEventType } from "@/types/api";
import {
  ComputerInteractionStreamerFacade,
  createStreamingResponse,
} from "@/lib/streaming";
import { GeminiComputerStreamer } from "@/lib/streaming/gemini";
import { logError } from "@/lib/logger";

export const maxDuration = 800;

export async function POST(request: Request) {
  const abortController = new AbortController();
  const { signal } = abortController;

  request.signal.addEventListener("abort", () => {
    abortController.abort();
  });

  const {
    messages,
    sandboxId,
    resolution,
  } = await request.json();

  const apiKey = process.env.CREATEOS_SANDBOX_API_KEY;
  const baseUrl = process.env.CREATEOS_SANDBOX_BASE_URL || "https://api-eu.sb.createos.sh/";

  if (!apiKey) {
    return new Response("CreateOS Sandbox API key not found", { status: 500 });
  }

  const client = new CreateosSandboxClient({
    baseUrl,
    apiKey,
  });

  let desktop: Sandbox | undefined;
  let activeSandboxId = sandboxId;
  let vncUrl: string | undefined;

  try {
    if (!activeSandboxId) {
      const newSandbox = await client.createSandbox({
        shape: "s-1vcpu-1gb",
        rootfs: "desktop:1",
        ingress_enabled: true,
      });

      activeSandboxId = newSandbox.id;
      desktop = newSandbox;

      const screens = await newSandbox.computer.screens.list();
      if (screens && screens.length > 0 && screens[0]) {
        const screenId = screens[0].screen_id;
        const conn = await newSandbox.computer.screens.connect(screenId);
        vncUrl = conn.url;
      }
    } else {
      desktop = await client.getSandbox(activeSandboxId);
    }

    if (!desktop) {
      return new Response("Failed to connect to sandbox", { status: 500 });
    }

    try {
      const streamer: ComputerInteractionStreamerFacade =
        new GeminiComputerStreamer(desktop, resolution);

      if (!sandboxId && activeSandboxId && vncUrl) {
        async function* stream(): AsyncGenerator<SSEEvent> {
          yield {
            type: SSEEventType.SANDBOX_CREATED,
            sandboxId: activeSandboxId,
            vncUrl: vncUrl as string,
          };

          yield* streamer.stream({ messages, signal });
        }

        return createStreamingResponse(stream());
      } else {
        return createStreamingResponse(streamer.stream({ messages, signal }));
      }
    } catch (error) {
      logError("Error from streaming service:", error);

      return new Response(
        "An error occurred with the AI service. Please try again.",
        { status: 500 }
      );
    }
  } catch (error) {
    logError("Error connecting to CreateOS sandbox:", error);
    return new Response("Failed to connect to sandbox", { status: 500 });
  }
}
