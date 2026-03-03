// src/adapters/slack.ts — Slack Events API adapter

import type { SlackEvent } from "../types";

// ─── Signature Verification ───────────────────────────────────────────────────

/**
 * Verifies a Slack request signature using HMAC-SHA256.
 * https://api.slack.com/authentication/verifying-requests-from-slack
 */
export async function verifySlackSignature(
  request: Request,
  rawBody: string,
  signingSecret: string,
): Promise<boolean> {
  const timestamp = request.headers.get("x-slack-request-timestamp");
  const slackSignature = request.headers.get("x-slack-signature");

  if (!timestamp || !slackSignature) return false;

  // Reject requests older than 5 minutes (replay attack prevention)
  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 5 * 60;
  if (parseInt(timestamp, 10) < fiveMinutesAgo) {
    console.warn("[Slack] Request timestamp too old — possible replay attack.");
    return false;
  }

  const sigBaseString = `v0:${timestamp}:${rawBody}`;

  // HMAC-SHA256 using Web Crypto API (available in Workers)
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(signingSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(sigBaseString),
  );

  const hex = `v0=${Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;

  // Constant-time comparison
  return hex === slackSignature;
}

// ─── Parse ────────────────────────────────────────────────────────────────────

export interface SlackParsed {
  channelId: string;
  userId: string;
  text: string;
  /** True if this is just the URL verification challenge from Slack */
  isChallenge: boolean;
  challenge?: string;
}

/**
 * Parses a Slack Events API payload.
 * Handles: URL verification challenge, app_mention events.
 * Returns null for bot messages (prevents self-reply loops).
 */
export function parseSlackEvent(body: SlackEvent): SlackParsed | null {
  // Handle Slack's URL verification challenge (sent on first setup)
  if (body.type === "url_verification" && body.challenge) {
    return {
      channelId: "",
      userId: "",
      text: "",
      isChallenge: true,
      challenge: body.challenge,
    };
  }

  const event = body.event;
  if (!event) return null;

  // Ignore bot messages to prevent infinite loops
  if (event.bot_id) return null;

  // Only process app_mention (when @TarBot is mentioned in a channel)
  if (event.type !== "app_mention") return null;

  // Strip the bot mention part — Slack formats it as <@BOTID>
  const cleanText = event.text.replace(/<@[A-Z0-9]+>/g, "").trim();
  if (!cleanText) return null;

  return {
    channelId: event.channel,
    userId: event.user,
    text: cleanText,
    isChallenge: false,
  };
}

// ─── Send ─────────────────────────────────────────────────────────────────────

/** Sends a message to a Slack channel using the Bot token. */
export async function sendSlackMessage(
  channelId: string,
  text: string,
  botToken: string,
): Promise<void> {
  const response = await fetch("https://slack.com/api/chat.postMessage", {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      Authorization: `Bearer ${botToken}`,
    },
    body: JSON.stringify({
      channel: channelId,
      text,
      mrkdwn: true,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error(`[Slack] postMessage failed: ${err}`);
  }
}
