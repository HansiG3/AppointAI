import mongoose from 'mongoose';
import { SLOT_STATUS } from '../config/constants.js';

const slotSchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: [true, 'Doctor is required'],
    },
    date: {
      type: String,
      required: [true, 'Date is required'],
      match: [/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'],
    },
    startTime: {
      type: String,
      required: [true, 'Start time is required'],
      match: [/^\d{2}:\d{2}$/, 'Start time must be in HH:mm format'],
    },
    endTime: {
      type: String,
      required: [true, 'End time is required'],
      match: [/^\d{2}:\d{2}$/, 'End time must be in HH:mm format'],
    },
    status: {
      type: String,
      enum: Object.values(SLOT_STATUS),
      default: SLOT_STATUS.AVAILABLE,
    },
    // Optional: for temporary holds (Phase 2 feature)
    heldBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    holdExpiresAt: {
      type: Date,
      default: null,
    },
    // Set after successful booking
    appointment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// CRITICAL: Unique compound index prevents two slots at same doctor/date/time
slotSchema.index(
  { doctor: 1, date: 1, startTime: 1 },
  { unique: true }
);

// Query index for availability searches
slotSchema.index({ date: 1, status: 1, doctor: 1 });
slotSchema.index({ doctor: 1, date: 1, status: 1 });

// Validate startTime < endTime
slotSchema.pre('save', function (next) {
  if (this.startTime >= this.endTime) {
    return next(new Error('Start time must be before end time'));
  }
  next();
});

slotSchema.methods.toSafeObject = function () {
  return {
    id: this._id,
    doctor: this.doctor,
    date: this.date,
    startTime: this.startTime,
    endTime: this.endTime,
    status: this.status,
  };
};

const Slot = mongoose.model('Slot', slotSchema);

export default Slot;
