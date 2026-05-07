import Stripe from "stripe";

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-03-31.basil", typescript: true });

export const PLANS = {
  starter: { name: "Starter", priceId: process.env.STRIPE_PRICE_STARTER!, monthlyEur: 89, apartments: 1 },
  pro:     { name: "Pro",     priceId: process.env.STRIPE_PRICE_PRO!,     monthlyEur: 149, apartments: 5 },
  business:{ name: "Business",priceId: process.env.STRIPE_PRICE_BUSINESS!, monthlyEur: 299, apartments: -1 },
} as const;
