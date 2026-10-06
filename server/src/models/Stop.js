import mongoose from 'mongoose';

const stopSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }, // [lng, lat]
  },
  isEventStop: { type: Boolean, default: false },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', default: null },
}, { timestamps: true });

stopSchema.index({ location: '2dsphere' });

export const Stop = mongoose.model('Stop', stopSchema);
