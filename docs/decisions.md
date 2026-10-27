# Decision log

## 2026-10-27: Use Baileys, not the WhatsApp Cloud API

**Options:**

1. Baileys: an unofficial library that connects as a WhatsApp Web linked device.
2. WhatsApp Cloud API: the official Meta API, which sends messages to a webhook.

**Decision:** Use Baileys.

**Accepted risks:**

- Baileys is not official. It breaks the WhatsApp Terms of Service, and Meta can ban the number.
- A WhatsApp change can stop Baileys without warning. We must monitor the connection.
- The linked device can disconnect. Someone must scan a new QR code if this occurs.

**How we reduce the risks:**

- Test with a separate number before we connect the business number.
- Do not send bulk or automated outgoing messages.
- Alert a person when the connection stops.

## 2026-10-27: Run the Baileys worker on an always-on host, not on Vercel

**Reason:** Baileys keeps one WebSocket connection open all the time. Vercel
functions run for a short time and then stop. They cannot hold the connection.

**Result:** The worker runs as a long-running Node.js process. Vercel is
optional. We can use it later for a small status page or a Salesforce-facing API.

**Still to decide:** the host (Railway, Render, Fly.io, or a VPS).

## 2026-10-27: Phase 1 technical choices

- **Language:** TypeScript on Node.js 20 or later.
- **Baileys version:** pinned to `7.0.0-rc14`, with no automatic upgrades.
  Baileys is unofficial, and a new version can change how it behaves. We upgrade by hand and test first.
- **Session storage:** the Baileys file store (`useMultiFileAuthState`) for local tests.
  Baileys says that this store is not for production. Phase 4 replaces it.
- **Logs:** the message text is hidden by default, because it holds customer personal data.
- **Messages in scope:** only new messages (`notify`). Status updates, broadcasts,
  newsletters, reactions and system messages are ignored.
