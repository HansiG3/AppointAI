import mongoose from 'mongoose';
import { APPOINTMENT_STATUS } from '../config/constants.js';

const appointmentSchema = new mongoose.Schema(
  {
    bookingId: {
      type: String,
      required: [true, 'Booking ID is required'],
      unique: true,
      trim: true,
      match: [/^APT-\d{8}-[A-Z0-9]{6}$/, 'Invalid Booking ID format'],
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: [true, 'Doctor is required'],
    },
    specialization: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Specialization',
      required: [true, 'Specialization is required'],
    },
    slot: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Slot',
      required: [true, 'Slot is required'],
    },
    // Denormalized snapshot fields for convenient display + history
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
      match: [/^\d{2}:\d{2}$/, 'End time must be in HH:mm format'],
    },
    location: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      enum: Object.values(APPOINTMENT_STATUS),
      default: APPOINTMENT_STATUS.CONFIRMED,
    },
    cancellationReason: {
      type: String,
      trim: true,
      maxlength: [500, 'Cancellation reason cannot exceed 500 characters'],
      default: null,
    },
    cancelledAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes (bookingId already indexed via `unique: true` on the field — no duplicate needed)
appointmentSchema.index({ user: 1, date: 1, status: 1 });
appointmentSchema.index({ doctor: 1, date: 1, status: 1 });
appointmentSchema.index({ specialization: 1, date: 1 });
appointmentSchema.index({ slot: 1 });

// Safe serialization
appointmentSchema.methods.toSafeObject = function () {
  return {
    id: this._id,
    bookingId: this.bookingId,
    user: this.user,
    doctor: this.doctor,
    specialization: this.specialization,
    slot: this.slot,
    date: this.date,
    startTime: this.startTime,
    endTime: this.endTime,
    location: this.location,
    status: this.status,
    cancellationReason: this.cancellationReason,
    cancelledAt: this.cancelledAt,
    createdAt: this.createdAt,
    updatedAt: this.updatedAt,
  };
};

const Appointment = mongoose.model('Appointment', appointmentSchema);

export default Appointment;
