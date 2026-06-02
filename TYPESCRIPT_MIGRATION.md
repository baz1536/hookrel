# TypeScript Migration Plan — hookrel

> **Status: Draft — not applied**
> This document describes the proposed migration. No files have been changed.

---

## Overview

Migrate the `hookrel` Node.js/Express webhook relay service from CommonJS JavaScript to TypeScript. The project uses CommonJS (`"type": "commonjs"`) and has a dual-database architecture (SQLite or MongoDB, selected at runtime via `DB_TYPE` env var) — the most distinctive aspect of this migration.

**Scope:** ~45 files in `src/`
**Out of scope:** `public/` (client HTML/JS/CSS), `editor-src/` (Tiptap bundle)

---

## Approach: Gradual Migration with `allowJs: true`

Convert files tier by tier (lowest-level first). The compiler accepts both `.js` and `.ts` at once so the app stays runnable throughout.

---

## Step 1 — Create a TypeScript branch

Before making any changes, create and switch to a dedicated branch:

```bash
git checkout -b TypeScript
```

All migration work goes on this branch. Merge back to main only when the full migration is verified and the app runs cleanly.

---

## Step 2 — Install dependencies

```bash
npm install --save-dev typescript tsx @types/node @types/express @types/express-session @types/bcryptjs @types/nodemailer @types/better-sqlite3 @types/multer @typescript-eslint/eslint-plugin @typescript-eslint/parser
```

> `@types/ws` is needed if WebSocket typing is used in providers.
> `helmet`, `express-rate-limit`, `otpauth`, `winston` all ship their own types.

---

## Step 2 — Add tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "CommonJS",
    "moduleResolution": "Node",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "allowJs": true,
    "checkJs": false,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "public", "editor-src"]
}
```

Key decisions:
- `module: CommonJS` — preserves the existing `require()`/`module.exports` convention; no module-system rewrite needed.
- `strict: true` — full strictness from day one on converted files.
- `noUncheckedIndexedAccess` — catches array lookups in rule-matching logic.

---

## Step 3 — Update package.json scripts

```json
{
  "scripts": {
    "build": "tsc --build",
    "start": "node --env-file .env dist/server.js",
    "dev": "tsx watch --env-file .env src/server.ts",
    "lint": "npm run lint:ts && npm run lint:css && npm run lint:html",
    "lint:ts": "eslint src/**/*.{js,ts}"
  }
}
```

Update Dockerfile to add a build step:

```dockerfile
ARG NODE_VERSION=26.2.0
FROM node:${NODE_VERSION}-slim AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY src/ ./src/
COPY tsconfig.json ./
RUN npm run build

FROM node:${NODE_VERSION}-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY --from=build /app/dist ./dist
COPY public/ ./public/
USER node
EXPOSE 3551
CMD ["node", "dist/server.js"]
```

---

## Step 4 — Update ESLint config

Extend `eslint.config.mjs` to handle TypeScript files alongside the existing JS rules:

```js
import js from '@eslint/js';
import n from 'eslint-plugin-n';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.ts'],
    languageOptions: { parser: tsparser },
    plugins: { '@typescript-eslint': tseslint },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['src/**/*.js', 'public/**/*.js'],
    plugins: { n },
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs' },
    rules: {
      'n/no-missing-require': 'error',
      'n/no-extraneous-require': 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
];
```

---

## Step 5 — New file: `src/types/index.ts`

Define all domain types before converting any other files.

```typescript
import type { Request } from 'express';
import type { SessionData } from 'express-session';

// ── Session / Auth ────────────────────────────────────────────────────────────

declare module 'express-session' {
  interface SessionData {
    user?: SessionUser;
  }
}

export interface SessionUser {
  id: string;
  username: string;
  role: 'admin' | 'user';
}

export interface AuthRequest extends Request {
  session: import('express-session').Session & Partial<SessionData>;
}

// ── Sources ───────────────────────────────────────────────────────────────────

export interface Source {
  _id: string;
  name: string;
  slug: string;
  token: string;
  description?: string;
  tokenPaths?: string[];
  eventTypes?: string[];
  createdAt: Date;
  updatedAt: Date;
}

// ── Rules ─────────────────────────────────────────────────────────────────────

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'is_empty'
  | 'is_not_empty';

export type ConditionMode = 'and' | 'or';
export type GroupMatchMode = 'first' | 'all';

export interface Condition {
  field: string;
  operator: ConditionOperator;
  value: string;
}

export interface Rule {
  _id: string;
  name: string;
  active: boolean;
  groupId: string;
  sourceId: string | null;
  eventType: string;
  conditions: Condition[];
  conditionMode: ConditionMode;
  providerIds: string[];
  templateId: string | null;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

// ── Groups ────────────────────────────────────────────────────────────────────

export interface Group {
  _id: string;
  name: string;
  matchMode: GroupMatchMode;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

// ── Providers ─────────────────────────────────────────────────────────────────

export type ProviderType =
  | 'smtp'
  | 'telegram'
  | 'pushover'
  | 'discord'
  | 'slack'
  | 'gotify'
  | 'ntfy'
  | 'msgraph'
  | 'teams';

export interface Provider {
  _id: string;
  name: string;
  type: ProviderType;
  config: Record<string, string>;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ── Templates ─────────────────────────────────────────────────────────────────

export interface Template {
  _id: string;
  name: string;
  subject?: string;
  body: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Inbound Logs ──────────────────────────────────────────────────────────────

export type DispatchStatus = 'pending' | 'success' | 'partial' | 'failed' | 'no_match';

export interface InboundLog {
  _id: string;
  sourceId: string;
  sourceName: string;
  slug: string;
  eventType: string;
  payload: unknown;
  tokens: Record<string, unknown>;
  receivedAt: Date;
  dispatchStatus: DispatchStatus;
  dispatchResults?: DispatchResult[];
}

export interface DispatchResult {
  ruleId: string;
  ruleName: string;
  providerId: string;
  providerName: string;
  success: boolean;
  error?: string;
}

// ── DB Adapter interface ──────────────────────────────────────────────────────
// Both SQLite and MongoDB adapters implement this contract.

export interface DbAdapter {
  isReady(): boolean;
  close(): Promise<void>;
}
```

---

## Step 6 — New file: `src/utils/env.ts`

Centralise all `process.env` access:

```typescript
function required(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
}

export const env = {
  port: parseInt(process.env.PORT ?? '3551', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  dbType: (process.env.DB_TYPE ?? 'sqlite') as 'sqlite' | 'mongodb',
  mongodbUri: process.env.MONGODB_URI,
  sqlitePath: process.env.SQLITE_PATH ?? './data/hookrel.db',
  authEnabled: process.env.AUTH_ENABLED !== 'false',
  sessionSecret: process.env.SESSION_SECRET,
  encryptionKey: process.env.ENCRYPTION_KEY,
  logLevel: process.env.LOG_LEVEL ?? 'info',
  logDir: process.env.LOG_DIR ?? './logs',
  publicUrl: process.env.PUBLIC_URL,
  httpsProxy: process.env.HTTPS_PROXY,
} as const;
```

---

## Step 7 — Conversion order (lowest-level first)

### Tier 1 — Pure utilities
1. `src/utils/env.ts` ← new file (step 6)
2. `src/utils/logger.ts`
3. `src/utils/nanoid.ts`
4. `src/services/encryption.ts`
5. `src/constants/providerTypes.ts`

### Tier 2 — Database adapters
6. `src/services/db/sqlite.ts`
7. `src/services/db/mongodb.ts`
8. `src/services/db/index.ts` ← typed adapter selector

> The dual-adapter pattern means both `sqlite.ts` and `mongodb.ts` must satisfy the same repository function signatures. Consider defining a `Repository<T>` generic interface that both adapters implement.

### Tier 3 — Repositories
9. `src/repositories/users.ts`
10. `src/repositories/sources.ts`
11. `src/repositories/groups.ts`
12. `src/repositories/rules.ts`
13. `src/repositories/providers.ts`
14. `src/repositories/templates.ts`
15. `src/repositories/logs.ts`
16. `src/repositories/settings.ts`

### Tier 4 — Notification providers
17. `src/services/providers/discord.ts`
18. `src/services/providers/email.ts`
19. `src/services/providers/gotify.ts`
20. `src/services/providers/ntfy.ts`
21. `src/services/providers/pushover.ts`
22. `src/services/providers/slack.ts`
23. `src/services/providers/teams.ts`

### Tier 5 — Core services
24. `src/services/users.ts`
25. `src/services/sessionStore.ts`
26. `src/services/sourceCatalogue.ts`
27. `src/services/payloadParser.ts`
28. `src/services/templateEngine.ts`
29. `src/services/ruleEngine.ts`
30. `src/services/notifier.ts`
31. `src/services/retention.ts`

### Tier 6 — Middleware
32. `src/middleware/auth.ts`

### Tier 7 — Route handlers (can be done in parallel)
33. `src/routes/api/auth.ts`
34. `src/routes/api/dashboard.ts`
35. `src/routes/api/groups.ts`
36. `src/routes/api/logs.ts`
37. `src/routes/api/providers.ts`
38. `src/routes/api/rules.ts`
39. `src/routes/api/settings.ts`
40. `src/routes/api/sources.ts`
41. `src/routes/api/templates.ts`
42. `src/routes/webhook.ts`
43. `src/routes/index.ts`

### Tier 8 — Entry point
44. `src/server.ts`

---

## Key challenge: dual-database adapter

The single most complex part of this migration is typing the dual SQLite/MongoDB adapter. Define a shared repository interface that both adapters satisfy:

```typescript
// src/types/repositories.ts

export interface RulesRepository {
  findAll(): Promise<Rule[]>;
  findAllActive(): Promise<Rule[]>;
  findById(id: string): Promise<Rule | null>;
  findByGroup(groupId: string): Promise<Rule[]>;
  create(data: Omit<Rule, '_id' | 'createdAt' | 'updatedAt'>): Promise<Rule>;
  update(id: string, data: Partial<Rule>): Promise<Rule | null>;
  remove(id: string): Promise<boolean>;
  count(): Promise<number>;
}
// ... repeat for each entity
```

Each adapter (`sqlite.ts`, `mongodb.ts`) then satisfies these interfaces. The `db/index.ts` selector returns a typed object:

```typescript
export function getRepositories(): {
  rules: RulesRepository;
  sources: SourcesRepository;
  // ...
}
```

---

## Key challenges & mitigations

| Challenge | Mitigation |
|-----------|------------|
| Dual DB adapter — SQLite rows vs MongoDB documents | Define shared repository interfaces (see above); each adapter implements them |
| SQLite `fromRow()` normalization — coerces types, parses JSON | Type the raw row shape separately; `fromRow` becomes `(raw: SqliteRuleRow) => Rule` |
| `setImmediate` background dispatch in webhook handler | Type the async block explicitly; the sync/async split is intentional and fine as-is |
| Dynamic provider config (`Record<string, string>`) | Keep generic for now; add branded `SmtpConfig`, `SlackConfig` etc. in a follow-up |
| Session-based auth with optional fallback | `req.session.user` is already typed via the session declaration merge |
| `global-agent` proxy setup at module load time | Wrap in a typed `initProxy(): void` helper |
| Microsoft Graph / Azure Identity types | `@azure/identity` and `@microsoft/microsoft-graph-client` both ship their own types |

---

## What stays as-is

| Area | Reason |
|------|---------|
| `public/js/` (16 files) | Client-side — separate concern |
| `public/partials/` (HTML) | Static HTML — no benefit |
| `editor-src/` | Tiptap bundle — built separately with esbuild |

---

## Estimated effort

| Phase | Files | Effort |
|-------|-------|--------|
| Setup (steps 1–4) | — | ~30 min |
| New types/env files | 3 | ~1.5 hrs |
| Tier 1 — utils | 4 | ~1 hr |
| Tier 2 — DB adapters | 3 | ~2 hrs |
| Tier 3 — repositories | 8 | ~2.5 hrs |
| Tier 4 — providers | 7 | ~1.5 hrs |
| Tier 5 — services | 8 | ~2 hrs |
| Tier 6–7 — middleware/routes | 12 | ~2.5 hrs |
| Tier 8 — server | 1 | ~30 min |
| **Total** | **~46 files** | **~14 hrs** |
