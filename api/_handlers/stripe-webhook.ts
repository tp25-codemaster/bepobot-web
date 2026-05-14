
import type { APIRoute } from "astro";
import { stripe, PLANS } from "../_lib/stripe.js";
import type Stripe from "stripe";
import { db } from "../../db/client.js";

export const POST: APIRoute = async ({ request }) => {
  const rawBody = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return new Response("No stripe-signature header", { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err: any) {
    console.error(`Webhook signature verification failed.`, err.message);
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  const subscription = event.data.object as Stripe.Subscription;

  switch (event.type) {
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const priceId = subscription.items.data[0].price.id;
      const plan = Object.keys(PLANS).find(
        (key) => PLANS[key as keyof typeof PLANS].priceId === priceId
      );

      if (plan && subscription.customer) {
        await db.from("profiles").update({
          plan,
          stripe_customer_id: subscription.customer as string,
        }).eq("id", subscription.metadata.user_id);
      }
      break;
    }
    case "customer.subscription.deleted": {
      if (subscription.customer) {
        await db.from("profiles").update({
          plan: "trial",
        }).eq("stripe_customer_id", subscription.customer as string);
      }
      break;
    }
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  return new Response("OK", { status: 200 });
};
