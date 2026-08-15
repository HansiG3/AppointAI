# AppointAI

Conversational healthcare appointment booking platform built with the MERN stack.

## Features

- 🤖 AI-powered conversational booking
- 📅 Real-time appointment scheduling
- 👨‍⚕️ Doctor and specialization management
- 🔐 Secure JWT authentication
- 📱 Responsive design

## Tech Stack

- **Frontend**: React + Vite
- **Backend**: Node.js + Express
- **Database**: MongoDB + Mongoose
- **AI**: Claude (Anthropic)
- **Auth**: JWT + bcryptjs

## Quick Start

### Prerequisites

- Node.js 18+
- MongoDB (local or Atlas)
- Anthropic API key (optional for Phase 1)

### Installation

1. Clone the repository
2. Install all dependencies:
   ```bash
   npm run install:all
   ```

3. Configure environment variables:
   ```bash
   cd server
   cp .env.example .env
   # Edit .env with your MongoDB URI and other settings
   ```

### Development

Run both client and server concurrently:
```bash
npm run dev
```

Or run them separately:
```bash
npm run dev:server  # Backend on port 5000
npm run dev:client  # Frontend on port 5173
```

### Testing

```bash
npm test
```

## Project Structure

```
AppointAI/
├── client/          # React frontend
├── server/          # Express backend
├── docs/            # Documentation
└── package.json     # Root workspace config
```

## Development Phases

- [x] Phase 1: Project Setup
- [ ] Phase 2: Authentication
- [ ] Phase 3: Database Models
- [ ] Phase 4: Backend APIs
- [ ] Phase 5: AI Integration
- [ ] Phase 6: Conversational Booking
- [ ] Phase 7: Admin Dashboard
- [ ] Phase 8: Testing
- [ ] Phase 9: Deployment

## License

MIT
