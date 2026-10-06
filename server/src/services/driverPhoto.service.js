import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';
import { DriverPhoto } from '../models/DriverPhoto.js';
import { Trip } from '../models/Trip.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PHOTOS_DIR = path.resolve(__dirname, '../../uploads/driver-photos');

// Ensure photos directory exists on boot
try {
  if (!fs.existsSync(PHOTOS_DIR)) {
    fs.mkdirSync(PHOTOS_DIR, { recursive: true });
  }
} catch (err) {
  logger.error('Failed to create driver-photos upload directory:', err.message);
}

// In-memory rate limiting: 10 uploads per hour per user
const uploadRateLimits = new Map();

/**
 * Check and record upload rate limit: max 10/hour per user
 */
export function checkRateLimit(userId) {
  const now = Date.now();
  const oneHourAgo = now - 60 * 60 * 1000;
  const userKey = userId.toString();

  let timestamps = uploadRateLimits.get(userKey) || [];
  timestamps = timestamps.filter(ts => ts > oneHourAgo);

  if (timestamps.length >= 10) {
    return false;
  }

  timestamps.push(now);
  uploadRateLimits.set(userKey, timestamps);
  return true;
}

/**
 * Verify JPEG magic bytes (FF D8 FF)
 */
export function verifyJpegMagicBytes(buffer) {
  if (!buffer || buffer.length < 3) return false;
  return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
}

/**
 * Save photo to disk and create pending DriverPhoto document
 */
export async function saveDriverPhoto(userId, buffer) {
  if (!verifyJpegMagicBytes(buffer)) {
    const error = new Error('Invalid image format. Only JPEG images are accepted.');
    error.statusCode = 400;
    error.code = 'INVALID_FORMAT';
    throw error;
  }

  if (buffer.length > 800 * 1024) {
    const error = new Error('Image size exceeds 800 KB limit.');
    error.statusCode = 400;
    error.code = 'LIMIT_FILE_SIZE';
    throw error;
  }

  const filename = `${randomUUID()}.jpg`;
  const filePath = path.join(PHOTOS_DIR, filename);

  await fs.promises.writeFile(filePath, buffer);

  const photo = await DriverPhoto.create({
    userId,
    filename,
    status: 'pending',
    capturedAt: new Date(),
  });

  return photo;
}

/**
 * Delete photo file from disk and database
 */
export async function deleteDriverPhoto(photoRecord) {
  if (!photoRecord) return;
  try {
    if (photoRecord.filename) {
      const filePath = path.join(PHOTOS_DIR, photoRecord.filename);
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath).catch(() => {});
      }
    }
    await DriverPhoto.findByIdAndDelete(photoRecord._id);
  } catch (err) {
    logger.error(`Error deleting driver photo ${photoRecord._id}:`, err.message);
  }
}

/**
 * Delete photo associated with a trip
 */
export async function deleteDriverPhotoForTrip(tripId) {
  if (!tripId) return;
  try {
    const photos = await DriverPhoto.find({ tripId });
    for (const photo of photos) {
      await deleteDriverPhoto(photo);
    }
  } catch (err) {
    logger.error(`Error deleting photo for trip ${tripId}:`, err.message);
  }
}

/**
 * Sweeper running on boot and hourly
 * Deletes pending photos older than 30 min and any files whose trip is not active.
 */
export async function sweepStalePhotos() {
  try {
    // 1. Delete pending photos older than 30 minutes
    const thirtyMinAgo = new Date(Date.now() - 30 * 60 * 1000);
    const stalePending = await DriverPhoto.find({
      status: 'pending',
      capturedAt: { $lt: thirtyMinAgo },
    });
    for (const p of stalePending) {
      await deleteDriverPhoto(p);
    }

    // 2. Delete attached photos whose trip is not active (or trip no longer exists)
    const attachedPhotos = await DriverPhoto.find({ status: 'attached' });
    for (const p of attachedPhotos) {
      if (!p.tripId) {
        await deleteDriverPhoto(p);
        continue;
      }
      const trip = await Trip.findById(p.tripId);
      if (!trip || trip.status !== 'active') {
        await deleteDriverPhoto(p);
      }
    }

    // 3. Scan directory: any file on disk that does not match an existing DriverPhoto record
    if (fs.existsSync(PHOTOS_DIR)) {
      const files = await fs.promises.readdir(PHOTOS_DIR);
      const activeRecords = await DriverPhoto.find({}, 'filename');
      const validFilenames = new Set(activeRecords.map(r => r.filename));

      for (const file of files) {
        if (file === '.gitkeep') continue;
        if (!validFilenames.has(file)) {
          await fs.promises.unlink(path.join(PHOTOS_DIR, file)).catch(() => {});
        }
      }
    }
  } catch (err) {
    logger.error('Error during photo sweeper execution:', err.message);
  }
}

let sweeperInterval = null;

export function startPhotoSweeper() {
  sweepStalePhotos().catch(err => logger.error('Initial photo sweep error:', err.message));

  if (!sweeperInterval) {
    sweeperInterval = setInterval(() => {
      sweepStalePhotos().catch(err => logger.error('Hourly photo sweep error:', err.message));
    }, 60 * 60 * 1000);
  }
}

export function stopPhotoSweeper() {
  if (sweeperInterval) {
    clearInterval(sweeperInterval);
    sweeperInterval = null;
  }
}
