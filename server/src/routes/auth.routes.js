import express from 'express';
import { register, login, getCurrentUser } from '../controllers/auth.controller.js';
import { registerValidator, loginValidator } from '../validators/auth.validator.js';
import { authenticateJWT } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimiter.js';

const router = express.Router();

// Public routes with rate limiting
router.post('/register', authLimiter, registerValidator, register);
router.post('/login', authLimiter, loginValidator, login);

// Protected route
router.get('/me', authenticateJWT, getCurrentUser);

export default router;
