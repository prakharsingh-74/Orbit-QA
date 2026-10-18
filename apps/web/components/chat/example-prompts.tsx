"use client";

import React from "react";
import { ShieldCheck, Terminal } from "lucide-react";
import { Button } from "@repo/ui";
import { cn } from "@/lib/utils";

interface ExamplePromptProps {
  text: string;
  onClick: () => void;
  disabled?: boolean;
}

export function ExamplePrompt({ text, onClick, disabled }: ExamplePromptProps) {
  return (
    <Button
      onClick={onClick}
      variant="outline"
      size="lg"
      className="text-left whitespace-normal text-xs sm:text-sm h-auto py-2.5 px-3 sm:px-4 font-mono border-border hover:border-accent hover:text-accent transition-colors flex items-center gap-2"
      disabled={disabled}
    >
      {text}
    </Button>
  );
}

interface ExamplePromptsProps {
  onPromptClick: (prompt: string) => void;
  prompts?: Array<{ text: string; prompt: string }>;
  disabled?: boolean;
  className?: string;
}

export function ExamplePrompts({
  onPromptClick,
  prompts = [
    {
      text: "Test Web Workflow and Detect Failures",
      prompt:
        "Automatically test web workflows, detect failures, generate reproducible Playwright tests, and diagnose fixes using isolated CreateOS sandbox",
    },
    {
      text: "Reproduce Checkout Form Bugs",
      prompt:
        "Open browser, test user checkout form validation, check console errors and generate Playwright test spec",
    },
    {
      text: "Diagnose Broken UI and Verify Fix",
      prompt:
        "Navigate to target web application, inspect failed network requests, identify broken DOM element, and diagnose fixes",
    },
  ],
  disabled = false,
  className,
}: ExamplePromptsProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 sm:gap-4 mx-auto my-4 sm:my-6 w-full max-w-[700px] px-4",
        className
      )}
    >
      <div className="flex items-center gap-2 text-accent font-mono text-xs sm:text-sm">
        <ShieldCheck className="w-4 h-4" />
        <span>Try QA Agent Workflows</span>
      </div>
      <div className="flex flex-wrap gap-2 justify-center w-full px-2 sm:px-0 pb-2">
        {prompts.map((item, index) => (
          <ExamplePrompt
            key={index}
            text={item.text}
            onClick={() => onPromptClick(item.prompt)}
            disabled={disabled}
          />
        ))}
      </div>
    </div>
  );
}
