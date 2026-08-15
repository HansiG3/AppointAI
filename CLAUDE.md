# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development

```bash
# Install all dependencies (root + client + server)
npm run install:all

# Run both client and server in dev mode concurrently
npm run dev

# Run only the server (with nodemon)
npm run dev:server   # → cd server && npm run dev

# Run only the client (Vite HMR)
npm run dev:client   # → cd client && npm run dev
```

### Testing

```bash
# Run all tests across workspaces
npm run test

# Server tests only (Jest with ESM support)
cd server && npm run test

# Server tests in watch mode
cd server && npm run test:watch
```

### Linting

```bash
npm run lint          # ESLint on .js/.jsx
```

### Build

```bash
npm run build         # Vite production build of client
```

### Database seeding

```bash
cd server && npm run seed:admin   # Create initial admin user
cd server && npm run seed:data    # Seed doctors, slots, specializations
```

## Environment

Copy `server/.env.example` to `server/.env` and fill in:
- `MONGODB_URI` — MongoDB connection string
- `JWT_SECRET` — secret for signing tokens
- `LLM_API_KEY` — Anthropic API key
- `LLM_MODEL` — defaults to `claude-3-5-sonnet-20241022`
- `CLIENT_ORIGIN` — CORS origin (`http://localhost:5173` in dev)
- `APP_TIMEZONE` — used for date/time resolution (default `Asia/Kolkata`)

Client env: set `VITE_API_BASE_URL` (defaults to `http://localhost:5000/api`).

## Architecture

This is a MERN stack application: React + Vite (client), Express + MongoDB/Mongoose (server), with an Anthropic Claude AI layer for conversational booking.

### Server (`server/src/`)

**Entry:** `server.js` → `app.js` (Express setup: helmet, CORS, rate limiting, routes, error handler)

**Routes and their controllers:**
- `POST /api/chat` — the main conversational endpoint
- `POST /api/auth/register`, `POST /api/auth/login`
- `/api/doctors`, `/api/availability`, `/api/appointments` — REST CRUD
- `/api/admin` — admin-only management (requires `ADMIN` role)

**AI pipeline (`src/ai/`):**

The core flow lives in `orchestrator.js → processChatTurn()`:

1. Deterministic fast-path: cancel requests, pending confirmations, slot selections, and "show all slots" bypass the LLM entirely and go to `fallback.js → processFallbackTurn()`.
2. LLM call via `adapter.js → callLLM()` (Anthropic structured output using tool_use).
3. Output validated by `validateAIOutput()` — intent allowlist, date/time format checks, slot ID candidate check, function allowlist.
4. Specialization resolved from DB (never trusted from LLM).
5. Deterministic slot resolution: if the user's message names a doctor + time matching a candidate slot, that slot is selected server-side — the LLM cannot override it.
6. Function call loop (max 3 calls): dispatches to `functionDispatcher.js` which is an allowlisted set of DB operations.
7. Confirmation flow: `pendingAction` with a 5-minute expiry is set on the `Conversation` document. `processFallbackTurn` handles the yes/no response.
8. On LLM failure, the system falls back to `processFallbackTurn` so the chat stays functional.

`fallback.js` is a fully deterministic NLP engine (regex + keyword matching for intent, date/time, specialization). It handles: cancellation by booking ID, confirmation/rejection of pending bookings, slot selection by time/doctor name, and availability search.

`functionDispatcher.js` contains all DB operations the AI can call:
- `checkAvailability`, `findAlternativeSlots`, `searchDoctors`
- `createAppointment` — uses a MongoDB session + atomic `findOneAndUpdate` to lock the slot (`AVAILABLE → BOOKED`) and prevent double-booking
- `cancelAppointment` — releases the slot back to `AVAILABLE` if the appointment is in the future
- `modifyAppointment`, `getAppointment`

**Booking ID format:** `APT-YYYYMMDD-XXXXXX` (e.g. `APT-20260817-CZBO3N`)

**Conversation state machine (`CONVERSATION_STAGE`):**
`COLLECTING_DETAILS → SEARCHING → AWAITING_SLOT_SELECTION → AWAITING_CONFIRMATION → COMPLETED`

The `Conversation` document carries: `stage`, `status`, `messages[]`, `draft` (specialization, date, time, selected slot), `candidateSlotIds[]`, `selectedSlotId`, `pendingAction`.

**Models:** `User`, `Doctor`, `Specialization`, `Slot`, `Appointment`, `Conversation`  
Slots store `status: AVAILABLE | HELD | BOOKED | BLOCKED`, `date (YYYY-MM-DD)`, `startTime/endTime (HH:mm)`.

**Key safety invariants to preserve:**
- `userId` is always taken from the authenticated JWT, never from the LLM output.
- `slotId` for `createAppointment` is always taken from `conversation.pendingAction.slotId` (server-side), never from the LLM.
- Only slots present in `conversation.candidateSlotIds` may be confirmed.

### Client (`client/src/`)

**Routing:** `App.jsx` — React Router with `ProtectedRoute` (checks localStorage token; `requireAdmin` prop checks role). Routes: `/login`, `/register`, `/chat`, `/admin`.

**Auth:** `AuthContext.jsx` stores `user` + `token` in `localStorage` under keys `appointai_token` / `appointai_user`.

**API:** `api/client.js` — Axios instance with a request interceptor that injects the JWT, and a response interceptor that auto-redirects to `/login` on 401.

**Chat (`pages/ChatPage.jsx`):** Sends `{ conversationId, message, selectedOptionId }` to `POST /api/chat`. Slot cards pass `selectedOptionId` (the slotId); natural language input attempts deterministic slot resolution on the client too (`findSlotFromMessage`) before sending. The "Appointment Confirmed" green card only renders when both `response.appointment.bookingId` is present and `response.message` matches `/appointment confirmed/i`.

**Styling:** CSS custom properties defined in `styles/tokens.css`; component-scoped stylesheets (`auth.css`, `chat.css`, `admin.css`).
