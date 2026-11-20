# Exam Portal — Examination Management System

A full-stack, single-application examination platform with ALC-center multi-tenancy,
class-aware question distribution, a server-authoritative exam engine, and integrated
live proctoring. Built as one Next.js app — frontend, APIs, auth, database and
proctoring all run from `npm run dev`.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + React 19 + TypeScript |
| Styling | Tailwind CSS v4 + shadcn/ui components |
| Database | MongoDB Atlas + Mongoose |
| Auth | NextAuth v5 (credentials, JWT HTTP-only cookie), bcrypt, role-based |
| Media | Cloudinary (profile photos, proctoring evidence) |
| Excel | ExcelJS (template download + import/validation) |
| Validation | Zod (client + server) |

## Architecture

One monolithic Next.js application:

- **Pages** live under `src/app/{admin,alc,student,exam}` with role-scoped layouts.
- **APIs** are Next.js Route Handlers under `src/app/api/**` (no separate backend).
- **Auth** is split into an edge-safe config (`src/lib/auth.config.ts`, used by the
  `src/proxy.ts` middleware for route protection) and the full server auth
  (`src/lib/auth.ts`) so Mongoose/bcrypt never bundle into the edge runtime.
- **Models** are Mongoose schemas in `src/models/` (17 collections).
- **Proctoring** reuses the logic/hooks from the standalone ProctorGuard system,
  ported to this app's endpoints and Cloudinary (see “Proctoring” below).

### Roles

- **SUPER_ADMIN** — centers, students, test approvals, MS-CIT enquiries, audit logs.
- **ALC_CENTER** — question bank, Excel import, test composer, scheduling, enrollment, results.
- **STUDENT** — registration, eligible/enrolled tests, the exam, history, account.

## Prerequisites

- Node.js 20+ and npm
- A MongoDB Atlas cluster (free tier is fine)
- A Cloudinary account (free tier is fine)

## Installation

```bash
cd exam-portal
npm install
cp .env.example .env     # then fill in the values (see below)
npm run seed             # creates the first SUPER_ADMIN + Terms v1
npm run dev              # http://localhost:3000
```

## Environment configuration (`.env`)

```
MONGODB_URI=mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
MONGODB_DB=exam_portal            # optional; defaults to exam_portal
AUTH_SECRET=<openssl rand -base64 32>
AUTH_TRUST_HOST=true
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
NEXT_PUBLIC_APP_URL=http://localhost:3000
AI_SERVICE_URL=                   # optional external face-detection service (see Proctoring)
```

### MongoDB Atlas setup
1. Create a cluster and a database user.
2. Network Access → allow your IP (or `0.0.0.0/0` for testing).
3. Copy the connection string into `MONGODB_URI`. A dedicated database name is
   pinned via `MONGODB_DB` (default `exam_portal`) so data never lands in the
   shared `test` database.

### Cloudinary setup
1. From the Cloudinary dashboard copy Cloud name, API Key and API Secret.
2. Put them in the three `CLOUDINARY_*` variables. Uploads are validated
   (type + size) server-side; nothing is stored on the local filesystem.

## Creating accounts

- **Super admin**: created by `npm run seed` (defaults `admin@examportal.local` /
  `Admin@12345`; override with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`).
- **ALC centers**: the super admin creates a center in **Admin → ALC Centers**,
  which also creates that center's login account. Each center has a unique
  **code** students use at registration.
- **Students**: self-register at `/register` (class-aware form), optionally with a
  center code. The super admin can also manage/reset students.

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the app (dev) |
| `npm run build` | Production build |
| `npm start` | Run the production build |
| `npm run seed` | Seed super admin + Terms (`SEED_DEMO_CENTER=true` adds a demo center) |
| `npx tsx scripts/seed-questions.ts` | Populate the demo center with sample questions |

> **Low-RAM machines:** the build caps workers via `experimental.cpus` in
> `next.config.ts`. If a build OOMs, run it with
> `NODE_OPTIONS="--max-old-space-size=2048" npm run build` and don't run `npm run dev`
> at the same time (both use the `.next` directory).

## Proctoring

Modes are set per test: **MANDATORY**, **OPTIONAL** (student chooses at enrollment),
or **DISABLED**. Once an attempt begins, its mode is locked.

Reused from the existing ProctorGuard system and adapted to this app:
- Browser monitoring (`src/hooks/useBrowserMonitoring.ts`): tab/visibility/focus
  and fullscreen tracking, clipboard & screenshot blocking, heartbeat.
- Webcam capture + preview (`src/hooks/useWebcamCapture.ts`, `WebcamPreview`).
- Fullscreen + keyboard lock (`src/lib/proctoring/examLock.ts`).

Server side (`src/app/api/exam/[testId]/proctoring/*`): consent/session, event
ingestion with a server-authoritative policy (`src/lib/proctoring.ts`) that issues
warnings and auto-terminates on threshold, heartbeat, and snapshot evidence stored
to Cloudinary.

**AI face analysis** (multiple faces / no face) is optional. The original ProctorGuard
Python service is not bundled; set `AI_SERVICE_URL` to integrate it. Without it, the
system does **not** fabricate face-detection results — it records the webcam frames
and the browser-level signals it genuinely captures.

## Deployment

Compatible with any Node.js host. Avoid running long builds on <4 GB RAM hosts.

- **Vercel**: import the repo, set env vars, deploy. Route Handlers run as functions.
  Note: serverless functions are short-lived; periodic proctoring snapshots are sent
  from the browser on an interval, which works, but there is no persistent WebSocket.
- **Render**: a Web Service running `npm run build` then `npm start`, with the env vars set.
- **GoDaddy VPS / standard Node host**: `npm ci && npm run build && npm start` behind a
  reverse proxy (nginx) terminating TLS. Camera/getUserMedia requires **HTTPS**.

## Limitations

- Proctoring is browser-based (not a lockdown browser). Keyboard Lock is Chrome/Edge
  + fullscreen only; users can always force-exit fullscreen, which is detected and
  recorded as a violation.
- Camera access requires HTTPS (or `localhost`).
- AI face-detection requires an external `AI_SERVICE_URL`; it is off by default.
- The build is memory-hungry on constrained machines (see note above).
