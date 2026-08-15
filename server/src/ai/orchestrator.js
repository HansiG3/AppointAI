import Specialization from '../models/Specialization.js';
import Conversation from '../models/Conversation.js';

import { callLLM } from './adapter.js';
import { buildSystemPrompt } from './systemPrompt.js';
import { AI_OUTPUT_SCHEMA } from './outputSchema.js';
import { dispatch } from './functionDispatcher.js';

import {
  getCurrentDateTime,
  isDateValid,
} from '../utils/dateTime.js';

import {
  CONVERSATION_STAGE,
  CONVERSATION_STATUS,
  MESSAGE_ROLE,
  INTENT,
} from '../config/constants.js';

import logger from '../utils/logger.js';

const MAX_FUNCTION_CALLS = 3;

/**
 * ------------------------------------------------------------
 * ALLOWED FUNCTIONS
 * ------------------------------------------------------------
 */

const ALLOWED_FUNCTIONS = [
  'searchDoctors',
  'checkAvailability',
  'findAlternativeSlots',
  'createAppointment',
  'getAppointment',
  'modifyAppointment',
  'cancelAppointment',
];

/**
 * ------------------------------------------------------------
 * VALIDATE AI OUTPUT
 * ------------------------------------------------------------
 */

const validateAIOutput = (output, conversation) => {
  const errors = [];

  if (!output || typeof output !== 'object') {
    return ['AI output is not an object'];
  }

  // Required fields
  if (!output.intent) {
    errors.push('Missing intent');
  }

  if (!output.nextAction) {
    errors.push('Missing nextAction');
  }

  if (!output.assistantMessage) {
    errors.push('Missing assistantMessage');
  }

  // Intent allowlist
  const validIntents = Object.values(INTENT);

  if (
    output.intent &&
    validIntents.length > 0 &&
    !validIntents.includes(output.intent)
  ) {
    errors.push(`Invalid intent: ${output.intent}`);
  }

  // Date validation
  if (output.date && !isDateValid(output.date)) {
    errors.push(`Date "${output.date}" is in the past`);
    output.date = null;
  }

  // Time validation
  if (
    output.time &&
    !/^\d{2}:\d{2}$/.test(output.time)
  ) {
    errors.push(`Invalid time format: ${output.time}`);
    output.time = null;
  }

  // selectedSlotId must be a current candidate
  if (output.selectedSlotId) {
    const candidates =
      conversation.candidateSlotIds?.map((id) => id.toString()) || [];

    if (
      candidates.length > 0 &&
      !candidates.includes(output.selectedSlotId.toString())
    ) {
      errors.push(
        `selectedSlotId "${output.selectedSlotId}" is not a current candidate`
      );

      output.selectedSlotId = null;
    }
  }

  // Function allowlist
  if (output.functionCall?.name) {
    if (!ALLOWED_FUNCTIONS.includes(output.functionCall.name)) {
      errors.push(
        `Function "${output.functionCall.name}" is not allowlisted`
      );

      output.functionCall = null;
      output.nextAction = 'RESPOND';
    }
  }

  // Confirmation safety
  if (
    output.confirmation === 'CONFIRMED' &&
    !conversation.pendingAction
  ) {
    output.confirmation = 'NOT_PROVIDED';
  }

  return errors;
};

/**
 * ------------------------------------------------------------
 * RESOLVE SPECIALIZATION
 * ------------------------------------------------------------
 */

const resolveSpecialization = async (name) => {
  if (!name) {
    return null;
  }

  const normalized = name
    .toLowerCase()
    .trim();

  return Specialization.findOne({
    status: 'ACTIVE',
    $or: [
      {
        slug: normalized,
      },
      {
        name: {
          $regex: `^${normalized}$`,
          $options: 'i',
        },
      },
      {
        aliases: normalized,
      },
    ],
  });
};

/**
 * ------------------------------------------------------------
 * BUILD CONTEXT
 * ------------------------------------------------------------
 *
 * IMPORTANT:
 * We now give the LLM the actual slot information, not only
 * slot IDs.
 *
 * This prevents:
 *
 * User: Dr. Arjun Rao at 5 PM
 *
 * AI accidentally selecting:
 *
 * Dr. Meera Shah at 5 PM
 * ------------------------------------------------------------
 */

const buildContext = async (
  conversation,
  supportedSpecializations
) => {
  const {
    date,
    time,
    timezone,
  } = getCurrentDateTime();

  const draft = conversation.draft || {};

  return {
    currentDate: date,
    currentTime: time,
    timezone,

    supportedSpecializations,

    conversationStage: conversation.stage,

    validatedDraft: draft,

    candidateSlots:
      draft.candidateSlots || [],

    candidateSlotIds:
      conversation.candidateSlotIds || [],

    selectedSlotId:
      conversation.selectedSlotId ||
      draft.selectedSlotId ||
      null,

    pendingAction:
      conversation.pendingAction || null,
  };
};

/**
 * ------------------------------------------------------------
 * NORMALIZE SLOT
 * ------------------------------------------------------------
 *
 * We keep only information the LLM needs.
 */

const normalizeSlot = (slot) => {
  if (!slot) {
    return null;
  }

  return {
    slotId: slot.slotId || slot._id || slot.id,

    doctorId:
      slot.doctorId ||
      slot.doctor?._id ||
      slot.doctor?.id ||
      null,

    doctorName:
      slot.doctorName ||
      slot.doctor?.name ||
      slot.doctor?.fullName ||
      '',

    specialization:
      slot.specialization ||
      slot.specializationName ||
      '',

    date:
      slot.date ||
      '',

    startTime:
      slot.startTime ||
      slot.time ||
      '',

    endTime:
      slot.endTime ||
      '',

    location:
      slot.location ||
      slot.clinicName ||
      slot.clinic?.name ||
      '',
  };
};

/**
 * ------------------------------------------------------------
 * SAVE CANDIDATE SLOTS
 * ------------------------------------------------------------
 */

const saveCandidateSlots = (
  conversation,
  slots
) => {
  const normalizedSlots = slots
    .map(normalizeSlot)
    .filter(
      (slot) =>
        slot &&
        slot.slotId
    );

  conversation.candidateSlotIds =
    normalizedSlots.map(
      (slot) => slot.slotId
    );

  conversation.draft =
    conversation.draft || {};

  conversation.draft.candidateSlots =
    normalizedSlots;

  conversation.markModified('draft');
  conversation.markModified('candidateSlotIds');
};

/**
 * ------------------------------------------------------------
 * FIND SLOT BY ID
 * ------------------------------------------------------------
 */

const findCandidateSlotById = (
  conversation,
  slotId
) => {
  if (!slotId) {
    return null;
  }

  const slots =
    conversation.draft?.candidateSlots || [];

  return (
    slots.find(
      (slot) =>
        slot.slotId?.toString() ===
        slotId.toString()
    ) || null
  );
};

/**
 * ------------------------------------------------------------
 * NORMALIZE TIME
 * ------------------------------------------------------------
 */

const normalizeTime = (value) => {
  if (!value) {
    return null;
  }

  let text = value
    .toString()
    .trim()
    .toLowerCase();

  text = text
    .replace(/\./g, '')
    .replace(/\s+/g, ' ');

  // 9 pm -> 21:00
  const match12 = text.match(
    /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/
  );

  if (match12) {
    let hour = Number(match12[1]);
    const minute = Number(match12[2] || 0);
    const period = match12[3];

    if (period === 'pm' && hour !== 12) {
      hour += 12;
    }

    if (period === 'am' && hour === 12) {
      hour = 0;
    }

    return `${String(hour).padStart(2, '0')}:${String(
      minute
    ).padStart(2, '0')}`;
  }

  // 09:00
  const match24 = text.match(
    /^(\d{1,2}):(\d{2})$/
  );

  if (match24) {
    return `${String(
      Number(match24[1])
    ).padStart(2, '0')}:${match24[2]}`;
  }

  return null;
};

/**
 * ------------------------------------------------------------
 * EXTRACT DOCTOR FROM USER MESSAGE
 * ------------------------------------------------------------
 */

const extractDoctorName = (
  message,
  candidateSlots
) => {
  if (!message || !candidateSlots?.length) {
    return null;
  }

  const lowerMessage =
    message.toLowerCase();

  const doctors = [
    ...new Set(
      candidateSlots
        .map(
          (slot) =>
            slot.doctorName
        )
        .filter(Boolean)
    ),
  ];

  for (const doctor of doctors) {
    if (
      lowerMessage.includes(
        doctor.toLowerCase()
      )
    ) {
      return doctor;
    }

    // Also support:
    // "Dr Arjun Rao"
    // "Arjun Rao"
    const withoutDot =
      doctor
        .toLowerCase()
        .replace(/\./g, '');

    if (
      lowerMessage.includes(
        withoutDot
      )
    ) {
      return doctor;
    }
  }

  return null;
};

/**
 * ------------------------------------------------------------
 * RESOLVE SLOT FROM USER MESSAGE
 * ------------------------------------------------------------
 *
 * This is the most important protection.
 *
 * If the user says:
 *
 * "Dr. Arjun Rao at 5 PM"
 *
 * and we have:
 *
 * Meera 5 PM
 * Arjun 5 PM
 *
 * we deterministically choose Arjun.
 *
 * The LLM does NOT get to randomly choose another slot.
 * ------------------------------------------------------------
 */

const resolveSlotFromUserMessage = (
  message,
  conversation
) => {
  const slots =
    conversation.draft?.candidateSlots || [];

  if (!slots.length) {
    return null;
  }

  const lowerMessage =
    message.toLowerCase();

  const doctorName =
    extractDoctorName(
      message,
      slots
    );

  // Try to find a time in the message.
  const timeMatches =
    lowerMessage.match(
      /\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/gi
    );

  const requestedTime =
    timeMatches?.length
      ? normalizeTime(
          timeMatches[0]
        )
      : null;

  let matches = slots;

  // Doctor filter
  if (doctorName) {
    matches = matches.filter(
      (slot) =>
        slot.doctorName
          ?.toLowerCase()
          .includes(
            doctorName.toLowerCase()
          )
    );
  }

  // Time filter
  if (requestedTime) {
    matches = matches.filter(
      (slot) => {
        const slotTime =
          normalizeTime(
            slot.startTime
          );

        return (
          slotTime ===
          requestedTime
        );
      }
    );
  }

  // If exactly one slot matches,
  // select it deterministically.
  if (matches.length === 1) {
    return matches[0];
  }

  return null;
};

/**
 * ------------------------------------------------------------
 * MAIN CHAT ORCHESTRATOR
 * ------------------------------------------------------------
 */

export const processChatTurn = async ({
  conversation,
  userMessage,
  userId,
}) => {
  // ----------------------------------------------------------
  // Load active specializations
  // ----------------------------------------------------------

  const specializations =
    await Specialization.find({
      status: 'ACTIVE',
    }).lean();

  // ----------------------------------------------------------
  // First try deterministic slot resolution.
  //
  // This is especially important when user is selecting a
  // doctor/time from previously displayed candidates.
  // ----------------------------------------------------------

  let deterministicSlot =
    resolveSlotFromUserMessage(
      userMessage,
      conversation
    );

  // ----------------------------------------------------------
  // If the route already received a UI selection, that is
  // even stronger than natural-language resolution.
  // ----------------------------------------------------------

  if (
    conversation.selectedSlotId
  ) {
    const selectedSlot =
      findCandidateSlotById(
        conversation,
        conversation.selectedSlotId
      );

    if (selectedSlot) {
      deterministicSlot =
        selectedSlot;
    }
  }

  // ----------------------------------------------------------
  // Build context AFTER resolving the current selection.
  // ----------------------------------------------------------

  const context =
    await buildContext(
      conversation,
      specializations
    );

  const systemPrompt =
    buildSystemPrompt(
      context
    );

  // ----------------------------------------------------------
  // Last 10 messages only
  // ----------------------------------------------------------

  const recentMessages =
    conversation.messages.slice(-10);

  let aiOutput = null;

  let functionCallCount = 0;

  let finalAssistantMessage = '';

  let structuredOptions = [];

  let completedAppointment = null;

  try {
    // ========================================================
    // STEP 1
    // Ask LLM for intent/entities
    // ========================================================

    aiOutput =
      await callLLM({
        systemPrompt,
        messages: [
          ...recentMessages,
          {
            role: MESSAGE_ROLE.USER,
            message: userMessage,
          },
        ],
        schema: AI_OUTPUT_SCHEMA,
      });

    // ========================================================
    // STEP 2
    // Validate AI output
    // ========================================================

    const validationErrors =
      validateAIOutput(
        aiOutput,
        conversation
      );

    if (
      validationErrors.length
    ) {
      logger.warn(
        'AI output validation errors:',
        validationErrors
      );
    }

    // ========================================================
    // STEP 3
    // Resolve specialization
    // ========================================================

    if (
      aiOutput.specialization
    ) {
      const spec =
        await resolveSpecialization(
          aiOutput.specialization
        );

      if (spec) {
        conversation.draft =
          conversation.draft || {};

        conversation.draft.specializationId =
          spec._id;

        conversation.draft.specializationName =
          spec.name;

        aiOutput.specializationId =
          spec._id;
      } else {
        aiOutput.specialization =
          null;

        aiOutput.missingInformation =
          [
            ...(aiOutput.missingInformation ||
              []),
            'specialization',
          ];
      }
    }

    // ========================================================
    // STEP 4
    // Update validated draft
    // ========================================================

    conversation.draft =
      conversation.draft || {};

    if (aiOutput.date) {
      conversation.draft.date =
        aiOutput.date;
    }

    if (aiOutput.time) {
      conversation.draft.time =
        aiOutput.time;
    }

    if (
      aiOutput.timeRange?.start
    ) {
      conversation.draft.timeRange =
        {
          start:
            aiOutput.timeRange.start,

          end:
            aiOutput.timeRange.end,
        };
    }

    if (aiOutput.location) {
      conversation.draft.location =
        aiOutput.location;
    }

    conversation.intent =
      aiOutput.intent;

    // ========================================================
    // STEP 5
    // OVERRIDE AI SLOT WITH DETERMINISTIC SLOT
    // ========================================================

    if (deterministicSlot) {
      aiOutput.selectedSlotId =
        deterministicSlot.slotId;

      conversation.selectedSlotId =
        deterministicSlot.slotId;

      conversation.draft.selectedSlotId =
        deterministicSlot.slotId;

      // Update draft with exact selected slot
      conversation.draft.selectedSlot =
        deterministicSlot;

      conversation.markModified(
        'draft'
      );

      logger.info(
        'Deterministically selected slot',
        deterministicSlot
      );
    }

    // ========================================================
    // STEP 6
    // FUNCTION CALL LOOP
    // ========================================================

    while (
      aiOutput.nextAction ===
        'CALL_FUNCTION' &&
      aiOutput.functionCall?.name &&
      functionCallCount <
        MAX_FUNCTION_CALLS
    ) {
      functionCallCount++;

      const {
        name,
        arguments: fnArgs = {},
      } =
        aiOutput.functionCall;

      if (
        !ALLOWED_FUNCTIONS.includes(
          name
        )
      ) {
        throw new Error(
          `Function "${name}" is not allowed`
        );
      }

      logger.info(
        `Dispatching function: ${name}`,
        {
          args: fnArgs,
        }
      );

      // ------------------------------------------------------
      // Never trust userId from LLM
      // ------------------------------------------------------

      const enrichedArgs = {
        ...fnArgs,
      };

      // ------------------------------------------------------
      // Server-side specialization
      // ------------------------------------------------------

      if (
        enrichedArgs.specializationId ===
          undefined &&
        conversation.draft
          ?.specializationId
      ) {
        enrichedArgs.specializationId =
          conversation.draft.specializationId;
      }

      // ======================================================
      // CRITICAL:
      // createAppointment MUST use the validated selected
      // slot, NOT whatever slot ID the LLM invents.
      // ======================================================

      if (
        name ===
        'createAppointment'
      ) {
        const serverSlotId =
          conversation.pendingAction
            ?.slotId ||
          conversation.selectedSlotId ||
          conversation.draft
            ?.selectedSlotId ||
          deterministicSlot?.slotId;

        if (!serverSlotId) {
          throw new Error(
            'Cannot create appointment without a validated slot'
          );
        }

        const candidateIds =
          conversation.candidateSlotIds?.map(
            (id) => id.toString()
          ) || [];

        if (
          candidateIds.length &&
          !candidateIds.includes(
            serverSlotId.toString()
          )
        ) {
          throw new Error(
            'Selected slot is not a current candidate'
          );
        }

        // FORCE the exact server validated slot
        enrichedArgs.slotId =
          serverSlotId;

        // If dispatcher expects selectedSlotId
        // keep both fields synchronized.
        enrichedArgs.selectedSlotId =
          serverSlotId;

        logger.info(
          'FORCED createAppointment slot',
          {
            slotId:
              serverSlotId,
            userId,
          }
        );
      }

      // ======================================================
      // CANCEL APPOINTMENT
      // ======================================================

      if (
        name ===
        'cancelAppointment'
      ) {
        // Always force authenticated user.
        enrichedArgs.userId =
          userId;

        logger.info(
          'Cancelling appointment',
          {
            args:
              enrichedArgs,
          }
        );
      }

      // ======================================================
      // MODIFY APPOINTMENT
      // ======================================================

      if (
        name ===
        'modifyAppointment'
      ) {
        enrichedArgs.userId =
          userId;
      }

      // ======================================================
      // DISPATCH
      // ======================================================

      const fnResult =
        await dispatch(
          name,
          enrichedArgs,
          {
            userId,
          }
        );

      logger.info(
        `Function ${name} result`,
        fnResult
      );

      // ======================================================
      // AVAILABILITY RESULT
      // ======================================================

      if (
        name ===
          'checkAvailability' ||
        name ===
          'findAlternativeSlots'
      ) {
        const slots =
          fnResult?.slots || [];

        // Save complete slot information.
        saveCandidateSlots(
          conversation,
          slots
        );

        conversation.stage =
          slots.length > 0
            ? CONVERSATION_STAGE.AWAITING_SLOT_SELECTION
            : CONVERSATION_STAGE.SEARCHING;

        structuredOptions =
          slots.map(
            (slot) => ({
              type: 'SLOT',
              ...slot,
            })
          );
      }

      // ======================================================
      // CREATE APPOINTMENT RESULT
      // ======================================================

      if (
        name ===
        'createAppointment'
      ) {
        if (
          fnResult?.success
        ) {
          completedAppointment =
            fnResult.appointment ||
            null;

          conversation.stage =
            CONVERSATION_STAGE.COMPLETED;

          conversation.status =
            CONVERSATION_STATUS.COMPLETED;

          conversation.pendingAction =
            null;

          conversation.selectedSlotId =
            null;

          conversation.draft =
            conversation.draft || {};

          conversation.draft.selectedSlotId =
            null;

          conversation.markModified(
            'draft'
          );
        } else {
          conversation.stage =
            CONVERSATION_STAGE.SEARCHING;
        }
      }

      // ======================================================
      // CANCEL / MODIFY RESULT
      // ======================================================

      if (
        name ===
          'cancelAppointment' ||
        name ===
          'modifyAppointment'
      ) {
        if (
          fnResult?.success
        ) {
          conversation.stage =
            CONVERSATION_STAGE.COMPLETED;

          conversation.pendingAction =
            null;

          conversation.selectedSlotId =
            null;

          conversation.draft =
            conversation.draft || {};

          conversation.draft.selectedSlotId =
            null;

          conversation.markModified(
            'draft'
          );
        }
      }

      // ======================================================
      // Ask LLM to turn grounded result into natural language
      // ======================================================

      const groundedMessages = [
        ...recentMessages,

        {
          role: MESSAGE_ROLE.USER,
          message: userMessage,
        },

        {
          role: MESSAGE_ROLE.ASSISTANT,
          message:
            `Function ${name} returned: ${JSON.stringify(
              fnResult
            )}`,
        },
      ];

      aiOutput =
        await callLLM({
          systemPrompt:
            buildSystemPrompt(
              await buildContext(
                conversation,
                specializations
              )
            ),

          messages:
            groundedMessages,

          schema:
            AI_OUTPUT_SCHEMA,
        });

      validateAIOutput(
        aiOutput,
        conversation
      );

      // ------------------------------------------------------
      // After LLM response, never allow it to replace the
      // server selected slot during booking.
      // ------------------------------------------------------

      if (
        name ===
          'createAppointment' &&
        completedAppointment
      ) {
        // Use the actual appointment returned by backend.
        // Do NOT allow LLM to change doctor/time.
        aiOutput.assistantMessage =
          buildAppointmentConfirmation(
            completedAppointment
          );
      }
    }

    // ========================================================
    // STEP 7
    // CONFIRMATION FLOW
    // ========================================================

    if (
      aiOutput.nextAction ===
      'REQUEST_CONFIRMATION'
    ) {
      const confirmationSlot =
        deterministicSlot ||
        findCandidateSlotById(
          conversation,
          aiOutput.selectedSlotId
        );

      if (!confirmationSlot) {
        // Do not allow confirmation for an unknown slot.
        conversation.stage =
          CONVERSATION_STAGE.AWAITING_SLOT_SELECTION;

        aiOutput.assistantMessage =
          'Please select one of the available appointment slots.';

        aiOutput.nextAction =
          'RESPOND';
      } else {
        conversation.stage =
          CONVERSATION_STAGE.AWAITING_CONFIRMATION;

        conversation.selectedSlotId =
          confirmationSlot.slotId;

        conversation.draft =
          conversation.draft || {};

        conversation.draft.selectedSlotId =
          confirmationSlot.slotId;

        conversation.draft.selectedSlot =
          confirmationSlot;

        conversation.pendingAction = {
          type:
            'CREATE_APPOINTMENT',

          slotId:
            confirmationSlot.slotId,

          expiresAt:
            new Date(
              Date.now() +
                5 * 60 * 1000
            ),
        };

        conversation.markModified(
          'draft'
        );

        // IMPORTANT:
        // Build confirmation from server-selected slot,
        // not from LLM-generated doctor information.
        aiOutput.assistantMessage =
          buildSlotConfirmation(
            confirmationSlot
          );
      }
    }

    // ========================================================
    // STEP 8
    // If appointment completed, don't show a stale
    // confirmation for every subsequent message.
    // ========================================================

    if (
      conversation.status ===
        CONVERSATION_STATUS.COMPLETED &&
      completedAppointment
    ) {
      finalAssistantMessage =
        buildAppointmentConfirmation(
          completedAppointment
        );
    } else {
      finalAssistantMessage =
        aiOutput.assistantMessage ||
        'Please select an available appointment slot.';
    }
  } catch (error) {
    logger.error(
      'AI orchestration error:',
      error
    );

    finalAssistantMessage =
      "I'm having trouble processing your request right now. Please try again, or use the booking form directly.";

    conversation.stage =
      CONVERSATION_STAGE.COLLECTING_DETAILS;
  }

  // ==========================================================
  // STEP 9
  // Save assistant message
  // ==========================================================

  conversation.messages.push({
    role: MESSAGE_ROLE.ASSISTANT,
    message:
      finalAssistantMessage,
  });

  conversation.markModified(
    'draft'
  );

  conversation.markModified(
    'candidateSlotIds'
  );

  await conversation.save();

  // ==========================================================
  // STEP 10
  // Return response
  // ==========================================================

  return {
    conversationId:
      conversation._id,

    stage:
      conversation.stage,

    status:
      conversation.status,

    message:
      finalAssistantMessage,

    options:
      structuredOptions,

    appointment:
      completedAppointment,

    error:
      null,
  };
};

/**
 * ------------------------------------------------------------
 * BUILD SLOT CONFIRMATION
 * ------------------------------------------------------------
 */

const buildSlotConfirmation = (
  slot
) => {
  const doctor =
    slot.doctorName ||
    'Selected doctor';

  const specialization =
    slot.specialization ||
    'Selected specialization';

  const date =
    slot.date ||
    'Selected date';

  const startTime =
    slot.startTime ||
    '';

  const endTime =
    slot.endTime ||
    '';

  const location =
    slot.location ||
    'Clinic';

  return [
    'Please confirm your appointment:',
    '',
    `Doctor: ${doctor}`,
    `Specialization: ${specialization}`,
    `Date: ${formatDate(date)}`,
    `Time: ${formatTime(startTime)} - ${formatTime(endTime)}`,
    `Location: ${location}`,
    '',
    'Would you like me to book this appointment?',
  ].join('\n');
};

/**
 * ------------------------------------------------------------
 * BUILD ACTUAL APPOINTMENT CONFIRMATION
 * ------------------------------------------------------------
 */

const buildAppointmentConfirmation = (
  appointment
) => {
  if (!appointment) {
    return 'Appointment confirmed successfully.';
  }

  const doctor =
    appointment.doctorName ||
    appointment.doctor?.name ||
    appointment.doctor?.fullName ||
    'Selected doctor';

  const specialization =
    appointment.specialization ||
    appointment.specializationName ||
    appointment.doctor?.specialization ||
    '';

  const date =
    appointment.date ||
    appointment.appointmentDate ||
    '';

  const startTime =
    appointment.startTime ||
    appointment.time ||
    '';

  const endTime =
    appointment.endTime ||
    '';

  const location =
    appointment.location ||
    appointment.clinicName ||
    appointment.clinic?.name ||
    '';

  const bookingId =
    appointment.bookingId ||
    appointment._id ||
    '';

  return [
    'Appointment confirmed! 🎉',
    '',
    `Doctor: ${doctor}`,
    `Specialization: ${specialization}`,
    `Date: ${formatDate(date)}`,
    `Time: ${formatTime(startTime)}${endTime ? ` - ${formatTime(endTime)}` : ''}`,
    `Location: ${location}`,
    '',
    `Booking ID: ${bookingId}`,
  ].join('\n');
};

/**
 * ------------------------------------------------------------
 * DATE FORMATTER
 * ------------------------------------------------------------
 */

const formatDate = (
  value
) => {
  if (!value) {
    return '';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleDateString(
    'en-GB',
    {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    }
  );
};

/**
 * ------------------------------------------------------------
 * TIME FORMATTER
 * ------------------------------------------------------------
 */

const formatTime = (
  value
) => {
  if (!value) {
    return '';
  }

  const normalized =
    normalizeTime(value);

  if (!normalized) {
    return value;
  }

  const [hours, minutes] =
    normalized.split(':');

  let hour =
    Number(hours);

  const period =
    hour >= 12
      ? 'PM'
      : 'AM';

  hour =
    hour % 12 || 12;

  return `${hour}:${minutes} ${period}`;
};