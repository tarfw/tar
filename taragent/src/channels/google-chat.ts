/**
 * Google Chat channel — handler for Google Chat event payloads and messages.
 */

import type { ChannelMessage, ChannelResponse } from './types';

export interface GoogleChatProcessResult {
  message: ChannelMessage;
  response: ChannelResponse;
}

/**
 * Handle incoming Google Chat webhook event payload.
 */
export function handleGoogleChatEvent(event: any): ChannelMessage | null {
  if (!event || (event.type !== 'MESSAGE' && event.type !== 'ADDED_TO_SPACE')) {
    return null;
  }

  const spaceName = event.space?.name || 'spaces/default';
  const sender = event.user || event.message?.sender || {};
  const userId = sender.name || 'users/unknown';
  const userName = sender.displayName || 'Google Chat User';
  
  // Extract text message content
  let text = event.message?.argumentText?.trim() || event.message?.text || '';

  // Clean bot @mentions if present
  if (event.message?.annotations) {
    for (const annotation of event.message.annotations) {
      if (annotation.type === 'USER_MENTION' && annotation.userMention?.type === 'BOT') {
        const botName = annotation.userMention.user?.displayName || '';
        if (botName) {
          text = text.replace(new RegExp(`@${botName}`, 'gi'), '').trim();
        }
      }
    }
  }

  if (event.type === 'ADDED_TO_SPACE' && !text) {
    text = '/start';
  }

  if (!text) return null;

  return {
    platform: 'google-chat',
    chatId: spaceName,
    userId,
    userName,
    content: text,
    messageId: event.message?.name,
  };
}

/**
 * Formats a Google Chat card or simple text response.
 */
export function formatGoogleChatResponse(text: string): { text: string } {
  return { text };
}
