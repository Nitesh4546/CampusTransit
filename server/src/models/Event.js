import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  venueName: { type: String, required: true, trim: true },
  venueLocation: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }, // [lng, lat]
  },
  startsAt: { type: Date, required: true },
  endsAt: { type: Date, required: true },
  shuttleWindow: {
    from: { type: Date, required: true },
    until: { type: Date, required: true },
  },
  routeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Route' }],
  isPublished: { type: Boolean, default: false },
}, { timestamps: true });

eventSchema.index({ venueLocation: '2dsphere' });
eventSchema.index({ startsAt: 1, endsAt: 1 });

export const Event = mongoose.model('Event', eventSchema);
