/**
 * Channel types — shared interfaces for all messaging channels.
 */

export interface ChannelMessage {
  platform: 'telegram' | 'slack' | 'discord' | 'whatsapp';
  chatId: string;
  userId: string;
  userName: string;
  content: string;
  messageId?: string;
  replyTo?: string;
}

export interface ChannelConfig {
  platform: string;
  botToken?: string;
  webhookUrl?: string;
  appId?: string;
  appSecret?: string;
}

export interface ChannelResponse {
  chatId: string;
  text: string;
  replyToMessageId?: string;
}
