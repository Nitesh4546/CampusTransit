import { Router } from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import { generateToken, verifyJWT } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import rateLimit from 'express-rate-limit';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: { code: 'RATE_LIMIT', message: 'Too many login attempts' } },
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /auth/login
router.post('/login', loginLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email })
      .populate('assignedBus')
      .populate('assignedRoute');
    if (!user) {
      return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    }
    const valid = await user.comparePassword(password);
    if (!valid) {
      return res.status(401).json({ error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } });
    }
    const token = generateToken(user._id);
    res.json({
      token,
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        assignedBus: user.assignedBus?._id || user.assignedBus,
        assignedRoute: user.assignedRoute?._id || user.assignedRoute,
        assignedBusDetails: user.assignedBus?._id ? user.assignedBus : null,
        assignedRouteDetails: user.assignedRoute?._id ? user.assignedRoute : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

// GET /auth/me
router.get('/me', verifyJWT, async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .select('-passwordHash')
      .populate('assignedBus')
      .populate('assignedRoute');
    res.json({ user });
  } catch (err) {
    next(err);
  }
});

export default router;
