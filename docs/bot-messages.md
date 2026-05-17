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
Printify shop selected: <yes|no>
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

Used for individual order detail views for every provider.

Automatically sent only when polling finds a new order or an order with a problem status.

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

## Polling Behavior

The bot uses provider API polling as the source of truth.

- Every 30 minutes, the bot checks provider APIs for new orders and problem statuses.
- New orders receive an Order Details message.
- Orders that move into a problem status receive an Order Details message.
- Every 6 hours, the bot refreshes current not-delivered orders and sends the Order Digest.

## Digest

Used for the 6-hour order digest, manual refresh digest output, and the inline `Refresh all` action.

```text
Order Digest

Printify
<store label>

Order: <external order id>
Customer: <customer name|Unknown>
Status: <mapped Printify-style status>

Order: <external order id>
Customer: <customer name|Unknown>
Status: <mapped Printify-style status> <- <previous mapped status>

Gelato
<store label>

Order: <external order id>
Customer: <customer name|Unknown>
Status: <mapped Printify-style status>
```

The previous status marker is only shown when the order changed status since the last digest.

When there are no active orders:

```text
Order Digest

No active orders.
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

### Printify Shop Selection

```text
Select the Printify shop for this bot.
```

### Printify Shop Selected

```text
Selected Printify shop <shop title or shop id>.
```

## Callback Popups

These are short Telegram callback-query popup messages.

```text
Order not found.
Select a Printify shop in settings first.
Order refreshed.
Provider link is not available for this order.
Orders refreshed.
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
Printify <shop name>
Printify Shop <shop id>
Select Printify Shop
```

### Printify Shop Selection

```text
<shop title> (<shop id>)
Back
```
