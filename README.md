# HookRel

**Webhooks in. Notifications out.**

HookRel is a self-hosted webhook relay. It receives webhook events from your applications, matches them against your rules, formats them using templates, and dispatches notifications to your chosen providers — all without writing a single line of code.

---

## How it works

```
Your App  →  HookRel  →  Rules  →  Message Template  →  Provider (Email / Telegram / Pushover)
```

1. Your application sends a webhook to HookRel's unique URL
2. HookRel matches the event type against your configured rules
3. The payload is rendered through your message template
4. The notification is delivered via your registered provider

---

## Features

- **Multiple providers** — SMTP, Microsoft 365, Teams, Telegram, Pushover, Slack, Discord, Gotify, ntfy
- **Rich message templates** — HTML editor with formatting, tables, and colour for email; plain text for Telegram and Pushover
- **Pre-built source catalogue** — Sonarr, Radarr, Prowlarr, Seerr, Tautulli, or any custom app
- **Live token learning** — Custom sources automatically learn available tokens from real payloads
- **Flexible rules** — Match by source, event type, or both; fire all matching rules or just the first
- **Dual database** — SQLite (zero setup, default) or MongoDB
- **Credential encryption** — Provider secrets encrypted at rest
- **Multi-user** — Admin and read-only user roles with session auth

---

## Quick start

### Docker (recommended)

```yaml
services:
  hookrel:
    image: baz1536/hookrel:latest
    container_name: hookrel
    restart: unless-stopped
    ports:
      - "3551:3551"
    environment:
      PORT: 3551
      NODE_ENV: production
      PUBLIC_URL: http://your-server-ip:3551
      DB_TYPE: sqlite
      DB_PATH: /app/data/hookrel.db
      AUTH_ENABLED: "true"
      ENCRYPTION_KEY: "replace_with_64_hex_chars"
      SESSION_SECRET: "replace_with_64_hex_chars"
    volumes:
      - hookrel_data:/app/data
      - hookrel_logs:/app/logs

volumes:
  hookrel_data:
  hookrel_logs:
```

Then open `http://your-server-ip:3551` — you'll be prompted to create an admin account on first launch.

### Generate secrets

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Run twice — once for `ENCRYPTION_KEY`, once for `SESSION_SECRET`.

---

## Environment variables

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3551` | Port the server listens on |
| `NODE_ENV` | `production` | Node environment |
| `PUBLIC_URL` | *(none)* | Public-facing base URL — used to build webhook URLs in the UI. Set to your domain or IP. |

| `DB_TYPE` | `sqlite` | Database type — `sqlite` or `mongodb` |
| `DB_PATH` | `./data/hookrel.db` | SQLite file path or MongoDB connection URI |
| `AUTH_ENABLED` | `true` | Set to `false` to bypass authentication (dev/trusted network only) |
| `ENCRYPTION_KEY` | *(required)* | 64-char hex string — encrypts provider credentials at rest |
| `SESSION_SECRET` | *(required)* | 64-char hex string — signs session cookies |
| `LOG_LEVEL` | `info` | Log verbosity — `error`, `warn`, `info`, `debug` |
| `LOG_DIR` | `./logs` | Directory for daily rotating log files |
| `TZ` | *(system)* | Timezone (e.g. `Europe/London`) |
| `HTTPS_PROXY` | *(none)* | Proxy for outbound HTTPS traffic (Telegram, Pushover, MS Graph, email) |
| `HTTP_PROXY` | *(none)* | Proxy for outbound HTTP traffic |
| `NO_PROXY` | *(none)* | Comma-separated list of hosts/CIDRs to bypass the proxy |

---

## Proxy support

If your server routes outbound traffic through a corporate or network proxy, set the standard proxy environment variables:

```env
HTTPS_PROXY=http://proxy.example.com:3128
HTTP_PROXY=http://proxy.example.com:3128
NO_PROXY=localhost,127.0.0.1,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16
```

All outbound clients (Telegram, Pushover, Microsoft Graph, SMTP) will route through the proxy automatically. `NO_PROXY` accepts a comma-separated list of hostnames, IP addresses, or CIDR ranges that should bypass the proxy — include your internal network ranges so local services (e.g. MongoDB, other containers) are unaffected.

If no proxy variables are set, HookRel connects directly — there is no overhead.

---

## Database options

### SQLite (default — zero setup)

```env
DB_TYPE=sqlite
DB_PATH=/app/data/hookrel.db
```

The database file is created automatically. Mount `/app/data` as a volume to persist it.

### MongoDB

```env
DB_TYPE=mongodb
DB_PATH=mongodb://user:pass@host:27017/hookrel?authSource=admin
```

The full connection URI is used — host, port, credentials, database name, and auth source all in one value. HookRel creates its own collections and indexes on first start.

---

## Supported providers

| Provider | Format | Notes |
|---|---|---|
| SMTP | HTML or plain text | Standard email via any SMTP server |
| Microsoft 365 | HTML or plain text | Via Microsoft Graph API — requires an app registration |
| Microsoft Teams | Plain text | Via incoming webhook connector |
| Telegram | Plain text | Via bot token |
| Pushover | Plain text | Via API token and user key |
| Slack | Plain text | Via incoming webhook URL |
| Discord | Plain text | Via webhook URL |
| Gotify | Plain text | Via app token |
| ntfy | Plain text | Via topic URL |

---

## Supported webhook sources

| Source | Event type field | Known events |
|---|---|---|
| Jellyfin | `NotificationType` | ItemAdded, PlaybackStart, PlaybackStop, UserCreated, and more |
| Plex | `event` | media.play, media.pause, media.stop, media.scrobble, library.new |
| Prowlarr | `eventType` | Health, ApplicationUpdate |
| Radarr | `eventType` | Grab, Download, Rename, MovieAdded, Health, and more |
| Seerr | `notification_type` | Media pending/approved/available, Issue events |
| Sonarr | `eventType` | Grab, Download, Rename, SeriesAdd, Health, and more |
| Tautulli | `action` | play, stop, pause, resume, watched, recently_added |
| Uptime Kuma | `heartbeat.status` | `0` (down), `1` (up) |
| Custom | Configurable | Tokens learned automatically from live payloads |

---

## Webhook authentication

**Note:** Plex webhooks are sent as `multipart/form-data` (Plex Pass required). HookRel handles this automatically — no special configuration needed.

Each source gets a unique URL and bearer token. Configure your application to POST to:

```
POST https://your-hookrel-url/webhook/<slug>
```

With either:
```
Authorization: Bearer <token>
```
or:
```
X-API-Key: <token>
```

---

## Docker Compose with MongoDB

```yaml
services:
  hookrel:
    image: baz1536/hookrel:latest
    container_name: hookrel
    restart: unless-stopped
    ports:
      - "3551:3551"
    environment:
      PORT: 3551
      NODE_ENV: production
      PUBLIC_URL: http://your-server-ip:3551
      DB_TYPE: mongodb
      DB_PATH: mongodb://hookrel:yourpassword@mongodb:27017/hookrel?authSource=admin
      AUTH_ENABLED: "true"
      ENCRYPTION_KEY: "replace_with_64_hex_chars"
      SESSION_SECRET: "replace_with_64_hex_chars"
    volumes:
      - hookrel_logs:/app/logs

  mongodb:
    image: mongo:7
    container_name: mongodb
    restart: unless-stopped
    environment:
      MONGO_INITDB_ROOT_USERNAME: hookrel
      MONGO_INITDB_ROOT_PASSWORD: yourpassword
    volumes:
      - mongodb_data:/data/db

volumes:
  hookrel_logs:
  mongodb_data:
```

---

## Behind a reverse proxy

Set `PUBLIC_URL` to your external domain so webhook URLs shown in the UI are correct:

```env
PUBLIC_URL=https://hookrel.example.com
```

Webhook URLs will then appear as `https://hookrel.example.com/webhook/<slug>` in the UI.

---

## License

MIT — see [LICENSE](LICENSE)

Copyright © 2026 dBR Promotions. All rights reserved.
