# Implementation Report

Transformation of the existing Exam Portal into a full Examination Management System.
Date: 2026-11-20.

## 1. What was inspected
- **`exam-portal/`** — the existing app: Next.js 16 (App Router) + React 19 + TS,
  shadcn/ui + Tailwind v4, NextAuth v5, **Prisma 5 on PostgreSQL**, roles
  ADMIN/CONTRIBUTOR/CANDIDATE. Working question/test/attempt/result/certificate models.
- **`Proctoring/Proctoring/`** — a standalone ProctorGuard system: Express + Prisma/Postgres
  backend + Python AI face-detection, and a Vite/React frontend with mature hooks
  (`useBrowserMonitoring`, `useWebcamCapture`), `WebcamPreview`, `examLock`, `proctoringService`.
  Its own `LMS_MERGE_DESIGN.md` targeted a *different* product, so no ready-made integration.

## 2. What was replaced
- **Data layer**: Prisma/PostgreSQL fully removed; rebuilt on **MongoDB Atlas + Mongoose**
  (confirmed with the owner). All old Prisma-coupled routes/pages deleted.
- **Roles/domain**: ADMIN/CONTRIBUTOR/CANDIDATE → **SUPER_ADMIN / ALC_CENTER / STUDENT**,
  with ALC multi-tenancy, class/stream distribution, MS-CIT, approvals.
- **Auth**: kept NextAuth v5 but re-backed on Mongoose, login by **email or mobile**,
  bcrypt + account lockout, split edge-safe config for the `proxy.ts` middleware.

## 3. What was reused from the proctoring folder
- `examLock.ts` (fullscreen + Keyboard Lock) — ported verbatim.
- `useBrowserMonitoring` and `useWebcamCapture` — ported and adapted to this app's
  endpoints and conventions.
- `WebcamPreview` and `WarningBanner` — ported.
- The server-side policy concept (warnings → termination) reimplemented in
  `src/lib/proctoring.ts` against Mongoose; evidence stored to Cloudinary.
- The Python AI service is **not** bundled; it is pluggable via `AI_SERVICE_URL`.

## 4. What was implemented
- Auth + RBAC middleware; class-aware student registration (Cloudinary photo, MS-CIT enquiry).
- Three role dashboards with real DB stats; shared responsive app shell.
- **Distribution engine** (`src/lib/distribution.ts`): exactly 25 questions honoring
  5-7 / 8-10 / 11-12 category min-max rules, with actionable errors.
- Question bank CRUD + **Excel** template/import/validate/commit.
- Test composer (distribution + proctoring config), submit (feasibility-gated).
- Admin approval (approve / reject / request-changes + notifications).
- Scheduling, eligibility, enrollment (with optional-proctoring choice).
- **Exam engine**: frozen 25-question set (no regeneration on refresh), shuffled options,
  correct answers never sent to client, autosave, server-authoritative timer, grading +
  category breakdown, double-submit protection.
- Professional exam UI (palette with 4 status colours, timer, mark-for-review, submit dialog).
- **Proctoring**: consent/session, event policy + auto-termination, heartbeat, snapshot
  evidence → Cloudinary, pre-exam camera/identity/consent gate, live webcam corner + warning banner.
- Admin: centers CRUD (+ login creation), students management, MS-CIT enquiries (+CSV export),
  audit log viewer. ALC: students, scheduling, results/analytics.

## 5. Database models (`src/models/`, 17 collections)
User, ALCCenter, StudentProfile, Question, Test, TestEnrollment, ExamAttempt,
ExamResponse, ExamResult, ProctoringSession, ProctoringEvent, ProctoringEvidence,
MSCITEnquiry, AuditLog, Notification, SystemSetting, TermsVersion — with indexes,
tenant keys, and partial-unique email/mobile.

## 6. APIs (`src/app/api/**`)
- `auth/[...nextauth]`, `public/register`
- `alc/questions` (+`[id]`, `template`, `import`, `import/commit`), `alc/pool`,
  `alc/tests` (+`[id]`, `submit`, `schedule`), `alc/students` (+`[id]`), `alc/results`
- `admin/approvals`, `admin/tests/[id]` (+`decision`), `admin/centers` (+`[id]`),
  `admin/students/[id]`, `admin/enquiries` (+`[id]`), `admin/audit`
- `student/tests` (+`[id]/enroll`), `student/results`, `student/account` (+`password`)
- `exam/[testId]/start|answer|submit`, `exam/[testId]/proctoring/consent|event|heartbeat|snapshot`

## 7. Environment variables
`MONGODB_URI`, `MONGODB_DB` (opt), `AUTH_SECRET`, `AUTH_TRUST_HOST`,
`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`,
`NEXT_PUBLIC_APP_URL`, `AI_SERVICE_URL` (opt), plus optional `SEED_*`.

## 8. Tests executed and results (live, against Atlas + Cloudinary)
- Student registration incl. MS-CIT enquiry creation, duplicate 409, null email/mobile
  uniqueness — **pass** (fixed a real sparse-index bug → partial index).
- ALC login (role + centerId in session), question create/list (center-scoped) — **pass**.
- Excel template download, import preview (valid/invalid/duplicate detection), commit — **pass**.
- Test composer create + submit; infeasible pool rejected with exact error — **pass**.
- Admin approval (list, preview with answers, approve) — **pass** (fixed populate model-registration).
- Full exam: schedule → enroll → start (**exactly 25**, **no answer leak**) → **refresh returns
  identical frozen set** → answer → submit → grade + category breakdown → double-submit 409 — **pass**.
- Proctoring: consent, 3 violations → warnings 1/2/3 → **auto-termination**, heartbeat TERMINATED,
  snapshot → **real Cloudinary URL** — **pass**.
- Admin centers/students/enquiries/audit endpoints — **pass**.
- `tsc --noEmit` clean; `npm run build` succeeds (all ~45 routes).

## 9. Remaining issues / not yet built
- Proctoring **review UI** for admin/ALC (events + evidence are captured and stored;
  the viewing screen is not built yet).
- Student per-attempt **result detail page** (history list + category breakdown exists).
- Admin create-student form (students self-register; admin can manage/reset/delete).
- Multi-center test assignment UI (model + API field `assignedCenters` exist).
- AI face-detection is off unless `AI_SERVICE_URL` is configured.
- Build is memory-intensive on <4 GB machines (worker cap + `NODE_OPTIONS` documented).
