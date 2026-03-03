// src/adapters/whatsapp.ts — WhatsApp Cloud API (Meta) adapter

import type { WhatsAppWebhook } from "../types";

// ─── Webhook Verification ─────────────────────────────────────────────────────

/**
 * Handles Meta's GET webhook verification challenge.
 * Returns a Response with the hub.challenge value if the verify token matches.
 */
export function verifyWhatsAppChallenge(
  url: URL,
  verifyToken: string,
): Response | null {
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === verifyToken && challenge) {
    console.log("[WhatsApp] Webhook verified successfully.");
    return new Response(challenge, { status: 200 });
  }

  console.warn("[WhatsApp] Webhook verification failed.");
  return new Response("Forbidden", { status: 403 });
}

// ─── Parse ────────────────────────────────────────────────────────────────────

export interface WhatsAppParsed {
  from: string; // Sender's phone number (E.164 format)
  text: string; // Message body text
}

/**
 * Extracts the sender phone and message text from a WhatsApp webhook payload.
 * Returns null for non-text messages (images, voice notes, etc.).
 */
export function parseWhatsAppMessage(
  body: WhatsAppWebhook,
): WhatsAppParsed | null {
  const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

  if (!message || message.type !== "text" || !message.text?.body) {
    return null;
  }

  return {
    from: message.from,
    text: message.text.body.trim(),
  };
}

// ─── Send ─────────────────────────────────────────────────────────────────────

/** Sends a text message to a WhatsApp user via the Cloud API. */
export async function sendWhatsAppMessage(
  to: string,
  text: string,
  phoneNumberId: string,
  accessToken: string,
): Promise<void> {
  const url = `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: { body: text },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(`[WhatsApp] sendMessage to ${to} failed: ${err}`);
  }
}
