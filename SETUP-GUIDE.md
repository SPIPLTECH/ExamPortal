# Exam Portal - Setup & Demo Guide

## Quick Restart (On This Mac)

Open Terminal and run:

```bash
cd ~/Downloads/exam-portal
npm run dev
```

Then open http://localhost:3000 in your browser.

To stop the server, press `Ctrl + C` in the terminal.

---

## Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@exam.com | admin123 |
| Admin 2 | superadmin@exam.com | admin123 |
| Contributor | rahul@exam.com | contrib123 |
| Contributor | priya@exam.com | contrib123 |
| Contributor | amit@exam.com | contrib123 |
| Candidate | sneha@exam.com | cand123 |
| Candidate | ravi@exam.com | cand123 |
| Candidate | ananya@exam.com | cand123 |
| Candidate | vikram@exam.com | cand123 |
| Candidate | meera@exam.com | cand123 |

---

## Copying to Another Computer

Yes, you can copy the `exam-portal` folder to any computer. But the new computer needs some software installed first.

### What the New Computer Needs

1. **Node.js** (version 20 or higher) - https://nodejs.org (download the LTS version)
2. **PostgreSQL** (version 14 or higher) - https://www.postgresql.org/download/

### Step-by-Step Setup on a New Computer

#### Step 1: Install Node.js
- Go to https://nodejs.org
- Download and install the **LTS** version
- Verify: open Terminal and run `node --version` (should show v20 or higher)

#### Step 2: Install PostgreSQL
- **Mac**: `brew install postgresql@16` then `brew services start postgresql@16`
- **Windows**: Download from https://www.postgresql.org/download/windows/ and install
- **Linux**: `sudo apt install postgresql` then `sudo systemctl start postgresql`

#### Step 3: Create the Database
```bash
createdb exam_portal
```

If that doesn't work (on Windows or some setups):
```bash
psql -U postgres -c "CREATE DATABASE exam_portal;"
```

#### Step 4: Copy the Folder
Copy the entire `exam-portal` folder to the new computer (via USB, cloud drive, zip file, etc.).

You can put it in **any folder** - Desktop, Documents, Downloads, anywhere.

#### Step 5: Update Database Connection (if needed)
Open the file `exam-portal/.env` in a text editor. You'll see:

```
DATABASE_URL="postgresql://shashikant@localhost:5432/exam_portal?schema=public"
```

Change `shashikant` to the **username** on the new computer:
- **Mac/Linux**: Run `whoami` in Terminal to find your username
- **Windows**: Usually `postgres` is the username, so use:
  ```
  DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/exam_portal?schema=public"
  ```

#### Step 6: Install Dependencies & Setup Database
Open Terminal, navigate to the folder, and run:

```bash
cd path/to/exam-portal
npm install
npx prisma migrate deploy
npx tsx prisma/seed.ts
```

This will:
- `npm install` - Install all required packages
- `prisma migrate deploy` - Create all database tables
- `tsx prisma/seed.ts` - Load sample data (users, questions, tests, etc.)

#### Step 7: Start the App
```bash
npm run dev
```

Open http://localhost:3000 in your browser.

---

## Troubleshooting

**"command not found: npm"**
- Node.js is not installed or not in your PATH
- Reinstall from https://nodejs.org

**"connection refused" or database errors**
- Make sure PostgreSQL is running
- Mac: `brew services start postgresql@16`
- Linux: `sudo systemctl start postgresql`

**"database exam_portal does not exist"**
- Run: `createdb exam_portal`

**"role does not exist"**
- Edit the `.env` file and update the username in DATABASE_URL

**Port 3000 already in use**
- Another app is using port 3000
- Either close that app, or run: `npm run dev -- -p 3001` (then open http://localhost:3001)

---

## What to Demo

1. **Admin** (admin@exam.com) - Dashboard stats, manage users, review questions, create/manage tests, view all results
2. **Contributor** (rahul@exam.com) - Create questions (4 types: MCQ, Fill-blank, Match, Image-MCQ), submit for review, edit rejected questions
3. **Candidate** (sneha@exam.com) - Browse tests, register, take exam with timer, view results, download PDF certificate
4. **Certificate Verification** - Public page, no login needed. Go to any certificate and click "Verify"
