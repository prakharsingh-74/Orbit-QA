"use client";

import React, { useState } from "react";
import { Button } from "@repo/ui";
import { CheckCircle2, AlertTriangle } from "lucide-react";

export default function DemoPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [age, setAge] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setStatus("error");
      setErrorMsg("Name is required");
      return;
    }

    if (!email.includes("@")) {
      setStatus("error");
      setErrorMsg("Valid email address required");
      return;
    }

    if (parseInt(age, 10) < 18) {
      setStatus("error");
      setErrorMsg("Age must be at least 18 years old to register");
      return;
    }

    setStatus("success");
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md p-6 bg-neutral-900 border border-neutral-800 rounded-xl shadow-2xl space-y-6">
        <div>
          <h2 className="text-xl font-bold font-mono">Orbit QA Demo Target</h2>
          <p className="text-xs text-neutral-400 mt-1">
            Controlled signup onboarding form with reproducible validation logic.
          </p>
        </div>

        {status === "success" ? (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg flex items-center gap-2 text-sm">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            <span>Account created successfully! Welcome aboard.</span>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {status === "error" && (
              <div
                id="error-banner"
                className="p-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-lg flex items-center gap-2 text-xs font-mono"
              >
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="space-y-1">
              <label className="text-xs font-mono text-neutral-400">Full Name</label>
              <input
                id="name-input"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2.5 rounded bg-neutral-800 border border-neutral-700 text-sm focus:border-amber-500 outline-none"
                placeholder="Jane Doe"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-mono text-neutral-400">Email Address</label>
              <input
                id="email-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full p-2.5 rounded bg-neutral-800 border border-neutral-700 text-sm focus:border-amber-500 outline-none"
                placeholder="jane@example.com"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-mono text-neutral-400">Age</label>
              <input
                id="age-input"
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full p-2.5 rounded bg-neutral-800 border border-neutral-700 text-sm focus:border-amber-500 outline-none"
                placeholder="21"
              />
            </div>

            <Button
              id="submit-button"
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-600 text-black font-semibold text-xs py-2.5 rounded"
            >
              Submit Registration
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
