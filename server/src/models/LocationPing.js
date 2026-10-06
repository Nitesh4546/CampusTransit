import mongoose from 'mongoose';

const locationPingSchema = new mongoose.Schema({
  tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', required: true },
  busId: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus', required: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }, // [lng, lat]
  },
  speedKmh: { type: Number, default: 0 },
  heading: { type: Number, default: 0 },
  accuracyM: { type: Number, default: 0 },
  ts: { type: Date, default: Date.now },
});

locationPingSchema.index({ location: '2dsphere' });
locationPingSchema.index({ ts: 1 }, { expireAfterSeconds: 86400 }); // TTL: 24h
locationPingSchema.index({ tripId: 1, ts: -1 });

export const LocationPing = mongoose.model('LocationPing', locationPingSchema);
