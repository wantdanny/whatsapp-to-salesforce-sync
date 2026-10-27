# WhatsApp to Salesforce sync

This service copies messages from the business WhatsApp number into Salesforce.
It uses [Baileys](https://github.com/WhiskeySockets/Baileys) to connect to
WhatsApp as a linked device, in the same way as WhatsApp Web.

Status: planning. There is no code yet.

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
| 1 | Connect Baileys to a test number and log incoming messages | Not started |
| 2 | Connect to a Salesforce sandbox and write test records | Not started |
| 3 | Match phone numbers to Contacts and Leads | Not started |
| 4 | Store the Baileys session safely and reconnect after a restart | Not started |
| 5 | Deploy to an always-on host, with monitoring and alerts | Not started |
| 6 | Go live with the business number | Not started |

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
