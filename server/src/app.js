import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { errorHandler } from './middleware/error.js';
import authRoutes from './routes/auth.routes.js';
import routesRoutes from './routes/routes.routes.js';
import stopsRoutes from './routes/stops.routes.js';
import busesRoutes from './routes/buses.routes.js';
import tripsRoutes from './routes/trips.routes.js';
import eventsRoutes from './routes/events.routes.js';
import announcementsRoutes from './routes/announcements.routes.js';
import usersRoutes from './routes/users.routes.js';
import etaRoutes from './routes/eta.routes.js';
import driverRoutes from './routes/driver.routes.js';

const app = express();

// Security
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests or same-origin
    if (!origin) return callback(null, true);
    // Allow configured client origin, localhost, 127.0.0.1, or local private network IPs
    if (
      origin === env.CLIENT_ORIGIN ||
      /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ||
      /^https?:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)(:\d+)?$/.test(origin) ||
      /^https?:\/\/.*\.trycloudflare\.com$/.test(origin)
    ) {
      return callback(null, true);
    }
    // Default allow for local development
    return callback(null, true);
  },
  credentials: true,
}));

// Body parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: env.NODE_ENV,
    version: '1.0.0',
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/routes', routesRoutes);
app.use('/api/stops', stopsRoutes);
app.use('/api/buses', busesRoutes);
app.use('/api/trips', tripsRoutes);
app.use('/api/events', eventsRoutes);
app.use('/api/announcements', announcementsRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/eta', etaRoutes);
app.use('/api/driver', driverRoutes);

// Root route info
app.get('/', (req, res) => {
  res.json({
    message: '🚌 Live Bus Tracker API is running.',
    frontendApp: 'http://localhost:5173',
    healthCheck: '/api/health',
    endpoints: {
      routes: '/api/routes',
      stops: '/api/stops',
      events: '/api/events',
      activeTrips: '/api/trips/active',
      announcements: '/api/announcements',
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `Route ${req.method} ${req.path} not found` } });
});

// Global error handler
app.use(errorHandler);

export default app;
