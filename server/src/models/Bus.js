import mongoose from 'mongoose';

const busSchema = new mongoose.Schema({
  plateNo: { type: String, required: true, unique: true, uppercase: true, trim: true },
  name: { type: String, required: true, trim: true },
  capacity: { type: Number, default: 40 },
  driver: {
    name: { type: String, trim: true, default: '' },
    phone: { type: String, trim: true, default: '' },
    license: { type: String, trim: true, default: '' },
  },
  defaultRouteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', default: null },
  currentRouteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', default: null },
  currentTripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', default: null },
  status: { type: String, enum: ['idle', 'on_trip', 'offline'], default: 'idle' },
}, { timestamps: true });

export const Bus = mongoose.model('Bus', busSchema);
