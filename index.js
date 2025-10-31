import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import http from "http";
import dotenv from "dotenv";
import WebSocketHandler from "./src/rtms/websocketHandler.js";
import applyHeaders from "./src/utils/applyHeaders.js";
import { cleanup as cleanupInworld } from "./src/inworld/inworldService.js";
import { Logger } from "./src/utils/logging.js";

const logger = new Logger('Server');

dotenv.config();

const RTMS_CONFIG = {
    clientId: process.env.ZM_RTMS_CLIENT || '',
    clientSecret: process.env.ZM_RTMS_SECRET || ''
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
app.use((req, res, next) => {
    applyHeaders(res);
    next();
});

// Serve static files from public folder
app.use(express.static(path.join(__dirname, 'public')));

// Root route - serve the HTML page
app.get('/', (req, res) => {
    logger.debug('Serving HTML page for GET /');
    logger.debug('Query params:', req.query);
    logger.debug('Headers:', req.headers);
    
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Webhook endpoint for RTMS events
app.post('/webhook', (req, res) => {
    logger.debug('Received webhook POST to /webhook');
    const webhookData = req.body;
    wsHandler.handleWebhookEvent(webhookData);
    res.status(200).send('OK');
});

// Create HTTP server
const server = http.createServer(app);
// Initialize WebSocket handler with server and RTMS config
const wsHandler = new WebSocketHandler(server, RTMS_CONFIG);

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

process.on('uncaughtException', async (error) => {
    logger.error('Uncaught Exception:', error);
    await shutdown();
});

process.on('unhandledRejection', async (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    await shutdown();
});

// Shutdown function
async function shutdown() {
    logger.info('Starting graceful shutdown...');
    
    try {
        // Close WebSocket handler connections
        if (wsHandler) {
            await wsHandler.cleanup();
        }
        
        // Cleanup Inworld graph instances
        await cleanupInworld();
        
        // Close the HTTP server
        server.close(() => {
            logger.debug('HTTP server closed');
        });
        
        // Give some time for cleanup to complete
        setTimeout(() => {
            logger.success('Shutdown complete');
            process.exit(0);
        }, 1000);
        
    } catch (error) {
        logger.error('Error during shutdown:', error);
        process.exit(1);
    }
}
