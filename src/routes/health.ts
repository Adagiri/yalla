import { Router } from 'express';
import { ServiceManager } from '../services/service-manager';
import { queueService } from '../services/redis-queue.service';

const healthRouter = Router();

healthRouter.get('/health', async (req, res) => {
  const health = await ServiceManager.healthCheck();

  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

healthRouter.get('/health/queue', async (req, res) => {
  try {
    const stats = await queueService.getStats();
    res.json({
      status: 'healthy',
      timestamp: new Date(),
      queue: stats,
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date(),
      error: error.message,
    });
  }
});

export default healthRouter;
