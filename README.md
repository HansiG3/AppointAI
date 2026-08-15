# AppointAI 🩺💬

**An AI-powered, chat-based appointment booking assistant for healthcare.**

AppointAI lets a patient book a doctor's appointment by simply chatting in plain English — no forms, no manual slot-hunting — while giving admins a dashboard to view and manage every booking.

---

## Table of Contents

1. [Abstract](#1-abstract)
2. [Spec & Plan](#2-spec--plan)
   - [2.1 System Design (High-Level)](#21-system-design-high-level)
   - [2.2 Feature Breakdown](#22-feature-breakdown)
   - [2.3 Prompt Design](#23-prompt-design)
   - [2.4 Data Model](#24-data-model)
   - [2.5 Implementation Plan](#25-implementation-plan)
3. [Implementation](#3-implementation)
4. [Edge Cases](#4-edge-cases)
5. [Getting Started](#5-getting-started)
6. [Demo Video](#6-demo-video)

---

# 1. Abstract

Booking a healthcare appointment online has always been a tedious task. Platforms like Practo and Tata 1mg already provide great services, but the process itself is still slow and frustrating — users have to manually fill out long forms, hunt through calendars for an open slot, and figure out which doctor's specialization matches their need.

**AppointAI** solves this by turning the entire booking process into a simple conversation.

Instead of navigating a form, a user just tells AppointAI what they need:

> "Hey, I want to book a dermatologist appointment on 15 August 2026 at 5 p.m."

AppointAI's AI assistant reads this natural-language request, extracts the key details such as specialization, date, and time, and searches the database for a matching doctor and slot.

If the slot is available, it confirms the remaining details with the user and books the appointment by providing a unique **Booking ID**.

If the slot is not available, AppointAI automatically suggests the nearest available alternatives instead of leaving the user to search manually.

### Key User Flows

#### User Flow

Sign up / Log in → Describe appointment need in chat → Answer AI follow-up questions → Review doctor and slot → Confirm → Receive unique Booking ID

<img width="500" height="950" alt="User Flow" src="https://github.com/user-attachments/assets/224d7fb4-8070-4dc1-ba46-836d49483e6b" />

#### Admin Flow

Log in → View appointments → Search / Filter bookings → Update / Reschedule / Cancel bookings

<img width="300" height="300" alt="Admin Flow" src="https://github.com/user-attachments/assets/78ac525b-7ca7-43db-b144-27e8e3cbb975" />

By replacing the traditional "search and fill a form" experience with a natural conversation, AppointAI removes the friction that makes appointment booking feel like a chore.

At the same time, every appointment shown or booked is backed by **real, live database data** — never something the AI invents.

---

# 2. Spec & Plan

## 2.1 System Design (High-Level)

AppointAI is built as a **MERN-stack** application:

- **MongoDB**
- **Express.js**
- **React**
- **Node.js**

The core design principle is:

> **The AI understands the user's request — the backend is responsible for validation, availability, and booking.**

The AI service:

- Never directly accesses the database
- Never invents doctors or slots
- Never reports a booking as confirmed until the backend successfully creates it

This keeps the system trustworthy even though the interface feels conversational and free-form.

### Architecture Diagram

<img width="750" height="400" alt="Architecture Diagram" src="https://github.com/user-attachments/assets/491353b3-b97e-472a-a6b0-7942087d8f38" />

### System Components

| Component | Technology | Responsibility |
|---|---|---|
| User application | React, Vite, JavaScript | Registration, login, chat, doctor/slot selection, confirmations, appointment history |
| Admin dashboard | React, Vite, JavaScript | Protected views to manage appointments, doctors, specializations, and slots |
| API server | Node.js, Express.js | Authentication, validation, chat orchestration, domain rules, REST APIs |
| AI service adapter | Node.js → LLM API | Sends system prompt + context, requests structured output, normalizes responses |
| Appointment domain services | Node.js | Doctor search, availability checks, alternatives, atomic booking, Booking ID generation |
| Persistence layer | MongoDB + Mongoose | Users, doctors, specializations, slots, appointments, conversations |
| Authentication | JWT + password hashing | Identifies users/admins and enforces role-based access |

### Why This Design?

The LLM is treated purely as a **language layer**.

It interprets user intent and generates natural-language responses, while every operation that changes booking state is performed by deterministic backend code.

This protects the application against:

- Hallucinated bookings
- Invalid doctor/slot information
- Unauthorized operations
- Double booking
- Incorrect availability

<<<<<<< HEAD
### Booking Sequence Diagram
=======
---

## Booking Sequence Diagram

The following flow shows how a single chat message becomes a confirmed booking:
>>>>>>> 07e824526fc480f04769309c1cc6230f15359bf5

```mermaid
sequenceDiagram
    actor User
    participant UI as React Frontend
    participant API as Express Backend
    participant LLM as LLM AI Service
    participant Domain as Booking/Availability Service
    participant DB as MongoDB

    User->>UI: Book dermatology on 15 Aug 2026 at 5 PM
    UI->>API: POST /api/chat
    API->>LLM: Prompt + current date/timezone + safe context
    LLM-->>API: Structured intent and entities
    API->>API: Validate schema, date, time, and intent

    alt Required information is missing
        API->>LLM: Provide validated missing fields
        LLM-->>API: Clarification question
        API-->>UI: Ask for missing information
        UI-->>User: Display question
        User->>UI: Provide missing information
        UI->>API: POST /api/chat
    end

    API->>Domain: Check real doctors and requested slot
    Domain->>DB: Query active doctors and available slots
    DB-->>Domain: Matching records

    alt Requested slot unavailable
        Domain->>DB: Query alternative slots
        DB-->>Domain: Real alternative records
        Domain-->>API: Alternatives with slot IDs
        API->>LLM: Grounded alternatives
        LLM-->>API: Natural-language suggestion
        API-->>UI: Message + structured alternatives
        User->>UI: Select an alternative
        UI->>API: POST /api/chat with selected slot ID
    else Requested slot available
        Domain-->>API: Requested slot and doctor
    end

    API-->>UI: Appointment summary and confirmation request
    User->>UI: Confirm
    UI->>API: POST /api/chat with confirmation
    API->>Domain: Create appointment for authenticated user
    Domain->>DB: Atomically claim slot if AVAILABLE
    DB-->>Domain: Claim succeeded or failed

    alt Slot claim succeeded
        Domain->>DB: Create appointment + unique Booking ID
        DB-->>Domain: Persisted appointment
        Domain-->>API: Confirmed appointment
        API->>LLM: Grounded booking result
        LLM-->>API: Confirmation wording
        API-->>UI: Confirmed details and Booking ID
        UI-->>User: Show booking confirmation
    else Slot was taken before confirmation
        Domain-->>API: Conflict
        API-->>UI: Explain conflict and offer refreshed alternatives
    end
2.2 Feature Breakdown
User Features
Feature	Behavior
Registration/Login	JWT-based authentication with name, email, phone, and password
Conversational Chat	Natural-language appointment requests
Specialization Detection	Maps everyday terms such as "skin doctor" to supported specializations
Date/Time Extraction	Resolves expressions such as "tomorrow" and "5 PM"
Missing Information Handling	Asks focused follow-up questions instead of guessing
Doctor & Slot Search	Returns only real database-backed availability
Alternative Suggestions	Offers nearby real slots when the requested slot is unavailable
Confirmation	Shows appointment summary and requires explicit confirmation
Unique Booking ID	Example: APT-20260815-K7M4Q2
Appointment Management	View, reschedule, and cancel appointments
AI Features
Intent detection
Entity extraction
Conversation-state-aware follow-ups
Missing-field detection
Clarification questions
Allow-listed backend function calling
Natural-language responses based on backend-grounded results
Admin Features
Admin login with role verification
Paginated appointment views
Search and filtering
Search by:
Booking ID
User
Doctor
Specialization
Date
Status
Reschedule appointments
Cancel appointments
Create, update, and delete doctors
Manage specializations
Manage appointment slots
2.3 Prompt Design

<<<<<<< HEAD
---

## 2.2 Feature Breakdown

### User Features

| Feature | Behavior |
|---|---|
| Registration/Login | JWT-based authentication with name, email, phone, and password |
| Conversational Chat | Natural-language appointment requests |
| Specialization Detection | Maps everyday terms such as "skin doctor" to supported specializations |
| Date/Time Extraction | Resolves expressions such as "tomorrow" and "5 PM" |
| Missing Information Handling | Asks focused follow-up questions instead of guessing |
| Doctor & Slot Search | Returns only real database-backed availability |
| Alternative Suggestions | Offers nearby real slots when the requested slot is unavailable |
| Confirmation | Shows appointment summary and requires explicit confirmation |
| Unique Booking ID | Example: `APT-20260815-K7M4Q2` |
| Appointment Management | View, reschedule, and cancel appointments |

### AI Features

- Intent detection
- Entity extraction
- Conversation-state-aware follow-ups
- Missing-field detection
- Clarification questions
- Allow-listed backend function calling
- Natural-language responses based on backend-grounded results

### Admin Features

- Admin login with role verification
- Paginated appointment views
- Search and filtering
- Search by Booking ID, user, doctor, specialization, date, and status
- Reschedule appointments
- Cancel appointments
- Create, update, and delete doctors
- Manage specializations
- Manage appointment slots

---

## 2.3 Prompt Design

Each model call is built from four controlled components:

1. **System Prompt**
   - Defines the AI's role and safety rules.

2. **Runtime Context**
   - Current date
   - Timezone
   - Supported specializations
   - Conversation stage
   - Validated appointment draft

3. **Conversation Context**
   - A bounded window of recent messages.

4. **Structured Output Schema**
   - Strict JSON schema
   - Allow-listed backend functions

### Simplified System Prompt

```text
=======
Each model call is built from four controlled components:

System Prompt
Defines the AI's role and safety rules.
Runtime Context
Current date
Timezone
Supported specializations
Conversation stage
Validated appointment draft
Conversation Context
A bounded window of recent messages.
Structured Output Schema
Strict JSON schema
Allow-listed backend functions
Simplified System Prompt
>>>>>>> 07e824526fc480f04769309c1cc6230f15359bf5
You are AppointAI, a healthcare appointment booking assistant.


Your purpose is to help authenticated users find, book, view, reschedule, and
cancel healthcare appointments through clear conversation.

<<<<<<< HEAD
You are a scheduling assistant, not a doctor.
Never diagnose, prescribe, or claim a specialization is medically correct
based on symptoms.

RUNTIME CONTEXT

=======

You are a scheduling assistant, not a doctor.
Never diagnose, prescribe, or claim a specialization is medically correct
based on symptoms.


RUNTIME CONTEXT


>>>>>>> 07e824526fc480f04769309c1cc6230f15359bf5
- Current date: {{CURRENT_DATE_ISO}}
- Timezone: {{TIMEZONE}}
- Supported specializations: {{SUPPORTED_SPECIALIZATIONS}}
- Conversation stage: {{CONVERSATION_STAGE}}
- Validated draft: {{VALIDATED_DRAFT}}


RULES
<<<<<<< HEAD

1. Extract intent and entities from the newest user message.
2. Ask ONE short clarification question at a time.
3. Never invent a doctor, slot, or Booking ID.
4. Only use backend-returned data.
5. Never treat a slot as booked until the backend confirms it.
6. Always require explicit user confirmation before creating,
   rescheduling, or cancelling an appointment.
7. Resolve relative dates such as "tomorrow" using the provided
   current date and timezone.
```

The model is only allowed to **request** backend operations such as:

- `checkAvailability`
- `createAppointment`
- `rescheduleAppointment`
- `cancelAppointment`

The backend independently validates and executes these operations.

The overall process is:

> **Propose → Validate → Execute → Narrate**

This keeps the assistant conversational without allowing it to make unsupervised changes to real data.

---

## 2.4 Data Model

MongoDB stores six main collections:
=======


1. Extract intent and entities from the newest user message.
2. Ask ONE short clarification question at a time.
3. Never invent a doctor, slot, or Booking ID.
4. Only use backend-returned data.
5. Never treat a slot as booked until the backend confirms it.
6. Always require explicit user confirmation before creating,
   rescheduling, or cancelling an appointment.
7. Resolve relative dates such as "tomorrow" using the provided
   current date and timezone.

The model is only allowed to request backend operations such as:
>>>>>>> 07e824526fc480f04769309c1cc6230f15359bf5

checkAvailability
createAppointment
rescheduleAppointment
cancelAppointment

The backend independently validates and executes these operations.

The overall process is:

Propose → Validate → Execute → Narrate

This keeps the assistant conversational without allowing it to make unsupervised changes to real data.

2.4 Data Model

MongoDB stores six main collections:
erDiagram
    USER ||--o{ APPOINTMENT : books
    USER ||--o{ CONVERSATION : owns
    SPECIALIZATION ||--o{ DOCTOR : categorizes
    SPECIALIZATION ||--o{ APPOINTMENT : labels
    DOCTOR ||--o{ SLOT : offers
    DOCTOR ||--o{ APPOINTMENT : attends
    SLOT ||--o| APPOINTMENT : assigned_to
    CONVERSATION }o--o{ SLOT : proposes
    CONVERSATION }o--o| APPOINTMENT : targets

    USER {
        ObjectId _id
        string name
        string email
        string phone
        string passwordHash
        string role
    }

    SPECIALIZATION {
        ObjectId _id
        string name
        string slug
        string status
    }

    DOCTOR {
        ObjectId _id
        ObjectId specialization
        string name
        number experience
        string location
        string status
    }

    SLOT {
        ObjectId _id
        ObjectId doctor
        string date
        string startTime
        string endTime
        string status
    }

    APPOINTMENT {
        ObjectId _id
        string bookingId
        ObjectId user
        ObjectId doctor
        ObjectId specialization
        ObjectId slot
        string status
    }

    CONVERSATION {
        ObjectId _id
        ObjectId user
        string stage
        string intent
        string status
    }
Collections
Collection	Purpose
User	Stores patients and admins using role: USER | ADMIN
Specialization	Stores canonical specializations and everyday aliases
Doctor	Stores doctor profiles, specialization, location, and active status
Slot	Atomic bookable unit containing doctor, date, time, and status
Appointment	Stores confirmed bookings and unique Booking IDs
Conversation	Stores server-owned conversation state
Preventing Double Booking

<<<<<<< HEAD
### Collections

| Collection | Purpose |
|---|---|
| `User` | Stores patients and admins using `role: USER \| ADMIN` |
| `Specialization` | Stores canonical specializations and everyday aliases |
| `Doctor` | Stores doctor profiles, specialization, location, and active status |
| `Slot` | Atomic bookable unit containing doctor, date, time, and status |
| `Appointment` | Stores confirmed bookings and unique Booking IDs |
| `Conversation` | Stores server-owned conversation state |

### Preventing Double Booking

A slot can only be changed from:

```text
AVAILABLE → BOOKED
```

through an atomic conditional update:

```text
Update the slot ONLY if it is still AVAILABLE.
```

If two users attempt to book the same slot simultaneously:

1. One booking succeeds.
2. The other receives `409 SLOT_UNAVAILABLE`.
3. Fresh alternatives are returned.

---

## 2.5 Implementation Plan

The system was built in phases so that the deterministic booking engine works correctly before the AI layer is added.

| Phase | Focus |
|---|---|
| 1 | Project setup — repo structure, environment configuration, Express/React apps |
| 2 | Authentication — registration, login, JWT, role-based middleware |
| 3 | Core data + admin CRUD — doctors, specializations, slots |
| 4 | Deterministic availability & booking APIs |
| 5 | Conversational orchestration — LLM integration, prompt design, structured output |
| 6 | User appointment management — view, reschedule, cancel |
| 7 | Admin dashboard — filters, pagination, reschedule/cancel UI |
| 8 | Testing — unit, integration, AI extraction, concurrency tests |
| 9 | Deployment — frontend, Express backend, MongoDB Atlas |

This order ensures that the booking rules are proven correct before the AI is layered on top.

Therefore, a bad LLM response cannot bypass the backend's validation and booking rules.
=======
A slot can only be changed from:

AVAILABLE → BOOKED

through an atomic conditional update:

Update the slot ONLY if it is still AVAILABLE.

If two users attempt to book the same slot simultaneously:

One booking succeeds.
The other receives 409 SLOT_UNAVAILABLE.
Fresh alternatives are returned.
2.5 Implementation Plan
>>>>>>> 07e824526fc480f04769309c1cc6230f15359bf5

The system was built in phases so that the deterministic booking engine works correctly before the AI layer is added.

<<<<<<< HEAD
# 3. Implementation

## Tech Stack

- **Frontend:** React + Vite + JavaScript
- **Backend:** Node.js + Express.js
- **Database:** MongoDB + Mongoose
- **Authentication:** JWT + Password Hashing
- **AI:** LLM API with structured output / function calling
- **API:** REST APIs

## AI Tools Used

### Claude Code

Claude Code was primarily used for the most critical implementation and debugging tasks, including:

- Complex coding tasks
- Debugging
- Backend implementation
- Frontend implementation
- Integration
- Complex functionality

### Codex

Codex was primarily used during the planning phase for:

- Project specification
- System design
- Implementation planning
- Documentation

This approach helped balance:

- Code quality
- Reasoning capability
- Development speed
- API/tool usage cost

### Approximate AI Usage

According to the AI usage dashboard during the development session:

| Model | Reported Usage |
|---|---:|
| Claude Opus 5 | 17.19M tokens |
| Claude Sonnet 5 | 1.72M tokens |
| GPT-5.6 | 259.2K tokens |

The majority of the usage came from Claude Opus for complex implementation and debugging tasks.

---

## Repository Structure

```text
=======
Phase	Focus
1	Project setup — repo structure, environment configuration, Express/React apps
2	Authentication — registration, login, JWT, role-based middleware
3	Core data + admin CRUD — doctors, specializations, slots
4	Deterministic availability & booking APIs
5	Conversational orchestration — LLM integration, prompt design, structured output
6	User appointment management — view, reschedule, cancel
7	Admin dashboard — filters, pagination, reschedule/cancel UI
8	Testing — unit, integration, AI extraction, concurrency tests
9	Deployment — frontend, Express backend, MongoDB Atlas

This order ensures that the booking rules are proven correct before the AI is layered on top.

Therefore, a bad LLM response cannot bypass the backend's validation and booking rules.

3. Implementation
Tech Stack
Frontend: React + Vite + JavaScript
Backend: Node.js + Express.js
Database: MongoDB + Mongoose
Authentication: JWT + Password Hashing
AI: LLM API with structured output / function calling
API: REST APIs
AI Tools Used
Claude Code

Claude Code was primarily used for the most critical implementation and debugging tasks.

In particular:

Complex coding tasks
Debugging
Backend implementation
Frontend implementation
Integration
Complex functionality
Codex

Codex was primarily used during the planning phase for:

Project specification
System design
Implementation planning
Documentation

This approach helped balance:

Code quality
Reasoning capability
Development speed
API/tool usage cost
Approximate AI Usage

According to the AI usage dashboard during the development session:

Model	Reported Usage
Claude Opus 5	17.19M tokens
Claude Sonnet 5	1.72M tokens
GPT-5.6	259.2K tokens

The majority of the usage came from Claude Opus for complex implementation and debugging tasks.

Repository Structure
>>>>>>> 07e824526fc480f04769309c1cc6230f15359bf5
appointai/
│
├── client/                     # React (Vite) user-facing application
│
├── admin/                      # React (Vite) admin dashboard
│
├── server/
│   ├── controllers/            # Request controllers
│   ├── routes/                 # API routes
│   ├── middleware/             # Auth, role checks, validation, rate limiting
│   ├── services/               # Doctor, availability and appointment logic
│   ├── models/                 # Mongoose schemas
│   ├── ai/                     # LLM adapter and prompt logic
│   └── index.js                # Server entry point
│
├── docs/
│   └── images/                 # Architecture and flow diagrams
│
└── README.md
4. Edge Cases

<<<<<<< HEAD
---

# 4. Edge Cases

AppointAI is designed to fail safely.

A confused user or a faulty model response should never result in an invented doctor, lost booking, or double-booked slot.

### Conversation & Extraction

- Ambiguous time such as `"at 5"` → asks whether the user means AM or PM.
- Relative dates such as `"tomorrow"` → resolved using the backend's current date and timezone.
- Unsupported specialization → asks the user to choose from supported options.
- Past dates → rejected.
- User changes their mind during the booking flow → previous slot selection is cleared and availability is re-searched.

### Availability & Booking Integrity

- Requested slot unavailable → real alternatives are suggested.
- AI-generated/hallucinated slot IDs → rejected by the backend.
- Two users confirm the same slot → exactly one booking succeeds.
- Repeated confirmation clicks → handled using an idempotency key.
- Slot information mismatch → rejected server-side.

### Authentication & Authorization

- Users cannot access another user's appointments.
- Non-admin users cannot access `/api/admin/*`.
- Expired or invalid JWTs return `401`.

### Admin Operations

- Deactivating a doctor does not automatically cancel existing appointments.
- Duplicate slots for the same doctor/date/time are rejected.
- Admin rescheduling uses the same atomic booking protection as user rescheduling.

### AI / Infrastructure Failures

- LLM timeout → safe retry message.
- Malformed AI output → rejected safely.
- No database mutation occurs when AI output is invalid.
- Prompt injection attempts cannot directly trigger unauthorized backend operations.
- Only allow-listed backend functions can be executed.
=======
AppointAI is designed to fail safely.
>>>>>>> 07e824526fc480f04769309c1cc6230f15359bf5

A confused user or a faulty model response should never result in an invented doctor, lost booking, or double-booked slot.

<<<<<<< HEAD
# 5. Getting Started

Follow these steps to run AppointAI locally.

## Prerequisites

Make sure the following are installed:

- Node.js v18 or later
- npm
- MongoDB Atlas or local MongoDB
- Git
- An LLM API key

## Step 1: Clone the Repository

```bash
git clone <repo-url>
cd appointai
```

## Step 2: Set Up the Backend

```bash
cd server
npm install
```

Create a `.env` file inside the `server` folder:

```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
LLM_API_KEY=your_llm_api_key
TIMEZONE=Asia/Kolkata
```

Start the backend:

```bash
npm run dev
```

The backend will run on the configured port, for example:

```text
http://localhost:5000
```

## Step 3: Set Up the Frontend

Open a new terminal:

```bash
=======
Conversation & Extraction
Ambiguous time such as "at 5" → asks whether the user means AM or PM.
Relative dates such as "tomorrow" → resolved using the backend's current date and timezone.
Unsupported specialization → asks the user to choose from supported options.
Past dates → rejected.
User changes their mind during the booking flow → previous slot selection is cleared and availability is re-searched.
Availability & Booking Integrity
Requested slot unavailable → real alternatives are suggested.
AI-generated/hallucinated slot IDs → rejected by the backend.
Two users confirm the same slot → exactly one booking succeeds.
Repeated confirmation clicks → handled using an idempotency key.
Slot information mismatch → rejected server-side.
Authentication & Authorization
Users cannot access another user's appointments.
Non-admin users cannot access /api/admin/*.
Expired or invalid JWTs return 401.
Admin Operations
Deactivating a doctor does not automatically cancel existing appointments.
Duplicate slots for the same doctor/date/time are rejected.
Admin rescheduling uses the same atomic booking protection as user rescheduling.
AI / Infrastructure Failures
LLM timeout → safe retry message.
Malformed AI output → rejected safely.
No database mutation occurs when AI output is invalid.
Prompt injection attempts cannot directly trigger unauthorized backend operations.
Only allow-listed backend functions can be executed.
5. Getting Started

Follow these steps to run AppointAI locally.

Prerequisites

Make sure the following are installed:

Node.js v18 or later
npm
MongoDB Atlas or local MongoDB
Git
An LLM API key
Step 1: Clone the Repository
git clone <repo-url>
cd appointai
Step 2: Set Up the Backend

Open a terminal and run:

cd server
npm install

Create a .env file inside the server folder:

MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_jwt_secret
LLM_API_KEY=your_llm_api_key
TIMEZONE=Asia/Kolkata

Start the backend:

npm run dev

The backend will run on the configured port, for example:

http://localhost:5000
Step 3: Set Up the Frontend

Open a new terminal:

>>>>>>> 07e824526fc480f04769309c1cc6230f15359bf5
cd appointai/client
npm install
npm run dev

The frontend will run using Vite.
<<<<<<< HEAD

Usually:

```text
http://localhost:5173
```

## Step 4: Run the Application

Keep both terminals running.

### Backend

```bash
cd server
npm run dev
```

### Frontend

```bash
cd client
npm run dev
```

Then open the frontend URL shown in the terminal.

## Step 5: Test the Application

1. Register or log in as a patient.
2. Enter an appointment request using natural language.
3. Select an available appointment slot.
4. Confirm the appointment.
5. Verify the generated Booking ID.
6. Test appointment cancellation.
7. Test rebooking of a cancelled slot.
8. Test unavailable dates and times.

### Example Requests

```text
I need a dermatologist tomorrow at 5 PM
```

```text
I need a cardiologist on 20 August
```

```text
Cancel my appointment APT-XXXXXXXX
```

## Environment Variables

| Variable | Description |
|---|---|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret used for JWT authentication |
| `LLM_API_KEY` | API key for the configured LLM service |
| `TIMEZONE` | Application timezone, e.g. `Asia/Kolkata` |
=======

Usually:
>>>>>>> 07e824526fc480f04769309c1cc6230f15359bf5

http://localhost:5173
Step 4: Run the Application

<<<<<<< HEAD
# 6. Demo Video

📹 **Demo Video:**  
`<insert demo video link here — max 5 minutes, with voiceover explaining the solution>`

### Demo Flow

The demo should showcase:

1. User registration/login
2. Natural-language appointment request
3. AI extracting appointment requirements
4. Doctor and slot availability
5. Alternative slot suggestions
6. Appointment confirmation
7. Generated Booking ID
8. Appointment management
9. Admin dashboard
10. Rescheduling/cancellation
=======
Keep both terminals running.

Backend
cd server
npm run dev
Frontend
cd client
npm run dev
>>>>>>> 07e824526fc480f04769309c1cc6230f15359bf5

Then open the frontend URL shown in the terminal.

<<<<<<< HEAD
# Conclusion

AppointAI combines a conversational AI interface with a deterministic backend booking engine.

The AI handles **understanding and communication**, while the backend handles:

- Validation
- Doctor search
- Slot availability
- Booking
- Rescheduling
- Cancellation
- Authentication
- Authorization
- Double-booking protection

This architecture allows AppointAI to provide a natural conversational experience without allowing the AI to hallucinate or directly manipulate real booking data.

---

*Built as part of the Intern Role assignment — a chat-based appointment booking assistant with a deterministic, non-hallucinating backend and a conversational AI front end.*
=======
Step 5: Test the Application
Register or log in as a patient.
Enter an appointment request using natural language.
Select an available appointment slot.
Confirm the appointment.
Verify the generated Booking ID.
Test appointment cancellation.
Test rebooking of a cancelled slot.
Test unavailable dates and times.
Example Requests
I need a dermatologist tomorrow at 5 PM
I need a cardiologist on 20 August
Cancel my appointment APT-XXXXXXXX
Environment Variables
Variable	Description
MONGODB_URI	MongoDB connection string
JWT_SECRET	Secret used for JWT authentication
LLM_API_KEY	API key for the configured LLM service
TIMEZONE	Application timezone, e.g. Asia/Kolkata
6. Demo Video

📹 Demo Video:
<insert demo video link here — max 5 minutes, with voiceover explaining the solution>

The demo should showcase:

User registration/login
Natural-language appointment request
AI extracting appointment requirements
Doctor and slot availability
Alternative slot suggestions
Appointment confirmation
Generated Booking ID
Appointment management
Admin dashboard
Rescheduling/cancellation
Conclusion

AppointAI combines a conversational AI interface with a deterministic backend booking engine.

The AI handles understanding and communication, while the backend handles:

Validation
Doctor search
Slot availability
Booking
Rescheduling
Cancellation
Authentication
Authorization
Double-booking protection

This architecture allows AppointAI to provide a natural conversational experience without allowing the AI to hallucinate or directly manipulate real booking data.
>>>>>>> 07e824526fc480f04769309c1cc6230f15359bf5
