# Deployment Guide: GeoPin & Exam Portal

**Author:** Shashikant
**Date:** February 2026
**Version:** 1.0

---

## Table of Contents

- [Part A: Running on Your MacBook (Local Demo)](#part-a-running-on-your-macbook-local-demo)
  - [A1. Prerequisites Check](#a1-prerequisites-check)
  - [A2. GeoPin Local Setup](#a2-geopin-local-setup)
  - [A3. Exam Portal Local Setup](#a3-exam-portal-local-setup)
  - [A4. Testing Both Apps](#a4-testing-both-apps)
  - [A5. Access from Phone (Same WiFi)](#a5-access-from-phone-same-wifi)
- [Part B: Understanding Web Hosting](#part-b-understanding-web-hosting)
  - [B1. What is Web Hosting?](#b1-what-is-web-hosting)
  - [B2. Types of Hosting](#b2-types-of-hosting)
  - [B3. What Each App Needs](#b3-what-each-app-needs)
- [Part C: Recommended Hosting for India](#part-c-recommended-hosting-for-india)
  - [C1. GeoPin Hosting Options](#c1-geopin-hosting-options)
  - [C2. Exam Portal Hosting Options](#c2-exam-portal-hosting-options)
  - [C3. Railway (Both Apps)](#c3-railway-both-apps)
  - [C4. Indian Hosting Options](#c4-indian-hosting-options)
- [Part D: Web Deployment Steps](#part-d-web-deployment-steps)
  - [D1. GeoPin on PythonAnywhere](#d1-geopin-on-pythonanywhere)
  - [D2. GeoPin on Railway](#d2-geopin-on-railway)
  - [D3. Exam Portal on Vercel + Neon](#d3-exam-portal-on-vercel--neon)
  - [D4. Domain Name Setup](#d4-domain-name-setup)
  - [D5. HTTPS / SSL](#d5-https--ssl)
- [Part E: Maintenance Checklist](#part-e-maintenance-checklist)
  - [E1. Backups](#e1-backups)
  - [E2. Updating Code](#e2-updating-code)
  - [E3. Monitoring](#e3-monitoring)
- [Appendix: Quick Reference Card](#appendix-quick-reference-card)

---

# Part A: Running on Your MacBook (Local Demo)

This section will get both apps running on your laptop so you can demo them to anyone — even from your phone.

---

## A1. Prerequisites Check

Open **Terminal** (press `Cmd + Space`, type "Terminal", press Enter) and run each command below to check what's installed.

### Check Python

```bash
python3 --version
```

**Expected output:** `Python 3.11.x` or `Python 3.12.x` (any 3.9+ is fine)

**If not installed:**

```bash
# Install Homebrew first (if you don't have it)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Then install Python
brew install python
```

### Check Node.js

```bash
node --version
```

**Expected output:** `v20.x.x` or higher

```bash
npm --version
```

**Expected output:** `10.x.x` or higher

**If not installed:**

```bash
brew install node
```

### Check PostgreSQL

```bash
psql --version
```

**Expected output:** `psql (PostgreSQL) 14.x` or higher

```bash
# Check if PostgreSQL is running
brew services list | grep postgresql
```

**Expected output:** A line showing `postgresql` with status `started`

**If not installed:**

```bash
brew install postgresql@16
brew services start postgresql@16
```

**If installed but not running:**

```bash
brew services start postgresql
```

### Create the Exam Portal Database

```bash
createdb exam_portal
```

If this gives an error like "database already exists", that's fine — it means the database is already created.

### Summary: What Each App Needs

| Prerequisite | GeoPin | Exam Portal |
|-------------|--------|-------------|
| Python 3.9+ | Yes | No |
| Node.js 20+ | No | Yes |
| PostgreSQL | No (uses SQLite) | Yes |
| pip (Python package manager) | Yes (comes with Python) | No |
| npm (Node package manager) | No | Yes (comes with Node) |

---

## A2. GeoPin Local Setup

GeoPin is a Python/Flask app that uses SQLite — no database setup needed!

### Step 1: Open Terminal and go to the project folder

```bash
cd ~/Downloads/GeoPin
```

### Step 2: Create a virtual environment (recommended)

A virtual environment keeps GeoPin's packages separate from your system Python.

```bash
python3 -m venv venv
```

### Step 3: Activate the virtual environment

```bash
source venv/bin/activate
```

You'll see `(venv)` appear at the beginning of your terminal prompt. This means the virtual environment is active.

### Step 4: Install dependencies

```bash
pip install -r requirements.txt
```

This installs Flask, Pillow (image processing), geopy (maps), and other packages. Takes about 30 seconds.

### Step 5: Run the app

```bash
python3 run.py
```

**Expected output:**

```
[SEED] Default admin created: username=admin, password=admin123
 * Serving Flask app 'geopin'
 * Debug mode: on
 * Running on all addresses (0.0.0.0)
 * Running on http://127.0.0.1:5001
 * Running on http://192.168.x.x:5001
```

### Step 6: Open in browser

Open your web browser and go to:

```
http://localhost:5001
```

This takes you to the field user page (mobile capture screen).

For the admin panel, go to:

```
http://localhost:5001/admin/login
```

**Default admin login:**
- Username: `admin`
- Password: `admin123`

### Step 7: Stop the app (when done)

Press `Ctrl + C` in the terminal to stop GeoPin.

To deactivate the virtual environment:

```bash
deactivate
```

### Troubleshooting: GeoPin

| Problem | Solution |
|---------|----------|
| `ModuleNotFoundError: No module named 'flask'` | Run `pip install -r requirements.txt` again. Make sure venv is activated. |
| `Address already in use` | Another app is using port 5001. Close it or change the port in `run.py` (line: `app.run(... port=5001 ...)`) |
| Images not showing on map | Check that `geopin/static/uploads/` folder exists |
| `[Errno 13] Permission denied` | Run `chmod -R 755 ~/Downloads/GeoPin` |

---

## A3. Exam Portal Local Setup

Exam Portal is a Next.js app that needs PostgreSQL.

### Step 1: Make sure PostgreSQL is running

```bash
brew services list | grep postgresql
```

If it's not running:

```bash
brew services start postgresql
```

### Step 2: Create the database (if not done already)

```bash
createdb exam_portal
```

### Step 3: Open Terminal and go to the project folder

```bash
cd ~/Downloads/exam-portal
```

### Step 4: Install dependencies

```bash
npm install
```

This downloads all JavaScript packages. Takes 1-2 minutes.

### Step 5: Set up the environment file

Check if `.env` exists:

```bash
ls -la .env
```

If the file exists, verify it has the correct content:

```bash
cat .env
```

It should contain:

```
DATABASE_URL="postgresql://shashikant@localhost:5432/exam_portal?schema=public"
AUTH_SECRET="exam-portal-secret-key-change-in-production-2024"
AUTH_TRUST_HOST=true
NEXTAUTH_URL="http://localhost:3000"
```

If `.env` doesn't exist, create it:

```bash
cat > .env << 'EOF'
DATABASE_URL="postgresql://shashikant@localhost:5432/exam_portal?schema=public"
AUTH_SECRET="exam-portal-secret-key-change-in-production-2024"
AUTH_TRUST_HOST=true
NEXTAUTH_URL="http://localhost:3000"
EOF
```

> **Note:** Replace `shashikant` with your Mac username if different. To check your username, run `whoami`.

### Step 6: Set up the database tables

```bash
npx prisma migrate deploy
```

**Expected output:**

```
1 migration found in prisma/migrations
1 migration applied successfully
```

### Step 7: Load sample data

```bash
npx tsx prisma/seed.ts
```

This creates 10 test users, 30 questions, and 2 sample tests.

### Step 8: Run the app

```bash
npm run dev
```

**Expected output:**

```
  ▲ Next.js 16.1.6
  - Local:        http://localhost:3000
  - Network:      http://192.168.x.x:3000
```

### Step 9: Open in browser

```
http://localhost:3000
```

**Test accounts (all created by seed data):**

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@exam.com | admin123 |
| Admin | superadmin@exam.com | admin123 |
| Contributor | rahul@exam.com | contrib123 |
| Contributor | priya@exam.com | contrib123 |
| Contributor | amit@exam.com | contrib123 |
| Candidate | sneha@exam.com | cand123 |
| Candidate | ravi@exam.com | cand123 |
| Candidate | ananya@exam.com | cand123 |
| Candidate | vikram@exam.com | cand123 |
| Candidate | meera@exam.com | cand123 |

### Step 10: Stop the app (when done)

Press `Ctrl + C` in the terminal.

### Troubleshooting: Exam Portal

| Problem | Solution |
|---------|----------|
| `Error: P1001: Can't reach database server` | PostgreSQL is not running. Run `brew services start postgresql` |
| `Error: database "exam_portal" does not exist` | Run `createdb exam_portal` |
| `EACCES: permission denied` | Run `sudo chown -R $(whoami) ~/Downloads/exam-portal/node_modules` |
| Port 3000 already in use | Use `npm run dev -- -p 3001` to run on port 3001 |
| `prisma migrate` fails | Try `npx prisma migrate reset` (warning: this erases all data) |
| Blank page after login | Clear browser cookies for localhost:3000, then try again |

---

## A4. Testing Both Apps

You can run both apps at the same time! Each uses a different port.

### Running Both Simultaneously

**Terminal 1 — GeoPin:**

```bash
cd ~/Downloads/GeoPin
source venv/bin/activate
python3 run.py
```

**Terminal 2 — Exam Portal:**

```bash
cd ~/Downloads/exam-portal
npm run dev
```

### Quick Test Checklist

**GeoPin (http://localhost:5001):**

- [ ] Field user page loads at `http://localhost:5001`
- [ ] Admin login works at `http://localhost:5001/admin/login` (admin / admin123)
- [ ] Admin dashboard shows stats
- [ ] Map page loads with Leaflet map
- [ ] Can add a field user from admin panel
- [ ] Field capture page requests camera and GPS permissions

**Exam Portal (http://localhost:3000):**

- [ ] Login page loads at `http://localhost:3000/login`
- [ ] Admin login works (admin@exam.com / admin123)
- [ ] Admin dashboard shows statistics
- [ ] Contributor login works (rahul@exam.com / contrib123)
- [ ] Candidate login works (sneha@exam.com / cand123)
- [ ] Candidate can see available tests
- [ ] Question bank has 30 questions

---

## A5. Access from Phone (Same WiFi)

You can access both apps from your phone — perfect for demoing GeoPin's camera/GPS features!

### Step 1: Find your Mac's IP address

```bash
ipconfig getifaddr en0
```

**Example output:** `192.168.1.42`

If that gives no output, try:

```bash
ipconfig getifaddr en1
```

### Step 2: Access from phone

Make sure your phone is connected to the **same WiFi network** as your MacBook.

Open your phone's browser and go to:

| App | URL on Phone |
|-----|-------------|
| GeoPin | `http://192.168.1.42:5001` (replace with your IP) |
| Exam Portal | `http://192.168.1.42:3000` (replace with your IP) |

### Step 3: Allow network access (if prompted)

The first time you run the apps, macOS may ask: *"Do you want the application to accept incoming network connections?"*

Click **Allow**.

### Important Notes for Phone Access

- **GeoPin camera/GPS:** Works on localhost without HTTPS. On a phone via IP address, some browsers may block GPS. If GPS doesn't work on phone, that's normal for HTTP — it will work when deployed with HTTPS.
- **Both apps must be running** on your MacBook for phone access to work.
- If your Mac goes to sleep, the apps will stop responding. Keep it awake during demos.

---

# Part B: Understanding Web Hosting

This section explains web hosting concepts in simple terms so you can make informed decisions.

---

## B1. What is Web Hosting?

Right now, your apps run on your MacBook. Only you (and people on your WiFi) can use them. **Web hosting** means putting your apps on a computer that's always connected to the internet — so anyone in the world can access them.

Think of it like this:

| Concept | Real-World Analogy |
|---------|-------------------|
| Your MacBook | Your home kitchen — you can cook, but only your family eats |
| Web Hosting | A restaurant — anyone can come and eat |
| Domain Name (e.g., geopin.com) | The restaurant's address/signboard |
| HTTPS/SSL | A security guard at the restaurant door |

When you "deploy" your app, you're basically:
1. Copying your code to the hosting computer
2. Installing the dependencies there
3. Starting the app
4. Pointing a web address to it

---

## B2. Types of Hosting

### Shared Hosting (Cheapest, Limited)

- Your app shares a computer with hundreds of other websites
- Like living in an apartment building
- **Cheap:** Rs. 100-300/month
- **Limitations:** Cannot run Python/Node freely, limited control
- **Examples:** GoDaddy, Hostinger, Bluehost
- **Verdict:** Not suitable for GeoPin or Exam Portal

### Platform-as-a-Service / PaaS (Best for Beginners)

- You upload your code, the platform handles everything else
- Like hiring a caterer — you provide the recipe, they cook
- **Price:** Free tiers available, paid plans Rs. 500-2000/month
- **Examples:** PythonAnywhere, Vercel, Railway, Render
- **Verdict:** Best choice for your apps

### VPS — Virtual Private Server (More Control)

- You get your own virtual computer in the cloud
- Like renting a commercial kitchen — you manage everything
- **Price:** Rs. 300-1500/month
- **Examples:** DigitalOcean, AWS, Google Cloud, Linode
- **Verdict:** Good for later when you need more control

### Managed Hosting (Premium)

- Everything managed for you — servers, updates, backups
- Like a franchise — they handle operations, you focus on the product
- **Price:** Rs. 2000-10000/month
- **Examples:** AWS Elastic Beanstalk, Google App Engine
- **Verdict:** Overkill for now, good for large-scale later

---

## B3. What Each App Needs

### GeoPin Requirements

| Need | Details |
|------|---------|
| Language | Python 3.9+ |
| Framework | Flask |
| Database | SQLite (simple) or PostgreSQL (scalable) |
| File Storage | Stores uploaded photos (needs persistent storage) |
| HTTPS | Required for GPS on mobile browsers |
| Memory | ~128 MB minimum |
| CPU | Very light usage |

### Exam Portal Requirements

| Need | Details |
|------|---------|
| Language | Node.js 20+ |
| Framework | Next.js 16 (React) |
| Database | PostgreSQL (required, not optional) |
| File Storage | Minimal (no file uploads) |
| HTTPS | Recommended for login security |
| Memory | ~256 MB minimum |
| Build Step | `npm run build` required before production |

---

# Part C: Recommended Hosting for India

Here are the best hosting options, ranked from easiest to most flexible.

---

## C1. GeoPin Hosting Options

### Option 1: PythonAnywhere (Easiest — Recommended for Beginners)

| Feature | Details |
|---------|---------|
| **Website** | [www.pythonanywhere.com](https://www.pythonanywhere.com) |
| **Free Tier** | Yes — 1 web app, 512 MB storage, limited CPU |
| **Price (Paid)** | $5/month (~Rs. 420/month) for more power |
| **Database** | SQLite works free, PostgreSQL on paid plan |
| **HTTPS** | Free SSL on `yourusername.pythonanywhere.com` |
| **Difficulty** | Very Easy — web-based setup, no terminal needed |
| **Limitation** | Free tier blocks external API calls (affects geocoding) |
| **Best For** | Quick demo, learning deployment |

### Option 2: Railway (Modern, Easy)

| Feature | Details |
|---------|---------|
| **Website** | [railway.app](https://railway.app) |
| **Free Tier** | $5 free credits/month (enough for small apps) |
| **Price (Paid)** | $5/month base + usage |
| **Database** | PostgreSQL add-on available |
| **HTTPS** | Automatic |
| **Difficulty** | Easy — connects to GitHub |
| **Best For** | Modern deployment with Git integration |

### Option 3: DigitalOcean App Platform

| Feature | Details |
|---------|---------|
| **Website** | [www.digitalocean.com](https://www.digitalocean.com) |
| **Free Tier** | 3 free static sites, $5/month for apps |
| **Database** | Managed PostgreSQL ($15/month) |
| **HTTPS** | Automatic |
| **Difficulty** | Medium — more options to configure |
| **Best For** | Production-grade hosting |

---

## C2. Exam Portal Hosting Options

### Option 1: Vercel + Neon (Best for Next.js — Recommended)

| Feature | Details |
|---------|---------|
| **Vercel** | [vercel.com](https://vercel.com) — made by the creators of Next.js |
| **Neon** | [neon.tech](https://neon.tech) — free PostgreSQL database |
| **Free Tier** | Both have generous free tiers |
| **Vercel Free** | Unlimited deployments, 100 GB bandwidth |
| **Neon Free** | 0.5 GB storage, 190 hours compute/month |
| **HTTPS** | Automatic on both |
| **Difficulty** | Easy — designed for Next.js apps |
| **Best For** | Exam Portal specifically |

### Option 2: Railway

- Same as GeoPin option — can host both apps on one platform
- Built-in PostgreSQL
- $5 free credits/month

### Option 3: Render

| Feature | Details |
|---------|---------|
| **Website** | [render.com](https://render.com) |
| **Free Tier** | Free web service (spins down after inactivity) |
| **Database** | Free PostgreSQL (90-day limit, then paid) |
| **HTTPS** | Automatic |
| **Best For** | Alternative to Vercel |

---

## C3. Railway (Both Apps on One Platform)

If you want to keep things simple and host both apps in one place:

| Feature | Details |
|---------|---------|
| **What you get** | 1 account, 1 dashboard for both apps |
| **GeoPin** | Python service + SQLite or PostgreSQL |
| **Exam Portal** | Node.js service + PostgreSQL |
| **Free credits** | $5/month (enough for light usage of both) |
| **Advantage** | One bill, one platform, easier to manage |
| **Disadvantage** | Free tier might not be enough for both running 24/7 |

---

## C4. Indian Hosting Options

If you prefer Indian hosting providers (payment in INR, Indian support):

| Provider | Type | Price | Python | Node.js | PostgreSQL |
|----------|------|-------|--------|---------|------------|
| **DigitalOcean** (Bangalore datacenter) | VPS | Rs. 420/month | Yes | Yes | Yes |
| **Hostinger India** | VPS | Rs. 199/month | Yes | Yes | Yes |
| **AWS Mumbai Region** | Cloud | Pay-per-use | Yes | Yes | Yes |
| **Google Cloud Mumbai** | Cloud | Pay-per-use | Yes | Yes | Yes |

> **Recommendation:** Start with PythonAnywhere (GeoPin) + Vercel+Neon (Exam Portal) since both are free. Move to Railway or DigitalOcean when you need more power.

---

# Part D: Web Deployment Steps

Detailed step-by-step instructions for deploying each app.

---

## D1. GeoPin on PythonAnywhere

### Prerequisites

- A GitHub account ([github.com](https://github.com) — free)
- Your GeoPin code pushed to GitHub

### Step 1: Push GeoPin to GitHub

If you haven't already put your code on GitHub:

```bash
cd ~/Downloads/GeoPin

# Initialize git (if not already a repo)
git init
git add .
git commit -m "Initial commit: GeoPin app"

# Create a repository on GitHub (go to github.com -> New Repository -> name it "GeoPin")
# Then run:
git remote add origin https://github.com/YOUR_USERNAME/GeoPin.git
git branch -M main
git push -u origin main
```

### Step 2: Create a PythonAnywhere account

1. Go to [www.pythonanywhere.com](https://www.pythonanywhere.com)
2. Click **"Pricing & signup"**
3. Choose **"Create a Beginner account"** (free)
4. Enter username, email, password
5. Verify your email

### Step 3: Open a Bash console on PythonAnywhere

1. After logging in, click the **"Consoles"** tab
2. Under "Start a new console", click **"Bash"**

### Step 4: Clone your code

In the PythonAnywhere Bash console:

```bash
git clone https://github.com/YOUR_USERNAME/GeoPin.git
```

### Step 5: Create a virtual environment

```bash
cd GeoPin
mkvirtualenv --python=/usr/bin/python3.10 geopin-env
pip install -r requirements.txt
```

### Step 6: Set up the web app

1. Go to the **"Web"** tab on PythonAnywhere
2. Click **"Add a new web app"**
3. Click **"Next"** (accept the free domain: `yourusername.pythonanywhere.com`)
4. Select **"Manual configuration"** (not Flask — we'll configure it ourselves)
5. Select **Python 3.10**
6. Click **"Next"**

### Step 7: Configure the WSGI file

1. On the Web tab, click the **WSGI configuration file** link (it looks like `/var/www/yourusername_pythonanywhere_com_wsgi.py`)
2. Delete all the contents and replace with:

```python
import sys
import os

# Add your project directory to the path
project_home = '/home/YOUR_USERNAME/GeoPin'
if project_home not in sys.path:
    sys.path.insert(0, project_home)

# Set environment variables
os.environ['FLASK_ENV'] = 'production'
os.environ['SECRET_KEY'] = 'your-secret-key-change-this-to-something-random'

# Import your Flask app
from geopin import create_app
from geopin.extensions import db

application = create_app()

with application.app_context():
    db.create_all()
```

3. Click **"Save"**

### Step 8: Set the virtualenv path

On the Web tab, in the **"Virtualenv"** section:

- Enter: `/home/YOUR_USERNAME/.virtualenvs/geopin-env`
- Press Enter

### Step 9: Set the static files

On the Web tab, in the **"Static files"** section:

| URL | Directory |
|-----|-----------|
| `/static/` | `/home/YOUR_USERNAME/GeoPin/geopin/static` |

### Step 10: Reload the app

Click the green **"Reload"** button on the Web tab.

### Step 11: Visit your app!

Open:

```
https://yourusername.pythonanywhere.com
```

Admin login:

```
https://yourusername.pythonanywhere.com/admin/login
```

---

## D2. GeoPin on Railway

### Step 1: Push code to GitHub

(Same as Step 1 in D1 above)

### Step 2: Create additional files for Railway

You need to create two files in your GeoPin project:

**File 1: `Procfile`** (in the root folder, no extension)

```
web: gunicorn "geopin:create_app()" --bind 0.0.0.0:$PORT
```

**File 2: `runtime.txt`** (in the root folder)

```
python-3.11.0
```

**Update `requirements.txt`** — add gunicorn:

```
# Add this line at the end of requirements.txt
gunicorn==21.2.0
```

Commit and push these changes:

```bash
cd ~/Downloads/GeoPin
git add Procfile runtime.txt requirements.txt
git commit -m "Add Railway deployment files"
git push
```

### Step 3: Create a Railway account

1. Go to [railway.app](https://railway.app)
2. Click **"Login"** -> **"Login with GitHub"**
3. Authorize Railway

### Step 4: Create a new project

1. Click **"New Project"**
2. Select **"Deploy from GitHub repo"**
3. Select your **GeoPin** repository
4. Railway will automatically detect it's a Python project

### Step 5: Add environment variables

1. Click on your service in the Railway dashboard
2. Go to the **"Variables"** tab
3. Add these variables:

| Variable | Value |
|----------|-------|
| `FLASK_ENV` | `production` |
| `SECRET_KEY` | `some-random-string-at-least-32-characters` |

### Step 6: Deploy

Railway auto-deploys when you push to GitHub. After a minute or two, you'll get a URL like:

```
https://geopin-production-xxxx.up.railway.app
```

### Step 7: (Optional) Add PostgreSQL

If you want to upgrade from SQLite to PostgreSQL on Railway:

1. In your Railway project, click **"New"** -> **"Database"** -> **"PostgreSQL"**
2. Railway automatically adds the `DATABASE_URL` variable to your service
3. No code changes needed — GeoPin's `config.py` already reads `DATABASE_URL` in production mode

---

## D3. Exam Portal on Vercel + Neon

This is the recommended setup for the Exam Portal.

### Part 1: Set up Neon PostgreSQL (Database)

### Step 1: Create a Neon account

1. Go to [neon.tech](https://neon.tech)
2. Click **"Sign Up"** -> Sign up with GitHub
3. Create a new project:
   - **Name:** `exam-portal`
   - **Region:** Choose the closest (Asia Pacific if available, otherwise US East)
4. After creation, you'll see your **connection string**. It looks like:

```
postgresql://username:password@ep-xxxx-xxxx-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require
```

**Copy this string** — you'll need it in the next steps.

### Step 2: Run database migration

On your MacBook, temporarily update your `.env` to point to Neon:

```bash
cd ~/Downloads/exam-portal
```

Create a temporary `.env.production` file (don't overwrite your local `.env`):

```bash
cat > .env.production << 'EOF'
DATABASE_URL="postgresql://username:password@ep-xxxx.neon.tech/neondb?sslmode=require"
EOF
```

Run the migration against Neon:

```bash
# Use the production database URL for migration
DATABASE_URL="YOUR_NEON_CONNECTION_STRING" npx prisma migrate deploy
```

Optionally seed the production database:

```bash
DATABASE_URL="YOUR_NEON_CONNECTION_STRING" npx tsx prisma/seed.ts
```

### Part 2: Deploy to Vercel

### Step 3: Push code to GitHub

```bash
cd ~/Downloads/exam-portal

# Initialize git (if not already)
git init

# Create .gitignore if it doesn't exist
# Make sure .env is in .gitignore (it should be already)

git add .
git commit -m "Initial commit: Exam Portal"
git remote add origin https://github.com/YOUR_USERNAME/exam-portal.git
git branch -M main
git push -u origin main
```

### Step 4: Create a Vercel account

1. Go to [vercel.com](https://vercel.com)
2. Click **"Sign Up"** -> **"Continue with GitHub"**
3. Authorize Vercel

### Step 5: Import your project

1. Click **"Add New..."** -> **"Project"**
2. Select your **exam-portal** repository
3. Vercel auto-detects it's a Next.js project

### Step 6: Add environment variables

Before clicking "Deploy", add these environment variables:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | `postgresql://username:password@ep-xxxx.neon.tech/neondb?sslmode=require` (your Neon URL) |
| `AUTH_SECRET` | A random string (generate one with: `openssl rand -base64 32`) |
| `AUTH_TRUST_HOST` | `true` |
| `NEXTAUTH_URL` | `https://your-project-name.vercel.app` (Vercel gives you this URL after first deploy — you can update it later) |

### Step 7: Configure build settings

Vercel usually auto-detects these, but verify:

| Setting | Value |
|---------|-------|
| Framework Preset | Next.js |
| Build Command | `npx prisma generate && npm run build` |
| Output Directory | (leave default) |
| Install Command | `npm install` |

> **Important:** The build command must include `npx prisma generate` before `npm run build` so Prisma Client is generated during the build.

### Step 8: Deploy!

Click **"Deploy"**. Vercel will:
1. Install dependencies
2. Generate Prisma Client
3. Build your Next.js app
4. Deploy it

After 2-3 minutes, you'll get a URL like:

```
https://exam-portal-xxxx.vercel.app
```

### Step 9: Update NEXTAUTH_URL

1. Go to your project Settings -> Environment Variables on Vercel
2. Update `NEXTAUTH_URL` to your actual Vercel URL
3. Click **"Redeploy"** from the Deployments tab

### Step 10: Test your deployment

Open your Vercel URL and try logging in:

- Admin: `admin@exam.com` / `admin123`
- Candidate: `sneha@exam.com` / `cand123`

### Auto-deployments

Every time you push code to GitHub, Vercel automatically rebuilds and deploys your app!

---

## D4. Domain Name Setup (Optional)

A custom domain gives your app a professional address like `geopin.in` or `examportal.in`.

### Where to Buy a Domain

| Provider | Price (.in domain) | Price (.com domain) |
|----------|-------------------|---------------------|
| [Namecheap](https://namecheap.com) | ~Rs. 600/year | ~Rs. 800/year |
| [GoDaddy India](https://in.godaddy.com) | ~Rs. 499/year | ~Rs. 999/year |
| [BigRock](https://www.bigrock.in) | ~Rs. 399/year | ~Rs. 799/year |
| [Google Domains](https://domains.google) | ~Rs. 800/year | ~Rs. 1000/year |

### Connecting Domain to Vercel (Exam Portal)

1. Buy your domain (e.g., `examportal.in`)
2. In Vercel dashboard -> Project Settings -> Domains
3. Add your domain: `examportal.in`
4. Vercel will give you DNS records to add
5. Go to your domain registrar's DNS settings
6. Add the records Vercel specifies (usually an A record or CNAME)
7. Wait 5-30 minutes for DNS to propagate
8. Update `NEXTAUTH_URL` in Vercel to `https://examportal.in`

### Connecting Domain to PythonAnywhere (GeoPin)

1. **Requires paid PythonAnywhere plan** ($5/month)
2. In PythonAnywhere -> Web tab -> add your domain
3. Add a CNAME record at your registrar pointing to:
   ```
   webapp-yourusername.pythonanywhere.com
   ```
4. PythonAnywhere provides free HTTPS via Let's Encrypt

### Connecting Domain to Railway

1. In Railway -> Project Settings -> Domains
2. Add your custom domain
3. Railway gives you a CNAME record to add at your registrar
4. Railway provides free HTTPS automatically

---

## D5. HTTPS / SSL

**HTTPS** (the padlock icon in your browser) encrypts data between the user and your server. It's essential for:

- GeoPin: Required for GPS to work on mobile browsers
- Exam Portal: Required for secure login

### Good News: HTTPS is Automatic!

| Platform | HTTPS |
|----------|-------|
| PythonAnywhere | Automatic (free, on their subdomain) |
| Vercel | Automatic (free, on all domains) |
| Railway | Automatic (free, on all domains) |
| Neon | Already uses SSL for database connections |

You don't need to do anything — all recommended platforms provide HTTPS for free.

---

# Part E: Maintenance Checklist

After deploying, here's how to keep your apps running smoothly.

---

## E1. Backups

### GeoPin Backups

**What to back up:**
- SQLite database file (`instance/geopin.db`)
- Uploaded photos (`geopin/static/uploads/`)

**On PythonAnywhere:**

```bash
# In PythonAnywhere Bash console
cd ~/GeoPin

# Backup database
cp instance/geopin.db instance/geopin_backup_$(date +%Y%m%d).db

# Download backup via Files tab on PythonAnywhere
```

**On Railway:**
- If using PostgreSQL, Railway provides automatic backups
- For SQLite: Railway's file system is ephemeral (not persistent) — use PostgreSQL instead

**Local backup (from your Mac):**

```bash
# Backup GeoPin database
cp ~/Downloads/GeoPin/instance/geopin.db ~/Downloads/geopin_backup_$(date +%Y%m%d).db
```

### Exam Portal Backups

**On Neon:**
- Neon automatically creates point-in-time backups
- You can also manually export:

```bash
# From your Mac (requires psql installed)
pg_dump "YOUR_NEON_CONNECTION_STRING" > exam_portal_backup_$(date +%Y%m%d).sql
```

**Local backup:**

```bash
pg_dump exam_portal > ~/Downloads/exam_portal_backup_$(date +%Y%m%d).sql
```

### Backup Schedule

| What | How Often | Method |
|------|-----------|--------|
| GeoPin database | Weekly | Manual download or cron job |
| GeoPin photos | Weekly | Download uploads folder |
| Exam Portal database | Weekly | `pg_dump` or Neon dashboard |
| Code (GitHub) | Every change | `git push` |

---

## E2. Updating Code

### Updating GeoPin

**On PythonAnywhere:**

```bash
# In PythonAnywhere Bash console
cd ~/GeoPin
git pull origin main
pip install -r requirements.txt  # In case new packages were added

# Then go to Web tab and click "Reload"
```

**On Railway:**

```bash
# On your Mac — just push to GitHub!
cd ~/Downloads/GeoPin
git add .
git commit -m "Update: description of changes"
git push
# Railway auto-deploys within 1-2 minutes
```

### Updating Exam Portal

**On Vercel:**

```bash
# On your Mac — just push to GitHub!
cd ~/Downloads/exam-portal
git add .
git commit -m "Update: description of changes"
git push
# Vercel auto-deploys within 2-3 minutes
```

**If you changed the database schema (prisma/schema.prisma):**

```bash
# On your Mac
cd ~/Downloads/exam-portal

# Create a new migration
npx prisma migrate dev --name describe_your_change

# Push to GitHub (Vercel will run migrations during build)
git add .
git commit -m "Database: description of change"
git push
```

> **Important:** After database schema changes, you may need to run `DATABASE_URL="YOUR_NEON_URL" npx prisma migrate deploy` manually if Vercel build doesn't run migrations automatically.

---

## E3. Monitoring

### Check if Apps Are Running

**Quick check from browser:**
- Open your app's URL
- If it loads, it's running!

**PythonAnywhere:**
- Web tab -> Check "Log files" section
- Error log: shows Python errors
- Server log: shows access requests

**Vercel:**
- Dashboard -> Project -> "Logs" tab
- Shows real-time request and error logs

**Railway:**
- Dashboard -> Service -> "Logs" tab
- Shows real-time logs with search

### Common Issues After Deployment

| Issue | Platform | Solution |
|-------|----------|----------|
| App shows error page | All | Check error logs for the specific error |
| Database connection error | Vercel/Railway | Verify `DATABASE_URL` in environment variables |
| "Application not responding" | PythonAnywhere | Click "Reload" on Web tab |
| Slow first load | Vercel (free) | Normal — free tier has cold starts |
| App works then stops | Railway (free) | Free tier has limited hours; upgrade if needed |
| GPS not working on phone | PythonAnywhere | Make sure you're using `https://` not `http://` |

### Uptime Monitoring (Optional)

For free uptime monitoring (get notified if your app goes down):

1. Go to [uptimerobot.com](https://uptimerobot.com) (free for up to 50 monitors)
2. Create an account
3. Add monitors for your app URLs
4. Set check interval to 5 minutes
5. Add your email for notifications

---

# Appendix: Quick Reference Card

## Local Development Commands

### GeoPin

```bash
cd ~/Downloads/GeoPin
source venv/bin/activate        # Activate virtual environment
python3 run.py                  # Start app on port 5001
deactivate                      # When done
```

**URL:** http://localhost:5001
**Admin:** admin / admin123

### Exam Portal

```bash
cd ~/Downloads/exam-portal
npm run dev                     # Start app on port 3000
```

**URL:** http://localhost:3000
**Admin:** admin@exam.com / admin123

---

## Deployment Summary

| App | Best Free Option | URL Pattern |
|-----|-----------------|-------------|
| GeoPin | PythonAnywhere | `https://username.pythonanywhere.com` |
| Exam Portal | Vercel + Neon | `https://exam-portal.vercel.app` |
| Both together | Railway | `https://appname.up.railway.app` |

---

## Emergency: Reset Everything Locally

If something goes completely wrong and you want to start fresh:

### Reset GeoPin

```bash
cd ~/Downloads/GeoPin
rm -f instance/geopin.db        # Delete the database
rm -rf geopin/static/uploads/*  # Delete uploaded photos
python3 run.py                  # Recreates database + admin user
```

### Reset Exam Portal

```bash
cd ~/Downloads/exam-portal
npx prisma migrate reset        # WARNING: Deletes ALL data
npx tsx prisma/seed.ts          # Reload sample data
npm run dev
```

---

## Cost Summary (Monthly)

### Free Tier (Good for demos and small usage)

| Service | Cost | What You Get |
|---------|------|-------------|
| PythonAnywhere (GeoPin) | Free | 1 app, 512 MB, limited CPU |
| Vercel (Exam Portal) | Free | Unlimited deploys, 100 GB bandwidth |
| Neon (Database) | Free | 0.5 GB storage, PostgreSQL |
| GitHub | Free | Unlimited repositories |
| **Total** | **Free** | |

### Paid Tier (For production use)

| Service | Cost | What You Get |
|---------|------|-------------|
| PythonAnywhere (GeoPin) | $5/month (~Rs. 420) | Custom domain, more CPU, PostgreSQL |
| Vercel Pro (Exam Portal) | $20/month (~Rs. 1680) | More bandwidth, analytics |
| Neon Pro (Database) | $19/month (~Rs. 1600) | More storage, autoscaling |
| Domain name | ~Rs. 500/year | Professional web address |
| **Total** | **~Rs. 3,700/month + Rs. 500/year** | |

### Budget Option (Paid, but cheaper)

| Service | Cost | What You Get |
|---------|------|-------------|
| Railway (Both apps) | $5/month (~Rs. 420) | Both apps + database |
| Domain name | ~Rs. 500/year | Professional web address |
| **Total** | **~Rs. 420/month + Rs. 500/year** | |

---

*End of Deployment Guide*
