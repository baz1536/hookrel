# hookrel

Self-hosted webhook relay — receives inbound webhooks, matches them against rules, and dispatches notifications to 9 provider types (email, Telegram, Discord, Slack, Pushover, Gotify, Ntfy, Teams, Microsoft Graph).

## Stack

- **Runtime:** Node.js 26, CommonJS
- **Web:** Express 5, Helmet, express-session, express-rate-limit
- **Database:** SQLite (`better-sqlite3`, default) or MongoDB (switchable via `DB_TYPE`)
- **Auth:** Session-based, bcrypt password hashing, optional TOTP 2FA
- **Encryption:** AES-256-GCM for provider credentials at rest
- **Logging:** Winston with daily file rotation
- **Dev:** nodemon, esbuild (TipTap editor bundle), ESLint + Stylelint + HTMLHint

## Project layout

```
src/
  server.js               — entry point
  constants/providerTypes.js
  middleware/auth.js      — setupSession, requireAuth, requireAdmin
  repositories/           — groups, rules, sources, providers, templates, logs, users, settings
  routes/
    api/                  — REST endpoints (rules, groups, sources, providers, templates, logs, settings, auth, dashboard)
    webhook.js            — inbound webhook receiver (token auth, multipart + JSON)
    index.js              — SPA shell routes
  services/
    db/
      index.js            — adapter selector (sqlite or mongodb)
      sqlite.js           — SQLite implementation
      mongodb.js          — MongoDB implementation
    providers/            — discord, email, gotify, ntfy, pushover, slack, teams
    ruleEngine.js         — condition matching (8 operators, AND/OR modes, group ordering)
    notifier.js           — dispatch orchestration (Promise.allSettled, partial failure tolerance)
    templateEngine.js     — payload token substitution
    payloadParser.js      — JSON + Plex multipart parsing
    encryption.js         — AES-256-GCM
    sessionStore.js       — DB-backed session store
    retention.js          — log cleanup
    users.js
  utils/
    logger.js             — Winston logger
    nanoid.js             — ID generation
  editor-src/             — TipTap rich text editor (compiled to public/js/tiptap.bundle.js)
public/                   — client-side HTML/JS/CSS
```

## Commands

```bash
npm run dev           # nodemon --env-file .env src/server.js
npm start             # node --env-file .env src/server.js
npm run build:editor  # esbuild TipTap bundle
npm run lint          # eslint + stylelint + htmlhint
npm run docker:push
```

## Environment

`PORT` (3551), `NODE_ENV`, `PUBLIC_URL` (for webhook URL display behind reverse proxy), `DB_TYPE` (sqlite|mongodb), `DB_PATH`, `AUTH_ENABLED`, `ENCRYPTION_KEY`, `SESSION_SECRET`, `LOG_LEVEL`, `LOG_DIR`, `HTTPS_PROXY`/`HTTP_PROXY`/`NO_PROXY`.

## Key conventions

- **Dual DB adapter** — `services/db/index.js` selects the adapter at startup; both SQLite and MongoDB expose the same function signatures. Never import sqlite.js or mongodb.js directly from routes — always go through repositories
- **Repository layer** — all DB access goes through `repositories/`; routes never query the DB directly
- **Webhook dispatch is async** — the inbound handler responds synchronously (201) then dispatches in `setImmediate`; failures are logged but never surface to the sender
- **Provider credentials are encrypted** — `notifier.js` calls `decryptProvider()` before sending; never log decrypted credentials
- Proxy is bootstrapped via `global-agent` before any outbound HTTP (covers Telegram, email, MS Graph)
- Plex webhooks arrive as `multipart/form-data` — `payloadParser.js` handles both JSON and multipart

## TypeScript migration

See `TYPESCRIPT_MIGRATION.md` — draft plan, not yet applied. Start with `git checkout -b TypeScript`.
