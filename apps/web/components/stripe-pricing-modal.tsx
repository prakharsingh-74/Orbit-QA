"use client";

import React, { useState } from "react";
import { Button } from "@repo/ui";
import { Zap, Clock, ShieldCheck, Check, Sparkles, Loader2, CreditCard, X, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";

interface StripePricingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allocatedMinutes?: number | null;
  onPlanSelected?: (minutes: number) => void;
}

export function StripePricingModal({
  open,
  onOpenChange,
  allocatedMinutes,
  onPlanSelected,
}: StripePricingModalProps) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const plans = [
    {
      id: "tier_5",
      minutes: 5,
      price: "$3",
      cents: 300,
      label: "Quick Smoke Test",
      description: "Ideal for testing a single page, login flow, or quick critical path.",
      features: [
        "5 minutes dedicated VM execution",
        "Autonomous Gemini browser control",
        "Playwright test generator",
        "Live VNC screen streaming",
      ],
      popular: false,
    },
    {
      id: "tier_10",
      minutes: 10,
      price: "$5",
      cents: 500,
      label: "Full Workflow QA",
      description: "Best for comprehensive testing, multi-step forms, and diagnosing failures.",
      features: [
        "10 minutes dedicated VM execution",
        "Self-healing Playwright assertions",
        "Full console and visual error logs",
        "Automated code diff patch proposal",
      ],
      popular: true,
    },
    {
      id: "tier_15",
      minutes: 15,
      price: "$20",
      cents: 2000,
      label: "Deep Regression & Fix",
      description: "Extended session for edge case discovery, regression, and verified fixes.",
      features: [
        "15 minutes dedicated VM execution",
        "Full test suite reproduction",
        "Zero-latency persistent instance",
        "Downloadable test & patch artifacts",
      ],
      popular: false,
    },
  ];

  const handleCheckout = async (planId: string, minutes: number) => {
    try {
      setLoadingPlan(planId);
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId }),
      });

      const data = await res.json();

      if (!res.ok || !data.url) {
        throw new Error(data.error || "Failed to start checkout");
      }

      // Save pending plan locally
      localStorage.setItem("orbit_selected_plan", planId);
      localStorage.setItem("orbit_selected_minutes", minutes.toString());

      // Redirect directly to Stripe Checkout
      window.location.href = data.url;
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to launch Stripe checkout.");
      setLoadingPlan(null);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-4xl p-6 sm:p-8 bg-bg-100 dark:bg-bg-200 border border-border text-fg rounded-xl shadow-2xl overflow-hidden"
          >
            {/* Close Button */}
            <button
              onClick={() => onOpenChange(false)}
              className="absolute top-4 right-4 text-fg-400 hover:text-fg transition-colors p-1 rounded-md"
              title="Close modal"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Header */}
            <div className="space-y-2 text-center pb-2">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/15 border border-accent/30 text-accent">
                <Zap className="h-6 w-6" />
              </div>
              <div className="flex items-center justify-center gap-2">
                <h2 className="text-2xl sm:text-3xl font-mono font-bold tracking-tight">
                  Choose Your Sandbox Runtime
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-[11px] font-mono font-semibold tracking-wider uppercase">
                  TEST CARD MODE
                </span>
              </div>
              <p className="text-fg-400 text-xs sm:text-sm max-w-lg mx-auto">
                Select your instance duration. Secure payment is processed via Stripe in test mode,
                allocating your dedicated CreateOS browser VM for the selected runtime.
              </p>

              {/* Test Card Banner */}
              <div className="mx-auto max-w-lg mt-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 flex items-center justify-between text-xs font-mono text-amber-300">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 shrink-0 text-amber-400" />
                  <span>Test Card: <code className="bg-black/40 px-1.5 py-0.5 rounded text-amber-200 font-bold">4242 •••• •••• 4242</code></span>
                </div>
                <div className="text-[11px] text-amber-400/80">Any date / CVC 123</div>
              </div>
            </div>

            {/* Pricing Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
              {plans.map((plan) => {
                const isSelected = allocatedMinutes === plan.minutes;
                const isLoading = loadingPlan === plan.id;

                return (
                  <div
                    key={plan.id}
                    className={`relative flex flex-col justify-between rounded-xl p-5 border transition-all duration-200 ${
                      plan.popular
                        ? "border-accent bg-accent/[0.04] shadow-md shadow-accent/5 ring-1 ring-accent"
                        : "border-border bg-bg-200/50 hover:border-fg-400"
                    }`}
                  >
                    {plan.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-accent text-[11px] font-mono font-semibold text-black flex items-center gap-1 shadow-sm">
                        <Sparkles className="h-3 w-3" /> MOST POPULAR
                      </div>
                    )}

                    <div>
                      <div className="flex items-center justify-between">
                        <h3 className="font-mono font-bold text-base text-fg">{plan.label}</h3>
                        <div className="flex items-center gap-1 text-xs font-mono text-accent">
                          <Clock className="h-3.5 w-3.5" />
                          <span>{plan.minutes} mins</span>
                        </div>
                      </div>

                      <div className="mt-4 flex items-baseline gap-1">
                        <span className="text-3xl font-extrabold font-mono tracking-tight text-fg">
                          {plan.price}
                        </span>
                        <span className="text-xs text-fg-400 font-mono">/ session</span>
                      </div>

                      <p className="mt-2 text-xs text-fg-300 leading-relaxed min-h-[36px]">
                        {plan.description}
                      </p>

                      <div className="mt-5 space-y-2 border-t border-border/60 pt-4">
                        {plan.features.map((feature, i) => (
                          <div key={i} className="flex items-start gap-2 text-xs text-fg-300">
                            <Check className="h-3.5 w-3.5 text-accent shrink-0 mt-0.5" />
                            <span>{feature}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="mt-6">
                      <Button
                        onClick={() => handleCheckout(plan.id, plan.minutes)}
                        disabled={isLoading || isSelected}
                        className={`w-full font-mono text-xs py-2.5 flex items-center justify-center gap-2 ${
                          plan.popular
                            ? "bg-accent text-black hover:bg-accent/90 font-bold"
                            : "bg-bg-300 text-fg hover:bg-bg-400 border border-border"
                        }`}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            <span>Launching Stripe...</span>
                          </>
                        ) : isSelected ? (
                          <>
                            <Check className="h-3.5 w-3.5" />
                            <span>Active ({plan.minutes}m)</span>
                          </>
                        ) : (
                          <>
                            <CreditCard className="h-3.5 w-3.5" />
                            <span>Test Pay {plan.price}</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="mt-6 pt-3 border-t border-border/40 flex items-center justify-between text-xs text-fg-400">
              <div className="flex items-center gap-1.5 font-mono">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>Stripe Test Mode Activated</span>
              </div>
              <div className="font-mono text-[11px]">
                Instant CreateOS Sandbox Allocation
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
