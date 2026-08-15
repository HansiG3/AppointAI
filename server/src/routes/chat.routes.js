import express from 'express';
import Conversation from '../models/Conversation.js';
import { authenticateJWT } from '../middleware/auth.js';
import { successResponse, errorResponse } from '../utils/response.js';
import {
  ERROR_CODES,
  CONVERSATION_STAGE,
  CONVERSATION_STATUS,
  MESSAGE_ROLE,
} from '../config/constants.js';
import { chatLimiter } from '../middleware/rateLimiter.js';
import { processChatTurn } from '../ai/orchestrator.js';
import logger from '../utils/logger.js';

const router = express.Router();

router.use(authenticateJWT);

/**
 * @route   POST /api/chat
 * @desc    Process one conversational turn
 * @access  Private
 */
router.post('/', chatLimiter, async (req, res, next) => {
  try {
    const {
      conversationId,
      message,
      selectedOptionId,
    } = req.body;

    const userId = req.user.id;

    // ---------------------------------------------------------
    // Basic validation
    // ---------------------------------------------------------

    if (!message || message.trim().length === 0) {
      return errorResponse(
        res,
        'Message is required',
        ERROR_CODES.VALIDATION_ERROR,
        400
      );
    }

    if (message.length > 2000) {
      return errorResponse(
        res,
        'Message too long (max 2000 characters)',
        ERROR_CODES.VALIDATION_ERROR,
        400
      );
    }

    // ---------------------------------------------------------
    // Load existing conversation or create a new one
    // ---------------------------------------------------------

    let conversation;

    if (conversationId) {
      conversation = await Conversation.findOne({
        _id: conversationId,
        user: userId,
      });

      if (!conversation) {
        return errorResponse(
          res,
          'Conversation not found',
          ERROR_CODES.NOT_FOUND,
          404
        );
      }
    } else {
      conversation = await Conversation.create({
        user: userId,
        stage: CONVERSATION_STAGE.COLLECTING_DETAILS,
        status: CONVERSATION_STATUS.ACTIVE,
        messages: [],
        draft: {},
        candidateSlotIds: [],
        selectedSlotId: null,
        pendingAction: null,
      });
    }

    // ---------------------------------------------------------
    // IMPORTANT:
    // Add USER message exactly once.
    // ---------------------------------------------------------

    const cleanMessage = message.trim();

    conversation.messages.push({
      role: MESSAGE_ROLE.USER,
      message: cleanMessage,
    });

    // ---------------------------------------------------------
    // UI slot selection
    //
    // If user clicked an appointment card, the frontend sends
    // selectedOptionId.
    //
    // We ONLY accept it if it belongs to the current candidate
    // list. Never blindly trust a client-provided slot ID.
    // ---------------------------------------------------------

    if (selectedOptionId) {
      const candidates =
        conversation.candidateSlotIds?.map((id) => id.toString()) || [];

      const selectedId = selectedOptionId.toString();

      if (candidates.includes(selectedId)) {
        conversation.selectedSlotId = selectedOptionId;

        // Also remember that this selection came directly from
        // the user interface. The LLM must not replace it.
        conversation.draft = conversation.draft || {};

        conversation.draft.selectedSlotId = selectedOptionId;

        conversation.markModified('draft');
      } else {
        logger.warn(
          `Rejected invalid selectedOptionId: ${selectedId}`
        );
      }
    }

    // ---------------------------------------------------------
    // Process the conversational turn
    // ---------------------------------------------------------

    const result = await processChatTurn({
      conversation,
      userMessage: cleanMessage,
      userId,
    });

    return res.status(200).json(result);
  } catch (error) {
    logger.error('Chat route error:', error);
    next(error);
  }
});

/**
 * @route   GET /api/chat/:conversationId
 * @desc    Reload an owned conversation
 * @access  Private
 */
router.get('/:conversationId', async (req, res, next) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.conversationId,
      user: req.user.id,
    });

    if (!conversation) {
      return errorResponse(
        res,
        'Conversation not found',
        ERROR_CODES.NOT_FOUND,
        404
      );
    }

    return successResponse(res, {
      conversationId: conversation._id,
      stage: conversation.stage,
      status: conversation.status,
      messages: conversation.messages,
      draft: conversation.draft,
      candidateSlotIds: conversation.candidateSlotIds,
      selectedSlotId: conversation.selectedSlotId,
      pendingAction: conversation.pendingAction,
    });
  } catch (error) {
    logger.error('Get conversation error:', error);
    next(error);
  }
});

export default router;