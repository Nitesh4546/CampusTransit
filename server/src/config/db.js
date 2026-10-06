import mongoose from 'mongoose';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

export async function connectDB() {
  try {
    await mongoose.connect(env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    logger.info(`✅ MongoDB connected: ${mongoose.connection.host}`);
  } catch (err) {
    logger.error('❌ MongoDB connection failed:', err.message);
    process.exit(1);
  }
}
