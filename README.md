# Aurora Nails Studio – Reservation System

Online booking site for a nail studio (manicure/pedicure/nail art), plus a
separate staff dashboard at `/dashboard` for managing reservations.

> Note: the old preview link pointed at the previous barbershop deployment.
> Redeploy under your own domain once you've customized the branding.

## Backend (Node.js + PostgreSQL)

Stores reservations in PostgreSQL.

### Prerequisites
- Node.js 18+ and npm
- PostgreSQL 13+

### 1) Install dependencies
From `MasterBarber/server`:
```bash
npm install
```

### 2) Configure environment
Create `MasterBarber/server/.env` with:
```bash
PORT=8080
# For local development, allow localhost origins
ALLOWED_ORIGIN=http://localhost:8080,http://127.0.0.1:8080
ALLOW_NO_ORIGIN=true

# Database configuration
# Option 1: Use Supabase (production)
DATABASE_URL=postgresql://user:password@db.xxxxx.supabase.co:5432/postgres

# Option 2: Use local PostgreSQL (development)
# PGHOST=localhost
# PGPORT=5432
# PGDATABASE=masterbarber
# PGUSER=postgres
# PGPASSWORD=your_password_here

# Optional admin token to allow barber to delete any reservation
ADMIN_TOKEN=choose_a_secret_code
```

### 3) Create database and schema
Create DB once:
```sql
CREATE DATABASE masterbarber;
```
Apply schema from `MasterBarber/server/schema.sql` (using `psql`):
```bash
psql -h %PGHOST% -U %PGUSER% -d %PGDATABASE% -f schema.sql
```

Expected table:
```sql
CREATE TABLE IF NOT EXISTS reservations (
  id SERIAL PRIMARY KEY,
  date TEXT NOT NULL,
  hour TEXT NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(date, hour)
);
```

### 4) Run the application

**The backend serves both API and frontend!** Just run the server:

From `MasterBarber/server`:
```bash
npm run dev    # Development mode with auto-reload
# or
npm start      # Production mode
```

The server will:
- ✅ Start on `http://localhost:8080` (or PORT from .env)
- ✅ Serve the frontend from `MasterBarber/public/`
- ✅ Provide API at `http://localhost:8080/api/`

**Open your browser:** `http://localhost:8080`

### 5) Project Structure

```
MasterBarber/
├── public/          # Frontend (HTML, CSS, JS)
│   ├── index.html    # Public booking site
│   ├── dashboard.html # Staff admin dashboard (/dashboard)
│   ├── script.js
│   └── style.css
└── server/          # Backend (Node.js + Express)
    ├── src/
    │   ├── index.js      # Main server (serves both API + static files)
    │   ├── db.js         # Database connection
    │   └── reservations.js # API routes
    └── .env              # Environment variables
```

### 6) API Endpoints

- `GET /api/reservations` → Get all reservations
- `POST /api/reservations` → Create/update reservation
- `PUT /api/reservations` → Update reservation
- `DELETE /api/reservations?date=YYYY-MM-DD&hour=HH:MM` → Delete reservation
- `DELETE /api/reservations/cleanup` → Delete bookings older than 7 days (admin only)
- `POST /api/reservations/day-off` → Mark a whole day as closed (admin only)
- `POST /api/admin/verify` → Verify admin token

### 7) Admin Dashboard

Staff manage reservations at `/dashboard` (e.g. `http://localhost:8080/dashboard`),
a separate page from the public booking site. It asks for the `ADMIN_TOKEN` from
`.env` and, once unlocked, lets staff browse any day, add/edit/cancel bookings,
mark a day off, and clean up old records. The login only lasts for the browser
tab (`sessionStorage`) — closing the tab logs staff out.

### Troubleshooting

**CORS errors:**
- Ensure `ALLOWED_ORIGIN` in `.env` includes `http://localhost:8080`
- For development, set `ALLOW_NO_ORIGIN=true`

**Database connection errors:**
- Verify `DATABASE_URL` or PostgreSQL connection settings in `.env`
- Check internet connection (if using Supabase)
- Ensure database exists and is accessible

**Server won't start:**
- Check if port 8080 is already in use
- Verify all dependencies are installed: `cd server && npm install`
- Check `.env` file exists in `server/` directory

**Frontend not loading:**
- Make sure you're accessing `http://localhost:8080` (not opening HTML file directly)
- Check browser console for errors
- Verify `public/` folder contains `index.html`, `script.js`, and `style.css`