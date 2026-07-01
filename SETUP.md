# Lockbox — Setup Guide

Secure secret & file sharing for Vista employees. Hosted at **lockbox.vista.co**.

## Monorepo structure

```
packages/
├── ui/      React 19 SPA (Vite 8 + TanStack Router + Tailwind 4)
├── api/     Cloudflare Worker — Hono 4 (auth, API, serves UI)
├── cron/    Cloudflare Worker — daily expiry cleanup
├── email/   Cloudflare Worker — transactional email
└── db/      Shared Drizzle schema (imported by api + cron)
```

---

## 1. Cloudflare Resources (Already Created)

You've already created all necessary resources. Update your wrangler configs with these IDs:

### D1 Databases

**Global database** (metadata + non-EU secrets):
```
Name: lockbox
ID: 61ebaa99-9fff-4804-a0c8-0ecbb99289bc
```

**EU database** (EU secrets only, EU jurisdiction):
```
Name: lockbox-eu
ID: 11d1906e-3cd4-4b26-9e56-b236acff76ad
```

Currently only the global database is used. To silo EU data to `lockbox-eu`, you'd need to add a second D1 binding and route based on the `eu_jurisdiction` flag. This can be done in a future iteration.

**Update in `packages/api/wrangler.toml` and `packages/cron/wrangler.toml`**: ✅ Done

### R2 Storage Buckets

**Global bucket** (non-EU files):
```
Name: lockbox
Custom domain: r2.lockbox.vista.co
```

**EU bucket** (EU files, EU jurisdiction):
```
Name: lockbox-eu
Custom domain: eu.lockbox.vista.co
Jurisdiction: eu
```

**Update in `packages/api/wrangler.toml` and `packages/cron/wrangler.toml`**: ✅ Done

### Workers KV Namespace

**For PKCE state storage** (short-lived auth flows):
```bash
# Get the KV namespace ID:
npx wrangler kv:namespace list

# Find "lockbox" in the output, get its "id" field
# Add it to packages/api/wrangler.toml under [[kv_namespaces]]
```

**Update in `packages/api/wrangler.toml`**: ⏳ Pending (add the ID from command above)

---

## 2. R2 Configuration: Lifecycle Rules & CORS

### Lifecycle Rules (Auto-delete after 31 days)

To auto-delete orphaned blobs that are not referenced in the database:

**In Cloudflare dashboard**:

1. **Bucket: lockbox** (Global, non-EU)
   - Click **Settings** tab
   - Scroll to **Lifecycle rules**
   - Click **Add a lifecycle rule**
   - Rule name: `delete-orphans-global`
   - Apply to: All objects
   - Object age: `31 days`
   - Action: **Delete**
   - Save

2. **Bucket: lockbox-eu** (EU)
   - Repeat the same rule
   - Rule name: `delete-orphans-eu`

**Why 31 days?**
- Secrets/files expire after 15 days (FILE_EXPIRE_DAYS)
- Orphaned blobs have 31 days before auto-delete (16-day safety buffer)
- Cron cleanup runs daily at 03:00 UTC to delete expired entries + associated blobs
- Lifecycle rules are a safety net for orphans that slip through

### Enable Local Uploads (Faster global uploads)

**Bucket: lockbox** only (global uploads):

```bash
# Optimize for geographically distributed uploads
# Data writes to edge near user, then async replicates to bucket
# No additional cost, zero latency for uploads from uploader's region
npx wrangler r2 bucket local-uploads enable lockbox
```

**Bucket: lockbox-eu**: ❌ Not compatible (jurisdictional restrictions block local uploads)

**Why enable it?**
- Users upload from globally distributed locations
- Data stored near client for fast writes
- Asynchronously replicated to primary bucket
- Cost: $0 extra (same Class A pricing as normal uploads)
- Tradeoff: Brief cross-region read latency during replication (typical: <5 min)

### CORS Configuration: Not Needed

**Question**: Should you configure CORS on R2 buckets?

**Answer**: **No** — your architecture doesn't need it.

**Why**:
- Your browser never directly accesses R2 custom domains
- All requests go through the Worker (`lockbox.vista.co`)
- Routes like `/file/:id` and `/raw/:id` fetch from R2 server-side and return to client
- Worker is a reverse proxy, no browser-to-R2 calls = no CORS

**When you'd need CORS**:
- If using presigned URLs for direct browser downloads
- If the SPA used `fetch()` directly to R2 custom domains
- If doing multipart uploads directly from browser

**Other R2 settings**: Versioning and Object Lock are disabled (not needed for transient blobs).

---

## 3. Entra App Registration

✅ **Already configured**:
- Tenant ID: `9a2a7202-e5e0-4d87-8961-875023f85cc5`
- Client ID: `462908d0-7eca-4ece-9fa8-c35357fc873a`
- OpenID Configuration: https://login.microsoftonline.com/9a2a7202-e5e0-4d87-8961-875023f85cc5/v2.0/.well-known/openid-configuration

These are already set in `packages/api/wrangler.toml` as `[vars]`. Only the client secret needs to be set via `wrangler secret put` (see Step 6).

---

## 4. Get KV Namespace ID

```bash
npx wrangler kv:namespace list

# Find "lockbox" in output, copy its "id" field
# Then update packages/api/wrangler.toml:
# [[kv_namespaces]]
# binding = "PKCE_KV"
# id = "<paste_id_here>"
```

---

## 5. Generate TypeScript bindings from config

Run this command in each Worker directory after updating `wrangler.toml`. This auto-generates the `Env` interface to match your actual bindings — never hand-write it.

```bash
# Do this for each package: api, cron, email
cd packages/api
npx wrangler types

cd ../cron
npx wrangler types

cd ../email
npx wrangler types
```

---

## 5. Enable Cloudflare Email Service

The `packages/email` Worker uses Cloudflare's native Email Service API.

1. In Cloudflare dashboard → **Email** → **Email Service** → **Connect Domain**
2. Add domain `lockbox.vista.co`
3. Update DNS records as shown (SPF, DKIM)
4. The `send_email` binding is already configured in `packages/email/wrangler.toml`

---

## 6. Set Worker secrets

Only the client secret needs to be set as a secret (sensitive). Tenant ID and Client ID are already in `wrangler.toml` as vars.

```bash
cd packages/api

# Client secret (sensitive — from Entra App Registration)
npx wrangler secret put ENTRA_CLIENT_SECRET

# Session secret (random 32-byte hex string for HMAC signing)
npx wrangler secret put SESSION_SECRET
# Generate one: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 7. Run migrations

```bash
# Local
npx pnpm@10 --filter @lockbox/api run db:migrate:local

# Remote (production)
npx pnpm@10 --filter @lockbox/api run db:migrate:remote
```

---

## 8. Install & build

```bash
npx pnpm@10 install

npx pnpm@10 run build        # builds ui → dist/, then api worker
```

---

## 9. Deploy

```bash
# Deploy everything
npx pnpm@10 run deploy:all

# Or individually:
npx pnpm@10 run deploy:api     # main worker (includes ui)
npx pnpm@10 run deploy:cron    # cleanup cron
npx pnpm@10 run deploy:email   # email worker
```

---

## 10. Local development

```bash
# Terminal 1 — UI hot-reload
npx pnpm@10 --filter @lockbox/ui run dev

# Terminal 2 — API worker (serves at http://localhost:8787)
npx pnpm@10 --filter @lockbox/api run dev
```

In development the API worker reads `packages/ui/dist` for assets.
Run `pnpm run build:ui` once before starting the API dev server.

---

## Access model

| Action | Who |
|--------|-----|
| Create/upload secrets | Authenticated Vista employees (Entra SSO) |
| Read secrets | Anyone with the link |
| Edit secrets | Anyone with the edit password |
| Invite guests (future) | Authenticated employees |

---

## Roadmap

- **Guest invites** — Schema is ready (`invites` table). Employees generate an invite link that lets a single external guest create one secret, accessible only to the inviter.
- **Email notifications** — `packages/email` is wired up; add the `[[send_email]]` binding in `wrangler.toml` and enable Email Routing for `lockbox.vista.co`.
- **Audit log** — Add a `D1` audit table recording who created/accessed what.
