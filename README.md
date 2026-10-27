# WhatsApp to Salesforce sync

This service copies messages from the business WhatsApp number into Salesforce.
It uses [Baileys](https://github.com/WhiskeySockets/Baileys) to connect to
WhatsApp as a linked device, in the same way as WhatsApp Web.

Status: Phase 1. The worker connects to WhatsApp and logs new messages. It does not write to Salesforce yet.

## How it works

The work has two parts. The capture runs all the time. The sync runs once a day.

**Capture (all the time):**

1. A customer sends a WhatsApp message, or staff reply from the business phone.
2. The Baileys worker gets the message through its open WebSocket connection.
3. The worker saves the message in a local database on the host.

**Daily sync (once a day):**

1. The sync groups the saved messages by customer and by day.
2. For each group, it searches Salesforce for the customer's phone number.
3. If it finds a match, it links the group to the right Opportunity (see "Salesforce data model").
4. It makes one Task for each customer and day, or updates that Task if it exists.
5. If there is no match, the sync tries again on the next days.
   After 7 days with no match, it stops and deletes the messages.
6. The sync never makes new Leads.

## Salesforce data model

Each customer gets one **Task** for each day with WhatsApp messages.

| Task field | Value |
|------------|-------|
| `Subject` | `WhatsApp: 27 Oct 2026 (5 messages)` |
| `Description` | The transcript of that day, in time order, both directions |
| `ActivityDate` | The day of the messages (UK time) |
| `Status` | `Completed` |
| `Type` | `WhatsApp` (a new picklist value) |
| `WhoId` | The matched Contact (or Person Account contact) or Lead |
| `WhatId` | The selected Opportunity. Empty if `WhoId` is a Lead. |
| `WhatsApp_Sync_Key__c` | New field. Text, External ID, unique. Phone number and day, for example `+447700900123|2026-10-27`. |
| `WhatsApp_Phone__c` | New field. Phone. The customer's number. |

The sync key lets the sync update the same Task if it runs again for the same day.

**Opportunity rule:**

1. Use the open Opportunity for the customer.
2. If there is no open Opportunity, use the most recent closed Opportunity.
3. If there is no Opportunity, the Task links only to the person.

Rules for Closed Lost Opportunities can come later.

**Phone match:** Salesforce numbers start with `+44` (E.164 format). The worker
also stores numbers in E.164 format. The search uses Salesforce SOSL on phone
fields, which ignores spaces and other format differences.

## Architecture

```
WhatsApp Business app (phone)
        │  linked device (QR code)
        ▼
Baileys worker  ── always-on Node.js process
        │  saves each message
        ▼
Local database  ── holds messages until they sync, max 7 days
        │  daily sync job
        ▼
Salesforce org  ── one Task for each customer and day
```

The Baileys worker must run all the time, also with a daily sync. WhatsApp
sends messages to a linked device only while it is connected, so the worker
must be online to catch them. Vercel functions start and stop for each
request, so they cannot keep the WhatsApp connection open. See
[docs/decisions.md](docs/decisions.md).

## Plan

| Phase | Work | Status |
|-------|------|--------|
| 0 | Decide the scope and answer the open questions | In progress |
| 1 | Connect Baileys to a test number and log new messages | Code done. Live test waits for the test number. |
| 2 | Save each message in a local database | Not started |
| 3 | Add the Task fields and the `WhatsApp` Task type in the `danny3` sandbox | Not started |
| 4 | Build the daily sync: phone match, Opportunity rule, Task upsert, 7-day retry | Not started |
| 5 | Store the Baileys session safely, deploy to an always-on host, add monitoring and alerts | Not started |
| 6 | Deploy the Salesforce changes to production and go live with the business number | Not started |

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
2. Does the org use Person Accounts?
3. If a customer has more than one open Opportunity, which one gets the Task?
4. If a phone number matches more than one person, which one gets the Task?
5. Who owns the Task: the Opportunity owner, the Contact or Lead owner, or an integration user?
6. At what time does the daily sync run?
7. Do we import old chats, or only new messages?

Answered:

- Staff replies: the sync includes messages that staff send from the business phone.
  Replies from Salesforce are not in scope.
- Group chats: not in scope.
- Message record: a Task, one for each customer and day.
- Links: the person and an Opportunity (see "Salesforce data model").
- Sync timing: once a day. A more frequent sync can come later.
- No match: no new Leads. Try again each day for 7 days, then stop.

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
- The local database holds messages for a maximum of 7 days. Delete each message
  after it syncs, or after the last retry. Keep the database on an encrypted volume.
