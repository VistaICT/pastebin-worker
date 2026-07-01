# Lockbox

Secure secret and attachment sharing for Vista employees.

## Architecture

This repository is now workspace-based only.

```
packages/
├── ui/      React SPA (Vite)
├── api/     Cloudflare Worker (Hono) + serves UI assets
├── cron/    Cloudflare Worker (scheduled cleanup)
├── email/   Cloudflare Worker (email service)
└── db/      Shared Drizzle schema
```

Legacy root-level single-worker code (`app/`, `server/`, `test/`, Nitro/TanStack Start configs) has been removed.

## Development

Install dependencies:

```bash
npx pnpm@10 install
```

Run UI and API locally:

```bash
npx pnpm@10 --filter @lockbox/ui run dev
npx pnpm@10 --filter @lockbox/api run dev
```

## Build

```bash
npx pnpm@10 run build
```

## Deploy

Deploy API worker (serves UI assets):

```bash
npx pnpm@10 run deploy
```

Deploy all workers:

```bash
npx pnpm@10 run deploy:all
```

## API Endpoints (current)

- `POST /api/secrets`
- `GET /api/secrets/:id`
- `PUT /api/secrets/:id`
- `POST /api/files`
- `GET /api/files/:id/meta`
- `GET /f/:id`
- `GET /raw/:id`
- `GET /auth/login`
- `GET /auth/callback`
- `POST /auth/logout`
- `GET /auth/me`

## Setup

For full Cloudflare resource setup (D1, R2, KV, secrets, deploy steps), use:

- `SETUP.md`

## Deployment

### Prerequisites

Before deploying, ensure you have:

1. [Created a Cloudflare D1 database](#3-create-cloudflare-d1-database) and executed the schema
2. [Created a Cloudflare R2 bucket](#4-create-cloudflare-r2-bucket) for file storage
3. [Configured wrangler.toml](#5-configure-wranglertoml) with your account details

### Manual Deployment

To deploy manually using Wrangler:

```bash
# Build the frontend
cd static
yarn build
cd ..

# Deploy to Cloudflare Workers
wrangler deploy
```

### Automated Deployment with GitHub Actions

This project includes a GitHub Actions workflow for automatic deployment on every push to the main branch.

#### Setup GitHub Actions

1. **Get your Cloudflare API Token**:

   - Go to [Cloudflare Dashboard](https://dash.cloudflare.com/profile/api-tokens)
   - Click "Create Token"
   - Use the "Custom token" template with these permissions:
     - Account: Cloudflare Workers:Edit
     - Zone: Zone:Read (if using custom domain)
     - Zone Resources: Include All zones (if using custom domain)

2. **Add the API Token to GitHub Secrets**:

   - Go to your GitHub repository
   - Navigate to Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `CF_API_TOKEN`
   - Value: Your Cloudflare API token

3. **Deploy**: Push to the main branch and the workflow will automatically deploy your changes.

### One-Click Deployment

Click the deploy button at the top of this README to deploy directly to Cloudflare Workers.

## Database Management

### Initialize Database Schema

```bash
# Initialize remote database (production)
yarn initdb:remote

# Initialize local database (development)
yarn initdb:local
```

### Drizzle ORM Commands

This project uses Drizzle ORM for type-safe database operations:

```bash
# Generate migration files after schema changes
yarn db:generate

# Apply migrations to local database
yarn db:migrate:local

# Apply migrations to remote database
yarn db:migrate:remote
```

### Database Schema

The application uses two main tables defined in `src/db/scheme.ts`:

- `pastes`: Stores text pastes with metadata
- `files`: Reserved for future file metadata (currently files are stored in R2)

All database operations are type-safe thanks to Drizzle ORM, which provides:

- Automatic TypeScript type generation
- SQL query builder with type checking
- Migration management
- Better development experience with IntelliSense

## Configuration

### Environment Variables

Set these in your `wrangler.toml` under `[vars]`:

- `ENVIRONMENT`: Set to "production" for production deployment
- `BASE_URL`: Your application's base URL (e.g., "https://your-domain.com")

### Storage Configuration

- **D1 Database**: Used for storing paste metadata and content
- **R2 Bucket**: Used for file uploads (up to 25MB per file)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally using `wrangler dev`
5. Submit a pull request

## License

MIT License - see LICENSE file for details.
