import rtms from "@zoom/rtms";
import { WebSocketServer } from "ws";
import { processTranscript, clearTranscriptHistory, processVisualEvaluation } from "../inworld/inworldService.js";
import { Logger } from "../utils/logging.js";
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import sharp from 'sharp';

const logger = new Logger('WebSocketHandler');

// Get the directory name for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configure RTMS SDK logging based on environment variable
// RTMS_LOG_LEVEL can be: 'debug', 'info', 'warn', 'error', or 'disabled'
const rtmsLogLevel = process.env.RTMS_LOG_LEVEL || 'disabled';
const rtmsLogEnabled = rtmsLogLevel !== 'disabled';

// Configure the RTMS logger
if (rtmsLogEnabled) {
    rtms.configureLogger({
        enabled: true,
        level: rtmsLogLevel,
        format: 'text'
    });
    logger.info(`RTMS SDK logging enabled with level: ${rtmsLogLevel}`);
} else {
    rtms.configureLogger({
        enabled: false,
        level: 'error',
        format: 'text'
    });
    logger.info('RTMS SDK logging disabled');
}

class WebSocketHandler {
    constructor(server, config) {
        this.server = server;
        this.rtmsConfig = config;
        this.rtmsClients = new Map();
        this.wsConnections = new Set();
        this.screenshotPath = path.join(__dirname, '../../screenshots');
        
        // Initialize WebSocket server
        this.wss = new WebSocketServer({ server });
        this.setupWebSocketServer();
        this.ensureScreenshotDirectory();
    }
    
    async ensureScreenshotDirectory() {
        try {
            await fs.mkdir(this.screenshotPath, { recursive: true });
            logger.debug('Screenshot directory ensured at:', this.screenshotPath);
        } catch (error) {
            logger.error('Error creating screenshot directory:', error);
        }
    }
    
    setupWebSocketServer() {
        // Handle WebSocket connections
        this.wss.on('connection', (ws) => {
            logger.info('New WebSocket connection established');
            this.wsConnections.add(ws);
            
            // Send initial connection message
            ws.send(JSON.stringify({
                type: 'connected',
                message: 'Connected to demeanor evaluation server'
            }));
            
            // Handle client messages
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    if (data.type === 'clear_history') {
                        clearTranscriptHistory();
                        logger.info('Transcript history cleared by client');
                    }
                } catch (error) {
                    logger.error('Error parsing client message:', error);
                }
            });
            
            ws.on('close', () => {
                logger.debug('WebSocket connection closed');
                this.wsConnections.delete(ws);
            });
            
            ws.on('error', (error) => {
                logger.error('WebSocket error:', error);
                this.wsConnections.delete(ws);
            });
        });
    }
    
    // Broadcast message to all connected WebSocket clients
    broadcastToClients(message) {
        const messageStr = JSON.stringify(message);
        this.wsConnections.forEach(ws => {
            if (ws.readyState === ws.OPEN) {
                ws.send(messageStr);
            }
        });
    }
    
    // Function to handle webhook events
    handleWebhookEvent(webhookData) {
        const event = webhookData.event;
        const payload = webhookData.payload;
        
        logger.debug(`Processing webhook event: ${event}`);
        
        const streamId = payload?.rtms_stream_id;
    
        if (event === "meeting.rtms_stopped") {
            if (!streamId) {
                logger.warn('Received meeting.rtms_stopped event without stream ID');
                return;
            }
    
            const client = this.rtmsClients.get(streamId);
            if (!client) {
                logger.warn(`Received meeting.rtms_stopped event for unknown stream ID: ${streamId}`);
                return;
            }
            
            client.leave();
            this.rtmsClients.delete(streamId);
            
            // Clear transcript history when meeting stops
            clearTranscriptHistory();
            
            // Notify frontend that meeting has stopped
            this.broadcastToClients({
                type: 'meeting_stopped',
                streamId: streamId,
                message: 'Meeting RTMS stream has stopped'
            });
    
            return;
        } else if (event !== "meeting.rtms_started") {
            logger.debug(`Ignoring unknown event: ${event}`);
            return;
        }
    
        // Create a new RTMS client for the stream if it doesn't exist
        const client = new rtms.Client({
            clientId: this.rtmsConfig.clientId,
            clientSecret: this.rtmsConfig.clientSecret
        });
        this.rtmsClients.set(streamId, client);
        
        // Clear transcript history when new meeting starts
        clearTranscriptHistory();
        
        // Notify frontend that meeting has started
        this.broadcastToClients({
            type: 'meeting_started',
            streamId: streamId,
            message: 'Meeting RTMS stream has started'
        });
    
        // Handle transcript data
        client.onTranscriptData(async (data, size, timestamp, metadata) => {
            logger.debug('Received transcript data');
            
            // Convert Buffer to string for processing
            const transcriptText = Buffer.isBuffer(data) ? data.toString('utf8') : String(data);
            const speakerName = metadata.userName || 'Unknown';
            
            logger.debug('Transcript:', speakerName, ':', transcriptText);
            
            try {
                // Process transcript through evaluation graphs
                logger.debug('Processing transcript through Inworld graphs...');
                const result = await processTranscript(speakerName, transcriptText, {
                    userId: metadata.userId,
                    timestamp: timestamp
                });
                
                logger.info('Processing complete. Guidance:', result.guidance);
                logger.info('Scores:', result.scores);
                
                // Send guidance and scores to clients
                const updateMessage = {
                    type: 'evaluation_update',
                    streamId: streamId,
                    transcript: {
                        speaker: speakerName,
                        text: transcriptText,
                        timestamp: timestamp,
                        userId: metadata.userId
                    },
                    guidance: result.guidance,
                    scores: result.scores
                };
                
                // Broadcast to all connected WebSocket clients
                this.broadcastToClients(updateMessage);
                
            } catch (error) {
                logger.error('Error processing transcript:', error);
                
                // Send error update with default values
                this.broadcastToClients({
                    type: 'evaluation_update',
                    streamId: streamId,
                    transcript: {
                        speaker: speakerName,
                        text: transcriptText,
                        timestamp: timestamp,
                        userId: metadata.userId
                    },
                    guidance: "Processing error. Please continue speaking.",
                    scores: {
                        professionalism: 5,
                        friendliness: 5,
                        helpfulness: 5
                    },
                    error: true
                });
            }
        });
    
        // Handle video data for visual evaluation
        let lastScreenshotTime = 0;
        const SCREENSHOT_INTERVAL = 5000; // 5 seconds
        
        client.onVideoData(async (data, size, timestamp, metadata) => {
            // Take a screenshot every 5 seconds
            const now = Date.now();
            if (now - lastScreenshotTime >= SCREENSHOT_INTERVAL) {
                lastScreenshotTime = now;
                
                try {
                    // Save the video frame as an image
                    const screenshotFilename = `screenshot_${streamId}.jpg`;
                    const screenshotFullPath = path.join(this.screenshotPath, screenshotFilename);
                    
                    // The video data from RTMS might be in various formats
                    // We'll use sharp to process and convert it to JPEG
                    let imageBuffer;
                    
                    try {
                        // Try to process the data with sharp
                        // This handles various video frame formats
                        imageBuffer = await sharp(data)
                            .jpeg({ quality: 90 })
                            .toBuffer();
                    } catch (sharpError) {
                        // If sharp fails, try to save the raw data
                        logger.warn('Sharp processing failed, saving raw data:', sharpError.message);
                        imageBuffer = data;
                    }
                    
                    await fs.writeFile(screenshotFullPath, imageBuffer);
                    logger.debug('Saved screenshot to:', screenshotFullPath);
                    
                    // Process the visual evaluation
                    const visualFeedback = await processVisualEvaluation(screenshotFullPath);
                    logger.info('Visual feedback:', visualFeedback);
                    
                    // Send visual feedback to frontend
                    this.broadcastToClients({
                        type: 'visual_evaluation_update',
                        streamId: streamId,
                        visualFeedback: visualFeedback,
                        timestamp: timestamp
                    });
                } catch (error) {
                    logger.error('Error processing video frame:', error);
                }
            }
        });
        
        // Audio data handler (not currently used)
        client.onAudioData((data, size, timestamp, metadata) => {
            // Audio processing could be added here if needed
        });
    
        // Join the meeting using the webhook payload directly
        client.join(payload);
    }
    
    // Cleanup method to close all connections gracefully
    async cleanup() {
        logger.info('Starting cleanup...');
        
        try {
            // Close all WebSocket connections
            logger.debug('Closing', this.wsConnections.size, 'WebSocket connections');
            this.wsConnections.forEach(ws => {
                if (ws.readyState === ws.OPEN) {
                    ws.send(JSON.stringify({
                        type: 'server_shutdown',
                        message: 'Server is shutting down'
                    }));
                    ws.close();
                }
            });
            this.wsConnections.clear();
            
            // Leave all RTMS meetings and clean up clients
            logger.debug('Cleaning up', this.rtmsClients.size, 'RTMS clients');
            for (const [streamId, client] of this.rtmsClients) {
                try {
                    logger.debug(`Leaving RTMS stream: ${streamId}`);
                    client.leave();
                } catch (error) {
                    logger.error(`Error leaving stream ${streamId}:`, error);
                }
            }
            this.rtmsClients.clear();
            
            // Close WebSocket server
            if (this.wss) {
                logger.debug('Closing WebSocket server');
                await new Promise((resolve, reject) => {
                    this.wss.close((err) => {
                        if (err) {
                            logger.error('Error closing WebSocket server:', err);
                            reject(err);
                        } else {
                            logger.debug('WebSocket server closed');
                            resolve();
                        }
                    });
                });
            }
            
            logger.success('Cleanup completed');
        } catch (error) {
            logger.error('Error during cleanup:', error);
            throw error;
        }
    }
}

export default WebSocketHandler;