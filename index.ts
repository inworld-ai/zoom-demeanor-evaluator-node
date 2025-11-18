import express, { type Request, type Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer, type Server } from 'http';
import dotenv from 'dotenv';
import WebSocketHandler from './src/rtms/websocketHandler.js';
import applyHeaders from './src/utils/applyHeaders.js';
import { cleanup as cleanupInworld } from './src/inworld/inworldService.js';
import { stopInworldRuntime } from '@inworld/runtime';
import { Logger } from './src/utils/logging.js';

const logger = new Logger('Server');

dotenv.config();

interface RTMSConfig {
  clientId: string;
  clientSecret: string;
}

const RTMS_CONFIG: RTMSConfig = {
  clientId: process.env.ZM_RTMS_CLIENT || '',
  clientSecret: process.env.ZM_RTMS_SECRET || '',
};

// Get the directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON bodies for webhooks
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply OWASP security headers to all requests
app.use((_req, res, next) => {
  applyHeaders(res);
  next();
});

// Serve static files from public folder
app.use(express.static(path.join(__dirname, 'public')));

// Root route - serve the HTML page
app.get('/', (_req: Request, res: Response) => {
  logger.debug('Serving HTML page for GET /');
  logger.debug('Query params:', _req.query);
  logger.debug('Headers:', _req.headers);

  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Create HTTP server
const server: Server = createServer(app);
// Initialize WebSocket handler with server and RTMS config
const wsHandler = new WebSocketHandler(server, RTMS_CONFIG);

// Webhook endpoint for RTMS events
app.post('/webhook', (req: Request, res: Response) => {
  logger.debug('Received webhook POST to /webhook');
  const webhookData = req.body;
  wsHandler.handleWebhookEvent(webhookData);
  res.status(200).send('OK');
});

// Start the HTTP server
server.listen(PORT, () => {
  logger.success(`Server running on port ${PORT}`);
});

// Graceful shutdown handlers
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  await shutdown();
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  await shutdown();
});

process.on('uncaughtException', async (error: Error) => {
  logger.error('Uncaught Exception:', error);
  await shutdown();
});

process.on(
  'unhandledRejection',
  async (reason: unknown, promise: Promise<unknown>) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    await shutdown();
  }
);

// Shutdown function - prevent multiple calls
let isShuttingDown = false;

async function shutdown(): Promise<void> {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  logger.info('Starting graceful shutdown...');

  try {
    // Close WebSocket handler connections
    if (wsHandler) {
      try {
        await Promise.race([
          wsHandler.cleanup(),
          new Promise((resolve) => {
            setTimeout(() => {
              logger.debug('WebSocket handler cleanup timeout');
              resolve(undefined);
            }, 5000);
          })
        ]);
      } catch (error) {
        // Log but continue - cleanup errors shouldn't prevent shutdown
        logger.debug('WebSocket handler cleanup error (non-fatal):', error);
      }
    }

    // Cleanup Inworld graph instances
    try {
      await Promise.race([
        cleanupInworld(),
        new Promise((resolve) => {
          setTimeout(() => {
            logger.debug('Inworld cleanup timeout');
            resolve(undefined);
          }, 5000);
        })
      ]);
    } catch (error) {
      // Log but continue - cleanup errors shouldn't prevent shutdown
      logger.debug('Inworld cleanup error (non-fatal):', error);
    }

    // Give a small delay for any pending operations to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Close the HTTP server with timeout
    await Promise.race([
      new Promise<void>((resolve) => {
        server.close(() => {
          logger.debug('HTTP server closed');
          resolve();
        });
      }),
      new Promise<void>((resolve) => {
        setTimeout(() => {
          logger.debug('HTTP server close timeout');
          resolve();
        }, 2000);
      })
    ]);

    // Stop Inworld Runtime with timeout
    try {
      await Promise.race([
        stopInworldRuntime(),
        new Promise((resolve) => {
          setTimeout(() => {
            logger.debug('stopInworldRuntime timeout');
            resolve(undefined);
          }, 5000);
        })
      ]);
      logger.debug('Inworld Runtime stopped');
    } catch (error) {
      // Log but continue - cleanup errors shouldn't prevent shutdown
      logger.debug('stopInworldRuntime error (non-fatal):', error);
    }

    // Exit immediately after cleanup
    logger.success('Shutdown complete');
    process.exit(0);
  } catch (error) {
    // Final catch-all - log and exit gracefully
    logger.error('Unexpected error during shutdown:', error);
    process.exit(0); // Exit with 0 to indicate graceful shutdown attempt
  }
}
