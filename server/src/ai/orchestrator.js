import Specialization from '../models/Specialization.js';
import Conversation from '../models/Conversation.js';
import { callLLM } from './adapter.js';
import { buildSystemPrompt } from './systemPrompt.js';
import { AI_OUTPUT_SCHEMA } from './outputSchema.js';
import { dispatch } from './functionDispatcher.js';
import { getCurrentDateTime, isDateValid } from '../utils/dateTime.js';
import { CONVERSATION_STAGE, CONVERSATION_STATUS, MESSAGE_ROLE, INTENT, SLOT_STATUS } from '../config/constants.js';
import logger from '../utils/logger.js';

const MAX_FUNCTION_CALLS = 3; // prevent LLM loops

/**
 * Validate AI structured output — treat model output as untrusted input.
 */
const validateAIOutput = (output, conversation) => {
  const errors = [];

  // Required fields
  if (!output.intent) errors.push('Missing intent');
  if (!output.nextAction) errors.push('Missing nextAction');
  if (!output.assistantMessage) errors.push('Missing assistantMessage');

  // Intent must be allowlisted
  const validIntents = Object.values(INTENT);
  if (!validIntents.includes(output.intent)) errors.push(`Invalid intent: ${output.intent}`);

  // Date validation — must not be in the past
  if (output.date && !isDateValid(output.date)) {
    errors.push(`Date "${output.date}" is in the past`);
    output.date = null;
  }

  // Time format
  if (output.time && !/^\d{2}:\d{2}$/.test(output.time)) {
    errors.push(`Invalid time format: ${output.time}`);
    output.time = null;
  }

  // selectedSlotId must have been in our candidate list
  if (output.selectedSlotId) {
    const candidates = conversation.candidateSlotIds?.map(id => id.toString()) || [];
    if (!candidates.includes(output.selectedSlotId.toString())) {
      errors.push(`selectedSlotId "${output.selectedSlotId}" not in current candidates`);
      output.selectedSlotId = null;
    }
  }

  // Function call name must be allowlisted
  if (output.functionCall?.name) {
    const allowed = ['searchDoctors', 'checkAvailability', 'findAlternativeSlots',
                     'createAppointment', 'getAppointment', 'modifyAppointment', 'cancelAppointment'];
    if (!allowed.includes(output.functionCall.name)) {
      errors.push(`Function "${output.functionCall.name}" not allowlisted`);
      output.functionCall = null;
      output.nextAction = 'RESPOND';
    }
  }

  // Confirmation: only honour CONFIRMED if there's an active pendingAction
  if (output.confirmation === 'CONFIRMED' && !conversation.pendingAction) {
    output.confirmation = 'NOT_PROVIDED';
  }

  return errors;
};

/**
 * Resolve specialization from AI output name/alias to a DB record.
 * Never pass arbitrary model text as a MongoDB field or operator.
 */
const resolveSpecialization = async (name) => {
  if (!name) return null;
  const normalized = name.toLowerCase().trim();
  return Specialization.findOne({
    status: 'ACTIVE',
    $or: [
      { slug: normalized },
      { name: { $regex: `^${normalized}$`, $options: 'i' } },
      { aliases: normalized },
    ],
  });
};

/**
 * Build a sanitized context object from a conversation — only what the LLM needs.
 */
const buildContext = async (conversation, supportedSpecializations) => {
  const { date, time, timezone } = getCurrentDateTime();
  return {
    currentDate: date,
    currentTime: time,
    timezone,
    supportedSpecializations,
    conversationStage: conversation.stage,
    validatedDraft: conversation.draft || {},
    candidateSlots: conversation.candidateSlotIds || [],
    pendingAction: conversation.pendingAction || null,
  };
};

/**
 * Main orchestration function for one chat turn.
 * Called by the chat route.
 */
export const processChatTurn = async ({ conversation, userMessage, userId }) => {
  // Load supported specializations once per turn
  const specializations = await Specialization.find({ status: 'ACTIVE' }).lean();

  // Build context and system prompt
  const context = await buildContext(conversation, specializations);
  const systemPrompt = buildSystemPrompt(context);

  // Prepare bounded message history for LLM (last 10 messages)
  const recentMessages = conversation.messages.slice(-10);

  let aiOutput;
  let functionCallCount = 0;
  let finalAssistantMessage = '';
  let structuredOptions = [];
  let completedAppointment = null;

  // ── Orchestration loop ─────────────────────────────────────────────────────
  try {
    // Step 1: Get structured intent + entities from LLM
    aiOutput = await callLLM({
      systemPrompt,
      messages: [...recentMessages, { role: MESSAGE_ROLE.USER, message: userMessage }],
      schema: AI_OUTPUT_SCHEMA,
    });

    // Step 2: Validate AI output
    const validationErrors = validateAIOutput(aiOutput, conversation);
    if (validationErrors.length > 0) {
      logger.warn('AI output validation errors:', validationErrors);
    }

    // Step 3: Resolve specialization to real DB record
    if (aiOutput.specialization) {
      const spec = await resolveSpecialization(aiOutput.specialization);
      if (spec) {
        conversation.draft.specializationId = spec._id;
        conversation.draft.specializationName = spec.name;
        aiOutput.specializationId = spec._id;
      } else {
        aiOutput.specialization = null;
        aiOutput.missingInformation = [...(aiOutput.missingInformation || []), 'specialization'];
      }
    }

    // Step 4: Update draft from validated AI output
    if (aiOutput.date) conversation.draft.date = aiOutput.date;
    if (aiOutput.time) conversation.draft.time = aiOutput.time;
    if (aiOutput.timeRange?.start) {
      conversation.draft.timeRange = { start: aiOutput.timeRange.start, end: aiOutput.timeRange.end };
    }
    if (aiOutput.location) conversation.draft.location = aiOutput.location;
    conversation.intent = aiOutput.intent;

    // Step 5: Function call loop
    while (
      aiOutput.nextAction === 'CALL_FUNCTION' &&
      aiOutput.functionCall?.name &&
      functionCallCount < MAX_FUNCTION_CALLS
    ) {
      functionCallCount++;
      const { name, arguments: fnArgs } = aiOutput.functionCall;

      logger.info(`Dispatching function: ${name}`, { args: fnArgs });

      // Inject server-side values — never trust model-provided userId
      const enrichedArgs = { ...fnArgs };
      if (enrichedArgs.specializationId === undefined && conversation.draft.specializationId) {
        enrichedArgs.specializationId = conversation.draft.specializationId;
      }

      const fnResult = await dispatch(name, enrichedArgs, { userId });

      // Store candidate slot IDs from availability results
      if (name === 'checkAvailability' || name === 'findAlternativeSlots') {
        const slots = fnResult.slots || [];
        conversation.candidateSlotIds = slots.map(s => s.slotId);
        conversation.stage = slots.length > 0
          ? CONVERSATION_STAGE.AWAITING_SLOT_SELECTION
          : CONVERSATION_STAGE.SEARCHING;
        structuredOptions = slots.map(s => ({ type: 'SLOT', ...s }));
      }

      if (name === 'createAppointment') {
        if (fnResult.success) {
          completedAppointment = fnResult.appointment;
          conversation.stage = CONVERSATION_STAGE.COMPLETED;
          conversation.status = CONVERSATION_STATUS.COMPLETED;
          conversation.pendingAction = null;
        } else {
          conversation.stage = CONVERSATION_STAGE.SEARCHING; // retry
        }
      }

      if (name === 'cancelAppointment' || name === 'modifyAppointment') {
        if (fnResult.success) {
          conversation.stage = CONVERSATION_STAGE.COMPLETED;
          conversation.pendingAction = null;
        }
      }

      // Step 6: Call LLM again with grounded result for natural-language wording
      const groundedMessages = [
        ...recentMessages,
        { role: MESSAGE_ROLE.USER, message: userMessage },
        {
          role: MESSAGE_ROLE.ASSISTANT,
          message: `Function ${name} returned: ${JSON.stringify(fnResult)}`,
        },
      ];

      aiOutput = await callLLM({
        systemPrompt,
        messages: groundedMessages,
        schema: AI_OUTPUT_SCHEMA,
      });

      validateAIOutput(aiOutput, conversation);
    }

    // Step 7: Handle confirmation flow
    if (aiOutput.nextAction === 'REQUEST_CONFIRMATION') {
      conversation.stage = CONVERSATION_STAGE.AWAITING_CONFIRMATION;
      if (aiOutput.selectedSlotId) {
        conversation.selectedSlotId = aiOutput.selectedSlotId;
        conversation.pendingAction = {
          type: 'CREATE_APPOINTMENT',
          slotId: aiOutput.selectedSlotId,
          expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min
        };
      }
    }

    finalAssistantMessage = aiOutput.assistantMessage;

  } catch (error) {
    logger.error('AI orchestration error:', error);
    // Graceful fallback — deterministic booking APIs remain available
    finalAssistantMessage = "I'm having trouble processing your request right now. Please try again, or use the booking form directly.";
    conversation.stage = CONVERSATION_STAGE.COLLECTING_DETAILS;
  }

  // Step 8: Persist conversation state
  conversation.messages.push({
    role: MESSAGE_ROLE.ASSISTANT,
    message: finalAssistantMessage,
  });

  conversation.markModified('draft');
  conversation.markModified('candidateSlotIds');
  await conversation.save();

  return {
    conversationId: conversation._id,
    stage: conversation.stage,
    message: finalAssistantMessage,
    options: structuredOptions,
    appointment: completedAppointment,
    error: null,
  };
};
