import mongoose from 'mongoose';

const tripSchema = new mongoose.Schema({
  busId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus', required: true },
  driverId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', required: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', default: null },
  status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' },
  startedAt: { type: Date, default: Date.now },
  endedAt: { type: Date, default: null },
  nextStopIndex: { type: Number, default: 0 },
  scheduledStartAt: { type: Date, default: null },
  lastDelayAnnouncementAt: { type: Date, default: null },
  driverPhotoId: { type: mongoose.Schema.Types.ObjectId, ref: 'DriverPhoto', default: null },
  driverSnapshot: {
    name: { type: String, default: '' },
    phone: { type: String, default: '' },
    license: { type: String, default: '' },
  },
}, { timestamps: true });

tripSchema.index({ status: 1, routeId: 1 });

export const Trip = mongoose.model('Trip', tripSchema);
