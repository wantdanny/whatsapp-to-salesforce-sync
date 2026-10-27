import {
  getContentType,
  isJidBroadcast,
  isJidGroup,
  isJidNewsletter,
  isPnUser,
  jidDecode,
  normalizeMessageContent,
  type WAMessage,
} from '@whiskeysockets/baileys';

/** A WhatsApp message in the shape that the Salesforce side needs. */
export interface InboundMessage {
  id: string;
  /** The chat that the message is in. For a 1:1 chat, this is the customer. */
  chatJid: string;
  isGroup: boolean;
  /** True if the business number sent the message. */
  fromMe: boolean;
  /** The customer's phone number in E.164 format, for example "+447700900123". */
  phoneNumber: string | null;
  /** The name that the sender set in WhatsApp. */
  senderName: string | null;
  timestamp: Date;
  /** The Baileys content type, for example "conversation" or "imageMessage". */
  type: string;
  /** The message text, or the caption for media. */
  text: string | null;
}

/** Content types that only change the state of a chat and carry no message. */
const IGNORED_TYPES = new Set([
  'protocolMessage',
  'senderKeyDistributionMessage',
  'reactionMessage',
  'pollUpdateMessage',
  'messageContextInfo',
]);

/**
 * Change a Baileys message into an InboundMessage.
 * Returns null for messages that we do not sync: status updates,
 * broadcasts, newsletters, and system messages with no content.
 */
export function toInboundMessage(msg: WAMessage): InboundMessage | null {
  const chatJid = msg.key.remoteJid;
  if (!chatJid || !msg.key.id) return null;
  if (isJidBroadcast(chatJid) || isJidNewsletter(chatJid)) return null;

  const content = normalizeMessageContent(msg.message);
  const type = getContentType(content);
  if (!content || !type || IGNORED_TYPES.has(type)) return null;

  const isGroup = Boolean(isJidGroup(chatJid));
  // WhatsApp can hide a phone number behind a LID ("123@lid"). Baileys then
  // puts the phone number JID in the "Alt" field, if it knows it.
  const candidates = isGroup
    ? [msg.key.participant, msg.key.participantAlt]
    : [chatJid, msg.key.remoteJidAlt];

  return {
    id: msg.key.id,
    chatJid,
    isGroup,
    fromMe: Boolean(msg.key.fromMe),
    phoneNumber: phoneFromJids(candidates),
    senderName: msg.pushName || null,
    timestamp: toDate(msg.messageTimestamp),
    type,
    text: textOf(content),
  };
}

/** Get an E.164 phone number from the first phone number JID in the list. */
export function phoneFromJids(jids: (string | null | undefined)[]): string | null {
  for (const jid of jids) {
    if (!jid || !isPnUser(jid)) continue;
    const user = jidDecode(jid)?.user;
    if (user && /^\d+$/.test(user)) return `+${user}`;
  }
  return null;
}

function textOf(content: NonNullable<WAMessage['message']>): string | null {
  return (
    content.conversation ||
    content.extendedTextMessage?.text ||
    content.imageMessage?.caption ||
    content.videoMessage?.caption ||
    content.documentMessage?.caption ||
    content.documentMessage?.fileName ||
    null
  );
}

function toDate(ts: WAMessage['messageTimestamp']): Date {
  if (ts == null) return new Date();
  const seconds = typeof ts === 'number' ? ts : ts.toNumber();
  return new Date(seconds * 1000);
}
