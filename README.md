# WhatsApp to Salesforce sync

This service copies messages from the business WhatsApp number into Salesforce.
It uses [Baileys](https://github.com/WhiskeySockets/Baileys) to connect to
WhatsApp as a linked device, in the same way as WhatsApp Web.

Status: Phase 1. The worker connects to WhatsApp and logs new messages. It does not write to Salesforce yet.

## How it works

1. A customer sends a WhatsApp message to the business number.
2. The Baileys worker gets the message through its open WebSocket connection.
3. The worker finds the Salesforce Contact or Lead from the phone number.
4. If there is no match, the worker makes a new Lead.
5. The worker saves the message on the record.

## Architecture

```
WhatsApp Business app (phone)
        │  linked device (QR code)
        ▼
Baileys worker  ── always-on Node.js process
        │  Salesforce REST API
        ▼
Salesforce org
```

The Baileys worker must run all the time. Vercel functions start and stop for
each request, so they cannot keep the WhatsApp connection open. See
[docs/decisions.md](docs/decisions.md).

## Plan

| Phase | Work | Status |
|-------|------|--------|
| 0 | Decide the scope and answer the open questions | In progress |
| 1 | Connect Baileys to a test number and log incoming messages | Code done. Live test waits for the test number. |
| 2 | Connect to a Salesforce sandbox and write test records | Not started |
| 3 | Match phone numbers to Contacts and Leads | Not started |
| 4 | Store the Baileys session safely and reconnect after a restart | Not started |
| 5 | Deploy to an always-on host, with monitoring and alerts | Not started |
| 6 | Go live with the business number | Not started |

## Run it on your computer

You need Node.js 20 or later, and a phone with WhatsApp or WhatsApp Business.

> **Warning:** Use the test number, not the business number. Meta can ban a
> number that uses Baileys.

1. Install the packages: `npm install`
2. Copy `.env.example` to `.env`. Keep the default values for a first test.
3. Start the worker: `npm run dev`
4. A QR code shows in the terminal.
5. On the phone, open WhatsApp > Settings > Linked devices > Link a device.
6. Scan the QR code. The log shows "WhatsApp connected".
7. Send a message to the test number from a different phone.
8. The log shows a "WhatsApp message" line with the phone number and type.

The session stays in the `auth_info` folder. The next start does not need a QR code.
To unlink, delete the folder, and remove the device on the phone.

The message text shows as `[hidden]`. To see it in a local test, set
`LOG_MESSAGE_TEXT=true` in `.env`.

### Commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the worker from the TypeScript source |
| `npm test` | Run the unit tests |
| `npm run typecheck` | Check the types |
| `npm run build` then `npm start` | Compile to `dist/` and run the compiled worker |

### Phone numbers and LIDs

WhatsApp can hide a phone number behind a "LID", an internal ID such as
`123456789@lid`. Baileys gives the real phone number when it knows it. If it
does not, `phoneNumber` is `null`. The Phase 1 test must show how often this
occurs, because the Salesforce match needs the phone number.

## Open questions

1. Which always-on host do we use (Railway, Render, Fly.io, or a VPS)?
2. Do we sync only incoming messages, or must staff also reply from Salesforce?
3. Do we sync all chats, or only chats with known customers? Are group chats in scope?
4. Do we import old chats, or only new messages?
5. Which Salesforce object stores a message: a Task, or a custom object?
6. Which Salesforce objects link to a message: Contact, Lead, Account, Opportunity?

## Environments

| Item | Value | Status |
|------|-------|--------|
| Salesforce sandbox | danny3 | Ready |
| WhatsApp test number | - | Not yet. Needed before Phase 1 tests. |
| Always-on host | - | Not chosen |

## Security

- The Baileys session files give full access to the WhatsApp account.
  Never commit them. Keep them in a secret store or an encrypted volume.
- Keep Salesforce credentials in environment variables only.
- Messages contain customer personal data. Do not log message text in production.
