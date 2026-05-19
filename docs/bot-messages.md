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
| `/digest` | Show the current order digest |
| `/settings` | Open bot settings |

## Command Replies

### `/start`

```text
📦 Order notifier is active in this group.
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
<One Order Details message per active not-delivered order>
```

When no active orders exist:

```text
No open orders found.
```

### `/digest`

```text
<Order Digest message>
```

### `/settings`

```text
⚙️ Settings
```

## Order Details

Used for individual order alerts and order detail views for every provider.

```text
<provider emoji> <provider name>
🏬 <store name or store id|Unknown>

📦 Order: <copyable dashboard/provider order number>
🏭 Sent to production: <sent-to-production date|Pending>

👤 Customer: <customer name|Unknown>
💵 Total cost: <currency amount|Pending>

🚚 Tracking: <tracking url or number|Pending|Delivered, no tracking number|In transit, no tracking number>
📍 Status: <mapped Printify-style status>
```

Delivered orders are not sent as Order Details. They are also omitted from `/orders`, `/refresh`, and the digest.

Example:

```text
🖨️ Printify
🏬 Peddlex

📦 Order: 4052650188
🏭 Sent to production: Sun, May 10

👤 Customer: Jordan Larkin
💵 Total cost: USD 57.88

🚚 Tracking: Pending
📍 Status: Ready to ship
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
<PROVIDER> order <dashboard/provider order number>
Status: <raw provider status>
Items: <item count>
Updated: <updated ISO timestamp>
```

The `Updated` line is omitted when no update timestamp exists.

## Digest

Used for the 6-hour order digest, manual refresh digest output, and the inline `🔄 Refresh all` action.

```text
📋 Order Digest

Printify
🏬 <store label>

📦 Order: <copyable dashboard/provider order number>
👤 Customer: <customer name|Unknown>
📍 Status: <mapped Printify-style status>

Gelato
🏬 <store label>

📦 Order: <copyable external order id>
👤 Customer: <customer name|Unknown>
📍 Status: <mapped Printify-style status> &lt;- <previous mapped status>
```

When there are no active orders:

```text
📋 Order Digest

No active orders.
```

## Settings Screens

### Digest Settings

```text
📋 Digest settings
```

### General Settings

```text
⚙️ Settings
```

### Printify Settings

```text
🖨️ Printify settings
```

```text
🔑 Paste the Printify API key in the next message.
```

```text
🔑 Printify key saved. Toggle the stores to capture orders for:
```

### Gelato Settings

```text
🌐 Gelato settings
```

```text
🔑 Paste the Gelato API key in the next message.
```

```text
🔑 Gelato key saved. Use Settings > Gelato > Add Gelato store to attach store IDs.
```

```text
🏬 Send the Gelato store as: store-id | Store Name
```

```text
🏬 Store not saved. Send it as: store-id | Store Name
```

```text
🏬 Gelato store saved: <store name> (<store id>)
```

## Callback Popups

These are short Telegram callback-query popup messages.

```text
📦 Order not found.
🖨️ Enable the Printify store in settings first.
🌐 Enable the Gelato store in settings first.
🔄 Order refreshed.
📍 Provider link is not available for this order.
🔄 Orders refreshed.
🏬 Store not found.
✅ <store name> enabled.
⬜ <store name> disabled.
```

## Inline Button Labels

### Order List

```text
<provider icon> <customer name>
🔄 Refresh all
📋 Digest settings
```

### Order Details

```text
View Details
🔄 Refresh Now
📍 Open Provider
```

`Open Provider` only appears when a provider URL is available.

### Production Risk Alert

```text
⚠️⚠️ Production risk

<provider icon> <Provider>
🏬 <store name>

📦 Order: <copyable order id>
📥 Order received: <date|Pending>
🏭 Sent to production: <date|Pending>
📍 Status: <status>

⚠️ Risk: <risk reason>
⏱️ Risk age: <duration>
📅 Expected ship date: <date|Unavailable>

👤 Customer: <customer name|Unknown>
💵 Total cost: <amount|Pending>

🚚 Tracking: <tracking|Pending>
```

### Digest Settings

```text
📋 Disable digest
📋 Enable digest
⬜ Enable digest only on new updates
✅ Enable digest only on new updates
```

### General Settings

```text
📋 Digest
🖨️ Printify
🌐 Gelato
```

### Provider Settings

```text
🔑 Add Printify key
🔑 Add Gelato key
🏬 Add Gelato store
✅ <store name>
⬜ <store name>
⚙️ Back
```
