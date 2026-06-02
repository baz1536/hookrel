# Hookrel — Heather Rose Integration Requirements

This document describes changes needed in Hookrel to support the Heather Rose storefront webhook integration.

## Webhook Payload Structure

All events from the Heather Rose storefront are sent as `POST` requests with `Content-Type: application/json`.

### Standard payload shape

```json
{
  "event": "order.created",
  "email": {
    "to": ["heather@heatherrose.uk"],
    "cc": [],
    "bcc": []
  },
  "order_number": "HR-2026-0001",
  "customer": "Barry Rose",
  "total": "1.00 GBP",
  "product": "Bold & Visible Mastermind",
  "requires_shipping": false
}
```

### Event types

| Event | Description | Dynamic `to` |
|---|---|---|
| `order.created` | New order placed | No — admin only |
| `order.dispatched` | Order marked dispatched | Yes — customer email added if "Notify customer" ticked |
| `order.refunded` | Refund issued | No — admin only |
| `order.note.customer` | Customer note added with notify | Yes — customer email always in `to` |

### Event-specific fields

**order.dispatched**
```json
{
  "event": "order.dispatched",
  "email": { "to": ["heather@heatherrose.uk", "customer@example.com"], "cc": [], "bcc": [] },
  "order_number": "HR-2026-0001",
  "customer": "Barry Rose",
  "tracking_number": "RM123456789GB",
  "product": "Bold & Visible Mastermind"
}
```

**order.note.customer**
```json
{
  "event": "order.note.customer",
  "email": { "to": ["customer@example.com"], "cc": ["heather@heatherrose.uk"], "bcc": [] },
  "order_number": "HR-2026-0001",
  "customer": "Barry Rose",
  "note": "Your order has been upgraded, enjoy!",
  "product": "Bold & Visible Mastermind"
}
```

## Required Hookrel Changes

### 1. Read `email` array from payload for recipients

Currently Hookrel has no concept of dynamic recipients. It needs to read the `email` object from the webhook payload and use it as the recipient list for the triggered email.

- `email.to` — array of strings, primary recipients
- `email.cc` — array of strings, CC recipients (may be empty)
- `email.bcc` — array of strings, BCC recipients (may be empty)

These should be merged with any statically configured recipients on the Hookrel webhook rule, not replace them.

**Priority: High** — without this, customer notifications (dispatch, customer notes) cannot reach the customer.

### 2. Subject line already supports payload interpolation ✅

The subject field already supports `{{payload.field}}` interpolation. No changes needed here. Example subjects:

- `New order {{payload.order_number}} from {{payload.customer}}`
- `Your order {{payload.order_number}} has been dispatched`
- `Update on your order {{payload.order_number}}`

### 3. Email body — use `{{payload.note}}` for customer notes

For the `order.note.customer` event, the note body is in `payload.note`. The Hookrel email template should be able to render this as the main body content.

### 4. Event type routing

The `event` field in the payload identifies the event type. Hookrel should be able to route different events to different email templates/rules based on this field.

Currently the Heather Rose admin configures which Hookrel endpoint each event fires to, so routing can also be handled by having separate Hookrel webhook URLs per event type. Either approach works.

## Auth

Each Hookrel endpoint is configured with an auth header in the Heather Rose admin. The storefront sends:

```
Authorization: Bearer <token>
```

The header name is configurable per endpoint in the Heather Rose webhooks admin.

## Testing

Once Hookrel supports the `email` array, test with:

1. Place a test order → `order.created` fires → admin receives notification
2. Mark order dispatched with "Notify customer" ticked → `order.dispatched` fires → both admin and customer receive notification
3. Add a customer note with "Notify customer" ticked → `order.note.customer` fires → customer receives the note content by email
4. Issue a refund → `order.refunded` fires → admin notified (Stripe handles customer refund email separately)
