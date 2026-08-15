/**
 * Strict JSON Schema for structured AI output.
 * The LLM must return exactly this shape via tool_use.
 */
export const AI_OUTPUT_SCHEMA = {
  type: 'object',
  properties: {
    intent: {
      type: 'string',
      enum: ['BOOK_APPOINTMENT', 'CHECK_AVAILABILITY', 'MODIFY_APPOINTMENT',
             'CANCEL_APPOINTMENT', 'VIEW_APPOINTMENT', 'GENERAL_QUERY', 'UNKNOWN'],
    },
    confidence: { type: 'number', minimum: 0, maximum: 1 },
    specialization: { type: ['string', 'null'] },
    doctorName: { type: ['string', 'null'] },
    doctorId: { type: ['string', 'null'] },
    date: {
      type: ['string', 'null'],
      description: 'ISO YYYY-MM-DD or null',
    },
    time: {
      type: ['string', 'null'],
      description: '24-hour HH:mm or null',
    },
    timeRange: {
      type: ['object', 'null'],
      properties: {
        start: { type: 'string' },
        end: { type: 'string' },
      },
    },
    location: { type: ['string', 'null'] },
    bookingId: { type: ['string', 'null'] },
    selectedSlotId: { type: ['string', 'null'] },
    confirmation: {
      type: 'string',
      enum: ['CONFIRMED', 'DECLINED', 'NOT_PROVIDED'],
    },
    missingInformation: {
      type: 'array',
      items: { type: 'string' },
    },
    ambiguousInformation: {
      type: 'array',
      items: { type: 'string' },
    },
    preferenceChanges: {
      type: 'object',
    },
    requiresConfirmation: { type: 'boolean' },
    nextAction: {
      type: 'string',
      enum: ['ASK_CLARIFICATION', 'CALL_FUNCTION', 'REQUEST_CONFIRMATION', 'RESPOND'],
    },
    functionCall: {
      type: ['object', 'null'],
      properties: {
        name: {
          type: 'string',
          enum: ['searchDoctors', 'checkAvailability', 'findAlternativeSlots',
                 'createAppointment', 'getAppointment', 'modifyAppointment', 'cancelAppointment'],
        },
        arguments: { type: 'object' },
      },
    },
    assistantMessage: {
      type: 'string',
      description: 'The user-facing response text.',
    },
  },
  required: ['intent', 'confidence', 'confirmation', 'missingInformation',
             'ambiguousInformation', 'requiresConfirmation', 'nextAction', 'assistantMessage'],
};
