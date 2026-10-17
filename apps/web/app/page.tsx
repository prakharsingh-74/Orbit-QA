"use client";

import { useRef, useState, useEffect } from "react";
import {
  MoonIcon,
  SunIcon,
  Timer,
  Power,
  Menu,
  X,
  ArrowUpRight,
} from "lucide-react";
import { useTheme } from "next-themes";
import { toast } from "sonner";
import { increaseTimeout, stopSandboxAction } from "@/app/actions";
import { motion, AnimatePresence } from "framer-motion";
import { ChatList } from "@/components/chat/message-list";
import { ChatInput } from "@/components/chat/input";
import { ExamplePrompts } from "@/components/chat/example-prompts";
import { useChat } from "@/lib/chat-context";
import { Frame } from "@repo/ui";
import { Button } from "@repo/ui";
import { Loader, AssemblyLoader } from "@repo/ui";
import Link from "next/link";
import { RepoBanner } from "@/components/repo-banner";
import { SANDBOX_TIMEOUT_MS } from "@/lib/config";
import { Surfing } from "@repo/ui";
import { Inspector } from "@/components/inspector";

export default function Home() {
  const [sandboxId, setSandboxId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [vncUrl, setVncUrl] = useState<string | null>(null);
  const { theme, setTheme } = useTheme();
  const [timeRemaining, setTimeRemaining] = useState<number>(
    SANDBOX_TIMEOUT_MS / 1000
  );
  const [isTabVisible, setIsTabVisible] = useState<boolean>(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const iFrameWrapperRef = useRef<HTMLDivElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [leftWidthPercent, setLeftWidthPercent] = useState<number>(55);
  const [inspectorHeightPercent, setInspectorHeightPercent] = useState<number>(50);
  const [isVerticalDragging, setIsVerticalDragging] = useState(false);
  const rightColumnRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && splitContainerRef.current) {
        const rect = splitContainerRef.current.getBoundingClientRect();
        const newPercent = ((e.clientX - rect.left) / rect.width) * 100;
        setLeftWidthPercent(Math.min(Math.max(newPercent, 25), 75));
      }
      if (isVerticalDragging && rightColumnRef.current) {
        const rect = rightColumnRef.current.getBoundingClientRect();
        const newVPercent = ((e.clientY - rect.top) / rect.height) * 100;
        setInspectorHeightPercent(Math.min(Math.max(newVPercent, 20), 70));
      }
    };

    const handleMouseUp = () => {
      if (isDragging) setIsDragging(false);
      if (isVerticalDragging) setIsVerticalDragging(false);
    };
    if (isDragging || isVerticalDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, isVerticalDragging]);

  const {
    messages,
    isLoading: chatLoading,
    input,
    setInput,
    sendMessage,
    stopGeneration,
    clearMessages,
    handleSubmit,
    onSandboxCreated,
  } = useChat();

  useEffect(() => {
    const handleVisibilityChange = () => {
      setIsTabVisible(document.visibilityState === "visible");
    };

    setIsTabVisible(document.visibilityState === "visible");

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  const stopSandbox = async () => {
    if (sandboxId) {
      try {
        stopGeneration();
        const success = await stopSandboxAction(sandboxId);
        if (success) {
          setSandboxId(null);
          setVncUrl(null);
          clearMessages();
          setTimeRemaining(SANDBOX_TIMEOUT_MS / 1000);
          toast("Sandbox instance stopped");
        } else {
          toast.error("Failed to stop sandbox instance");
        }
      } catch (error) {
        console.error("Failed to stop sandbox:", error);
        toast.error("Failed to stop sandbox");
      }
    }
  };

  const handleIncreaseTimeout = async () => {
    if (!sandboxId) return;

    try {
      await increaseTimeout(sandboxId);
      setTimeRemaining(SANDBOX_TIMEOUT_MS / 1000);
      toast.success("Instance time increased");
    } catch (error) {
      console.error("Failed to increase time:", error);
      toast.error("Failed to increase time");
    }
  };

  const onSubmit = (e: React.FormEvent) => {
    const content = handleSubmit(e);
    if (content) {
      const width =
        iFrameWrapperRef.current?.clientWidth ||
        (window.innerWidth < 768 ? window.innerWidth - 32 : 1024);
      const height =
        iFrameWrapperRef.current?.clientHeight ||
        (window.innerWidth < 768
          ? Math.min(window.innerHeight * 0.4, 400)
          : 768);

      sendMessage({
        content,
        sandboxId: sandboxId || undefined,
        environment: "linux",
        resolution: [width, height],
      });
    }
  };

  const handleExampleClick = (prompt: string) => {
    const width =
      iFrameWrapperRef.current?.clientWidth ||
      (window.innerWidth < 768 ? window.innerWidth - 32 : 1024);
    const height =
      iFrameWrapperRef.current?.clientHeight ||
      (window.innerWidth < 768 ? Math.min(window.innerHeight * 0.4, 400) : 768);

    sendMessage({
      content: prompt,
      sandboxId: sandboxId || undefined,
      environment: "linux",
      resolution: [width, height],
    });
  };

  const handleSandboxCreated = (newSandboxId: string, newVncUrl: string) => {
    setSandboxId(newSandboxId);
    setVncUrl(newVncUrl);
    setTimeRemaining(SANDBOX_TIMEOUT_MS / 1000);
    toast.success("Sandbox instance created");
  };

  const handleClearChat = () => {
    clearMessages();
    toast.success("Chat cleared");
  };

  const ThemeToggle = () => (
    <Button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      variant="outline"
      size="icon"
      suppressHydrationWarning
    >
      {theme === "dark" ? (
        <SunIcon className="h-5 w-5" suppressHydrationWarning />
      ) : (
        <MoonIcon className="h-5 w-5" suppressHydrationWarning />
      )}
    </Button>
  );

  useEffect(() => {
    if (!sandboxId) return;
    const interval = setInterval(() => {
      if (isTabVisible) {
        setTimeRemaining((prev) => (prev > 0 ? prev - 1 : 0));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [sandboxId, isTabVisible]);

  useEffect(() => {
    if (!sandboxId) return;

    if (timeRemaining === 10 && isTabVisible) {
      handleIncreaseTimeout();
    }

    if (timeRemaining === 0) {
      setSandboxId(null);
      setVncUrl(null);
      clearMessages();
      stopGeneration();
      toast.error("Instance time expired");
      setTimeRemaining(SANDBOX_TIMEOUT_MS / 1000);
    }
  }, [timeRemaining, sandboxId, stopGeneration, clearMessages, isTabVisible]);

  useEffect(() => {
    onSandboxCreated((newSandboxId: string, newVncUrl: string) => {
      handleSandboxCreated(newSandboxId, newVncUrl);
    });
  }, [onSandboxCreated]);

  return (
    <div className="w-full flex justify-center items-center h-dvh overflow-hidden p-2 sm:p-4 md:p-8 md:pb-10">
      <Frame
        classNames={{
          wrapper: "w-full h-full max-w-[2200px]",
          frame: "flex flex-col h-full overflow-hidden",
        }}
      >
        <div className="border-b w-full px-2 sm:px-3 py-2 flex items-center justify-between h-auto">
          <div className="flex flex-1 items-center text-base sm:text-lg truncate">
            <Link
              href="/"
              className="flex items-center gap-1 sm:gap-2"
              target="_blank"
            >

              <h1 className="whitespace-pre font-mono font-semibold tracking-wide">Orbit QA</h1>
            </Link>
          </div>

          <div className="md:hidden">
            <Button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              variant="ghost"
              size="icon"
              className="mr-1"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </Button>
          </div>

          <div className="hidden lg:flex items-center gap-2">
            <ThemeToggle />
            <RepoBanner />

            <AnimatePresence>
              {sandboxId && (
                <motion.div
                  className="flex items-center gap-2"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <Button
                    onClick={handleIncreaseTimeout}
                    variant="muted"
                    title={
                      isTabVisible
                        ? "Increase Time"
                        : "Timer paused (tab not active)"
                    }
                  >
                    <Timer
                      className={`h-3 w-3 ${!isTabVisible ? "text-fg-400" : ""
                        }`}
                    />
                    <span
                      className={`text-xs font-medium ${!isTabVisible ? "text-fg-400" : ""
                        }`}
                    >
                      {Math.floor(timeRemaining / 60)}:
                      {(timeRemaining % 60).toString().padStart(2, "0")}
                      {!isTabVisible && " (paused)"}
                    </span>
                  </Button>

                  <Button
                    onClick={stopSandbox}
                    variant="error"
                    className="text-xs"
                  >
                    <Power className="w-3 h-3" />
                    Stop
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="lg:hidden flex items-center">
            <AnimatePresence>
              {sandboxId && (
                <motion.div
                  className="flex items-center gap-1"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  <Button
                    onClick={handleIncreaseTimeout}
                    variant="muted"
                    size="sm"
                    title={
                      isTabVisible
                        ? "Increase Time"
                        : "Timer paused (tab not active)"
                    }
                    className="px-1.5"
                  >
                    <Timer
                      className={`h-3 w-3 ${!isTabVisible ? "text-fg-400" : ""
                        }`}
                    />
                    <span
                      className={`text-xs font-medium ml-1 ${!isTabVisible ? "text-fg-400" : ""
                        }`}
                    >
                      {Math.floor(timeRemaining / 60)}:
                      {(timeRemaining % 60).toString().padStart(2, "0")}
                    </span>
                  </Button>

                  <Button
                    onClick={stopSandbox}
                    variant="error"
                    size="sm"
                    className="text-xs px-1.5"
                  >
                    <Power className="w-3 h-3" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              className="lg:hidden border-b p-2 flex items-center justify-between"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
            >
              <div className="flex items-center gap-2">
                <ThemeToggle />
                <RepoBanner />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={splitContainerRef} className={`flex flex-col lg:flex-row flex-1 overflow-hidden ${isDragging ? "cursor-col-resize select-none" : ""}`}>
          <div
            ref={iFrameWrapperRef}
            style={{ width: typeof window !== "undefined" && window.innerWidth >= 1024 ? `${leftWidthPercent}%` : undefined }}
            className="relative w-full h-[40vh] lg:h-auto overflow-hidden flex-shrink-0"
          >
            {isLoading || (chatLoading && !sandboxId) ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <div className="flex items-center gap-3">
                  <h2 className="text-xl font-light text-accent">
                    {isLoading ? "Starting instance" : "Creating sandbox..."}
                  </h2>
                  <Loader variant="square" className="text-accent" />
                </div>

                <AssemblyLoader
                  className="mt-4 text-fg-300"
                  gridWidth={8}
                  gridHeight={4}
                  filledChar="■"
                  emptyChar="□"
                />

                <p className="text-sm text-fg-500 mt-4">
                  {isLoading
                    ? "Preparing your sandbox environment..."
                    : "Creating a new sandbox for your request..."}
                </p>
              </div>
            ) : sandboxId && vncUrl ? (
              <iframe
                ref={iframeRef}
                src={vncUrl}
                className="w-full h-full"
                allow="clipboard-read; clipboard-write"
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
                <Surfing className="text-[7px] leading-[7px] text-accent font-bold" />
                <h1 className="text-center text-fg-300 max-w-xs">
                  <span className="text-fg">Type</span> a message or{" "}
                  <span className="text-fg">select</span> an example prompt to
                  start a new{" "}
                  <a
                    href="https://github.com/prakharsingh-74/Orbit-QA"
                    className="underline inline-flex items-center gap-1 decoration-accent decoration-1 underline-offset-2 text-accent"
                    target="_blank"
                  >
                    sandbox <ArrowUpRight className="size-4" />
                  </a>
                </h1>
              </div>
            )}
          </div>

          {/* Resizable drag handle line */}
          <div
            onMouseDown={() => setIsDragging(true)}
            className="hidden lg:flex items-center justify-center w-2 -mx-1 z-30 cursor-col-resize group relative hover:bg-accent/40 active:bg-accent transition-colors duration-150 select-none"
            title="Drag to resize panels"
          >
            <div className="w-[1px] h-full bg-border group-hover:bg-accent transition-colors" />
            <div className="absolute w-4 h-8 bg-bg-200 border border-border rounded-full flex items-center justify-center shadow-md group-hover:border-accent">
              <div className="w-1 h-3 border-x border-fg-400 opacity-60" />
            </div>
          </div>

          {/* Right panel - Split Vertically between Inspector & Chat */}
          <div
            ref={rightColumnRef}
            style={{ width: typeof window !== "undefined" && window.innerWidth >= 1024 ? `${100 - leftWidthPercent}%` : undefined }}
            className={`flex-1 flex flex-col relative border-t lg:border-t-0 overflow-hidden h-[60vh] lg:h-auto ${isVerticalDragging ? "cursor-row-resize select-none" : ""}`}
          >
            {/* Top Section: Inspector */}
            <div style={{ height: `${inspectorHeightPercent}%` }} className="w-full overflow-hidden p-2.5 pb-0 flex flex-col min-h-[180px] shrink-0">
              <Inspector />
            </div>

            {/* Draggable Vertical Adjuster */}
            <div
              onMouseDown={() => setIsVerticalDragging(true)}
              className="h-2 w-full my-0.5 cursor-row-resize group relative flex items-center justify-center hover:bg-accent/20 active:bg-accent/40 select-none transition-colors z-20"
              title="Drag to resize Inspector and Chat"
            >
              <div className="h-[1px] w-full bg-border group-hover:bg-accent transition-colors" />
              <div className="absolute h-3 w-8 bg-bg-200 border border-border rounded-full flex items-center justify-center shadow-sm group-hover:border-accent">
                <div className="h-1 w-3 border-y border-fg-400 opacity-60" />
              </div>
            </div>

            {/* Bottom Section: Chat */}
            <div style={{ height: `${100 - inspectorHeightPercent}%` }} className="w-full flex-1 flex flex-col relative overflow-hidden min-h-[180px]">
            <ChatList className="flex-1" messages={messages} />

            {messages.length === 0 && (
              <ExamplePrompts
                onPromptClick={handleExampleClick}
                disabled={false}
                className="-translate-y-16"
              />
            )}

            <ChatInput
              input={input}
              setInput={setInput}
              onSubmit={onSubmit}
              isLoading={chatLoading}
              onStop={stopGeneration}
              disabled={false}
              className="absolute bottom-3 left-3 right-3"
            />
          </div>
          </div>
        </div>
      </Frame>
    </div>
  );
}










