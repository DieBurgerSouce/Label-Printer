/**
 * WebSocket Server using Socket.IO
 * Provides real-time updates for automation jobs, screenshots, OCR results, etc.
 */

import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';

// ============================================
// EVENT TYPES
// ============================================

export interface ServerToClientEvents {
  // Job Events
  'job:created': (data: JobCreatedEvent) => void;
  'job:updated': (data: JobUpdatedEvent) => void;
  'job:progress': (data: JobProgressEvent) => void;
  'job:completed': (data: JobCompletedEvent) => void;
  'job:failed': (data: JobFailedEvent) => void;

  // Screenshot Events
  'screenshot:captured': (data: ScreenshotCapturedEvent) => void;
  'screenshot:uploaded': (data: ScreenshotUploadedEvent) => void;

  // OCR Events
  'ocr:started': (data: OCRStartedEvent) => void;
  'ocr:progress': (data: OCRProgressEvent) => void;
  'ocr:completed': (data: OCRCompletedEvent) => void;
  'ocr:failed': (data: OCRFailedEvent) => void;

  // Match Events
  'match:found': (data: MatchFoundEvent) => void;
  'match:failed': (data: MatchFailedEvent) => void;

  // Label Events
  'label:generated': (data: LabelGeneratedEvent) => void;
  'label:failed': (data: LabelFailedEvent) => void;

  // System Events
  'system:notification': (data: SystemNotificationEvent) => void;
}

export interface ClientToServerEvents {
  // Job Subscriptions
  'job:subscribe': (jobId: string) => void;
  'job:unsubscribe': (jobId: string) => void;

  // Automation Subscriptions
  'automation:subscribe': (automationId: string) => void;
  'automation:unsubscribe': (automationId: string) => void;

  // System
  ping: () => void;
}

// ============================================
// EVENT DATA INTERFACES
// ============================================

export interface JobCreatedEvent {
  jobId: string;
  jobType: 'crawl' | 'automation';
  name: string;
  timestamp: string;
}

export interface JobUpdatedEvent {
  jobId: string;
  status: string;
  progress?: number;
  currentStage?: string;
  message?: string;
  timestamp: string;
}

export interface JobProgressEvent {
  jobId: string;
  progress: number; // 0-100
  currentStep: string;
  currentStepProgress?: number;
  totalSteps?: number;
  message?: string;
  timestamp: string;
}

export interface JobCompletedEvent {
  jobId: string;
  results: any;
  duration: number; // in milliseconds
  timestamp: string;
}

export interface JobFailedEvent {
  jobId: string;
  error: string;
  stage?: string;
  timestamp: string;
}

export interface ScreenshotCapturedEvent {
  jobId: string;
  screenshotId: string;
  url: string;
  thumbnailUrl?: string;
  productUrl: string;
  productName?: string;
  timestamp: string;
}

export interface ScreenshotUploadedEvent {
  jobId: string;
  screenshotId: string;
  imageUrl: string;
  thumbnailUrl?: string;
  timestamp: string;
}

export interface OCRStartedEvent {
  jobId: string;
  screenshotId: string;
  timestamp: string;
}

export interface OCRProgressEvent {
  jobId: string;
  screenshotId: string;
  progress: number; // 0-100
  timestamp: string;
}

export interface OCRCompletedEvent {
  jobId: string;
  screenshotId: string;
  ocrResultId: string;
  data: {
    articleNumber?: string;
    price?: number;
    productName?: string;
    confidence: number;
  };
  timestamp: string;
}

export interface OCRFailedEvent {
  jobId: string;
  screenshotId: string;
  error: string;
  timestamp: string;
}

export interface MatchFoundEvent {
  jobId: string;
  ocrResultId: string;
  matchId: string;
  matchType: 'exact' | 'fuzzy';
  confidence: number;
  articleNumber: string;
  timestamp: string;
}

export interface MatchFailedEvent {
  jobId: string;
  ocrResultId: string;
  articleNumber?: string;
  reason: string;
  timestamp: string;
}

export interface LabelGeneratedEvent {
  jobId: string;
  labelId: string;
  imageUrl: string;
  articleNumber: string;
  timestamp: string;
}

export interface LabelFailedEvent {
  jobId: string;
  articleNumber?: string;
  error: string;
  timestamp: string;
}

export interface SystemNotificationEvent {
  type: 'info' | 'warning' | 'error' | 'success';
  message: string;
  details?: any;
  timestamp: string;
}

// ============================================
// WEBSOCKET SERVER
// ============================================

export class WebSocketServer {
  private io: Server<ClientToServerEvents, ServerToClientEvents>;
  private connectedClients: Map<string, Socket> = new Map();

  constructor(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.FRONTEND_URL || ['http://localhost:5173', 'http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true,
      },
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.setupEventHandlers();
  }

  /**
   * Setup Socket.IO event handlers
   */
  private setupEventHandlers() {
    this.io.on('connection', (socket) => {
      console.log(`[WebSocket] Client connected: ${socket.id}`);
      this.connectedClients.set(socket.id, socket);

      // Handle job subscriptions
      socket.on('job:subscribe', (jobId: string) => {
        socket.join(`job:${jobId}`);
        console.log(`[WebSocket] Client ${socket.id} subscribed to job: ${jobId}`);
      });

      socket.on('job:unsubscribe', (jobId: string) => {
        socket.leave(`job:${jobId}`);
        console.log(`[WebSocket] Client ${socket.id} unsubscribed from job: ${jobId}`);
      });

      // Handle automation subscriptions
      socket.on('automation:subscribe', (automationId: string) => {
        socket.join(`automation:${automationId}`);
        console.log(`[WebSocket] Client ${socket.id} subscribed to automation: ${automationId}`);
      });

      socket.on('automation:unsubscribe', (automationId: string) => {
        socket.leave(`automation:${automationId}`);
        console.log(
          `[WebSocket] Client ${socket.id} unsubscribed from automation: ${automationId}`
        );
      });

      // Ping/Pong
      socket.on('ping', () => {
        socket.emit('system:notification', {
          type: 'info',
          message: 'pong',
          timestamp: new Date().toISOString(),
        });
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        console.log(`[WebSocket] Client disconnected: ${socket.id}`);
        this.connectedClients.delete(socket.id);
      });
    });

    console.log('[WebSocket] Server initialized and ready');
  }

  // ============================================
  // JOB EVENTS
  // ============================================

  emitJobCreated(data: JobCreatedEvent) {
    this.io.emit('job:created', data);
  }

  emitJobUpdated(jobId: string, data: Omit<JobUpdatedEvent, 'jobId'>) {
    const event: JobUpdatedEvent = { jobId, ...data };
    this.io.to(`job:${jobId}`).emit('job:updated', event);
    this.io.to(`automation:${jobId}`).emit('job:updated', event);
  }

  emitJobProgress(jobId: string, data: Omit<JobProgressEvent, 'jobId' | 'timestamp'>) {
    const event: JobProgressEvent = {
      jobId,
      ...data,
      timestamp: new Date().toISOString(),
    };
    this.io.to(`job:${jobId}`).emit('job:progress', event);
    this.io.to(`automation:${jobId}`).emit('job:progress', event);
  }

  emitJobCompleted(jobId: string, data: Omit<JobCompletedEvent, 'jobId' | 'timestamp'>) {
    const event: JobCompletedEvent = {
      jobId,
      ...data,
      timestamp: new Date().toISOString(),
    };
    this.io.to(`job:${jobId}`).emit('job:completed', event);
    this.io.to(`automation:${jobId}`).emit('job:completed', event);
  }

  emitJobFailed(jobId: string, data: Omit<JobFailedEvent, 'jobId' | 'timestamp'>) {
    const event: JobFailedEvent = {
      jobId,
      ...data,
      timestamp: new Date().toISOString(),
    };
    this.io.to(`job:${jobId}`).emit('job:failed', event);
    this.io.to(`automation:${jobId}`).emit('job:failed', event);
  }

  // ============================================
  // SCREENSHOT EVENTS
  // ============================================

  emitScreenshotCaptured(
    jobId: string,
    data: Omit<ScreenshotCapturedEvent, 'jobId' | 'timestamp'>
  ) {
    const event: ScreenshotCapturedEvent = {
      jobId,
      ...data,
      timestamp: new Date().toISOString(),
    };
    this.io.to(`job:${jobId}`).emit('screenshot:captured', event);
    this.io.to(`automation:${jobId}`).emit('screenshot:captured', event);
  }

  emitScreenshotUploaded(
    jobId: string,
    data: Omit<ScreenshotUploadedEvent, 'jobId' | 'timestamp'>
  ) {
    const event: ScreenshotUploadedEvent = {
      jobId,
      ...data,
      timestamp: new Date().toISOString(),
    };
    this.io.to(`job:${jobId}`).emit('screenshot:uploaded', event);
    this.io.to(`automation:${jobId}`).emit('screenshot:uploaded', event);
  }

  // ============================================
  // OCR EVENTS
  // ============================================

  emitOCRStarted(jobId: string, data: Omit<OCRStartedEvent, 'jobId' | 'timestamp'>) {
    const event: OCRStartedEvent = {
      jobId,
      ...data,
      timestamp: new Date().toISOString(),
    };
    this.io.to(`job:${jobId}`).emit('ocr:started', event);
    this.io.to(`automation:${jobId}`).emit('ocr:started', event);
  }

  emitOCRProgress(jobId: string, data: Omit<OCRProgressEvent, 'jobId' | 'timestamp'>) {
    const event: OCRProgressEvent = {
      jobId,
      ...data,
      timestamp: new Date().toISOString(),
    };
    this.io.to(`job:${jobId}`).emit('ocr:progress', event);
    this.io.to(`automation:${jobId}`).emit('ocr:progress', event);
  }

  emitOCRCompleted(jobId: string, data: Omit<OCRCompletedEvent, 'jobId' | 'timestamp'>) {
    const event: OCRCompletedEvent = {
      jobId,
      ...data,
      timestamp: new Date().toISOString(),
    };
    this.io.to(`job:${jobId}`).emit('ocr:completed', event);
    this.io.to(`automation:${jobId}`).emit('ocr:completed', event);
  }

  emitOCRFailed(jobId: string, data: Omit<OCRFailedEvent, 'jobId' | 'timestamp'>) {
    const event: OCRFailedEvent = {
      jobId,
      ...data,
      timestamp: new Date().toISOString(),
    };
    this.io.to(`job:${jobId}`).emit('ocr:failed', event);
    this.io.to(`automation:${jobId}`).emit('ocr:failed', event);
  }

  // ============================================
  // MATCH EVENTS
  // ============================================

  emitMatchFound(jobId: string, data: Omit<MatchFoundEvent, 'jobId' | 'timestamp'>) {
    const event: MatchFoundEvent = {
      jobId,
      ...data,
      timestamp: new Date().toISOString(),
    };
    this.io.to(`job:${jobId}`).emit('match:found', event);
    this.io.to(`automation:${jobId}`).emit('match:found', event);
  }

  emitMatchFailed(jobId: string, data: Omit<MatchFailedEvent, 'jobId' | 'timestamp'>) {
    const event: MatchFailedEvent = {
      jobId,
      ...data,
      timestamp: new Date().toISOString(),
    };
    this.io.to(`job:${jobId}`).emit('match:failed', event);
    this.io.to(`automation:${jobId}`).emit('match:failed', event);
  }

  // ============================================
  // LABEL EVENTS
  // ============================================

  emitLabelGenerated(jobId: string, data: Omit<LabelGeneratedEvent, 'jobId' | 'timestamp'>) {
    const event: LabelGeneratedEvent = {
      jobId,
      ...data,
      timestamp: new Date().toISOString(),
    };
    this.io.to(`job:${jobId}`).emit('label:generated', event);
    this.io.to(`automation:${jobId}`).emit('label:generated', event);
  }

  emitLabelFailed(jobId: string, data: Omit<LabelFailedEvent, 'jobId' | 'timestamp'>) {
    const event: LabelFailedEvent = {
      jobId,
      ...data,
      timestamp: new Date().toISOString(),
    };
    this.io.to(`job:${jobId}`).emit('label:failed', event);
    this.io.to(`automation:${jobId}`).emit('label:failed', event);
  }

  // ============================================
  // SYSTEM EVENTS
  // ============================================

  emitSystemNotification(data: Omit<SystemNotificationEvent, 'timestamp'>) {
    const event: SystemNotificationEvent = {
      ...data,
      timestamp: new Date().toISOString(),
    };
    this.io.emit('system:notification', event);
  }

  // ============================================
  // UTILITIES
  // ============================================

  /**
   * Get number of connected clients
   */
  getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }

  /**
   * Get Socket.IO server instance
   */
  getIO(): Server<ClientToServerEvents, ServerToClientEvents> {
    return this.io;
  }

  /**
   * Close WebSocket server
   */
  close() {
    this.io.close();
    console.log('[WebSocket] Server closed');
  }
}

// Export singleton instance
let webSocketServerInstance: WebSocketServer | null = null;

export function initializeWebSocketServer(httpServer: HttpServer): WebSocketServer {
  if (!webSocketServerInstance) {
    webSocketServerInstance = new WebSocketServer(httpServer);
  }
  return webSocketServerInstance;
}

export function getWebSocketServer(): WebSocketServer {
  if (!webSocketServerInstance) {
    throw new Error('WebSocket server not initialized. Call initializeWebSocketServer first.');
  }
  return webSocketServerInstance;
}
