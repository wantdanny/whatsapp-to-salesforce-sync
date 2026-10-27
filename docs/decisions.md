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

## 2026-10-27: Store messages as Tasks, one for each customer and day

**Options:**

1. A custom object, `WhatsApp_Message__c`, with one record for each message.
2. A Task, with one record for each customer and day.

**Decision:** Use a Task (option 2). This is the business preference.

**Details:**

- The Task `Description` holds the transcript of the day, in both directions.
- A new unique External ID field, `WhatsApp_Sync_Key__c`, holds the phone number and the day.
  The sync uses it to update the Task if it already exists, not make a second one.

**Trade-offs that we accept:**

- Reports cannot count single messages, only days with messages.
- `Description` holds a maximum of 32,000 characters. A very long day gets cut, with a note.

## 2026-10-27: Link each Task to an Opportunity

**Rule:**

1. Use the open Opportunity for the customer.
2. If there is none, use the most recent closed Opportunity.
3. If there is none, link only to the person.

**Later:** we can add rules for Closed Lost Opportunities.

## 2026-10-27: Sync once a day, not in real time

**Decision:** A daily job writes the messages of the day to Salesforce.

**Result:** The Baileys worker still runs all the time, because WhatsApp sends
messages to a linked device only while it is connected. The worker saves each
message in a local database. The daily job reads the database.

**Benefits:**

- If Salesforce is not available, the messages stay in the database for the next run.
- The schedule can change later, for example to each hour, without a new design.

## 2026-10-27: No new Leads. Retry unmatched numbers for 7 days

**Decision:** The sync never makes a Lead. If a phone number has no match, the
sync tries again on each daily run. After 7 days, it stops and deletes those messages.

**Reason for the delete:** messages are personal data. We keep them only as long as we need them.

This replaces "make a new Lead if there is no match" from the first plan.

## 2026-10-27: Match on Person Accounts only

**Facts from the business:**

- All customers are Person Accounts. Leads convert to Person Accounts.
- An org rule allows a maximum of one open Opportunity for each Person Account.

**Decisions:**

- The sync searches only Person Account phone fields. It does not search Leads.
- `WhoId` is the `PersonContactId`. `WhatId` is the Opportunity, or the Person Account if there is no Opportunity.
- The Task owner is the Opportunity owner. With no Opportunity, it is the Person Account owner.
- The sync runs at 01:00 UK time (`Europe/London`) and covers the day before.
- The sync takes only new messages. A history import can come later.
