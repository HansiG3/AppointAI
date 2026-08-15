import Specialization from '../models/Specialization.js';
import Doctor from '../models/Doctor.js';
import Slot from '../models/Slot.js';
import Appointment from '../models/Appointment.js';
import { SLOT_STATUS, DOCTOR_STATUS } from '../config/constants.js';
import { isDateValid, isDateTimeInFuture, addDays } from '../utils/dateTime.js';
import { generateUniqueBookingId } from '../utils/bookingId.js';
import mongoose from 'mongoose';

/**
 * Allowlisted function dispatcher.
 * Maps LLM-requested function names to internal service calls.
 * NEVER dynamically eval model-provided function names.
 */

const ALLOWLIST = {
  searchDoctors,
  checkAvailability,
  findAlternativeSlots,
  createAppointment,
  getAppointment,
  modifyAppointment,
  cancelAppointment,
};

export const dispatch = async (functionName, args, context) => {
  const fn = ALLOWLIST[functionName];
  if (!fn) throw new Error(`Function "${functionName}" is not allowlisted`);
  return fn(args, context);
};

// ─── Functions ────────────────────────────────────────────────────────────────

async function searchDoctors({ specializationId, doctorName, location }, _ctx) {
  const filter = { specialization: specializationId, status: DOCTOR_STATUS.ACTIVE };
  if (location) filter.location = { $regex: location, $options: 'i' };
  if (doctorName) filter.$text = { $search: doctorName };

  const doctors = await Doctor.find(filter)
    .populate('specialization', 'name slug')
    .limit(10)
    .lean();

  return doctors.map(d => ({
    id: d._id,
    name: d.name,
    specialization: d.specialization?.name,
    location: d.location,
    experience: d.experience,
    qualification: d.qualification,
  }));
}

async function checkAvailability({ specializationId, date, time, timeRange, doctorId, location }, _ctx) {
  if (!isDateValid(date)) return { slots: [], reason: 'DATE_IN_PAST' };

  const doctorFilter = { specialization: specializationId, status: DOCTOR_STATUS.ACTIVE };
  if (doctorId) doctorFilter._id = doctorId;
  if (location) doctorFilter.location = { $regex: location, $options: 'i' };

  const doctors = await Doctor.find(doctorFilter).lean();
  if (!doctors.length) return { slots: [], reason: 'NO_DOCTORS' };

  const doctorIds = doctors.map(d => d._id);
  const slotFilter = { doctor: { $in: doctorIds }, date, status: SLOT_STATUS.AVAILABLE };

  if (time) {
    slotFilter.startTime = time;
  } else if (timeRange?.start && timeRange?.end) {
    slotFilter.startTime = { $gte: timeRange.start, $lt: timeRange.end };
  }

  const slots = await Slot.find(slotFilter).sort({ startTime: 1 }).limit(10).lean();

  const doctorMap = {};
  doctors.forEach(d => { doctorMap[d._id.toString()] = d; });

  return {
    slots: slots.map(s => {
      const doc = doctorMap[s.doctor.toString()];
      return {
        slotId: s._id,
        date: s.date,
        startTime: s.startTime,
        endTime: s.endTime,
        doctor: { id: doc._id, name: doc.name, location: doc.location },
      };
    }),
    reason: slots.length ? null : 'NO_SLOTS',
  };
}

async function findAlternativeSlots({ specializationId, date, time, location, doctorId }, _ctx) {
  const alternatives = [];
  const WINDOW_HOURS = 2;

  const doctorFilter = { specialization: specializationId, status: DOCTOR_STATUS.ACTIVE };
  if (location) doctorFilter.location = { $regex: location, $options: 'i' };

  const doctors = await Doctor.find(doctorFilter).lean();
  if (!doctors.length) return { slots: [] };

  const doctorIds = doctors.map(d => d._id);
  const doctorMap = {};
  doctors.forEach(d => { doctorMap[d._id.toString()] = d; });

  // Strategy 1: same date, nearby times (±2 hours)
  if (time) {
    const [h, m] = time.split(':').map(Number);
    const baseMin = h * 60 + m;
    const windowStart = `${String(Math.max(0, Math.floor((baseMin - WINDOW_HOURS * 60) / 60))).padStart(2, '0')}:${String((baseMin - WINDOW_HOURS * 60) % 60 < 0 ? 0 : (baseMin - WINDOW_HOURS * 60) % 60).padStart(2, '0')}`;
    const windowEnd = `${String(Math.floor((baseMin + WINDOW_HOURS * 60) / 60)).padStart(2, '0')}:${String((baseMin + WINDOW_HOURS * 60) % 60).padStart(2, '0')}`;

    const sameDaySlots = await Slot.find({
      doctor: { $in: doctorIds },
      date,
      startTime: { $gte: windowStart, $lte: windowEnd },
      status: SLOT_STATUS.AVAILABLE,
    }).sort({ startTime: 1 }).limit(3).lean();

    sameDaySlots.forEach(s => {
      const doc = doctorMap[s.doctor.toString()];
      const diff = Math.abs(parseInt(s.startTime.replace(':', '')) - parseInt(time.replace(':', '')));
      alternatives.push({ slotId: s._id, date: s.date, startTime: s.startTime, endTime: s.endTime,
        doctor: { id: doc._id, name: doc.name, location: doc.location }, diff, reason: 'DIFFERENT_TIME' });
    });
  }

  // Strategy 2: next 3 days, any time
  if (alternatives.length < 5) {
    for (let i = 1; i <= 3 && alternatives.length < 5; i++) {
      const nextDate = addDays(date, i);
      const nextSlots = await Slot.find({
        doctor: { $in: doctorIds },
        date: nextDate,
        status: SLOT_STATUS.AVAILABLE,
      }).sort({ startTime: 1 }).limit(2).lean();

      nextSlots.forEach(s => {
        const doc = doctorMap[s.doctor.toString()];
        alternatives.push({ slotId: s._id, date: s.date, startTime: s.startTime, endTime: s.endTime,
          doctor: { id: doc._id, name: doc.name, location: doc.location }, diff: i * 1440, reason: 'DIFFERENT_DATE' });
      });
    }
  }

  // Sort by closeness and return top 5
  alternatives.sort((a, b) => a.diff - b.diff);
  return { slots: alternatives.slice(0, 5).map(({ diff, ...s }) => s) };
}

async function createAppointment({ slotId }, { userId }) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const slot = await Slot.findOneAndUpdate(
      { _id: slotId, status: SLOT_STATUS.AVAILABLE },
      { $set: { status: SLOT_STATUS.BOOKED } },
      { new: true, session }
    );

    if (!slot) {
      await session.abortTransaction();
      return { success: false, error: 'SLOT_UNAVAILABLE' };
    }

    const doctor = await Doctor.findById(slot.doctor).populate('specialization').session(session);
    const bookingId = await generateUniqueBookingId(slot.date);

    const [appointment] = await Appointment.create([{
      bookingId, user: userId,
      doctor: doctor._id, specialization: doctor.specialization._id, slot: slot._id,
      date: slot.date, startTime: slot.startTime, endTime: slot.endTime,
      location: doctor.location, status: 'CONFIRMED',
    }], { session });

    await Slot.findByIdAndUpdate(slot._id, { appointment: appointment._id }, { session });
    await session.commitTransaction();

    return {
      success: true,
      appointment: {
        id: appointment._id, bookingId: appointment.bookingId,
        date: slot.date, startTime: slot.startTime, endTime: slot.endTime,
        doctor: doctor.name, specialization: doctor.specialization.name,
        location: doctor.location,
      },
    };
  } catch (err) {
    await session.abortTransaction().catch(() => {});
    throw err;
  } finally {
    session.endSession();
  }
}

async function getAppointment({ appointmentId, bookingId }, { userId }) {
  const filter = { user: userId };
  if (appointmentId) filter._id = appointmentId;
  else if (bookingId) filter.bookingId = bookingId;
  else return null;

  const appt = await Appointment.findOne(filter)
    .populate('doctor', 'name location')
    .populate('specialization', 'name');
  return appt ? appt.toSafeObject() : null;
}

async function modifyAppointment({ appointmentId, newSlotId }, { userId }) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const appointment = await Appointment.findOne({
      _id: appointmentId, user: userId,
      status: { $in: ['CONFIRMED', 'PENDING'] },
    }).session(session);

    if (!appointment) {
      await session.abortTransaction();
      return { success: false, error: 'APPOINTMENT_NOT_FOUND' };
    }

    const newSlot = await Slot.findOneAndUpdate(
      { _id: newSlotId, status: SLOT_STATUS.AVAILABLE },
      { $set: { status: SLOT_STATUS.BOOKED } },
      { new: true, session }
    );

    if (!newSlot) {
      await session.abortTransaction();
      return { success: false, error: 'SLOT_UNAVAILABLE' };
    }

    if (isDateTimeInFuture(appointment.date, appointment.startTime)) {
      await Slot.findByIdAndUpdate(appointment.slot,
        { $set: { status: SLOT_STATUS.AVAILABLE, appointment: null } }, { session });
    }

    const doctor = await Doctor.findById(newSlot.doctor).session(session);
    appointment.slot = newSlot._id;
    appointment.date = newSlot.date;
    appointment.startTime = newSlot.startTime;
    appointment.endTime = newSlot.endTime;
    appointment.location = doctor.location;
    await appointment.save({ session });
    await Slot.findByIdAndUpdate(newSlot._id, { appointment: appointment._id }, { session });

    await session.commitTransaction();
    return { success: true, appointment: appointment.toSafeObject() };
  } catch (err) {
    await session.abortTransaction().catch(() => {});
    throw err;
  } finally {
    session.endSession();
  }
}

async function cancelAppointment({ appointmentId }, { userId }) {
  const session = await mongoose.startSession();
  try {
    session.startTransaction();

    const appointment = await Appointment.findOne({ _id: appointmentId, user: userId }).session(session);
    if (!appointment) {
      await session.abortTransaction();
      return { success: false, error: 'APPOINTMENT_NOT_FOUND' };
    }
    if (appointment.status === 'CANCELLED') {
      await session.abortTransaction();
      return { success: true, appointment: appointment.toSafeObject() }; // idempotent
    }

    appointment.status = 'CANCELLED';
    appointment.cancelledAt = new Date();
    await appointment.save({ session });

    if (isDateTimeInFuture(appointment.date, appointment.startTime)) {
      await Slot.findByIdAndUpdate(appointment.slot,
        { $set: { status: SLOT_STATUS.AVAILABLE, appointment: null } }, { session });
    }

    await session.commitTransaction();
    return { success: true, appointment: appointment.toSafeObject() };
  } catch (err) {
    await session.abortTransaction().catch(() => {});
    throw err;
  } finally {
    session.endSession();
  }
}
