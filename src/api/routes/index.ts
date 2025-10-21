import { Router } from 'express';
import labelsRouter from './labels';
import excelRouter from './excel';
import printRouter from './print';

const router = Router();

// Mount route handlers
router.use('/labels', labelsRouter);
router.use('/excel', excelRouter);
router.use('/print', printRouter);

// Health check
router.get('/health', (_req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

export default router;
