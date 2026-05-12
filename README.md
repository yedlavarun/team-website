# ⚡ Cardio Wars

> **Run. Track. Improve.**
> A fitness tracker with GPS runs, XP system, workout tracking, and leaderboard.

---

## Architecture

```
team-website/
 ├── backend/
 │    ├── middleware/
 │    │    └── auth.js          ← JWT verification
 │    ├── routes/
 │    │    ├── auth.js          ← Register / Login / Me
 │    │    ├── sessions.js      ← Workout session API
 │    │    └── leaderboard.js  ← XP rankings
 │    ├── server.js             ← Express app
 │    ├── db.sql                ← Schema reference
 │    └── package.json
 └── frontend/
      ├── index.html            ← GPS run tracker
      ├── script.js             ← GPS tracking + save-run bridge
      ├── stylesheet.css        ← Map styles
      ├── dashboard.html        ← Stats dashboard (NEW)
      ├── dashboard.css         ← Dashboard styles (NEW)
      └── dashboard.js          ← Dashboard logic (NEW)
```

---

## Prerequisites

- **Node.js** v18+
- A modern browser (Chrome / Firefox / Edge)

---

## 1. Backend Setup

```powershell
cd backend
npm install
node server.js
```

You should see:
```
✅ Connected to SQLite database.
✅ Database schema ready.
🚀 Cardio Wars server running on http://localhost:3000
```

> **Note:** The `game.db` SQLite file is created automatically on first run.
> If upgrading from v1, delete the old `game.db` so the new schema is applied cleanly.

---

## 2. Open the App

### Dashboard (Recommended Starting Point)
Open in browser:
```
http://localhost:3000/dashboard.html
```
- Create an account
- Log workouts manually **or** play the map and tap "Save Run to Dashboard"
- Track XP, stats, and leaderboard rankings

### GPS Run Tracker
```
http://localhost:3000
```
Or open `frontend/index.html` with VS Code Live Server (backend must be running).

---

## 3. How to Play

### GPS Run Tracker
1. Click **"Start Run"**.
2. Walk or run while distance/speed are tracked.
3. Click **"Stop Run"** to end.
4. On the Run Summary screen, tap **"💾 Save Run to Dashboard"**
   (requires being logged in to the Dashboard first).

### Dashboard
1. Register / Login at `http://localhost:3000/dashboard.html`
2. View your stats (distance, speed, calories, XP, streak)
3. Use **"Log Workout"** to manually add a session
4. Check the **Leaderboard** to see how you rank

---

## API Reference

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/auth/register` | ❌ | Create account |
| POST | `/api/auth/login` | ❌ | Login, get JWT |
| GET | `/api/auth/me` | ✅ | Current user profile |
| POST | `/api/sessions` | ✅ | Log a workout session |
| GET | `/api/sessions` | ✅ | Get session history |
| GET | `/api/sessions/stats` | ✅ | Get aggregated stats |
| GET | `/api/leaderboard` | ✅ | XP leaderboard |

> ✅ = Requires `Authorization: Bearer <token>` header

---

## XP System

```
XP per session = ROUND(distance_km × 10 + avgSpeed × 2)
Level = FLOOR(totalXP / 500) + 1
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Map not loading | Check internet (Leaflet needs tile CDN) |
| "Geolocation denied" | Allow location in browser settings |
| "No token" when saving run | Log in via Dashboard first, then return to map |
| DB schema errors | Delete `backend/game.db` and restart server |
| `bcrypt` install fails | Run `npm install` inside `backend/` directory |

---

## Future Path

| Now | Later |
|-----|-------|
| JWT + bcrypt | Firebase Auth |
| SQLite | Firestore / PostgreSQL |
| Local `game.db` | Cloud database |

Service-layer pattern in `routes/` makes this swap easy — business logic stays the same.
