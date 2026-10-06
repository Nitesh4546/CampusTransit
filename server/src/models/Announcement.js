import mongoose from 'mongoose';

const announcementSchema = new mongoose.Schema({
  tripId: { type: mongoose.Schema.Types.ObjectId, ref: 'Trip', default: null },
  routeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', required: true },
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', default: null },
  kind: { type: String, enum: ['delay', 'cancellation', 'info', 'event'], required: true },
  text: { type: String, required: true },
  textShort: { type: String, default: '' },
  source: { type: String, enum: ['gemini', 'template', 'manual'], default: 'manual' },
  status: { type: String, enum: ['draft', 'published'], default: 'draft' },
  meta: {
    delayMin: Number,
    stopName: String,
    reason: String,
  },
  createdAt: { type: Date, default: Date.now },
  publishedAt: { type: Date, default: null },
});

announcementSchema.index({ routeId: 1, status: 1, createdAt: -1 });
announcementSchema.index({ eventId: 1, status: 1, createdAt: -1 });

export const Announcement = mongoose.model('Announcement', announcementSchema);
