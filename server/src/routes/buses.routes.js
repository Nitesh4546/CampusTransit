import { Router } from 'express';
import { z } from 'zod';
import { Bus } from '../models/Bus.js';
import { User } from '../models/User.js';
import { verifyJWT, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { getBusStats, getFleetPunctuality } from '../services/punctuality.service.js';

const router = Router();

const driverSchema = z.object({
  name: z.string().min(1, 'Driver name is required'),
  phone: z.string().regex(/^\+?[0-9]{10,15}$/, 'Driver phone must be 10-15 digits, optional leading +'),
  license: z.string().optional().default(''),
});

const busSchema = z.object({
  plateNo: z.string().min(1).max(20),
  name: z.string().min(1),
  capacity: z.number().int().positive().optional().default(40),
  driver: driverSchema,
  status: z.enum(['idle', 'on_trip', 'offline']).optional().default('idle'),
  defaultRouteId: z.string().nullable().optional(),
  currentRouteId: z.string().nullable().optional(),
});

const busUpdateSchema = busSchema.partial();

// GET /buses - Drivers can see only their assigned bus; admins can see full fleet
router.get('/', verifyJWT, requireRole('admin', 'driver'), async (req, res, next) => {
  try {
    const filter = req.user.role === 'admin' ? {} : { _id: req.user.assignedBus };
    const buses = await Bus.find(filter)
      .populate('defaultRouteId', 'name color stops')
      .populate('currentRouteId', 'name color')
      .populate('currentTripId', 'status');

    const busIds = buses.map((b) => b._id);

    // Single aggregation for punctuality rating & onTimePct (no N+1)
    const [punctualityMap, driverUsers] = await Promise.all([
      getFleetPunctuality(busIds),
      User.find({ assignedBus: { $in: busIds } }).select('email assignedBus'),
    ]);

    const driverEmailMap = new Map();
    driverUsers.forEach((u) => {
      if (u.assignedBus) {
        driverEmailMap.set(u.assignedBus.toString(), u.email);
      }
    });

    const enrichedBuses = buses.map((bus) => {
      const bObj = bus.toObject();
      const punct = punctualityMap.get(bus._id.toString());
      return {
        ...bObj,
        rating: punct ? punct.rating : null,
        onTimePct: punct ? punct.onTimePct : null,
        assignedDriverEmail: driverEmailMap.get(bus._id.toString()) || null,
      };
    });

    res.json(enrichedBuses);
  } catch (err) {
    next(err);
  }
});

// GET /buses/:id/stats - punctuality statistics
router.get('/:id/stats', verifyJWT, requireRole('admin', 'driver'), async (req, res, next) => {
  try {
    const bus = await Bus.findById(req.params.id);
    if (!bus) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Bus not found' } });
    if (req.user.role === 'driver' && bus._id.toString() !== req.user.assignedBus?.toString()) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'This bus is not assigned to you' } });
    }

    const stats = await getBusStats(req.params.id);
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// GET /buses/:id - admin or assigned driver
router.get('/:id', verifyJWT, requireRole('admin', 'driver'), async (req, res, next) => {
  try {
    const bus = await Bus.findById(req.params.id)
      .populate('defaultRouteId', 'name color stops')
      .populate('currentRouteId', 'name color')
      .populate('currentTripId', 'status');
    if (!bus) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Bus not found' } });
    if (req.user.role === 'driver' && bus._id.toString() !== req.user.assignedBus?.toString()) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'This bus is not assigned to you' } });
    }

    const assignedUser = await User.findOne({ assignedBus: bus._id }).select('email name');
    const bObj = bus.toObject();
    bObj.assignedDriverEmail = assignedUser?.email || null;

    res.json(bObj);
  } catch (err) {
    next(err);
  }
});

// POST /buses - admin
router.post('/', verifyJWT, requireRole('admin'), validate(busSchema), async (req, res, next) => {
  try {
    const bus = await Bus.create(req.body);
    res.status(201).json(bus);
  } catch (err) {
    next(err);
  }
});

// PUT /buses/:id - admin
router.put('/:id', verifyJWT, requireRole('admin'), validate(busUpdateSchema), async (req, res, next) => {
  try {
    const bus = await Bus.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!bus) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Bus not found' } });
    res.json(bus);
  } catch (err) {
    next(err);
  }
});

// DELETE /buses/:id - admin
router.delete('/:id', verifyJWT, requireRole('admin'), async (req, res, next) => {
  try {
    const bus = await Bus.findByIdAndDelete(req.params.id);
    if (!bus) return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Bus not found' } });
    res.json({ message: 'Bus deleted' });
  } catch (err) {
    next(err);
  }
});

// POST /buses/:id/assign-driver - admin
router.post('/:id/assign-driver', verifyJWT, requireRole('admin'), async (req, res, next) => {
  try {
    const { driverId } = req.body;
    const driver = await User.findById(driverId);
    if (!driver || driver.role !== 'driver') {
      return res.status(400).json({ error: { code: 'INVALID_DRIVER', message: 'Invalid driver' } });
    }
    await User.findByIdAndUpdate(driverId, { assignedBus: req.params.id });
    res.json({ message: 'Driver assigned' });
  } catch (err) {
    next(err);
  }
});

export default router;
