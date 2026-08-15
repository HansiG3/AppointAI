import express from 'express';
import Conversation from '../models/Conversation.js';
import { authenticateJWT } from '../middleware/auth.js';
import { successResponse, errorResponse } from '../utils/response.js';
import { ERROR_CODES, CONVERSATION_STAGE, CONVERSATION_STATUS, MESSAGE_ROLE } from '../config/constants.js';
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
    const { conversationId, message, selectedOptionId } = req.body;
    const userId = req.user.id;

    if (!message || message.trim().length === 0) {
      return errorResponse(res, 'Message is required', ERROR_CODES.VALIDATION_ERROR, 400);
    }

    if (message.length > 2000) {
      return errorResponse(res, 'Message too long (max 2000 characters)', ERROR_CODES.VALIDATION_ERROR, 400);
    }

    // Load or create conversation
    let conversation;
    if (conversationId) {
      conversation = await Conversation.findOne({ _id: conversationId, user: userId });
      if (!conversation) {
        return errorResponse(res, 'Conversation not found', ERROR_CODES.NOT_FOUND, 404);
      }
    } else {
      conversation = await Conversation.create({
        user: userId,
        stage: CONVERSATION_STAGE.COLLECTING_DETAILS,
        status: CONVERSATION_STATUS.ACTIVE,
      });
    }

    // Append the user's message to history
    conversation.messages.push({
      role: MESSAGE_ROLE.USER,
      message: message.trim(),
    });

    // If the user selected a slot option from the UI, record it as a server-validated candidate
    if (selectedOptionId) {
      const candidates = conversation.candidateSlotIds?.map(id => id.toString()) || [];
      if (candidates.includes(selectedOptionId.toString())) {
        conversation.selectedSlotId = selectedOptionId;
      }
    }

    // Run AI orchestration
    const result = await processChatTurn({
      conversation,
      userMessage: message.trim(),
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
      return errorResponse(res, 'Conversation not found', ERROR_CODES.NOT_FOUND, 404);
    }

    return successResponse(res, {
      conversationId: conversation._id,
      stage: conversation.stage,
      status: conversation.status,
      messages: conversation.messages,
      draft: conversation.draft,
      candidateSlotIds: conversation.candidateSlotIds,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
