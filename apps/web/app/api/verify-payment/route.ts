import { NextResponse } from "next/server";
import Stripe from "stripe";
import { CreateosSandboxClient } from "@nodeops-createos/sandbox";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16" as any,
});

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("session_id");

    if (!sessionId) {
      return NextResponse.json({ error: "Missing session_id" }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== "paid") {
      return NextResponse.json({
        paid: false,
        message: "Payment not completed or pending",
      });
    }

    const minutes = parseInt(session.metadata?.minutes || "5", 10);
    const seconds = minutes * 60;

    // Apply allocated timing to active CreateOS Sandbox
    const apiKey =
      process.env.CREATEOS_SANDBOX_API_KEY ||
      process.env.CREATEOS_PROJECT_API_KEY ||
      process.env.CREATEOS_PLAN_API_KEY;
    const baseUrl =
      process.env.CREATEOS_SANDBOX_BASE_URL ||
      process.env.CREATEOS_PROJECT_API_URL ||
      "https://api-eu.sb.createos.sh/";

    let sandboxId = "";
    let autoPauseSet = false;

    if (apiKey) {
      try {
        const client = new CreateosSandboxClient({ baseUrl, apiKey });
        const sandboxes = await client.listSandboxes();
        const active = sandboxes?.find(
          (sb: any) => sb.status === "running" || sb.status === "starting"
        );
        if (active) {
          sandboxId = active.id;
          await active.setAutoPause(seconds);
          autoPauseSet = true;
        }
      } catch (sbErr) {
        console.warn("Could not set auto-pause on active sandbox:", sbErr);
      }
    }

    return NextResponse.json({
      paid: true,
      minutes,
      seconds,
      planId: session.metadata?.planId,
      customerEmail: session.customer_details?.email,
      sandboxId,
      autoPauseSet,
    });
  } catch (err: any) {
    console.error("Payment verification error:", err);
    return NextResponse.json(
      { error: err?.message || "Failed to verify session" },
      { status: 500 }
    );
  }
}
