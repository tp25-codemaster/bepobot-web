// /home/noessuuui/bepobot-web/api/stripe-checkout.ts
import { getSupabaseAdmin } from "../_lib/supabase.js";
import { stripe, PLANS } from "../_lib/stripe.js";

export default async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const supabase = getSupabaseAdmin();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(req.headers.get("Authorization")?.split(" ")[1] ?? "");

    if (userError || !user) {
      console.error("User authentication error:", userError?.message);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }

    const { plan } = await req.json();

    if (!plan || !(plan in PLANS)) {
      return new Response(JSON.stringify({ error: "Invalid or missing plan" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    let customerId;
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", userId)
      .single();

    if (profileError) {
      console.error("Error fetching profile:", profileError.message);
      throw new Error("Failed to fetch user profile.");
    }

    if (profile?.stripe_customer_id) {
      customerId = profile.stripe_customer_id;
    } else {
      try {
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: {
            userId: userId,
          },
        });
        customerId = customer.id;

        const { error: updateError } = await supabase
          .from("profiles")
          .update({ stripe_customer_id: customerId })
          .eq("id", userId);

        if (updateError) {
          console.error("Error updating stripe_customer_id:", updateError.message);
          throw new Error("Failed to update user profile with Stripe customer ID.");
        }
      } catch (createCustomerError: any) {
        console.error("Error creating Stripe customer:", createCustomerError.message);
        throw new Error("Failed to create Stripe customer.");
      }
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: PLANS[plan as keyof typeof PLANS].priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${process.env.FRONTEND_URL}/app/billing?success=1`,
      cancel_url: `${process.env.FRONTEND_URL}/app/billing`,
      subscription_data: {
        metadata: {
          user_id: userId,
        },
      },
      allow_promotion_codes: true,
    });

    if (!session.url) {
      throw new Error("Failed to create Stripe Checkout Session URL.");
    }

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Stripe checkout error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};