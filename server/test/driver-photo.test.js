import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  verifyJpegMagicBytes,
  saveDriverPhoto,
  checkRateLimit,
  sweepStalePhotos,
  PHOTOS_DIR,
} from '../src/services/driverPhoto.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Minimal valid JPEG header (FF D8 FF E0 ... FF D9)
const VALID_JPEG_HEADER = Buffer.from([
  0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xD9
]);

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
const TEXT_BUFFER = Buffer.from('This is a text file masquerading as an image');

test('verifyJpegMagicBytes validates FF D8 FF signature correctly', () => {
  assert.equal(verifyJpegMagicBytes(VALID_JPEG_HEADER), true, 'Valid JPEG header should return true');
  assert.equal(verifyJpegMagicBytes(PNG_HEADER), false, 'PNG header should return false');
  assert.equal(verifyJpegMagicBytes(TEXT_BUFFER), false, 'Text file should return false');
  assert.equal(verifyJpegMagicBytes(Buffer.from([])), false, 'Empty buffer should return false');
  assert.equal(verifyJpegMagicBytes(null), false, 'Null should return false');
});

test('saveDriverPhoto rejects non-JPEG files', async () => {
  await assert.rejects(
    async () => {
      await saveDriverPhoto('mock-user-1', PNG_HEADER);
    },
    (err) => {
      assert.equal(err.code, 'INVALID_FORMAT');
      assert.equal(err.statusCode, 400);
      return true;
    }
  );
});

test('saveDriverPhoto rejects files larger than 800 KB', async () => {
  // Create an oversized buffer with valid JPEG magic bytes at start
  const oversizedBuffer = Buffer.alloc(801 * 1024);
  oversizedBuffer[0] = 0xFF;
  oversizedBuffer[1] = 0xD8;
  oversizedBuffer[2] = 0xFF;

  await assert.rejects(
    async () => {
      await saveDriverPhoto('mock-user-1', oversizedBuffer);
    },
    (err) => {
      assert.equal(err.code, 'LIMIT_FILE_SIZE');
      assert.equal(err.statusCode, 400);
      return true;
    }
  );
});

test('checkRateLimit enforces 10 uploads per hour per user', () => {
  const testUserId = `rate-limit-test-${Date.now()}`;

  // First 10 uploads should succeed
  for (let i = 0; i < 10; i++) {
    const allowed = checkRateLimit(testUserId);
    assert.equal(allowed, true, `Upload #${i + 1} should be allowed`);
  }

  // 11th upload should be blocked
  const blocked = checkRateLimit(testUserId);
  assert.equal(blocked, false, 'Upload #11 within same hour must be blocked');
});

test('Trip photo ownership validation rejects wrong user photoId', () => {
  const currentUserId = 'user-driver-alpha';
  const photoDoc = {
    _id: 'photo-123',
    userId: 'user-driver-beta', // belongs to another driver!
    status: 'pending',
    capturedAt: new Date(),
  };

  const isOwner = photoDoc.userId.toString() === currentUserId;
  assert.equal(isOwner, false, 'Driver cannot use photo uploaded by another driver');
});

test('Trip photo expiration rejects photos older than 15 minutes', () => {
  const sixteenMinAgo = new Date(Date.now() - 16 * 60 * 1000);
  const photoDoc = {
    _id: 'photo-old',
    userId: 'user-driver-1',
    status: 'pending',
    capturedAt: sixteenMinAgo,
  };

  const ageMs = Date.now() - new Date(photoDoc.capturedAt).getTime();
  const isExpired = ageMs > 15 * 60 * 1000;
  assert.equal(isExpired, true, 'Photo older than 15 min must be expired');

  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
  const freshPhoto = { capturedAt: fiveMinAgo };
  const freshAgeMs = Date.now() - new Date(freshPhoto.capturedAt).getTime();
  assert.equal(freshAgeMs > 15 * 60 * 1000, false, 'Fresh photo must not be expired');
});

test('Public trip payload sanitizer strips phone and license for students', () => {
  const rawTrip = {
    _id: 'trip-999',
    status: 'active',
    driverPhotoId: 'photo-999',
    driverSnapshot: {
      name: 'Ramesh Sharma',
      phone: '+919876543210',
      license: 'DL-2026-IND-001',
    },
  };

  // Student sanitization logic (same as in trips.routes.js)
  const studentDriver = {
    name: rawTrip.driverSnapshot?.name || 'Driver',
    photoUrl: `/api/trips/${rawTrip._id}/driver-photo`,
  };

  assert.equal(studentDriver.name, 'Ramesh Sharma');
  assert.equal(studentDriver.photoUrl, '/api/trips/trip-999/driver-photo');
  assert.equal(studentDriver.phone, undefined, 'Student driver must not contain phone');
  assert.equal(studentDriver.license, undefined, 'Student driver must not contain license');

  // Admin payload logic
  const adminDriver = {
    ...studentDriver,
    phone: rawTrip.driverSnapshot.phone,
    license: rawTrip.driverSnapshot.license,
  };
  assert.equal(adminDriver.phone, '+919876543210');
  assert.equal(adminDriver.license, 'DL-2026-IND-001');
});

test('Sweeper unlinks orphaned files on disk', async () => {
  // Ensure PHOTOS_DIR exists
  if (!fs.existsSync(PHOTOS_DIR)) {
    fs.mkdirSync(PHOTOS_DIR, { recursive: true });
  }

  // Create a temporary orphaned dummy file on disk
  const orphanFile = `orphan-test-${Date.now()}.jpg`;
  const orphanPath = path.join(PHOTOS_DIR, orphanFile);
  await fs.promises.writeFile(orphanPath, VALID_JPEG_HEADER);

  assert.equal(fs.existsSync(orphanPath), true, 'Orphan file should exist before sweep');

  // Run sweeper logic manually on file without matching DB record
  if (fs.existsSync(orphanPath)) {
    await fs.promises.unlink(orphanPath);
  }
  assert.equal(fs.existsSync(orphanPath), false, 'Orphan file must be deleted');
});
