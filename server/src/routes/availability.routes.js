import express from 'express';
import { getAvailability } from '../controllers/availability.controller.js';
import { getAvailabilityValidator } from '../validators/availability.validator.js';
import { authenticateJWT } from '../middleware/auth.js';

const router = express.Router();

router.get('/', authenticateJWT, getAvailabilityValidator, getAvailability);

export default router;
