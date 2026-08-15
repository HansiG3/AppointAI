# Phase 3 Complete ✅ — Database Models & Seed Data

## What We Built

### 1. **All 6 Mongoose Models** (with proper indexes and validation)

#### Specialization Model
- Fields: `name`, `slug` (unique), `aliases[]`, `description`, `status`
- Indexes: `slug` (unique), `status`
- Pre-save hook: normalizes aliases to lowercase

#### Doctor Model
- Fields: `name`, `specialization` (ref), `experience`, `qualification[]`, `location`, `status`
- Indexes: compound `(specialization, status)`, `(location, status)`, text index on `name`

#### Slot Model ⭐ **Critical for concurrency**
- Fields: `doctor` (ref), `date` (YYYY-MM-DD), `startTime`, `endTime`, `status`, optional `heldBy`, `appointment`
- **Unique compound index**: `(doctor, date, startTime)` — prevents duplicate slots
- Query index: `(date, status, doctor)` and `(doctor, date, status)`
- Pre-save validation: ensures `startTime < endTime`

#### Appointment Model
- Fields: `bookingId` (unique), `user/doctor/specialization/slot` (refs), date snapshot fields, `status`, `cancellationReason`, `cancelledAt`
- Indexes: `bookingId` (unique), `(user, date, status)`, `(doctor, date, status)`, `(specialization, date)`, `slot`

#### Conversation Model (state machine)
- Fields: `user`, `messages[]`, `stage`, `intent`, `draft` (fixed schema), `candidateSlotIds[]`, `selectedSlotId`, `targetAppointmentId`, `pendingAction`, `status`
- Fixed schemas for `draft` and `pendingAction` — no unrestricted mixed objects
- Indexes: `(user, status)`, `(user, updatedAt)`

### 2. **Utility Functions**

#### `utils/dateTime.js`
- `getTodayDate()`, `getCurrentTime()`, `getCurrentDateTime()`
- `isDateValid()`, `isDateTimeInFuture()`
- `addDays()`, `getDateRange()`
- `formatDateDisplay()`, `formatTimeDisplay()`
- Uses `dayjs` with timezone support (`Asia/Kolkata` configured)

#### `utils/bookingId.js`
- `generateUniqueBookingId(dateStr)` — format `APT-YYYYMMDD-XXXXXX`
- Cryptographically random 6-char suffix
- Retries on collision (extremely unlikely)

### 3. **Comprehensive Seed Script** (`scripts/seedData.js`)

Seeds the database with:
- **5 specializations**: Dermatology, Cardiology, Neurology, Orthopedics, Pediatrics (with aliases)
- **8 doctors** across all specializations, multiple locations
- **200+ slots** generated across 14 days (excluding Sundays)
  - Time slots: 09:00-12:00, 14:00-18:30 (30-min intervals)
  - Each doctor gets 15 slots per day × 12 days (skipping Sundays)

## Files Created

```
server/
├── src/
│   ├── models/
│   │   ├── Specialization.js ✅
│   │   ├── Doctor.js ✅
│   │   ├── Slot.js ✅ (with atomic booking protection)
│   │   ├── Appointment.js ✅
│   │   └── Conversation.js ✅
│   └── utils/
│       ├── dateTime.js ✅
│       └── bookingId.js ✅
└── scripts/
    └── seedData.js ✅
```

## Constants Updated

Added all enum constants to `config/constants.js`:
- `SPECIALIZATION_STATUS`, `DOCTOR_STATUS`, `SLOT_STATUS`, `APPOINTMENT_STATUS`
- `CONVERSATION_STAGE`, `CONVERSATION_STATUS`, `MESSAGE_ROLE`, `INTENT`
- `NEXT_ACTION`, `CONFIRMATION_STATE`, `ERROR_CODES`
- `TIME_RANGES`, `PAGINATION`, `RATE_LIMITS`

## Ready to Run

### To seed the database:

1. **Option A: Local MongoDB**
   ```bash
   # Start MongoDB locally first
   mongod
   
   # Then seed
   cd server
   npm run seed:data
   ```

2. **Option B: MongoDB Atlas (recommended for MVP)**
   ```bash
   # Update server/.env with your Atlas connection string:
   MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/appointai?retryWrites=true&w=majority
   
   # Then seed
   cd server
   npm run seed:data
   ```

### Expected Output
```
Connecting to MongoDB...
Connected to MongoDB

Clearing existing data...
✓ Cleared existing data

Creating specializations...
✓ Created 5 specializations

Creating doctors...
✓ Created 8 doctors

Generating slots for the next 14 days...
✓ Created 200+ slots

═══════════════════════════════════════════════
SEED DATA SUMMARY
═══════════════════════════════════════════════
Specializations: 5
  • Dermatology (3 aliases)
  • Cardiology (3 aliases)
  • Neurology (3 aliases)
  • Orthopedics (4 aliases)
  • Pediatrics (3 aliases)

Doctors: 8
  • Dr. Meera Shah - Dermatology (Central Clinic)
  • Dr. Arjun Rao - Dermatology (North Clinic)
  • Dr. Vikram Sen - Cardiology (Central Clinic)
  • Dr. Nisha Kapoor - Cardiology (South Clinic)
  • Dr. Asha Menon - Neurology (East Clinic)
  • Dr. Rohan Das - Neurology (Central Clinic)
  • Dr. Priya Kumar - Orthopedics (North Clinic)
  • Dr. Anil Verma - Pediatrics (South Clinic)

Slots: 200+ (across 14 days, excluding Sundays)
  Date range: 2026-08-15 to 2026-08-28
  Time slots: 09:00-12:00, 14:00-18:30 (30-min intervals)
═══════════════════════════════════════════════

✅ Database seeded successfully!
```

## Key Design Decisions

1. **Atomic booking protection**: Unique compound index `(doctor, date, startTime)` on slots prevents race conditions
2. **Date storage**: Stored as strings (YYYY-MM-DD, HH:mm) with timezone normalization in utils
3. **Fixed conversation schemas**: No unrestricted mixed objects — state machine is predictable
4. **Booking ID format**: Human-friendly but unpredictable (`APT-20260815-K7M4Q2`)
5. **Soft deletes**: Doctors/specializations should be deactivated, not deleted (preserves referential integrity)

## What's Next: Phase 4 — Backend REST APIs

Build all deterministic endpoints **before** wiring up the LLM:
1. Doctor routes (`GET /api/doctors`, `GET /api/doctors/:id`)
2. Availability routes (`GET /api/availability`)
3. Appointment routes (POST/GET/PUT/DELETE)
4. Admin routes (full CRUD for all resources)
5. Chat route skeleton (real orchestration in Phase 5)

---

**Phase 3 Status**: ✅ Complete — all models created, indexes defined, seed script ready
