import { Router } from 'express';
import { z } from 'zod';
import { User } from '../models/User.js';
import { verifyJWT, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';

const router = Router();

const createUserSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['admin', 'driver', 'student']),
  assignedBus: z.string().optional().nullable(),
  assignedRoute: z.string().optional().nullable(),
});

// GET /users - admin
router.get('/', verifyJWT, requireRole('admin'), async (req, res, next) => {
  try {
    const filter = {};
    if (req.query.role) filter.role = req.query.role;
    const users = await User.find(filter)
      .select('-passwordHash')
      .populate('assignedBus', 'name plateNo defaultRouteId')
      .populate('assignedRoute', 'name color');
    res.json(users);
  } catch (err) {
    next(err);
  }
});

// GET /users/:id - admin
router.get('/:id', verifyJWT, requireRole('admin'), async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-passwordHash')
      .populate('assignedBus', 'name plateNo defaultRouteId')
      .populate('assignedRoute', 'name color');
    if (!user) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// POST /users - admin creates users
router.post('/', verifyJWT, requireRole('admin'), validate(createUserSchema), async (req, res, next) => {
  try {
    const { password, ...rest } = req.body;
    const passwordHash = await User.hashPassword(password);
    const user = await User.create({ ...rest, passwordHash });
    const { passwordHash: _, ...safeUser } = user.toObject();
    res.status(201).json(safeUser);
  } catch (err) {
    next(err);
  }
});

// PUT /users/:id - admin
router.put('/:id', verifyJWT, requireRole('admin'), async (req, res, next) => {
  try {
    if (req.body.password) {
      req.body.passwordHash = await User.hashPassword(req.body.password);
      delete req.body.password;
    }
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }).select('-passwordHash');
    if (!user) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    res.json(user);
  } catch (err) {
    next(err);
  }
});

// DELETE /users/:id - admin
router.delete('/:id', verifyJWT, requireRole('admin'), async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'User not found' } });
    res.json({ message: 'User deleted' });
  } catch (err) {
    next(err);
  }
});

export default router;
