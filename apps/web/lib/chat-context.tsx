"use client";

import React, {
  createContext,
  useContext,
  useState,
  useRef,
  useCallback,
} from "react";
import {
  ChatMessage,
  ChatState,
  ParsedSSEEvent,
  SendMessageOptions,
  ActionChatMessage,
  UserChatMessage,
  AssistantChatMessage,
  SystemChatMessage,
} from "@/types/chat";
import { SSEEventType, TestResultData } from "@/types/api";
import { logDebug, logError } from "./logger";

interface ChatContextType extends ChatState {
  sendMessage: (options: SendMessageOptions) => Promise<void>;
  stopGeneration: () => void;
  clearMessages: () => void;
  setInput: (input: string) => void;
  input: string;
  handleSubmit: (e: React.FormEvent) => string | undefined;
  onSandboxCreated: (
    callback: (sandboxId: string, vncUrl: string) => void
  ) => void;
  testResult: TestResultData;
  setTestResult: React.Dispatch<React.SetStateAction<TestResultData>>;
  currentScreenshot: string | null;
}

const defaultTestResult: TestResultData = {
  status: "idle",
  logs: [],
};

const ChatContext = createContext<ChatContextType | undefined>(undefined);

interface ChatProviderProps {
  children: React.ReactNode;
}

export function ChatProvider({ children }: ChatProviderProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [testResult, setTestResult] = useState<TestResultData>(defaultTestResult);
  const [currentScreenshot, setCurrentScreenshot] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const onSandboxCreatedRef = useRef<
    ((sandboxId: string, vncUrl: string) => void) | undefined
  >(undefined);

  const parseSSEEvent = (data: string): any | null => {
    try {
      if (!data || data.trim() === "") return null;
      if (data.startsWith("data: ")) {
        const jsonStr = data.substring(6).trim();
        if (!jsonStr) return null;
        return JSON.parse(jsonStr);
      }
      return JSON.parse(data);
    } catch {
      return null;
    }
  };

  const sendMessage = async ({
    content,
    sandboxId,
    environment,
    resolution,
  }: SendMessageOptions) => {
    if (isLoading) return;

    setIsLoading(true);
    setError(null);
    setTestResult((prev) => ({
      ...prev,
      status: "running",
      objective: content,
      logs: [...prev.logs, `[Orbit QA] Starting test objective: ${content}`],
    }));

    const userMessage: ChatMessage = {
      role: "user",
      content,
      id: Date.now().toString(),
    };

    setMessages((prev) => [...prev, userMessage]);
    abortControllerRef.current = new AbortController();

    try {
      const apiMessages = messages
        .concat(userMessage)
        .filter((msg) => msg.role === "user" || msg.role === "assistant")
        .map((msg) => {
          const typedMsg = msg as UserChatMessage | AssistantChatMessage;
          return {
            role: typedMsg.role,
            content: typedMsg.content,
          };
        });

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: apiMessages,
          sandboxId,
          environment,
          resolution,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(await response.text());
      }

      if (!response.body) {
        throw new Error("No response body");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          const parsedEvent = parseSSEEvent(line);
          if (!parsedEvent) continue;

          switch (parsedEvent.type) {
            case SSEEventType.ACTION:
              if (parsedEvent.action) {
                setMessages((prev) => [
                  ...prev,
                  {
                    role: "action",
                    id: `action-${Date.now()}`,
                    action: parsedEvent.action,
                    status: "pending",
                  },
                ]);
              }
              break;

            case SSEEventType.ACTION_COMPLETED:
              setMessages((prev) => {
                const next = [...prev];
                let lastIdx = -1; for (let i = next.length - 1; i >= 0; i--) { if (next[i]?.role === "action") { lastIdx = i; break; } }
                if (lastIdx !== -1) {
                  (next[lastIdx] as ActionChatMessage).status = "completed";
                }
                return next;
              });
              break;

            case SSEEventType.REASONING:
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  id: `assistant-${Date.now()}`,
                  content: parsedEvent.content,
                },
              ]);
              break;

            case SSEEventType.SCREENSHOT:
              if (parsedEvent.base64) {
                setCurrentScreenshot(parsedEvent.base64);
              }
              break;

            case SSEEventType.TEST_UPDATE:
              if (parsedEvent.data) {
                setTestResult((prev) => ({
                  ...prev,
                  ...parsedEvent.data,
                }));
              }
              break;

            case SSEEventType.LOG:
              if (parsedEvent.line) {
                setTestResult((prev) => ({
                  ...prev,
                  logs: [...prev.logs, parsedEvent.line],
                }));
              }
              break;

            case SSEEventType.SANDBOX_CREATED:
              if (parsedEvent.sandboxId && onSandboxCreatedRef.current) {
                onSandboxCreatedRef.current(
                  parsedEvent.sandboxId,
                  parsedEvent.vncUrl
                );
              }
              break;

            case SSEEventType.DONE:
              setIsLoading(false);
              break;

            case SSEEventType.ERROR:
              setError(parsedEvent.content);
              setIsLoading(false);
              break;
          }
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setError(err.message || "Failed to execute request");
        setTestResult((prev) => ({
          ...prev,
          status: "failed",
          error: err.message,
          logs: [...prev.logs, `[Error] ${err.message}`],
        }));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsLoading(false);
  };

  const clearMessages = () => {
    setMessages([]);
    setTestResult(defaultTestResult);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return undefined;
    const content = input;
    setInput("");
    return content;
  };

  const onSandboxCreated = (
    callback: (sandboxId: string, vncUrl: string) => void
  ) => {
    onSandboxCreatedRef.current = callback;
  };

  return (
    <ChatContext.Provider
      value={{
        messages,
        isLoading,
        error,
        input,
        setInput,
        sendMessage,
        stopGeneration,
        clearMessages,
        handleSubmit,
        onSandboxCreated,
        testResult,
        setTestResult,
        currentScreenshot,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }
  return context;
}

