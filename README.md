# AppointAI — AI-Powered Appointment Booking Assistant

## 1. Problem Understanding

### 1.1 Abstract

Considering the healthcare department, booking an online appointment has always been a tedious task. Existing platforms like Practo and Tata 1mg provide amazing services, but the tiresome process of online appointment booking can still be frustrating. Users often have to manually fill out forms, search for available doctors, select a specialization, and hunt for suitable appointment slots.

AppointAI aims to simplify this process through a conversational AI-based appointment booking system. Instead of navigating through multiple forms, users can simply chat with AppointAI and describe their requirements naturally. For example, a user can say, **"Hey, I want to book a dermatology appointment on 15 August 2026 at 5 PM."** The AI extracts the relevant information, checks the database for available doctors and slots, and guides the user through the booking process. If the requested slot is unavailable, AppointAI suggests nearby available slots.

In this way, AppointAI reduces the manual effort involved in appointment booking and provides a faster, simpler, and more conversational experience.

### 1.2 Key User Flows

### User Flow

<img src="https://github.com/user-attachments/assets/0f0ddd50-18bd-4835-a859-14fe6e958f34" alt="AppointAI User Flow" width="350"/>

### Admin Flow

<img src="https://github.com/user-attachments/assets/3b12fe7b-734f-4bc1-b8c9-fb6ddb46db56" alt="AppointAI Admin Flow" width="200"/>

---

## 2. Spec & Plan

### 2.1 System Design

AppointAI follows a MERN-based architecture.

```text
User
  ↓
React Frontend
  ↓
Node.js + Express Backend
  ↓
AI / Claude
  ↓
Appointment & Availability Logic
  ↓
MongoDB
```

The user interacts with AppointAI through a conversational React interface. The request is sent to the Node.js and Express backend, where the AI interprets the user's natural-language request.

The backend then validates the extracted information and checks the actual doctor and slot availability from MongoDB.

The AI does not directly access or modify the database. The backend remains responsible for availability, validation, and appointment creation.

The basic booking flow is:

```text
User Request
    ↓
AI Understands Request
    ↓
Extract Appointment Details
    ↓
Required Information Available?
    ↓
Check Doctor/Slot Availability
    ↓
Slot Available?
   / \
 No   Yes
 ↓     ↓
Suggest  Show Doctor
Alternatives + Slot
 ↓        ↓
User Selects  Ask Confirmation
Alternative       ↓
      \       User Confirms
       \          ↓
        ───→ Create Appointment
                  ↓
            Generate Booking ID
                  ↓
             Confirmation
```

### 2.2 Feature Breakdown

#### User Features

- User registration and login
- Conversational appointment booking
- Natural-language appointment requests
- Doctor specialization detection
- Date and time extraction
- Doctor search
- Slot availability checking
- Alternative-slot suggestions
- Appointment confirmation
- Unique Booking ID generation
- View appointments
- Reschedule appointments
- Cancel appointments

#### AI Features

- Intent detection
- Appointment detail extraction
- Missing-information detection
- Conversation context
- Clarification questions
- Alternative-slot suggestions
- Backend function/API calling
- Natural-language responses

#### Admin Features

- Admin login
- View appointments
- Search and filter appointments
- View appointment details
- Manage doctors
- Manage specializations
- Manage appointment slots
- Update/reschedule appointments
- Cancel appointments

### 2.3 Prompt Design

The AI acts as a healthcare appointment booking assistant.

For example:

```text
User:
"I want a dermatologist on 15 August at 5 PM."

AI extracts:

Intent: BOOK_APPOINTMENT
Specialization: Dermatology
Date: 15 August 2026
Time: 17:00
```

If information is missing, the AI asks the user for only the required information.

For example:

```text
User:
"I want a dermatologist."

AI:
"Sure! What date and time would you prefer?"
```

The AI can use backend functions such as:

```text
searchDoctors()
checkAvailability()
findAlternativeSlots()
createAppointment()
modifyAppointment()
cancelAppointment()
```

The AI never directly accesses MongoDB.

The backend validates the AI's output before performing any appointment operation.

### 2.4 Data Model

The main MongoDB collections are:

```text
User
Specialization
Doctor
Slot
Appointment
Conversation
```

Basic relationship:

```text
User
  ↓
Appointment
  ↓
Doctor
  ↓
Specialization
  ↓
Slot
```

#### User

Stores user account and authentication information.

#### Doctor

Stores doctor information such as name, specialization, experience and status.

#### Specialization

Stores medical specializations such as Dermatology, Cardiology, Neurology, Orthopedics and Pediatrics.

#### Slot

Stores doctor availability for specific dates and times.

#### Appointment

Stores the user, doctor, selected slot, appointment date/time, Booking ID and appointment status.

Possible appointment statuses:

```text
PENDING
CONFIRMED
CANCELLED
COMPLETED
```

#### Conversation

Stores relevant chat messages and conversation context required for the appointment-booking process.

The backend performs an availability check before creating an appointment to reduce the possibility of double booking.

### 2.5 Implementation Plan

The implementation will be completed in the following stages:

1. **Project Setup**
   - Create React + Vite frontend
   - Create Node.js + Express backend
   - Configure MongoDB
   - Set up environment variables

2. **Authentication**
   - User registration and login
   - JWT authentication
   - Admin authentication and authorization

3. **Database**
   - Create User model
   - Create Doctor model
   - Create Specialization model
   - Create Slot model
   - Create Appointment model
   - Create Conversation model

4. **Backend APIs**
   - Authentication APIs
   - Doctor APIs
   - Availability APIs
   - Appointment APIs
   - Admin APIs
   - Chat API

5. **AI Integration**
   - Integrate Claude API
   - Create system prompt
   - Extract intent and appointment information
   - Handle missing information
   - Connect AI with backend functions

6. **Conversational Booking**
   - Process user requests
   - Check availability
   - Suggest alternatives
   - Confirm appointments
   - Generate Booking ID

7. **Admin Dashboard**
   - View appointments
   - Search/filter bookings
   - Manage doctors
   - Manage slots
   - Update and cancel appointments

8. **Testing**
   - Test authentication
   - Test appointment booking
   - Test unavailable slots
   - Test alternative suggestions
   - Test cancellation and rescheduling
   - Test double-booking scenarios

---

## 3. Implementation

### 3.1 Technology Stack

| Component | Technology |
|---|---|
| Frontend | React + Vite |
| Styling | CSS |
| Backend | Node.js + Express.js |
| Database | MongoDB |
| Database ODM | Mongoose |
| Authentication | JWT + bcryptjs |
| AI | Claude API |
| HTTP Client | Axios |

### 3.2 AI Model

**Model Used:** Claude

Claude is used to understand natural-language appointment requests, extract appointment information, ask clarification questions, and interact with backend booking functions.

**Reason for Choosing Claude:**

AppointAI requires reliable natural-language understanding and structured outputs so that conversational requests can be converted into structured appointment information. Claude was selected for its ability to handle conversational interactions and structured tool/function calling.

**Tokens Used:**

Add the actual token usage recorded during development here.

Example:

```text
Input tokens:
Output tokens:
Total tokens:
```

### 3.3 Implementation Flow

The main AI-to-backend flow is:

```text
User
 ↓
React Chat Interface
 ↓
Axios
 ↓
Node.js + Express
 ↓
Claude
 ↓
Intent + Entity Extraction
 ↓
Backend Validation
 ↓
Check MongoDB
 ↓
Availability Result
 ↓
Claude
 ↓
React
 ↓
User
```

When the user confirms an appointment:

```text
User Confirmation
       ↓
Backend Validation
       ↓
Availability Recheck
       ↓
Create Appointment
       ↓
Generate Booking ID
       ↓
MongoDB
       ↓
Booking Confirmation
```

### 3.4 Project Structure

```text
AppointAI/
│
├── client/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── api/
│   │   ├── context/
│   │   ├── hooks/
│   │   └── styles/
│   │
│   └── vite.config.js
│
├── server/
│   ├── src/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── services/
│   │   ├── middleware/
│   │   ├── validators/
│   │   └── ai/
│   │
│   └── server.js
│
├── docs/
├── README.md
└── .env.example
```

---

## 4. Edge Cases

AppointAI handles the following edge cases:

### Missing Information

If the user does not provide required information, the AI asks for it conversationally.

Example:

```text
User:
"I want to book a dermatologist."

AI:
"What date and time would you prefer?"
```

### Unavailable Slot

If the requested slot is unavailable, the system searches for nearby available slots.

```text
Requested:
5:00 PM

Unavailable.

Alternatives:
5:30 PM
6:00 PM
```

The AI presents these alternatives to the user.

### Ambiguous Time

If the user says:

> "I want an appointment tomorrow evening."

The AI should ask for a more specific time if required.

### Invalid Doctor or Specialization

If the requested doctor or specialization does not exist, the AI informs the user and suggests available options.

### User Changes Preference

If the user changes the date or time during the conversation, the system updates the appointment preference and checks availability again.

### Appointment Cancellation

A user can cancel an existing appointment through the application.

### Double Booking

If two users try to book the same slot, the backend performs a final availability check before creating the appointment.

### Unauthorized Access

Users should only be able to view or modify their own appointments. Admin operations require appropriate authorization.

### AI/API Failure

If the AI service is temporarily unavailable, the system should return a meaningful error message instead of creating an incomplete appointment.

---

## Conclusion

AppointAI aims to make healthcare appointment booking simpler by replacing a lengthy manual booking process with a natural conversation.

Instead of:

```text
Fill Form
   ↓
Select Specialization
   ↓
Search Doctor
   ↓
Search Slot
   ↓
Book Appointment
```

the user can simply:

```text
Chat with AppointAI
        ↓
Understand Request
        ↓
Check Availability
        ↓
Select Slot
        ↓
Confirm
        ↓
Appointment Booked
```

**AppointAI — Book your healthcare appointment through a conversation.**
