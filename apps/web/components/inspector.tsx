"use client";

import React, { useState } from "react";
import { useChat } from "@/lib/chat-context";
import {
  AlertCircle,
  CheckCircle2,
  Code2,
  FileText,
  GitPullRequest,
  Terminal,
  Maximize2,
  Copy,
  Check,
} from "lucide-react";
import { Button } from "@repo/ui";
import { toast } from "sonner";

export function Inspector() {
  const [activeTab, setActiveTab] = useState<"results" | "logs" | "code">("results");
  const { testResult, currentScreenshot } = useChat();
  const [copied, setCopied] = useState(false);

  const copyCode = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full bg-bg-100 dark:bg-bg-200 border border-border rounded-lg overflow-hidden font-sans">
      {/* Header with Tabs */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-bg-200/50 dark:bg-bg-300/30">
        <div className="flex items-center gap-2">
          <Maximize2 className="h-4 w-4 text-accent" />
          <span className="font-semibold text-xs tracking-wider uppercase font-mono">
            Inspector
          </span>
        </div>

        <div className="flex items-center gap-1 bg-bg-300/60 dark:bg-bg-400/30 p-0.5 rounded-md text-xs">
          <button
            onClick={() => setActiveTab("results")}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeTab === "results"
                ? "bg-bg text-fg font-medium shadow-sm"
                : "text-fg-300 hover:text-fg"
            }`}
          >
            Results
          </button>
          <button
            onClick={() => setActiveTab("logs")}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeTab === "logs"
                ? "bg-bg text-fg font-medium shadow-sm"
                : "text-fg-300 hover:text-fg"
            }`}
          >
            Logs
          </button>
          <button
            onClick={() => setActiveTab("code")}
            className={`px-2.5 py-1 rounded transition-colors ${
              activeTab === "code"
                ? "bg-bg text-fg font-medium shadow-sm"
                : "text-fg-300 hover:text-fg"
            }`}
          >
            Code
          </button>
        </div>
      </div>

      {/* Tab Contents */}
      <div className="flex-1 overflow-y-auto p-3 text-xs space-y-3">
        {activeTab === "results" && (
          <div className="space-y-3">
            <div>
              <div className="text-[10px] uppercase font-mono tracking-wider text-fg-400 mb-1">
                Current Test Result
              </div>
              <div className="flex items-start gap-2 p-2.5 rounded-md border border-border bg-bg/50">
                {testResult.status === "failed" ? (
                  <AlertCircle className="h-4 w-4 text-error shrink-0 mt-0.5" />
                ) : testResult.status === "passed" ? (
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0 mt-0.5" />
                ) : (
                  <Terminal className="h-4 w-4 text-fg-300 shrink-0 mt-0.5" />
                )}

                <div className="space-y-1">
                  <div className="font-medium text-fg">
                    {testResult.status === "failed"
                      ? "Failure Detected"
                      : testResult.status === "passed"
                      ? "Test Passed Successfully"
                      : testResult.status === "running"
                      ? "Running Playwright workflow..."
                      : "Awaiting test run"}
                  </div>
                  <div className="text-fg-300 text-[11px] leading-relaxed">
                    {testResult.failedStep ||
                      testResult.objective ||
                      "Trigger a test flow from the agent chat below."}
                  </div>
                </div>
              </div>
            </div>

            {testResult.expected && (
              <div className="p-2.5 rounded-md border border-border bg-bg/30 space-y-1.5">
                <div className="text-[10px] font-mono uppercase text-fg-400">
                  Assertion Comparison
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-1.5 rounded bg-success/10 border border-success/20 text-success">
                    <span className="font-mono text-[9px] uppercase block opacity-75">
                      Expected
                    </span>
                    {testResult.expected}
                  </div>
                  <div className="p-1.5 rounded bg-error/10 border border-error/20 text-error">
                    <span className="font-mono text-[9px] uppercase block opacity-75">
                      Actual
                    </span>
                    {testResult.actual || "Assertion condition failed"}
                  </div>
                </div>
              </div>
            )}

            {testResult.diagnosis && (
              <div className="p-2.5 rounded-md border border-border bg-bg/30 space-y-1">
                <div className="flex items-center justify-between text-[10px] font-mono uppercase text-fg-400">
                  <span>AI Diagnosis</span>
                  {testResult.confidence && (
                    <span className="text-accent font-semibold">
                      {(testResult.confidence * 100).toFixed(0)}% Confidence
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-fg-200 leading-relaxed whitespace-pre-wrap">
                  {testResult.diagnosis}
                </div>
              </div>
            )}

            {/* Failure Screenshot thumbnail */}
            {(testResult.screenshot || currentScreenshot) && (
              <div className="space-y-1">
                <div className="text-[10px] font-mono uppercase text-fg-400 flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  <span>Captured Evidence</span>
                </div>
                <div className="rounded border border-border overflow-hidden max-h-40 bg-black flex items-center justify-center">
                  <img
                    src={testResult.screenshot || currentScreenshot!}
                    alt="Failure Evidence"
                    className="object-contain max-h-40 w-auto"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === "logs" && (
          <div className="font-mono text-[11px] leading-relaxed space-y-1 bg-black/40 p-2.5 rounded border border-border min-h-[140px] text-fg-200">
            {testResult.logs.length === 0 ? (
              <div className="text-fg-400 italic">No execution logs yet.</div>
            ) : (
              testResult.logs.map((log, idx) => (
                <div
                  key={idx}
                  className={
                    log.startsWith("[ERROR]") || log.includes("failed")
                      ? "text-error"
                      : log.startsWith("$")
                      ? "text-accent font-semibold"
                      : log.startsWith("[Orbit QA]")
                      ? "text-contrast-1"
                      : "text-fg-200"
                  }
                >
                  {log}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "code" && (
          <div className="space-y-3 font-mono text-[11px]">
            <div>
              <div className="flex items-center justify-between text-[10px] uppercase text-fg-400 mb-1">
                <span className="flex items-center gap-1">
                  <Code2 className="h-3 w-3" /> Playwright Test
                </span>
                {testResult.playwrightCode && (
                  <button
                    onClick={() => copyCode(testResult.playwrightCode!)}
                    className="hover:text-fg text-fg-400 flex items-center gap-1"
                  >
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    <span>Copy</span>
                  </button>
                )}
              </div>
              <pre className="p-2 rounded bg-bg-300/40 border border-border overflow-x-auto text-fg-100 max-h-48">
                <code>
                  {testResult.playwrightCode ||
                    `import { test, expect } from '@playwright/test';\n\ntest('orbit-qa reproducible bug verification', async ({ page }) => {\n  // Generated on test execution failure\n});`}
                </code>
              </pre>
            </div>

            {testResult.diffPatch && (
              <div>
                <div className="flex items-center justify-between text-[10px] uppercase text-fg-400 mb-1">
                  <span className="flex items-center gap-1 text-accent font-semibold">
                    <GitPullRequest className="h-3 w-3" /> Proposed Fix Diff
                  </span>
                </div>
                <pre className="p-2 rounded bg-black/60 border border-accent/30 overflow-x-auto text-[11px] leading-tight">
                  <code>
                    {testResult.diffPatch.split("\n").map((line, i) => (
                      <div
                        key={i}
                        className={
                          line.startsWith("+")
                            ? "text-success bg-success/10"
                            : line.startsWith("-")
                            ? "text-error bg-error/10"
                            : "text-fg-300"
                        }
                      >
                        {line}
                      </div>
                    ))}
                  </code>
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
