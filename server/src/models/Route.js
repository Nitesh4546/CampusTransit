import mongoose from 'mongoose';

const routeStopSchema = new mongoose.Schema({
  stopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stop', required: true },
  order: { type: Number, required: true },
  dwellSec: { type: Number, default: 30 },
  scheduledOffsetMin: { type: Number, default: 0 },
  projectedDistM: { type: Number, default: 0 }, // precomputed distance along polyline
}, { _id: false });

const routeSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  color: { type: String, default: '#3B82F6' }, // hex color
  type: { type: String, enum: ['regular', 'event'], default: 'regular' },
  stops: [routeStopSchema],
  polyline: { type: [[Number]], default: [] }, // [[lat, lng], ...]
  polylineCumDistM: { type: [Number], default: [] }, // cumulative meters per polyline point
  totalDistanceM: { type: Number, default: 0 },
  isLoop: { type: Boolean, default: false },
  schedule: {
    days: { type: [Number], default: [] }, // 0-6
    startTimes: { type: [String], default: [] }, // ['07:30', '08:15']
  },
  eventMode: {
    enabled: { type: Boolean, default: false },
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', default: null },
    headwayMin: { type: Number, default: 15 },
    activeFrom: { type: Date, default: null },
    activeUntil: { type: Date, default: null },
  },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export const Route = mongoose.model('Route', routeSchema);
