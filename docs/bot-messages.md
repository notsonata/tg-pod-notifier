# Bot Messages

This document lists the Telegram-facing text the bot sends or shows.

## Commands

Telegram command descriptions:

| Command | Description |
| --- | --- |
| `/start` | Activate the bot in this group |
| `/help` | Show available commands |
| `/orders` | List active tracked orders |
| `/refresh` | Refresh provider order data now |
| `/digest` | View digest settings |
| `/settings` | Open bot settings |

## Command Replies

### `/start`

```text
Order notifier is active in this group.
```

### `/help`

```text
Commands: /orders /digest /settings
```

### `/orders`

When active orders exist:

```text
Open orders
```

When no active orders exist:

```text
No open orders found.
```

### `/refresh`

```text
Refresh complete.
Printify stores enabled: <yes|no>
Printify orders refreshed: <count>
Gelato tracked orders refreshed: <count>
Active tracked orders: <count>
```

After the refresh summary, the bot also sends the digest message listed below.

### `/digest`

```text
Order digest is <enabled|disabled>.
```

### `/settings`

```text
Settings
```

## Order Details

Used for individual order alerts and order detail views for every provider.

```text
Order: <external order id>
Sent to production: <sent-to-production date|Pending>
Customer: <customer name|Unknown>
Total cost: <currency amount|Pending>
Tracking: <tracking url or number|Pending>
Status: <mapped Printify-style status>
```

Example:

```text
Order: 69d52d6b24b9796bcd0604aa
Sent to production: Sun, May 10
Customer: Jordan Larkin
Total cost: USD 57.88
Tracking: Pending
Status: Ready to ship
```

Status values currently rendered:

| Provider status | Bot status |
| --- | --- |
| `pending`, `on-hold`, `created` | On hold |
| `on-hold-submit-order` | On hold: Submit order |
| `payment-not-received`, `out-of-stock` | On hold: Action required |
| `sending-to-production`, `sent-to-production` | Sending to production |
| `in-production`, `in_production`, `printed` | In production |
| `has-issues`, `error`, `failed` | Has issues |
| `canceled`, `cancelled` | Canceled |
| `fulfilled`, `ready-to-ship`, `passed` | Ready to ship |
| `shipped` | Shipped |
| `on-the-way`, `in_transit` | On the way |
| `available-for-pickup` | Available for pickup |
| `out-for-delivery` | Out for delivery |
| `delivery-attempt` | Delivery attempt |
| `shipping-issue`, `exception` | Shipping issue |
| `return-to-sender`, `returned` | Return to sender |
| `delivered` | Delivered |
| Any other status | Unknown |

## Order Summary

Used after refreshing one order from its inline button.

```text
<PROVIDER> order <external order id>
Status: <raw provider status>
Items: <item count>
Updated: <updated ISO timestamp>
```

The `Updated` line is omitted when no update timestamp exists.

## Digest

Used for daily digests, manual refresh digest output, and the inline `Refresh all` action.

```text
Daily order digest

Active orders: <count>
<provider>: <count>

Stuck alerts:
- <severity>: <alert message>

Recent changes:
- <provider>:<order id> -> <raw status>
```

When there are no active alerts:

```text
Stuck alerts: none
```

When there are no recent changes:

```text
Recent changes: none
```

## Settings Screens

### Digest Settings

```text
Digest settings
```

### General Settings

```text
Settings
```

### Printify Settings

```text
Printify settings
```

```text
Paste the Printify API key in the next message.
```

```text
Printify key saved. Toggle the stores to capture orders for:
```

### Gelato Settings

```text
Gelato settings
```

```text
Paste the Gelato API key in the next message.
```

```text
Gelato key saved. Use Settings > Gelato > Add Gelato store to attach store IDs.
```

```text
Send the Gelato store as: store-id | Store Name
```

```text
Store not saved. Send it as: store-id | Store Name
```

```text
Gelato store saved: <store name> (<store id>)
```

## Callback Popups

These are short Telegram callback-query popup messages.

```text
Order not found.
Enable the Printify store in settings first.
Enable the Gelato store in settings first.
Order refreshed.
Provider link is not available for this order.
Orders refreshed.
Store not found.
<store name> enabled.
<store name> disabled.
```

## Inline Button Labels

### Order List

```text
<provider>:<external order id>
Refresh all
Digest settings
```

### Order Details

```text
View Details
Refresh Now
Open Provider
```

`Open Provider` only appears when a provider URL is available.

### Digest Settings

```text
Disable digest
Enable digest
```

### General Settings

```text
Digest
Printify
Gelato
```

### Provider Settings

```text
Add Printify key
Add Gelato key
Add Gelato store
ON <store name>
OFF <store name>
Back
```
