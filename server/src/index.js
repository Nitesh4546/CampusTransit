import { createServer } from 'http';
import { Server } from 'socket.io';
import app from './app.js';
import { connectDB } from './config/db.js';
import { env } from './config/env.js';
import { initSockets } from './sockets/index.js';
import { setDelayServiceIO } from './services/delay.service.js';
import { startPhotoSweeper } from './services/driverPhoto.service.js';
import { logger } from './utils/logger.js';

async function bootstrap() {
  // Connect to MongoDB
  await connectDB();

  // Start stale photo cleanup sweeper (boot + hourly)
  startPhotoSweeper();

  // Create HTTP server
  const httpServer = createServer(app);

  // Socket.io
  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (
          origin === env.CLIENT_ORIGIN ||
          /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
          /^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(origin) ||
          /^https?:\/\/.*\.trycloudflare\.com$/.test(origin)
        ) {
          return callback(null, true);
        }
        return callback(null, true);
      },
      credentials: true,
    },
    transports: ['websocket', 'polling'],
  });

  // Make io accessible to routes via app
  app.set('io', io);

  // Wire delay service to io
  setDelayServiceIO(io);

  // Init socket handlers
  initSockets(io);

  // Start listening
  const port = parseInt(env.PORT, 10);
  httpServer.listen(port, () => {
    logger.info(`🚌 Live Bus Tracker server running on http://localhost:${port}`);
    logger.info(`   Environment: ${env.NODE_ENV}`);
    logger.info(`   MongoDB: connected`);
  });

  // Graceful shutdown
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down...');
    httpServer.close(() => process.exit(0));
  });
}

bootstrap().catch(err => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});
