/**
 * WebSocket Notifier for Automation Service
 * Centralized WebSocket notifications to reduce boilerplate
 */

import { getWebSocketServer } from '../../websocket/socket-server.js';
import { AutomationJob } from '../../types/automation-types';

/**
 * Safe WebSocket emission - catches errors if WebSocket not initialized
 */
function safeEmit<T>(fn: () => T): void {
  try {
    fn();
  } catch (_err) {
    // WebSocket not initialized, ignore
  }
}

/**
 * Emit job created notification
 */
export function emitJobCreated(job: AutomationJob): void {
  safeEmit(() => {
    const wsServer = getWebSocketServer();
    wsServer.emitJobCreated({
      jobId: job.id,
      jobType: 'automation',
      name: job.name,
      timestamp: new Date().toISOString(),
    });
  });
}

/**
 * Emit job updated notification
 */
export function emitJobUpdated(
  jobId: string,
  status: string,
  progress: number,
  currentStage: string,
  message?: string
): void {
  safeEmit(() => {
    const wsServer = getWebSocketServer();
    wsServer.emitJobUpdated(jobId, {
      status,
      progress,
      currentStage,
      message,
      timestamp: new Date().toISOString(),
    });
  });
}

/**
 * Emit job completed notification
 */
export function emitJobCompleted(job: AutomationJob): void {
  safeEmit(() => {
    const wsServer = getWebSocketServer();
    wsServer.emitJobCompleted(job.id, {
      results: job.results,
      duration: job.results.summary.totalProcessingTime,
    });
  });
}

/**
 * Emit job failed notification
 */
export function emitJobFailed(job: AutomationJob, error: string, stage: string): void {
  safeEmit(() => {
    const wsServer = getWebSocketServer();
    wsServer.emitJobFailed(job.id, {
      error,
      stage,
    });
  });
}

/**
 * Emit label generated notification
 */
export function emitLabelGenerated(
  jobId: string,
  labelId: string,
  imageUrl: string,
  articleNumber: string
): void {
  safeEmit(() => {
    const wsServer = getWebSocketServer();
    wsServer.emitLabelGenerated(jobId, {
      labelId,
      imageUrl,
      articleNumber,
    });
  });
}

/**
 * Calculate overall progress based on current step
 */
export function calculateOverallProgress(step: number, stepProgress: number): number {
  // 4 steps, each is 25%
  const baseProgress = (step - 1) * 25;
  return Math.round(baseProgress + stepProgress / 4);
}
