import pino from 'pino';
import { loadConfig } from './config.js';
import { startWhatsApp } from './whatsapp.js';

const config = loadConfig();
const logger = pino({ level: config.logLevel });

// Phase 1: log each new message. A later phase sends it to Salesforce.
await startWhatsApp({
  authDir: config.authDir,
  logger,
  onMessage: async (message) => {
    logger.info(
      {
        id: message.id,
        direction: message.fromMe ? 'outgoing' : 'incoming',
        phoneNumber: message.phoneNumber,
        isGroup: message.isGroup,
        type: message.type,
        timestamp: message.timestamp.toISOString(),
        text: config.logMessageText ? message.text : '[hidden]',
      },
      'WhatsApp message',
    );
  },
});
