# tg-notifier

Telegram bot for monitoring Gelato and Printify orders from a single authorized Telegram group chat.

The service:

- accepts updates only from one configured Telegram group
- polls provider order state every 30 minutes
- stores orders, status history, and settings in SQLite
- posts order details for new orders and problem orders
- sends a six-hour digest of current not-delivered orders

## Current scope

This project is built for:

- one Telegram bot
- one authorized Telegram group chat
- one Gelato account
- one Printify shop

Private chats, DMs, and other groups are ignored silently.

## Stack

- Node.js 22
- TypeScript
- Fastify
- grammY
- Drizzle ORM
- SQLite
- node-cron
- Docker / Docker Compose

## Project structure

```text
src/
  config.ts              env loading and validation
  main.ts                app bootstrap
  db/                    sqlite schema and repository
  domain/                normalized order types
  http/server.ts         health route
  jobs/                  30-minute refresh and digest scheduling
  providers/             Gelato and Printify adapters
  telegram/              bot commands, keyboards, rendering, access control
tests/                   unit tests
```

## Requirements

- Node.js 22+
- npm 11+
- a Telegram bot token from BotFather
- a Telegram group where the bot is added
- a Gelato API key
- a Gelato store ID
- a Printify API token
- a Cloudflare Tunnel token if you want Docker to publish the app through your domain automatically

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create your local env file:

```bash
cp .env.example .env
```

3. Fill in `.env`:

```env
TELEGRAM_BOT_TOKEN=
AUTHORIZED_TELEGRAM_CHAT_ID=
CLOUDFLARE_TUNNEL_TOKEN=
GELATO_API_KEY=
GELATO_STORE_ID=
PRINTIFY_API_TOKEN=
PRINTIFY_SHOP_ID=
DATABASE_PATH=./data/tg-notifier.sqlite
PORT=38127
DEFAULT_TIMEZONE=UTC
```

4. Start the app:

```bash
npm run dev
```

5. Verify health:

```bash
curl http://localhost:38127/health
```

Expected response:

```json
{"ok":true}
```

## Telegram setup

### Create the bot

1. Create a bot with BotFather.
2. Copy the bot token into `TELEGRAM_BOT_TOKEN`.

### Add the bot to your group

1. Add the bot to the Telegram group you want to use.
2. Send at least one message in that group.
3. Find the group chat ID and set it as `AUTHORIZED_TELEGRAM_CHAT_ID`.

The bot only responds when `chat.id` exactly matches `AUTHORIZED_TELEGRAM_CHAT_ID`.

### Getting the group chat ID

One practical way is:

1. Temporarily run the bot.
2. Call Telegram `getUpdates` for your bot token:

```bash
curl "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates"
```

3. Find the group chat object and copy its `id`.

Group IDs are usually negative, often like `-100...`.

## Commands

Supported commands in the authorized group:

- `/start`
- `/help`
- `/orders`
- `/digest`
- `/settings`

The bot uses inline buttons for:

- viewing order details
- refreshing order state
- digest settings
- Printify shop selection

## Running with Docker

Build and run:

```bash
docker compose up --build
```

The SQLite database is stored in the local `./data` directory and mounted into the container.

### Compose services

The Compose stack includes:

- `app`: the Telegram bot and Fastify health server
- `cloudflared`: a Cloudflare Tunnel sidecar

If `CLOUDFLARE_TUNNEL_TOKEN` is set, `docker compose up --build` starts both services and publishes the app through your configured Cloudflare hostname.

If you only want to run the bot locally without the tunnel:

```bash
docker compose up --build app
```

## Cloudflare Tunnel

This repository is set up for a remotely-managed Cloudflare Tunnel using the official `cloudflare/cloudflared` Docker image and the documented token-based run command.

Relevant Cloudflare docs:

- [Cloudflare Tunnel overview](https://developers.cloudflare.com/tunnel/)
- [Tunnel routing](https://developers.cloudflare.com/tunnel/routing/)
- [Tunnel tokens](https://developers.cloudflare.com/tunnel/advanced/tunnel-tokens/)
- [Docker tunnel setup](https://developers.cloudflare.com/tunnel/setup/)

### One-time Cloudflare setup

1. Add your spare domain to Cloudflare if it is not already there.
2. In the Cloudflare dashboard, create a remotely-managed tunnel.
3. Add a public hostname such as `bot.example.com`.
4. Route that hostname to the local service `http://app:38127`.
5. Copy the tunnel token from the Cloudflare dashboard.
6. Put the token into `.env`:

```env
CLOUDFLARE_TUNNEL_TOKEN=eyJ...
```

After that, this repository can be copied to another machine and started with one command:

```bash
docker compose up --build -d
```

### What the tunnel container runs

The sidecar container runs:

```text
cloudflared tunnel --no-autoupdate run --token <CLOUDFLARE_TUNNEL_TOKEN>
```

That is Cloudflare's documented Docker pattern for remotely-managed tunnels.

### Verifying the tunnel

Check the app locally:

```bash
curl http://localhost:38127/health
```

Then check the public hostname:

```bash
curl https://bot.example.com/health
```

Expected response:

```json
{"ok":true}
```

## Polling and scheduling

Background jobs currently do the following:

- every 30 minutes:
  refresh Printify orders
  refresh known Gelato orders
  send order details for new orders and problem statuses
- every 6 hours:
  refresh current not-delivered orders
  send the order digest

## Database

SQLite tables used by the service:

- `orders`
- `order_items`
- `status_events`
- `settings`

The schema is defined in [src/db/schema.ts](/Users/angelo/Projects/Work/tg-notifier/src/db/schema.ts).

## Development commands

Run tests:

```bash
npm test
```

Build TypeScript:

```bash
npm run build
```

Generate Drizzle artifacts:

```bash
npm run db:generate
```

Run Drizzle migrations:

```bash
npm run db:migrate
```

## Current limitations

- the included Cloudflare container assumes a remotely-managed tunnel already exists and that its token is present in `.env`
- provider dashboard deep links are not populated yet
- digest behavior is currently limited to enable/disable in Telegram settings
- Gelato new-order discovery depends on known orders until provider-wide discovery is added

## Verification

Current verification commands:

```bash
npm test
npm run build
```
