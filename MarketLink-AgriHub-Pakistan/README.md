# MarketLink Agri-Hub Pakistan 🇵🇰

B2B agricultural marketplace connecting Pakistani farmers (kisan) directly with wholesalers, supermarket chains, exporters and food processors: live mandi rates (PKR / maund), bidding & counter-offers, escrow payments, quality inspection and truck tracking.

**Demo logins** (password `password123`): `farmer@marketlink.pk` · `buyer@marketlink.pk` · `inspector@marketlink.pk` · `ahmed.mustafa@admin.com`

## Routes

| Area | Route | Access |
|---|---|---|
| Home · Marketplace · Crop details · Mandi rates · Tracking | `/`, `/marketplace`, `/crop/:id`, `/mandi-rates`, `/tracking` | Public |
| Farmer / Buyer / Inspector / Admin dashboards | `/farmer/dashboard`, `/buyer/dashboard`, `/inspector/dashboard`, `/admin/dashboard` | Role only (enforced in `src/proxy.ts` + server) |
| Database explorer | `/admin/db-explorer` (API `/api/db/query`, `/api/db/schema`) | Admin |
| Auth | `/login`, `/register`, `/verify-email`, `/forgot-password`, `/admin-login` | Public |

## Branding & marketplace workflow

- **MARKETLINK AGRI-HUB** uses the infinity-leaf and wheat identity throughout the header, role dashboards, authentication, chatbot, favicon, and notification emails. Editable SVGs are in `public/brand/`; the email image is a PNG of the same lockup.
- **Farmer / Vendor:** manage profile and crops → negotiate bids → dispatch orders → receive escrow payouts → respond to verified buyer reviews at `/farmer/reviews`.
- **Buyer / Customer:** browse and inspect crops → submit offers → fund escrow → track delivery → rate sellers after delivery.
- **Admin / System Controller:** manage users → monitor transactions and reports → control mandi rates → resolve disputes. Quality inspectors certify crops before dispatch.
- Role dashboards show the steps and live metrics. Admin and Farmer dashboards can download their own current CSV summary report from `/api/reports/summary`.

## Integrations (configure in `.env`)

- **Payments:** Stripe Checkout + webhook, JazzCash & Easypaisa hosted checkout with signed callbacks. A built-in test gateway is used until keys are set (`PAYMENTS_SANDBOX=false` disables it).
- **Email / SMS:** Resend and Twilio. Without keys, messages go to the server log and OTP codes are shown on screen (development mode).
- **Google sign-in:** set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GOOGLE_CALLBACK_URL` (`<your-site>/api/auth/google/callback`, added as an Authorized redirect URI in Google Cloud Console). Until then a clearly-labelled test mode is used (`GOOGLE_OAUTH_MOCK=false` disables it).
- **Password reset:** `/forgot-password` emails a 15-minute single-use link to `/reset-password`; passwords are stored with bcrypt.
- **AI assistant:** `OPENAI_API_KEY` or `GEMINI_API_KEY`; otherwise the built-in rule engine answers.
- **Database schema:** `schema.sql` (PostgreSQL, runtime) and `schema.mysql.sql` (MySQL 8).

## 🛡️ Admin panel (Super Admin: Ahmed Mustafa)

Only `role = admin` can open `/admin/*` or call `/api/admin/*` and `/api/db/*`. Everyone else is redirected to `/login` with "Access Denied: Admin privileges required" (APIs return 403).

- Open **`/admin-login`** (e.g. `http://localhost:3000/admin-login`) and sign in with `ahmed.mustafa@admin.com` / `password123`.
- **Change the default password immediately:** sidebar → **Account settings** (the dashboard shows a red warning until you do).
- Admin pages: Analytics `/admin` · Users & Access `/admin/users` (create admins/inspectors, reset passwords, change roles) · Verification `/admin/verification` · Price Controller `/admin/mandi` · Shipments & Disputes `/admin/orders`.
- Want your own admin email/password from the very first start? Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env` **before** the first run (or delete the `.data` folder to start over).
- Forgot the admin password (local install)? Stop the server, set `ADMIN_PASSWORD` in `.env`, delete the `.data` folder, start again (demo data is recreated).

---

## Folder contents

| Item | What it is |
|---|---|
| `START-HERE.html` | Offline visual guide: open it first |
| `start-windows.bat` / `start.sh` / `start-docker.bat` | One-click start files |
| `Documentation/` | Project book PDF, PostgreSQL & MySQL scripts, API spec, workflows, ERD, admin guide, demo accounts |
| `src/` | Application source code (pages, dashboards, REST API, business logic) |
| `database/` · `public/` · `scripts/` | DDL scripts · images & downloads · launcher and generators |

## ⚠️ Why "http://localhost:3000" doesn't open by itself

`localhost` means **"this computer"**. The link only works **after you start the server on your own PC**, and only while the black server window stays open. Follow Option 1 below.

---

## Option 1: Run on your PC (recommended, only Node.js needed)

No PostgreSQL or Docker required: the app includes a **built-in database** (stored in the `.data` folder).

1. Install **Node.js 20 LTS or newer** from https://nodejs.org (click the big green "LTS" button, install with default options).
2. Unzip `MarketLink-AgriHub-Pakistan.zip` (right-click → **Extract All**) and open the **MarketLink-AgriHub-Pakistan** folder. Open **START-HERE.html** for a visual guide. Don't run it from inside the zip.
3. Open the extracted folder and:
   - **Windows:** double-click **`start-windows.bat`**
   - **macOS / Linux:** open Terminal in the folder and run `bash start.sh`
4. First run: it installs packages and builds (3-6 minutes). When you see **✅ MarketLink is running!**, your browser opens **http://localhost:3000** automatically.
5. **Keep the black window open** while using the site. Press `Ctrl + C` in it to stop.

Next time, step 3 starts in a few seconds.

### Open on your phone
Connect the phone to the same Wi-Fi and open the **"Phone / same Wi-Fi"** address shown in the window (e.g. `http://192.168.1.5:3000`). If Windows Firewall asks, click **Allow access**.

### Troubleshooting

| Problem | Fix |
|---|---|
| `'node' is not recognized` | Node.js not installed, or restart the PC after installing. |
| Browser says "can't be reached" | The server window was closed, or it hasn't finished starting. Wait for **✅ MarketLink is running!** |
| Port 3000 busy | Handled automatically: the window shows the port it used (e.g. 3001). |
| Want a fresh start with new demo data | Stop the server, delete the `.data` folder, start again. |
| Changed code / updated files | Run `start-windows.bat --rebuild` (or `node scripts/serve.cjs --rebuild`). |
| Want to use your own PostgreSQL | Set `DATABASE_URL=postgresql://postgres:PASSWORD@localhost:5432/app_db` in `.env` (the database is created automatically). |

---

## Option 1B: Connect MarketLink to PostgreSQL on your laptop (pgAdmin)

The website's built-in database needs no setup, but **pgAdmin cannot open it directly**. To see and manage your tables in pgAdmin, run a normal PostgreSQL server on your laptop:

1. Install **PostgreSQL** from https://www.postgresql.org/download/ (include **pgAdmin**). During installation choose a password for the PostgreSQL user `postgres`, and leave the server port at `5432`. Start the PostgreSQL service if it is not running.
2. Extract the project zip, open the **MarketLink-AgriHub-Pakistan** folder, and open `.env` with Notepad. If `.env` does not exist, copy `.env.example` and rename the copy `.env`. Set one line (replace the password with the one you chose in step 1):

   ```text
   DATABASE_URL=postgresql://postgres:YOUR_POSTGRES_PASSWORD@127.0.0.1:5432/app_db
   ```

   Do not add quotation marks. If the database password contains `@`, `#`, `/`, `:` or `?`, URL-encode those characters (or choose a password without URL-special characters). The website's demo password `password123` is **not** your PostgreSQL password.
3. In the project folder, run `node scripts/check-db.cjs --create` in Command Prompt/PowerShell. This tests your connection and creates the `app_db` database if needed. Alternatively, create a database named `app_db` in pgAdmin yourself, then run `node scripts/check-db.cjs` to check it.
4. Double-click **`start-windows.bat`** (Mac/Linux: `bash start.sh`). When it says “MarketLink is running”, open `http://localhost:3000/login`. On first visit the application creates its tables and sample data automatically.
5. In pgAdmin, connect to **Servers → PostgreSQL** using your `postgres` password, then expand **Databases → app_db → Schemas → public → Tables**. Right-click `users` → **View/Edit Data → All Rows** to verify the connection. If no tables appear, right-click **Tables → Refresh** after visiting the website.

**Changing from the built-in database to PostgreSQL does not copy old data.** Your previous built-in data stays safely in `.data/pglite`; the new `app_db` starts with seeded demo records. Switching `DATABASE_URL` back to blank and restarting uses the original built-in data again. Your laptop's `127.0.0.1` is not the cloud preview database; the two installations are separate. Keep `.env` private because it contains your database password.

### Using Docker instead

`docker compose up --build` starts PostgreSQL and the website together. To inspect that local Docker database in pgAdmin, use **Host:** `127.0.0.1`, **Port:** `5432`, **Database:** `app_db`, **Username:** `postgres`, **Password:** the value in `docker-compose.yml` (change the demo password before using it outside a trusted local PC).

## Option 2: Temporary public link (share with anyone, free)

While Option 1 is running, open a **second** terminal in the folder and run:

```bash
npx cloudflared tunnel --url http://localhost:3000
```

It prints a link like `https://green-mango-1234.trycloudflare.com`. Anyone can open it while your PC and both windows stay on. Alternative: `npx localtunnel --port 3000`.

## Option 3: Docker (includes a real PostgreSQL server)

Install Docker Desktop, then double-click `start-docker.bat` (or run `docker compose up --build`). Open http://localhost:3000.

## Option 4: Free cloud hosting (online 24/7)

- **Render.com:** push the folder to GitHub → Render → **New → Blueprint** → select repo (`render.yaml` sets up the web service and PostgreSQL). Free tier sleeps after 15 min idle.
- **Vercel + Neon:** free Postgres on neon.tech → import repo on vercel.com → set `DATABASE_URL`, `SESSION_SECRET`, `COOKIE_SECURE=true`.
- **Railway.app:** deploy from GitHub + PostgreSQL plugin, set `DATABASE_URL` and `SESSION_SECRET`.

---

## Environment variables (`.env`)

| Variable | Description |
|---|---|
| `DATABASE_URL` | Empty = built-in database. Or a PostgreSQL connection string. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Admin login created on first start (default `ahmed.mustafa@admin.com` / `password123`). |
| `SESSION_SECRET` | Long random text used to sign login cookies. |
| `COOKIE_SECURE` | `true` when served over HTTPS. |
| `PORT` | Preferred port (default 3000). |

## Developer commands

```bash
node scripts/serve.cjs      # build if needed + start + open browser
npm run dev                 # development mode with hot reload
npm run build && npm start  # plain production build / start
```

Health check: `GET /api/health` → `{"ok":true}` · Docs: `/docs` · Hosting page: `/deploy`
Stack: Next.js 16 · React 19 · Tailwind CSS 4 · PostgreSQL / PGlite · Drizzle ORM · Recharts
