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
import { StripePricingModal } from "@/components/stripe-pricing-modal";
import { CreditCard, Sparkles } from "lucide-react";

export default function Home() {
  const [sandboxId, setSandboxId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [vncUrl, setVncUrl] = useState<string | null>(null);
  const { theme, setTheme } = useTheme();
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
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
  const [pricingModalOpen, setPricingModalOpen] = useState(false);
  const [allocatedMinutes, setAllocatedMinutes] = useState<number | null>(null);

  // Check URL query parameters on load for Stripe checkout success or require payment
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get("session_id");
    const plan = params.get("plan");
    const mins = params.get("minutes");

    if (sessionId) {
      fetch(`/api/verify-payment?session_id=${sessionId}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.paid) {
            const m = data.minutes || (mins ? parseInt(mins, 10) : 5);
            setAllocatedMinutes(m);
            setTimeRemaining(m * 60);
            localStorage.setItem("orbit_paid_access", "true");
            localStorage.setItem("orbit_selected_minutes", m.toString());
            setPricingModalOpen(false);
            toast.success(`Payment verified via Stripe! ${m}-minute CreateOS testing sandbox allocated.`);
            // Clean URL query
            window.history.replaceState({}, document.title, window.location.pathname);
          } else {
            setPricingModalOpen(true);
          }
        })
        .catch(() => {
          setPricingModalOpen(true);
        });
    } else {
      // Check verified active paid access from local storage
      const hasPaid = localStorage.getItem("orbit_paid_access") === "true";
      const savedMins = localStorage.getItem("orbit_selected_minutes");
      if (hasPaid && savedMins) {
        const m = parseInt(savedMins, 10);
        setAllocatedMinutes(m);
        setTimeRemaining(m * 60);
        setPricingModalOpen(false);
      } else {
        // Enforce payment modal before any sandbox or agent workflow is started
        setPricingModalOpen(true);
      }
    }
  }, []);

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
          setTimeRemaining(allocatedMinutes ? allocatedMinutes * 60 : 0);
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
    if (!allocatedMinutes) {
      e.preventDefault();
      setPricingModalOpen(true);
      toast.error("Please complete payment first to start your QA agent sandbox.");
      return;
    }
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
    if (!allocatedMinutes) {
      setPricingModalOpen(true);
      toast.error("Please complete payment first to start your QA agent sandbox.");
      return;
    }
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
    setTimeRemaining(allocatedMinutes ? allocatedMinutes * 60 : 300);
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
                        <Button
              onClick={() => setPricingModalOpen(true)}
              variant="outline"
              className="text-xs font-mono border-accent/40 hover:border-accent text-accent bg-accent/5 hover:bg-accent/15 flex items-center gap-1.5 py-1.5 px-3"
            >
              <CreditCard className="h-3.5 w-3.5" />
              <span>{allocatedMinutes ? `${allocatedMinutes}m Active` : "Pricing Plans"}</span>
            </Button>
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
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center gap-5">
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/30 text-accent font-mono text-xs">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Orbit QA Agent</span>
                </div>
                <h2 className="text-lg sm:text-xl font-mono font-bold max-w-md text-fg">
                  Autonomous Web Workflow Testing & Failure Diagnosis
                </h2>
                <p className="text-xs sm:text-sm text-fg-400 max-w-lg leading-relaxed font-sans">
                  Orbit QA automatically tests web workflows, detects failures, generates reproducible Playwright tests, and helps developers diagnose and verify fixes using isolated CreateOS sandboxes.
                </p>
                {!allocatedMinutes && (
                  <Button
                    onClick={() => setPricingModalOpen(true)}
                    className="mt-2 text-xs font-mono bg-accent text-black hover:bg-accent/90 font-bold px-5 py-2.5 flex items-center gap-2"
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Choose Plan to Start Sandbox</span>
                  </Button>
                )}
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
              <StripePricingModal
          open={pricingModalOpen}
          onOpenChange={setPricingModalOpen}
          allocatedMinutes={allocatedMinutes}
          mandatory={!allocatedMinutes}
          onPlanSelected={(mins) => {
            setAllocatedMinutes(mins);
            setTimeRemaining(mins * 60);
          }}
        />
      </Frame>
    </div>
  );
}










