import Doctor from '../models/Doctor.js';
import Slot from '../models/Slot.js';
import Appointment from '../models/Appointment.js';

import {
  SLOT_STATUS,
  DOCTOR_STATUS,
} from '../config/constants.js';

import {
  isDateValid,
  isDateTimeInFuture,
  addDays,
} from '../utils/dateTime.js';

import {
  generateUniqueBookingId,
} from '../utils/bookingId.js';

import mongoose from 'mongoose';

// ============================================================
// ALLOWLIST
// ============================================================

const ALLOWLIST = {
  searchDoctors,
  checkAvailability,
  findAlternativeSlots,
  createAppointment,
  getAppointment,
  modifyAppointment,
  cancelAppointment,
};

export const dispatch = async (
  functionName,
  args = {},
  context = {}
) => {
  const fn =
    ALLOWLIST[functionName];

  if (!fn) {
    throw new Error(
      `Function "${functionName}" is not allowlisted`
    );
  }

  return fn(args, context);
};

// ============================================================
// SEARCH DOCTORS
// ============================================================

async function searchDoctors(
  {
    specializationId,
    doctorName,
    location,
  },
  _ctx
) {
  const filter = {
    specialization:
      specializationId,

    status:
      DOCTOR_STATUS.ACTIVE,
  };

  if (location) {
    filter.location = {
      $regex: location,
      $options: 'i',
    };
  }

  if (doctorName) {
    filter.name = {
      $regex: doctorName,
      $options: 'i',
    };
  }

  const doctors =
    await Doctor.find(filter)
      .populate(
        'specialization',
        'name slug'
      )
      .limit(10)
      .lean();

  return doctors.map(
    (doctor) => ({
      id: doctor._id,
      name: doctor.name,
      specialization:
        doctor.specialization?.name ||
        null,
      location:
        doctor.location,
      experience:
        doctor.experience,
      qualification:
        doctor.qualification,
    })
  );
}

// ============================================================
// CHECK AVAILABILITY
// ============================================================

async function checkAvailability(
  {
    specializationId,
    date,
    time,
    timeRange,
    doctorId,
    location,
  },
  _ctx
) {
  if (
    !date ||
    !isDateValid(date)
  ) {
    return {
      slots: [],
      reason: 'INVALID_DATE',
    };
  }

  const doctorFilter = {
    specialization:
      specializationId,

    status:
      DOCTOR_STATUS.ACTIVE,
  };

  if (doctorId) {
    doctorFilter._id =
      doctorId;
  }

  if (location) {
    doctorFilter.location = {
      $regex: location,
      $options: 'i',
    };
  }

  const doctors =
    await Doctor.find(
      doctorFilter
    ).lean();

  if (!doctors.length) {
    return {
      slots: [],
      reason: 'NO_DOCTORS',
    };
  }

  const doctorIds =
    doctors.map(
      (doctor) =>
        doctor._id
    );

  const slotFilter = {
    doctor: {
      $in: doctorIds,
    },

    date,

    // THIS IS IMPORTANT.
    // Booked/cancelled slots are not returned.
    status:
      SLOT_STATUS.AVAILABLE,
  };

  if (time) {
    slotFilter.startTime =
      time;
  } else if (
    timeRange?.start &&
    timeRange?.end
  ) {
    slotFilter.startTime = {
      $gte:
        timeRange.start,

      $lt:
        timeRange.end,
    };
  }

  const slots =
    await Slot.find(
      slotFilter
    )
      .sort({
        startTime: 1,
      })
      .limit(10)
      .lean();

  const doctorMap = {};

  doctors.forEach(
    (doctor) => {
      doctorMap[
        doctor._id.toString()
      ] = doctor;
    }
  );

  return {
    slots: slots.map(
      (slot) => {
        const doctor =
          doctorMap[
            slot.doctor.toString()
          ];

        return {
          slotId:
            slot._id,

          date:
            slot.date,

          startTime:
            slot.startTime,

          endTime:
            slot.endTime,

          doctor: {
            id:
              doctor._id,

            name:
              doctor.name,

            location:
              doctor.location,
          },
        };
      }
    ),

    reason:
      slots.length
        ? null
        : 'NO_SLOTS',
  };
}

// ============================================================
// FIND ALTERNATIVE SLOTS
// ============================================================

async function findAlternativeSlots(
  {
    specializationId,
    date,
    time,
    location,
    doctorId,
  },
  _ctx
) {
  const alternatives = [];

  const doctorFilter = {
    specialization:
      specializationId,

    status:
      DOCTOR_STATUS.ACTIVE,
  };

  if (doctorId) {
    doctorFilter._id =
      doctorId;
  }

  if (location) {
    doctorFilter.location = {
      $regex: location,
      $options: 'i',
    };
  }

  const doctors =
    await Doctor.find(
      doctorFilter
    ).lean();

  if (!doctors.length) {
    return {
      slots: [],
    };
  }

  const doctorIds =
    doctors.map(
      (doctor) =>
        doctor._id
    );

  const doctorMap = {};

  doctors.forEach(
    (doctor) => {
      doctorMap[
        doctor._id.toString()
      ] = doctor;
    }
  );

  // ----------------------------------------------------------
  // SAME DATE, NEARBY TIME
  // ----------------------------------------------------------

  if (time) {
    const [hours, minutes] =
      time
        .split(':')
        .map(Number);

    const baseMinutes =
      hours * 60 +
      minutes;

    const startMinutes =
      Math.max(
        0,
        baseMinutes - 120
      );

    const endMinutes =
      Math.min(
        1439,
        baseMinutes + 120
      );

    const toTime = (
      totalMinutes
    ) => {
      const h =
        Math.floor(
          totalMinutes / 60
        );

      const m =
        totalMinutes % 60;

      return `${String(h).padStart(
        2,
        '0'
      )}:${String(m).padStart(
        2,
        '0'
      )}`;
    };

    const sameDaySlots =
      await Slot.find({
        doctor: {
          $in: doctorIds,
        },

        date,

        startTime: {
          $gte:
            toTime(
              startMinutes
            ),

          $lte:
            toTime(
              endMinutes
            ),
        },

        status:
          SLOT_STATUS.AVAILABLE,
      })
        .sort({
          startTime: 1,
        })
        .limit(5)
        .lean();

    sameDaySlots.forEach(
      (slot) => {
        const doctor =
          doctorMap[
            slot.doctor.toString()
          ];

        alternatives.push({
          slotId:
            slot._id,

          date:
            slot.date,

          startTime:
            slot.startTime,

          endTime:
            slot.endTime,

          doctor: {
            id:
              doctor._id,

            name:
              doctor.name,

            location:
              doctor.location,
          },

          reason:
            'DIFFERENT_TIME',
        });
      }
    );
  }

  // ----------------------------------------------------------
  // NEXT 3 DAYS
  // ----------------------------------------------------------

  for (
    let i = 1;
    i <= 3 &&
    alternatives.length < 5;
    i++
  ) {
    const nextDate =
      addDays(date, i);

    const nextSlots =
      await Slot.find({
        doctor: {
          $in: doctorIds,
        },

        date: nextDate,

        status:
          SLOT_STATUS.AVAILABLE,
      })
        .sort({
          startTime: 1,
        })
        .limit(5)
        .lean();

    nextSlots.forEach(
      (slot) => {
        if (
          alternatives.length >=
          5
        ) {
          return;
        }

        const doctor =
          doctorMap[
            slot.doctor.toString()
          ];

        alternatives.push({
          slotId:
            slot._id,

          date:
            slot.date,

          startTime:
            slot.startTime,

          endTime:
            slot.endTime,

          doctor: {
            id:
              doctor._id,

            name:
              doctor.name,

            location:
              doctor.location,
          },

          reason:
            'DIFFERENT_DATE',
        });
      }
    );
  }

  return {
    slots:
      alternatives.slice(0, 5),
  };
}

// ============================================================
// CREATE APPOINTMENT
// ============================================================

async function createAppointment(
  { slotId },
  { userId }
) {
  if (!slotId) {
    return {
      success: false,
      error:
        'SLOT_ID_REQUIRED',
    };
  }

  if (!userId) {
    return {
      success: false,
      error:
        'USER_ID_REQUIRED',
    };
  }

  const session =
    await mongoose.startSession();

  try {
    session.startTransaction();

    // --------------------------------------------------------
    // DUPLICATE APPOINTMENT CHECK
    // --------------------------------------------------------

    const existing =
      await Appointment.findOne({
        user: userId,

        slot: slotId,

        status: {
          $in: [
            'CONFIRMED',
            'PENDING',
          ],
        },
      }).session(session);

    if (existing) {
      await session.abortTransaction();

      return {
        success: false,

        error:
          'DUPLICATE_APPOINTMENT',

        message:
          'You already have this appointment booked.',

        appointment:
          existing.toSafeObject
            ? existing.toSafeObject()
            : existing,
      };
    }

    // --------------------------------------------------------
    // ATOMIC SLOT LOCK
    // --------------------------------------------------------

    const slot =
      await Slot.findOneAndUpdate(
        {
          _id: slotId,

          // CRITICAL:
          // A BOOKED slot cannot be booked again.
          status:
            SLOT_STATUS.AVAILABLE,
        },

        {
          $set: {
            status:
              SLOT_STATUS.BOOKED,
          },
        },

        {
          new: true,
          session,
        }
      );

    if (!slot) {
      await session.abortTransaction();

      return {
        success: false,

        error:
          'SLOT_UNAVAILABLE',

        message:
          'This appointment slot is no longer available.',
      };
    }

    // --------------------------------------------------------
    // DOCTOR
    // --------------------------------------------------------

    const doctor =
      await Doctor.findById(
        slot.doctor
      )
        .populate(
          'specialization'
        )
        .session(session);

    if (!doctor) {
      await session.abortTransaction();

      return {
        success: false,

        error:
          'DOCTOR_NOT_FOUND',
      };
    }

    // --------------------------------------------------------
    // BOOKING ID
    // --------------------------------------------------------

    const bookingId =
      await generateUniqueBookingId(
        slot.date
      );

    // --------------------------------------------------------
    // CREATE APPOINTMENT
    // --------------------------------------------------------

    const [
      appointment,
    ] =
      await Appointment.create(
        [
          {
            bookingId,

            user:
              userId,

            doctor:
              doctor._id,

            specialization:
              doctor.specialization
                ._id,

            slot:
              slot._id,

            date:
              slot.date,

            startTime:
              slot.startTime,

            endTime:
              slot.endTime,

            location:
              doctor.location,

            status:
              'CONFIRMED',
          },
        ],
        {
          session,
        }
      );

    // --------------------------------------------------------
    // LINK SLOT TO APPOINTMENT
    // --------------------------------------------------------

    await Slot.findByIdAndUpdate(
      slot._id,

      {
        $set: {
          appointment:
            appointment._id,
        },
      },

      {
        session,
      }
    );

    await session.commitTransaction();

    return {
      success: true,

      appointment: {
        id:
          appointment._id,

        bookingId:
          appointment.bookingId,

        date:
          slot.date,

        startTime:
          slot.startTime,

        endTime:
          slot.endTime,

        doctor:
          doctor.name,

        specialization:
          doctor
            .specialization
            .name,

        location:
          doctor.location,
      },
    };
  } catch (error) {
    await session
      .abortTransaction()
      .catch(() => {});

    throw error;
  } finally {
    await session.endSession();
  }
}

// ============================================================
// GET APPOINTMENT
// ============================================================

async function getAppointment(
  {
    appointmentId,
    bookingId,
  },
  { userId }
) {
  const filter = {
    user: userId,
  };

  if (appointmentId) {
    if (
      !mongoose.isValidObjectId(
        appointmentId
      )
    ) {
      return null;
    }

    filter._id =
      appointmentId;
  } else if (bookingId) {
    filter.bookingId =
      String(
        bookingId
      )
        .trim()
        .toUpperCase();
  } else {
    return null;
  }

  return Appointment.findOne(
    filter
  )
    .populate(
      'doctor',
      'name location'
    )
    .populate(
      'specialization',
      'name'
    );
}

// ============================================================
// CANCEL APPOINTMENT
// ============================================================

async function cancelAppointment(
  {
    appointmentId,
    bookingId,
  },
  { userId }
) {
  if (!userId) {
    return {
      success: false,

      error:
        'USER_ID_REQUIRED',
    };
  }

  if (
    !appointmentId &&
    !bookingId
  ) {
    return {
      success: false,

      error:
        'APPOINTMENT_ID_OR_BOOKING_ID_REQUIRED',
    };
  }

  const session =
    await mongoose.startSession();

  try {
    session.startTransaction();

    // --------------------------------------------------------
    // FIND USER'S APPOINTMENT
    // --------------------------------------------------------

    const filter = {
      user: userId,
    };

    if (appointmentId) {
      if (
        !mongoose.isValidObjectId(
          appointmentId
        )
      ) {
        await session.abortTransaction();

        return {
          success: false,

          error:
            'APPOINTMENT_NOT_FOUND',
        };
      }

      filter._id =
        appointmentId;
    } else {
      filter.bookingId =
        String(
          bookingId
        )
          .trim()
          .toUpperCase();
    }

    const appointment =
      await Appointment.findOne(
        filter
      ).session(session);

    if (!appointment) {
      await session.abortTransaction();

      return {
        success: false,

        error:
          'APPOINTMENT_NOT_FOUND',

        message:
          'Appointment not found.',
      };
    }

    // --------------------------------------------------------
    // ALREADY CANCELLED
    // --------------------------------------------------------

    if (
      appointment.status ===
      'CANCELLED'
    ) {
      await session.abortTransaction();

      return {
        success: true,

        alreadyCancelled:
          true,

        appointment:
          appointment.toSafeObject
            ? appointment.toSafeObject()
            : appointment,
      };
    }

    // --------------------------------------------------------
    // CANCEL APPOINTMENT
    // --------------------------------------------------------

    appointment.status =
      'CANCELLED';

    appointment.cancelledAt =
      new Date();

    await appointment.save({
      session,
    });

    // --------------------------------------------------------
    // RELEASE SLOT
    // --------------------------------------------------------

    if (
      isDateTimeInFuture(
        appointment.date,
        appointment.startTime
      )
    ) {
      await Slot.findByIdAndUpdate(
        appointment.slot,

        {
          $set: {
            status:
              SLOT_STATUS.AVAILABLE,

            appointment:
              null,
          },
        },

        {
          session,
        }
      );
    }

    await session.commitTransaction();

    return {
      success: true,

      appointment:
        appointment.toSafeObject
          ? appointment.toSafeObject()
          : appointment,
    };
  } catch (error) {
    await session
      .abortTransaction()
      .catch(() => {});

    throw error;
  } finally {
    await session.endSession();
  }
}

// ============================================================
// MODIFY APPOINTMENT
// ============================================================

async function modifyAppointment(
  {
    appointmentId,
    newSlotId,
  },
  { userId }
) {
  if (
    !mongoose.isValidObjectId(
      appointmentId
    )
  ) {
    return {
      success: false,

      error:
        'APPOINTMENT_NOT_FOUND',
    };
  }

  const session =
    await mongoose.startSession();

  try {
    session.startTransaction();

    const appointment =
      await Appointment.findOne({
        _id:
          appointmentId,

        user:
          userId,

        status: {
          $in: [
            'CONFIRMED',
            'PENDING',
          ],
        },
      }).session(session);

    if (!appointment) {
      await session.abortTransaction();

      return {
        success: false,

        error:
          'APPOINTMENT_NOT_FOUND',
      };
    }

    const newSlot =
      await Slot.findOneAndUpdate(
        {
          _id:
            newSlotId,

          status:
            SLOT_STATUS.AVAILABLE,
        },

        {
          $set: {
            status:
              SLOT_STATUS.BOOKED,
          },
        },

        {
          new: true,
          session,
        }
      );

    if (!newSlot) {
      await session.abortTransaction();

      return {
        success: false,

        error:
          'SLOT_UNAVAILABLE',
      };
    }

    if (
      isDateTimeInFuture(
        appointment.date,
        appointment.startTime
      )
    ) {
      await Slot.findByIdAndUpdate(
        appointment.slot,

        {
          $set: {
            status:
              SLOT_STATUS.AVAILABLE,

            appointment:
              null,
          },
        },

        {
          session,
        }
      );
    }

    const doctor =
      await Doctor.findById(
        newSlot.doctor
      ).session(session);

    if (!doctor) {
      await session.abortTransaction();

      return {
        success: false,

        error:
          'DOCTOR_NOT_FOUND',
      };
    }

    appointment.slot =
      newSlot._id;

    appointment.date =
      newSlot.date;

    appointment.startTime =
      newSlot.startTime;

    appointment.endTime =
      newSlot.endTime;

    appointment.location =
      doctor.location;

    await appointment.save({
      session,
    });

    await Slot.findByIdAndUpdate(
      newSlot._id,

      {
        $set: {
          appointment:
            appointment._id,
        },
      },

      {
        session,
      }
    );

    await session.commitTransaction();

    return {
      success: true,

      appointment:
        appointment.toSafeObject
          ? appointment.toSafeObject()
          : appointment,
    };
  } catch (error) {
    await session
      .abortTransaction()
      .catch(() => {});

    throw error;
  } finally {
    await session.endSession();
  }
}