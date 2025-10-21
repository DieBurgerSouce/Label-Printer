import { getAPIServer } from './server';
import { initializeBrowserManager } from '../services/browser-manager';
import { createLogger } from '../utils/logger';
import config from '../config';

const logger = createLogger('API');

/**
 * Start API Server
 */
async function startAPIServer() {
  try {
    logger.info('Starting API Server...');

    // Initialize browser manager
    logger.info('Initializing browser manager...');
    await initializeBrowserManager();

    // Create and start API server
    const apiServer = getAPIServer();
    await apiServer.start(config.bullBoard.port);

    logger.info('API Server ready', {
      port: config.bullBoard.port,
      endpoints: {
        api: `http://localhost:${config.bullBoard.port}`,
        bullBoard: `http://localhost:${config.bullBoard.port}/admin/queues`,
        health: `http://localhost:${config.bullBoard.port}/health`,
      },
    });
  } catch (error) {
    logger.error('Failed to start API Server', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    process.exit(1);
  }
}

// Handle graceful shutdown
async function shutdown() {
  logger.info('Shutting down API Server...');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Handle uncaught errors
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { reason, promise });
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message });
  process.exit(1);
});

// Start server
if (require.main === module) {
  startAPIServer();
}

export default startAPIServer;
