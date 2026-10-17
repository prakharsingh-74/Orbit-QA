import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16" as any,
});

const PLAN_TIERS: Record<string, { minutes: number; amount: number; label: string }> = {
  tier_5: {
    minutes: 5,
    amount: 300, // $3.00
    label: "5 Minutes Sandbox Pass",
  },
  tier_10: {
    minutes: 10,
    amount: 500, // $5.00
    label: "10 Minutes Sandbox Pass",
  },
  tier_15: {
    minutes: 15,
    amount: 2000, // $20.00
    label: "15 Minutes Sandbox Pass",
  },
};

export async function POST(req: Request) {
  try {
    const { planId } = await req.json();
    const plan = PLAN_TIERS[planId];

    if (!plan) {
      return NextResponse.json({ error: "Invalid pricing plan selected." }, { status: 400 });
    }

    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const origin = `${protocol}://${host}`;

    // Create real Stripe Checkout Session specifying card payment method
    const session = await (stripe.checkout.sessions.create as any)({
      payment_method_types: ["card"] as any,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Orbit QA - ${plan.label}`,
              description: `Autonomous browser VM sandbox instance allocated for ${plan.minutes} minutes.`,
            },
            unit_amount: plan.amount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      metadata: {
        planId,
        minutes: plan.minutes.toString(),
      },
      success_url: `${origin}/?session_id={CHECKOUT_SESSION_ID}&plan=${planId}&minutes=${plan.minutes}`,
      cancel_url: `${origin}/`,
    });

    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (error: any) {
    console.error("Stripe checkout session error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to create Stripe payment session." },
      { status: 500 }
    );
  }
}
