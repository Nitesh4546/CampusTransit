import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin', 'driver', 'student'], required: true },
  assignedBus: { type: mongoose.Schema.Types.ObjectId, ref: 'Bus', default: null },
  assignedRoute: { type: mongoose.Schema.Types.ObjectId, ref: 'Route', default: null },
  createdAt: { type: Date, default: Date.now },
});

userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.statics.hashPassword = function (plain) {
  return bcrypt.hash(plain, 10);
};

export const User = mongoose.model('User', userSchema);
