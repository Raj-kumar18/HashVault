import { Router } from 'express';
import healthRoutes from './health.routes.js';
import authRoutes from './auth.routes.js';
import serverRoutes from './server.routes.js';
import collectorRoutes from './collector.routes.js';
import integrityRoutes from './integrity.routes.js';
import blockchainRoutes from './blockchain.routes.js';
import monitoringRoutes from './monitoring.routes.js';
import alertRoutes from './alert.routes.js';
import simulationRoutes from './simulation.routes.js';
import overviewRoutes from './overview.routes.js';
import logRoutes from './log.routes.js';
import aiRoutes from './ai.routes.js';

const router = Router();

// Mount health routes under /health
router.use('/health', healthRoutes);

// Mount authentication and authorization routes under /auth
router.use('/auth', authRoutes);

// Mount server fleet management routes under /servers
router.use('/servers', serverRoutes);

// Mount collector enrollment endpoints under /collector
router.use('/collector', collectorRoutes);

// Mount tamper-evident log integrity engine routes under /integrity
router.use('/integrity', integrityRoutes);

// Mount blockchain network & contract status routes under /blockchain
router.use('/blockchain', blockchainRoutes);

// Mount fleet monitoring engine routes under /monitoring
router.use('/monitoring', monitoringRoutes);

// Mount security alerts routes under /alerts
router.use('/alerts', alertRoutes);

// Mount controlled attack simulator routes under /simulations
router.use('/simulations', simulationRoutes);

// Mount comprehensive SOC overview routes under /overview
router.use('/overview', overviewRoutes);

// Mount universal logs explorer routes under /logs
router.use('/logs', logRoutes);

// Mount Sentinel AI investigation engine routes under /ai
router.use('/ai', aiRoutes);

export default router;
