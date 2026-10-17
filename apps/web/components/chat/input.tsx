"use client";

import React, { useMemo } from "react";
import { ChevronsRight, StopCircle, Send } from "lucide-react";
import { Button } from "@repo/ui";
import { cn } from "@/lib/utils";
import { Input } from "@repo/ui";
import { motion } from "motion/react";

interface ChatInputProps {
  input: string;
  setInput: (input: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  isLoading: boolean;
  onStop: () => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}

/**
 * Chat input component with submit and stop buttons
 */
export function ChatInput({
  input,
  setInput,
  onSubmit,
  isLoading,
  onStop,
  disabled = false,
  placeholder = "Describe a workflow to test (e.g. Test signup validation)...",
  className,
}: ChatInputProps) {
  const isInputEmpty = useMemo(() => input.trim() === "", [input]);

  return (
    <form onSubmit={onSubmit} className={cn("w-full", className)}>
      <div className="flex items-center w-full">
        <div className="relative w-full flex items-center">
          <Input
            placeholder={placeholder}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoFocus
            required
            disabled={disabled}
            className="w-full h-14 pl-4 pr-24 text-sm font-mono"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
            {isLoading ? (
              <Button
                type="button"
                onClick={onStop}
                variant="error"
                className="h-10 px-4 text-xs font-semibold gap-1.5 shadow-sm"
                disabled={disabled}
                title="Stop generating"
              >
                <StopCircle className="w-4 h-4" />
                <span>Stop</span>
              </Button>
            ) : (
              <Button
                type="submit"
                variant="accent"
                className="h-10 px-4 text-xs font-semibold gap-1.5 shadow-sm hover:brightness-110 active:scale-95"
                disabled={disabled || isInputEmpty}
                title="Send message"
              >
                <span>Send</span>
                <motion.span
                  animate={{
                    x: isInputEmpty ? 0 : 2,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 500,
                    damping: 20,
                  }}
                >
                  <ChevronsRight className="w-4 h-4" />
                </motion.span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
