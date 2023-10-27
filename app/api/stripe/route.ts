import { auth, currentUser } from "@clerk/nextjs";
import { NextResponse } from "next/server";

import prismadb from "@/lib/prismadb";
import { stripe } from "@/lib/stripe";
import { absoluteUrl } from "@/lib/utils";

const settingsUrl = "http://localhost:3001/settings";

export async function GET() {
  try {
    const { userId } = auth();
    console.log("[GET] userId:", userId); // Log userId
    const user = await currentUser();
    console.log("[GET] user:", user); // Log user

    if (!userId || !user) {
      console.log("[GET] Unauthorized"); // Log unauthorized
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const userSubscription = await prismadb.userSubscription.findUnique({
      where: {
        userId
      }
    });
    console.log("[GET] userSubscription:", userSubscription); // Log userSubscription

    if (userSubscription && userSubscription.stripeCustomerId) {
      const stripeSession = await stripe.billingPortal.sessions.create({
        customer: userSubscription.stripeCustomerId,
        return_url: settingsUrl,
      });
      console.log("[GET] billingPortal session:", stripeSession); // Log billingPortal session

      return new NextResponse(JSON.stringify({ url: stripeSession.url }));
    }

    const stripeSession = await stripe.checkout.sessions.create({
      success_url: settingsUrl,
      cancel_url: settingsUrl,
      payment_method_types: ["card"],
      mode: "subscription",
      billing_address_collection: "auto",
      customer_email: user.emailAddresses[0].emailAddress,
      line_items: [
        {
          price_data: {
            currency: "USD",
            product_data: {
              name: "Companion Pro",
              description: "Create Custom AI Companions"
            },
            unit_amount: 999,
            recurring: {
              interval: "month"
            }
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId,
      },
    });
    console.log("[GET] checkout session:", stripeSession); // Log checkout session

    return new NextResponse(JSON.stringify({ url: stripeSession.url }));
  } catch (error) {
    console.log("[STRIPE]", error); // Log any errors
    return new NextResponse("Internal Error", { status: 500 });
  }
};
