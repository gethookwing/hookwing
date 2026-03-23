/**
 * Slack webhook types.
 * @see https://api.slack.com/events
 */

import type { WebhookEvent } from '../../types.js';

export type SlackEventType =
  | 'message'
  | 'app_mention'
  | 'reaction_added'
  | 'member_joined_channel'
  | 'member_left_channel'
  | 'channel_created'
  | 'channel_deleted'
  | 'emoji_changed'
  | 'team_join'
  | 'link_shared'
  | 'app_uninstalled';

export interface SlackMessage {
  type: 'message';
  channel: string;
  user: string;
  text: string;
  ts: string;
  thread_ts?: string;
  [key: string]: unknown;
}

export interface SlackAppMention {
  type: 'app_mention';
  channel: string;
  user: string;
  text: string;
  ts: string;
  thread_ts?: string;
  [key: string]: unknown;
}

export interface SlackReactionAdded {
  type: 'reaction_added';
  item: {
    type: 'message';
    channel: string;
    ts: string;
  };
  reaction: string;
  user: string;
  [key: string]: unknown;
}

export interface SlackMemberJoinedChannel {
  type: 'member_joined_channel';
  channel: string;
  user: string;
  channel_type: string;
  ts: string;
  [key: string]: unknown;
}

export interface SlackUrlVerification {
  type: 'url_verification';
  challenge: string;
  [key: string]: unknown;
}

export interface SlackEvent extends WebhookEvent {
  type: SlackEventType | 'url_verification' | string;
  data: Record<string, unknown>;
}
