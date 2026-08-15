import mongoose from 'mongoose';
import {
  CONVERSATION_STAGE,
  CONVERSATION_STATUS,
  MESSAGE_ROLE,
  INTENT,
} from '../config/constants.js';

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: Object.values(MESSAGE_ROLE),
      required: true,
    },
    message: {
      type: String,
      required: true,
      maxlength: [5000, 'Message cannot exceed 5000 characters'],
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

// Fixed schema for pending action — no unrestricted mixed objects
const pendingActionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['CREATE_APPOINTMENT', 'RESCHEDULE_APPOINTMENT', 'CANCEL_APPOINTMENT'],
    },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', default: null },
    slotId: { type: mongoose.Schema.Types.ObjectId, ref: 'Slot', default: null },
    idempotencyKey: { type: String, default: null },
    expiresAt: { type: Date, default: null },
  },
  { _id: false }
);

// Fixed schema for the appointment draft
const draftSchema = new mongoose.Schema(
  {
    specializationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Specialization', default: null },
    specializationName: { type: String, default: null },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', default: null },
    date: { type: String, default: null },        // YYYY-MM-DD
    time: { type: String, default: null },        // HH:mm
    timeRange: {
      start: { type: String, default: null },
      end: { type: String, default: null },
    },
    location: { type: String, default: null },
  },
  { _id: false }
);

const conversationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    // Bounded message history (archive old messages in Phase 2)
    messages: {
      type: [messageSchema],
      default: [],
      validate: {
        validator: (arr) => arr.length <= 200,
        message: 'Conversation history cannot exceed 200 messages',
      },
    },
    stage: {
      type: String,
      enum: Object.values(CONVERSATION_STAGE),
      default: CONVERSATION_STAGE.COLLECTING_DETAILS,
    },
    intent: {
      type: String,
      enum: [...Object.values(INTENT), null],
      default: null,
    },
    draft: {
      type: draftSchema,
      default: () => ({}),
    },
    // Most recent server-returned slot options (validated IDs only)
    candidateSlotIds: {
      type: [mongoose.Schema.Types.ObjectId],
      ref: 'Slot',
      default: [],
    },
    // Server-validated selection from candidateSlotIds
    selectedSlotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Slot',
      default: null,
    },
    // Appointment being viewed/modified/cancelled
    targetAppointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
    },
    pendingAction: {
      type: pendingActionSchema,
      default: null,
    },
    status: {
      type: String,
      enum: Object.values(CONVERSATION_STATUS),
      default: CONVERSATION_STATUS.ACTIVE,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
conversationSchema.index({ user: 1, status: 1 });
conversationSchema.index({ user: 1, updatedAt: -1 });

const Conversation = mongoose.model('Conversation', conversationSchema);

export default Conversation;
