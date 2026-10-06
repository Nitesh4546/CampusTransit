import mongoose from 'mongoose';

const stopArrivalSchema = new mongoose.Schema({
  tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
  busId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus', required: true },
  routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', required: true },
  stopId: { type: mongoose.Schema.Types.ObjectId, ref: 'Stop', required: true },
  kind: { type: String, enum: ['departure', 'arrival'], required: true },
  scheduledAt: { type: Date, required: true },
  actualAt: { type: Date, required: true },
  delayMin: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now },
});

stopArrivalSchema.index({ busId: 1, createdAt: -1 });

export const StopArrival = mongoose.model('StopArrival', stopArrivalSchema);
