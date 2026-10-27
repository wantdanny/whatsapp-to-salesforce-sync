import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { WAMessage } from '@whiskeysockets/baileys';
import { phoneFromJids, toInboundMessage } from '../src/message.js';

const PHONE_JID = '447700900123@s.whatsapp.net';

function msg(overrides: Partial<WAMessage> & { key?: Partial<WAMessage['key']> }): WAMessage {
  return {
    messageTimestamp: 1761552000,
    pushName: 'Test Customer',
    message: { conversation: 'Hello' },
    ...overrides,
    key: { id: 'ABC123', remoteJid: PHONE_JID, fromMe: false, ...overrides.key },
  } as WAMessage;
}

test('reads a 1:1 text message', () => {
  const result = toInboundMessage(msg({}));
  assert.deepEqual(result, {
    id: 'ABC123',
    chatJid: PHONE_JID,
    isGroup: false,
    fromMe: false,
    phoneNumber: '+447700900123',
    senderName: 'Test Customer',
    timestamp: new Date(1761552000 * 1000),
    type: 'conversation',
    text: 'Hello',
  });
});

test('gets the phone number from remoteJidAlt when the chat uses a LID', () => {
  const result = toInboundMessage(
    msg({ key: { remoteJid: '123456789@lid', remoteJidAlt: PHONE_JID } }),
  );
  assert.equal(result?.phoneNumber, '+447700900123');
});

test('gives a null phone number when only a LID is known', () => {
  const result = toInboundMessage(msg({ key: { remoteJid: '123456789@lid' } }));
  assert.ok(result);
  assert.equal(result.phoneNumber, null);
});

test('uses the participant for the phone number in a group', () => {
  const result = toInboundMessage(
    msg({ key: { remoteJid: '1203630@g.us', participant: '99999@lid', participantAlt: PHONE_JID } }),
  );
  assert.equal(result?.isGroup, true);
  assert.equal(result?.phoneNumber, '+447700900123');
});

test('marks messages that the business sent', () => {
  assert.equal(toInboundMessage(msg({ key: { fromMe: true } }))?.fromMe, true);
});

test('reads the caption of an image', () => {
  const result = toInboundMessage(msg({ message: { imageMessage: { caption: 'The ring' } } }));
  assert.equal(result?.type, 'imageMessage');
  assert.equal(result?.text, 'The ring');
});

test('gives null text for media with no caption', () => {
  const result = toInboundMessage(msg({ message: { audioMessage: {} } }));
  assert.equal(result?.type, 'audioMessage');
  assert.equal(result?.text, null);
});

test('ignores status updates and newsletters', () => {
  assert.equal(toInboundMessage(msg({ key: { remoteJid: 'status@broadcast' } })), null);
  assert.equal(toInboundMessage(msg({ key: { remoteJid: '123@newsletter' } })), null);
});

test('ignores system messages and empty messages', () => {
  assert.equal(toInboundMessage(msg({ message: { protocolMessage: {} } })), null);
  assert.equal(toInboundMessage(msg({ message: null })), null);
});

test('removes the device number from a phone JID', () => {
  assert.equal(phoneFromJids(['447700900123:5@s.whatsapp.net']), '+447700900123');
  assert.equal(phoneFromJids([undefined, '1@lid']), null);
});
