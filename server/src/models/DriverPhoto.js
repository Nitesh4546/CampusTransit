import mongoose from 'mongoose';

const driverPhotoSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  filename: { type: String, required: true },
  status: { type: String, enum: ['pending', 'attached'], default: 'pending' },
  tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', default: null },
  capturedAt: { type: Date, default: Date.now },
}, { timestamps: true });

driverPhotoSchema.index({ status: 1, capturedAt: 1 });
driverPhotoSchema.index({ tripId: 1 });

export const DriverPhoto = mongoose.model('DriverPhoto', driverPhotoSchema);
