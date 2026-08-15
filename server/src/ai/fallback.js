import Specialization from '../models/Specialization.js';
import Slot from '../models/Slot.js';
import { dispatch } from './functionDispatcher.js';

import {
  CONVERSATION_STAGE,
  CONVERSATION_STATUS,
  MESSAGE_ROLE,
} from '../config/constants.js';

import {
  getCurrentDateTime,
  isDateValid,
  addDays,
} from '../utils/dateTime.js';

import logger from '../utils/logger.js';

// ============================================================
// HELPERS
// ============================================================

const formatDate = (date) => {
  if (!date) return '';

  const [year, month, day] = date
    .split('-')
    .map(Number);

  return new Date(
    year,
    month - 1,
    day
  ).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

const formatTime = (time) => {
  if (!time) return '';

  const [hour, minute] = time
    .split(':')
    .map(Number);

  const suffix = hour >= 12 ? 'PM' : 'AM';

  const displayHour = hour % 12 || 12;

  return `${displayHour}:${String(minute).padStart(
    2,
    '0'
  )} ${suffix}`;
};

// ============================================================
// DATE PARSER
// ============================================================

const parseDate = (text) => {
  const lower = text.toLowerCase();

  const { date: today } =
    getCurrentDateTime();

  if (/\btoday\b/.test(lower)) {
    return today;
  }

  if (/\btomorrow\b/.test(lower)) {
    return addDays(today, 1);
  }

  if (
    /\bday after tomorrow\b/.test(lower)
  ) {
    return addDays(today, 2);
  }

  // YYYY-MM-DD

  const isoMatch = lower.match(
    /\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/
  );

  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);

    const result = `${year}-${String(
      month
    ).padStart(2, '0')}-${String(day).padStart(
      2,
      '0'
    )}`;

    return isDateValid(result)
      ? result
      : null;
  }

  // 17 August 2026

  const longMonthMatch = lower.match(
    /\b(\d{1,2})\s+(january|february|march|april|may|june|july|august|september|october|november|december)(?:\s+(20\d{2}))?\b/
  );

  if (longMonthMatch) {
    const months = {
      january: 1,
      february: 2,
      march: 3,
      april: 4,
      may: 5,
      june: 6,
      july: 7,
      august: 8,
      september: 9,
      october: 10,
      november: 11,
      december: 12,
    };

    const day = Number(longMonthMatch[1]);
    const month = months[longMonthMatch[2]];

    const { date: currentDate } =
      getCurrentDateTime();

    const currentYear = Number(
      currentDate.split('-')[0]
    );

    const year = Number(
      longMonthMatch[3] || currentYear
    );

    const result = `${year}-${String(
      month
    ).padStart(2, '0')}-${String(day).padStart(
      2,
      '0'
    )}`;

    return isDateValid(result)
      ? result
      : null;
  }

  // 17 Aug 2026

  const shortMonthMatch = lower.match(
    /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*(?:\s+(20\d{2}))?\b/
  );

  if (shortMonthMatch) {
    const months = {
      jan: 1,
      feb: 2,
      mar: 3,
      apr: 4,
      may: 5,
      jun: 6,
      jul: 7,
      aug: 8,
      sep: 9,
      oct: 10,
      nov: 11,
      dec: 12,
    };

    const day = Number(shortMonthMatch[1]);
    const month = months[shortMonthMatch[2]];

    const { date: currentDate } =
      getCurrentDateTime();

    const currentYear = Number(
      currentDate.split('-')[0]
    );

    const year = Number(
      shortMonthMatch[3] || currentYear
    );

    const result = `${year}-${String(
      month
    ).padStart(2, '0')}-${String(day).padStart(
      2,
      '0'
    )}`;

    return isDateValid(result)
      ? result
      : null;
  }

  return null;
};

// ============================================================
// TIME PARSER
// ============================================================

const parseTime = (text) => {
  const lower = text.toLowerCase();

  // 5 PM / 5:30 PM

  const amPm = lower.match(
    /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/
  );

  if (amPm) {
    let hour = Number(amPm[1]);
    const minute = Number(amPm[2] || 0);
    const period = amPm[3];

    if (
      hour < 1 ||
      hour > 12 ||
      minute > 59
    ) {
      return null;
    }

    if (period === 'pm' && hour !== 12) {
      hour += 12;
    }

    if (period === 'am' && hour === 12) {
      hour = 0;
    }

    return `${String(hour).padStart(
      2,
      '0'
    )}:${String(minute).padStart(2, '0')}`;
  }

  // 17:00

  const twentyFourHour = lower.match(
    /\b([01]\d|2[0-3]):([0-5]\d)\b/
  );

  if (twentyFourHour) {
    return `${twentyFourHour[1]}:${twentyFourHour[2]}`;
  }

  return null;
};

// ============================================================
// TIME RANGE
// ============================================================

const parseTimeRange = (text) => {
  const lower = text.toLowerCase();

  if (/\bmorning\b/.test(lower)) {
    return {
      start: '08:00',
      end: '12:00',
    };
  }

  if (/\bafternoon\b/.test(lower)) {
    return {
      start: '12:00',
      end: '17:00',
    };
  }

  if (/\bevening\b/.test(lower)) {
    return {
      start: '17:00',
      end: '21:00',
    };
  }

  return null;
};

// ============================================================
// INTENT DETECTION
// ============================================================

const isCancellationRequest = (text) => {
  return /\b(cancel|cancellation|cancelled|canceling|cancelling)\b/i.test(
    text
  );
};

const isConfirmation = (text) => {
  return /^(yes|yeah|yep|y|confirm|confirmed|book it|go ahead|sure|okay|ok)$/i.test(
    text.trim()
  );
};

const isRejection = (text) => {
  return /^(no|nope|n|don't|do not|cancel)$/i.test(
    text.trim()
  );
};

const isShowAllSlots = (text) => {
  const lower = text.toLowerCase();

  return (
    (
      /\bshow\b/.test(lower) ||
      /\bsee\b/.test(lower) ||
      /\blist\b/.test(lower) ||
      /\bdisplay\b/.test(lower)
    ) &&
    /\bslot/.test(lower)
  );
};

// ============================================================
// BOOKING ID
// ============================================================

const extractBookingId = (text) => {
  const match = text.match(
    /\bAPT-\d{8}-[A-Z0-9]+\b/i
  );

  return match
    ? match[0].toUpperCase()
    : null;
};

// ============================================================
// SLOT ID
// ============================================================

const extractObjectId = (text) => {
  const match = text.match(
    /\b[a-f0-9]{24}\b/i
  );

  return match
    ? match[0]
    : null;
};

// ============================================================
// SPECIALIZATION
// ============================================================

const findSpecialization = (
  text,
  specializations
) => {
  const lower = text.toLowerCase();

  return specializations.find(
    (spec) => {
      const values = [
        spec.name,
        spec.slug,
        ...(spec.aliases || []),
      ]
        .filter(Boolean)
        .map((value) =>
          String(value).toLowerCase()
        );

      return values.some((value) =>
        lower.includes(value)
      );
    }
  );
};

// ============================================================
// ADD MESSAGE
// ============================================================

const addAssistantMessage = (
  conversation,
  message
) => {
  conversation.messages.push({
    role: MESSAGE_ROLE.ASSISTANT,
    message,
  });
};

// ============================================================
// SAVE
// ============================================================

const saveConversation = async (
  conversation
) => {
  conversation.markModified('draft');
  conversation.markModified(
    'candidateSlotIds'
  );

  await conversation.save();
};

// ============================================================
// CANCEL APPOINTMENT
// ============================================================

const handleCancellation = async ({
  conversation,
  userMessage,
  userId,
}) => {
  const bookingId =
    extractBookingId(userMessage);

  if (!bookingId) {
    const message =
      'Please provide your Booking ID so I can cancel the appointment. For example: APT-20260817-CZBO3N';

    addAssistantMessage(
      conversation,
      message
    );

    await saveConversation(
      conversation
    );

    return {
      conversationId:
        conversation._id,
      stage: conversation.stage,
      message,
      options: [],
      appointment: null,
      error: null,
    };
  }

  const result = await dispatch(
    'cancelAppointment',
    {
      bookingId,
    },
    {
      userId,
    }
  );

  if (!result.success) {
    const message =
      result.error ===
      'APPOINTMENT_NOT_FOUND'
        ? `I couldn't find an appointment with Booking ID ${bookingId}. Please check the Booking ID and try again.`
        : result.message ||
          'I could not cancel the appointment. Please try again.';

    addAssistantMessage(
      conversation,
      message
    );

    await saveConversation(
      conversation
    );

    return {
      conversationId:
        conversation._id,
      stage: conversation.stage,
      message,
      options: [],
      appointment: null,
      error: null,
    };
  }

  conversation.pendingAction = null;
  conversation.selectedSlotId = null;

  conversation.stage =
    CONVERSATION_STAGE.COMPLETED;

  conversation.status =
    CONVERSATION_STATUS.COMPLETED;

  const message =
    `Appointment cancelled successfully. ✅\n\n` +
    `Booking ID: ${bookingId}\n\n` +
    `The appointment slot has been released and is available for booking again.`;

  addAssistantMessage(
    conversation,
    message
  );

  await saveConversation(
    conversation
  );

  return {
    conversationId:
      conversation._id,
    stage: conversation.stage,
    message,
    options: [],
    appointment:
      result.appointment || null,
    error: null,
  };
};

// ============================================================
// CONFIRM BOOKING
// ============================================================

const handleConfirmation = async ({
  conversation,
  userMessage,
  userId,
}) => {
  if (
    isRejection(userMessage)
  ) {
    conversation.pendingAction = null;
    conversation.selectedSlotId = null;

    conversation.stage =
      CONVERSATION_STAGE.AWAITING_SLOT_SELECTION;

    const message =
      'No problem. Please select another available slot.';

    addAssistantMessage(
      conversation,
      message
    );

    await saveConversation(
      conversation
    );

    return {
      conversationId:
        conversation._id,
      stage: conversation.stage,
      message,
      options: [],
      appointment: null,
      error: null,
    };
  }

  if (
    !isConfirmation(userMessage)
  ) {
    const message =
      'Would you like me to book this appointment? Please reply "yes" or "no".';

    addAssistantMessage(
      conversation,
      message
    );

    await saveConversation(
      conversation
    );

    return {
      conversationId:
        conversation._id,
      stage: conversation.stage,
      message,
      options: [],
      appointment: null,
      error: null,
    };
  }

  const pending =
    conversation.pendingAction;

  if (
    !pending ||
    pending.type !==
      'CREATE_APPOINTMENT'
  ) {
    conversation.stage =
      CONVERSATION_STAGE.AWAITING_SLOT_SELECTION;

    const message =
      'Your previous slot selection is no longer active. Please select an available slot again.';

    addAssistantMessage(
      conversation,
      message
    );

    await saveConversation(
      conversation
    );

    return {
      conversationId:
        conversation._id,
      stage: conversation.stage,
      message,
      options: [],
      appointment: null,
      error: null,
    };
  }

  if (
    pending.expiresAt &&
    new Date(pending.expiresAt) <
      new Date()
  ) {
    conversation.pendingAction = null;
    conversation.selectedSlotId = null;

    conversation.stage =
      CONVERSATION_STAGE.AWAITING_SLOT_SELECTION;

    const message =
      'That slot selection has expired. Please choose an available slot again.';

    addAssistantMessage(
      conversation,
      message
    );

    await saveConversation(
      conversation
    );

    return {
      conversationId:
        conversation._id,
      stage: conversation.stage,
      message,
      options: [],
      appointment: null,
      error: null,
    };
  }

  const result = await dispatch(
    'createAppointment',
    {
      slotId: pending.slotId,
    },
    {
      userId,
    }
  );

  if (!result.success) {
    conversation.pendingAction = null;
    conversation.selectedSlotId = null;

    conversation.stage =
      CONVERSATION_STAGE.SEARCHING;

    let message;

    if (
      result.error ===
      'SLOT_UNAVAILABLE'
    ) {
      message =
        'Sorry, that slot is no longer available. It may have just been booked by another patient. Please choose another slot.';
    } else if (
      result.error ===
      'DUPLICATE_APPOINTMENT'
    ) {
      message =
        'You already have this appointment booked. I will not create a duplicate booking.';
    } else {
      message =
        'I could not complete the booking. Please choose another slot.';
    }

    addAssistantMessage(
      conversation,
      message
    );

    await saveConversation(
      conversation
    );

    return {
      conversationId:
        conversation._id,
      stage: conversation.stage,
      message,
      options: [],
      appointment: null,
      error: null,
    };
  }

  conversation.pendingAction = null;
  conversation.selectedSlotId = null;

  conversation.stage =
    CONVERSATION_STAGE.COMPLETED;

  conversation.status =
    CONVERSATION_STATUS.COMPLETED;

  const appointment =
    result.appointment;

  const message =
    `Appointment confirmed! 🎉\n\n` +
    `Doctor: ${appointment.doctor}\n` +
    `Specialization: ${appointment.specialization}\n` +
    `Date: ${formatDate(
      appointment.date
    )}\n` +
    `Time: ${formatTime(
      appointment.startTime
    )} - ${formatTime(
      appointment.endTime
    )}\n` +
    `Location: ${appointment.location}\n\n` +
    `Booking ID: ${appointment.bookingId}`;

  addAssistantMessage(
    conversation,
    message
  );

  await saveConversation(
    conversation
  );

  return {
    conversationId:
      conversation._id,
    stage: conversation.stage,
    message,
    options: [],
    appointment,
    error: null,
  };
};

// ============================================================
// SLOT SELECTION
// ============================================================

const handleSlotSelection = async ({
  conversation,
  userMessage,
}) => {
  const candidateIds = (
    conversation.candidateSlotIds || []
  ).map((id) =>
    id.toString()
  );

  let slotId =
    extractObjectId(userMessage);

  // If user says something like:
  // "9 AM"
  // find matching candidate slot.

  if (!slotId) {
    const requestedTime =
      parseTime(userMessage);

    if (requestedTime) {
      const matchingSlot =
        await Slot.findOne({
          _id: {
            $in: candidateIds,
          },
          startTime:
            requestedTime,
          status: 'AVAILABLE',
        });

      if (matchingSlot) {
        slotId =
          matchingSlot._id.toString();
      }
    }
  }

  // Also support:
  // "I want the first one"
  // "option 1"

  if (!slotId) {
    const optionMatch =
      userMessage.match(
        /\b(?:option|slot|number)\s*(\d+)\b/i
      );

    if (optionMatch) {
      const index =
        Number(optionMatch[1]) - 1;

      if (
        index >= 0 &&
        index < candidateIds.length
      ) {
        slotId =
          candidateIds[index];
      }
    }
  }

  if (
    !slotId ||
    !candidateIds.includes(
      slotId.toString()
    )
  ) {
    const message =
      'Please select one of the available appointment slots. You can say the doctor and time, such as "Dr. Arjun Rao at 9 AM".';

    addAssistantMessage(
      conversation,
      message
    );

    await saveConversation(
      conversation
    );

    return {
      conversationId:
        conversation._id,
      stage: conversation.stage,
      message,
      options: [],
      appointment: null,
      error: null,
    };
  }

  const slot =
    await Slot.findById(slotId)
      .populate({
        path: 'doctor',
        populate: {
          path: 'specialization',
        },
      })
      .lean();

  if (
    !slot ||
    slot.status !== 'AVAILABLE'
  ) {
    conversation.selectedSlotId = null;

    conversation.stage =
      CONVERSATION_STAGE.SEARCHING;

    const message =
      'Sorry, that slot is no longer available. Please search again for available slots.';

    addAssistantMessage(
      conversation,
      message
    );

    await saveConversation(
      conversation
    );

    return {
      conversationId:
        conversation._id,
      stage: conversation.stage,
      message,
      options: [],
      appointment: null,
      error: null,
    };
  }

  conversation.selectedSlotId =
    slot._id;

  conversation.pendingAction = {
    type: 'CREATE_APPOINTMENT',
    slotId: slot._id,
    expiresAt: new Date(
      Date.now() + 5 * 60 * 1000
    ),
  };

  conversation.stage =
    CONVERSATION_STAGE.AWAITING_CONFIRMATION;

  const message =
    `Please confirm your appointment:\n\n` +
    `Doctor: ${
      slot.doctor?.name || 'Doctor'
    }\n` +
    `Specialization: ${
      slot.doctor?.specialization?.name ||
      conversation.draft
        ?.specializationName ||
      'Specialist'
    }\n` +
    `Date: ${formatDate(
      slot.date
    )}\n` +
    `Time: ${formatTime(
      slot.startTime
    )} - ${formatTime(
      slot.endTime
    )}\n` +
    `Location: ${
      slot.doctor?.location || 'Clinic'
    }\n\n` +
    `Would you like me to book this appointment?`;

  addAssistantMessage(
    conversation,
    message
  );

  await saveConversation(
    conversation
  );

  return {
    conversationId:
      conversation._id,
    stage: conversation.stage,
    message,
    options: [],
    appointment: null,
    error: null,
  };
};

// ============================================================
// MAIN FALLBACK
// ============================================================

export const processFallbackTurn =
  async ({
    conversation,
    userMessage,
    userId,
    specializations,
  }) => {
    try {
      const text =
        userMessage.trim();

      // ------------------------------------------------------
      // CANCEL
      // ------------------------------------------------------

      if (
        isCancellationRequest(text)
      ) {
        return await handleCancellation({
          conversation,
          userMessage: text,
          userId,
        });
      }

      // ------------------------------------------------------
      // CONFIRMATION
      // ------------------------------------------------------

      if (
        conversation.pendingAction
          ?.type ===
        'CREATE_APPOINTMENT'
      ) {
        return await handleConfirmation({
          conversation,
          userMessage: text,
          userId,
        });
      }

      // ------------------------------------------------------
      // SLOT SELECTION
      // ------------------------------------------------------

      if (
        conversation.stage ===
        CONVERSATION_STAGE.AWAITING_SLOT_SELECTION
      ) {
        return await handleSlotSelection({
          conversation,
          userMessage: text,
        });
      }

      // ------------------------------------------------------
      // SPECIALIZATION
      // ------------------------------------------------------

      const specialization =
        findSpecialization(
          text,
          specializations
        );

      if (specialization) {
        conversation.draft.specializationId =
          specialization._id;

        conversation.draft.specializationName =
          specialization.name;
      }

      // ------------------------------------------------------
      // SHOW ALL SLOTS
      // ------------------------------------------------------

      const showAll =
        isShowAllSlots(text);

      // ------------------------------------------------------
      // DATE
      // ------------------------------------------------------

      const parsedDate =
        parseDate(text);

      const date =
        parsedDate ||
        conversation.draft?.date ||
        null;

      // ------------------------------------------------------
      // TIME
      // ------------------------------------------------------

      let time;

      let timeRange;

      if (showAll) {
        // VERY IMPORTANT:
        // Do not reuse an old time.

        time = null;
        timeRange = null;

        conversation.draft.time = null;
        conversation.draft.timeRange =
          null;
      } else {
        time =
          parseTime(text) ||
          conversation.draft?.time ||
          null;

        timeRange =
          parseTimeRange(text) ||
          conversation.draft?.timeRange ||
          null;
      }

      // ------------------------------------------------------
      // Save parsed information
      // ------------------------------------------------------

      if (date) {
        conversation.draft.date =
          date;
      }

      if (time) {
        conversation.draft.time =
          time;

        conversation.draft.timeRange =
          null;
      }

      if (
        timeRange &&
        !time
      ) {
        conversation.draft.timeRange =
          timeRange;
      }

      // ------------------------------------------------------
      // Need specialization
      // ------------------------------------------------------

      const specializationId =
        conversation.draft
          ?.specializationId;

      const specializationName =
        conversation.draft
          ?.specializationName;

      if (!specializationId) {
        conversation.stage =
          CONVERSATION_STAGE.COLLECTING_DETAILS;

        const message =
          'Sure! Which type of doctor would you like to see? For example, dermatologist, cardiologist, neurologist, or orthopedist.';

        addAssistantMessage(
          conversation,
          message
        );

        await saveConversation(
          conversation
        );

        return {
          conversationId:
            conversation._id,
          stage:
            conversation.stage,
          message,
          options: [],
          appointment: null,
          error: null,
        };
      }

      // ------------------------------------------------------
      // Need date
      // ------------------------------------------------------

      if (!date) {
        conversation.stage =
          CONVERSATION_STAGE.COLLECTING_DETAILS;

        const message =
          `When would you like to see a ${specializationName}? For example: tomorrow or 17 August 2026.`;

        addAssistantMessage(
          conversation,
          message
        );

        await saveConversation(
          conversation
        );

        return {
          conversationId:
            conversation._id,
          stage:
            conversation.stage,
          message,
          options: [],
          appointment: null,
          error: null,
        };
      }

      // ------------------------------------------------------
      // CHECK AVAILABILITY
      // ------------------------------------------------------

      const availability =
        await dispatch(
          'checkAvailability',
          {
            specializationId,
            date,
            time,
            timeRange,
          },
          {
            userId,
          }
        );

      let slots =
        availability.slots || [];

      // ------------------------------------------------------
      // If specific time unavailable:
      // find nearby alternatives.
      // ------------------------------------------------------

      if (
        !slots.length &&
        time &&
        !showAll
      ) {
        const alternatives =
          await dispatch(
            'findAlternativeSlots',
            {
              specializationId,
              date,
              time,
            },
            {
              userId,
            }
          );

        // IMPORTANT:
        // Do NOT silently replace an unavailable requested
        // date with another date.
        //
        // Only use alternatives from the SAME DATE.

        slots =
          (alternatives.slots || [])
            .filter(
              (slot) =>
                slot.date === date
            );
      }

      // ------------------------------------------------------
      // NO AVAILABILITY
      // ------------------------------------------------------

      if (!slots.length) {
        conversation.candidateSlotIds =
          [];

        conversation.stage =
          CONVERSATION_STAGE.SEARCHING;

        const message =
          `I couldn't find an available ${specializationName} appointment for ${formatDate(
            date
          )}. Please try another date or time.`;

        addAssistantMessage(
          conversation,
          message
        );

        await saveConversation(
          conversation
        );

        return {
          conversationId:
            conversation._id,
          stage:
            conversation.stage,
          message,
          options: [],
          appointment: null,
          error: null,
        };
      }

      // ------------------------------------------------------
      // STORE CANDIDATES
      // ------------------------------------------------------

      conversation.candidateSlotIds =
        slots.map(
          (slot) => slot.slotId
        );

      conversation.selectedSlotId =
        null;

      conversation.stage =
        CONVERSATION_STAGE.AWAITING_SLOT_SELECTION;

      // ------------------------------------------------------
      // OPTIONS
      // ------------------------------------------------------

      const options =
        slots.map((slot) => ({
          type: 'SLOT',

          slotId:
            slot.slotId,

          date:
            slot.date,

          startTime:
            slot.startTime,

          endTime:
            slot.endTime,

          doctorName:
            slot.doctor?.name ||
            'Doctor',

          specializationName,

          location:
            slot.doctor?.location ||
            '',
        }));

      // ------------------------------------------------------
      // MESSAGE
      // ------------------------------------------------------

      const displayedSlots =
        slots.slice(0, 5);

      const message =
        `I found ${slots.length} available appointment option${
          slots.length === 1 ? '' : 's'
        } for ${specializationName}:\n\n` +
        displayedSlots
          .map(
            (slot, index) =>
              `${index + 1}. ${
                slot.doctor?.name ||
                'Doctor'
              } — ${formatDate(
                slot.date
              )} at ${formatTime(
                slot.startTime
              )}`
          )
          .join('\n') +
        `\n\nPlease select a slot to continue.`;

      addAssistantMessage(
        conversation,
        message
      );

      await saveConversation(
        conversation
      );

      return {
        conversationId:
          conversation._id,
        stage: conversation.stage,
        message,
        options,
        appointment: null,
        error: null,
      };
    } catch (error) {
      logger.error(
        'Fallback processing error:',
        error
      );

      const message =
        "I'm having trouble processing your request right now. Please try again.";

      addAssistantMessage(
        conversation,
        message
      );

      await saveConversation(
        conversation
      );

      return {
        conversationId:
          conversation._id,
        stage:
          conversation.stage,
        message,
        options: [],
        appointment: null,
        error:
          'FALLBACK_ERROR',
      };
    }
  };