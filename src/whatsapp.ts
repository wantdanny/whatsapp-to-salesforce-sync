import makeWASocket, {
  Browsers,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  useMultiFileAuthState,
  type WAVersion,
} from '@whiskeysockets/baileys';
import type { Logger } from 'pino';
import qrcode from 'qrcode-terminal';
import { toInboundMessage, type InboundMessage } from './message.js';

export type MessageHandler = (message: InboundMessage) => Promise<void>;

/** The longest wait between two reconnect attempts. */
const MAX_RECONNECT_DELAY_MS = 60_000;
const VERSION_TIMEOUT_MS = 10_000;

/**
 * Connect to WhatsApp as a linked device and call onMessage for each new message.
 * Shows a QR code in the terminal when the session is not linked yet.
 * Reconnects after a disconnect, except when WhatsApp logs the device out.
 */
export async function startWhatsApp(opts: {
  authDir: string;
  logger: Logger;
  onMessage: MessageHandler;
}): Promise<void> {
  const { authDir, logger, onMessage } = opts;
  const { state, saveCreds } = await useMultiFileAuthState(authDir);
  const version = await latestVersion(logger);
  // Baileys logs a lot. Show only its warnings and errors.
  const baileysLogger = logger.child({ module: 'baileys' }, { level: 'warn' });
  let attempt = 0;

  const connect = () => {
    logger.info('Connecting to WhatsApp');
    const sock = makeWASocket({
      ...(version && { version }),
      logger: baileysLogger,
      browser: Browsers.macOS('Desktop'),
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, baileysLogger),
      },
      // Do not show the business number as "online" to customers.
      markOnlineOnConnect: false,
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
      if (qr) {
        logger.info('Scan this QR code: WhatsApp > Settings > Linked devices > Link a device');
        qrcode.generate(qr, { small: true });
      }

      if (connection === 'open') {
        attempt = 0;
        logger.info({ user: sock.user?.id }, 'WhatsApp connected');
      }

      if (connection === 'close') {
        const statusCode = (lastDisconnect?.error as { output?: { statusCode?: number } } | undefined)
          ?.output?.statusCode;
        if (statusCode === DisconnectReason.loggedOut) {
          logger.error(
            `WhatsApp logged this device out. Delete the "${authDir}" folder and start again to scan a new QR code.`,
          );
          process.exitCode = 1;
          return;
        }
        // WhatsApp asks for a restart right after the first QR scan. This is normal.
        const delay =
          statusCode === DisconnectReason.restartRequired
            ? 0
            : Math.min(1000 * 2 ** attempt, MAX_RECONNECT_DELAY_MS);
        attempt++;
        logger.warn({ statusCode, delayMs: delay }, 'WhatsApp disconnected. Reconnecting.');
        setTimeout(connect, delay);
      }
    });

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      // "notify" means new messages. "append" means history or messages
      // from the phone. History import is a later phase.
      if (type !== 'notify') return;
      for (const raw of messages) {
        const message = toInboundMessage(raw);
        if (!message) continue;
        try {
          await onMessage(message);
        } catch (err) {
          logger.error({ err, messageId: message.id }, 'Could not process message');
        }
      }
    });
  };

  connect();
}

/**
 * Get the current WhatsApp Web version. WhatsApp can refuse an old version.
 * If the request fails or takes too long, use the version in Baileys.
 */
async function latestVersion(logger: Logger): Promise<WAVersion | undefined> {
  const timeout = new Promise<undefined>((resolve) => setTimeout(resolve, VERSION_TIMEOUT_MS));
  const result = await Promise.race([fetchLatestBaileysVersion().catch(() => undefined), timeout]);
  if (!result?.isLatest) logger.warn('Could not get the latest WhatsApp Web version. Using the Baileys default.');
  return result?.isLatest ? result.version : undefined;
}
