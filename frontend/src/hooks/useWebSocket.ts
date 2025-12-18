/**
 * WebSocket Hook for Real-time Updates
 * Connects to Socket.IO server and provides job updates
 *
 * Performance optimized: REST polling only when WebSocket disconnected
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL ||
  (import.meta.env.PROD ? window.location.origin : 'http://localhost:3001');

// Polling interval when WebSocket is disconnected
const POLLING_INTERVAL_MS = 2000;

interface JobCreatedEvent {
  jobId: string;
  jobType: 'crawl' | 'automation';
  name: string;
  timestamp: string;
}

interface JobUpdatedEvent {
  jobId: string;
  status: string;
  progress?: number;
  currentStage?: string;
  timestamp: string;
}

interface JobCompletedEvent {
  jobId: string;
  results: unknown;
  duration: number;
  timestamp: string;
}

interface JobFailedEvent {
  jobId: string;
  error: string;
  stage?: string;
  timestamp: string;
}

interface ScreenshotCapturedEvent {
  jobId: string;
  screenshotId: string;
  url: string;
  thumbnailUrl?: string;
  productUrl: string;
  productName?: string;
  timestamp: string;
}

interface OCRCompletedEvent {
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

interface LabelGeneratedEvent {
  jobId: string;
  labelId: string;
  imageUrl: string;
  articleNumber: string;
  timestamp: string;
}

export interface WebSocketState {
  isConnected: boolean;
  progress: number;
  currentStage: string;
  status: string;
  screenshots: ScreenshotCapturedEvent[];
  ocrResults: OCRCompletedEvent[];
  labels: LabelGeneratedEvent[];
  error: string | null;
  results: unknown | null;
}

/**
 * Calculate overall progress from current step and step progress
 * Step 1/4 (crawling): 0-25%
 * Step 2/4 (processing-ocr): 25-50%
 * Step 3/4 (matching): 50-75%
 * Step 4/4 (rendering): 75-100%
 */
function calculateOverallProgress(currentStep: string, currentStepProgress: number, totalSteps: number = 4): number {
  const stepMap: Record<string, number> = {
    'pending': 0,
    'crawling': 1,
    'processing-ocr': 2,
    'matching': 3,
    'rendering': 4,
    'completed': 4,
  };

  const stepIndex = stepMap[currentStep] || 0;

  // If completed, return 100%
  if (currentStep === 'completed') {
    return 100;
  }

  // Calculate: (completed steps / total) * 100 + (current step progress / total)
  const completedStepsProgress = ((stepIndex - 1) / totalSteps) * 100;
  const currentProgress = (currentStepProgress / totalSteps);

  return Math.round(Math.max(0, completedStepsProgress + currentProgress));
}

/**
 * Hook to connect to WebSocket and listen to job updates
 * Optimized: REST polling only as fallback when WebSocket is disconnected
 */
export function useWebSocket(jobId?: string) {
  const socketRef = useRef<Socket | null>(null);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isConnectedRef = useRef<boolean>(false);

  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    progress: 0,
    currentStage: 'pending',
    status: 'pending',
    screenshots: [],
    ocrResults: [],
    labels: [],
    error: null,
    results: null,
  });

  // Fetch job data via REST API - memoized
  const fetchJobData = useCallback(async () => {
    if (!jobId) return;

    try {
      const res = await fetch(`${WS_URL}/api/automation/jobs/${jobId}`);
      const data = await res.json();

      if (data.success && data.job) {
        const currentStep = data.job.progress?.currentStep || 'pending';
        const currentStepProgress = data.job.progress?.currentStepProgress || 0;
        const totalSteps = data.job.progress?.totalSteps || 4;
        const overallProgress = calculateOverallProgress(currentStep, currentStepProgress, totalSteps);

        setState(prev => ({
          ...prev,
          status: data.job.status,
          currentStage: currentStep,
          progress: overallProgress,
          screenshots: data.job.results?.screenshots || [],
          ocrResults: data.job.results?.ocrResults || [],
          labels: data.job.results?.labels || [],
          error: null,
        }));
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setState(prev => ({ ...prev, error: errorMessage }));
    }
  }, [jobId]);

  // Start polling (only when WebSocket disconnected)
  const startPolling = useCallback(() => {
    // Only start polling if WebSocket is disconnected
    if (isConnectedRef.current) return;

    // Clear any existing interval
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    // Start new polling interval
    pollIntervalRef.current = setInterval(() => {
      // Double-check connection state before fetching
      if (!isConnectedRef.current) {
        fetchJobData();
      }
    }, POLLING_INTERVAL_MS);
  }, [fetchJobData]);

  // Stop polling (when WebSocket connects)
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Initial fetch (always fetch once to get initial state)
    fetchJobData();

    // Create socket connection
    const socket = io(WS_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      isConnectedRef.current = true;
      setState(prev => ({ ...prev, isConnected: true }));

      // Stop polling when WebSocket connects
      stopPolling();

      // Subscribe to job if jobId provided
      if (jobId) {
        socket.emit('job:subscribe', jobId);
      }
    });

    socket.on('disconnect', () => {
      isConnectedRef.current = false;
      setState(prev => ({ ...prev, isConnected: false }));

      // Start polling as fallback when WebSocket disconnects
      startPolling();
    });

    socket.on('connect_error', (error) => {
      isConnectedRef.current = false;
      setState(prev => ({ ...prev, error: error.message, isConnected: false }));

      // Start polling as fallback on connection error
      startPolling();
    });

    // Job events
    socket.on('job:created', (_data: JobCreatedEvent) => {
      // Job created notification
    });

    socket.on('job:updated', (data: JobUpdatedEvent) => {
      setState(prev => ({
        ...prev,
        status: data.status,
        progress: data.progress || prev.progress,
        currentStage: data.currentStage || prev.currentStage,
      }));
    });

    socket.on('job:completed', (data: JobCompletedEvent) => {
      setState(prev => ({
        ...prev,
        status: 'completed',
        progress: 100,
        results: data.results,
      }));
    });

    socket.on('job:failed', (data: JobFailedEvent) => {
      setState(prev => ({
        ...prev,
        status: 'failed',
        error: data.error,
      }));
    });

    // Screenshot events
    socket.on('screenshot:captured', (data: ScreenshotCapturedEvent) => {
      setState(prev => ({
        ...prev,
        screenshots: [...prev.screenshots, data],
      }));
    });

    // OCR events
    socket.on('ocr:completed', (data: OCRCompletedEvent) => {
      setState(prev => ({
        ...prev,
        ocrResults: [...prev.ocrResults, data],
      }));
    });

    // Label events
    socket.on('label:generated', (data: LabelGeneratedEvent) => {
      setState(prev => ({
        ...prev,
        labels: [...prev.labels, data],
      }));
    });

    // Cleanup
    return () => {
      stopPolling();
      if (jobId) {
        socket.emit('job:unsubscribe', jobId);
      }
      socket.disconnect();
    };
  }, [jobId, fetchJobData, startPolling, stopPolling]);

  // Helper function to subscribe to a different job
  const subscribeToJob = useCallback((newJobId: string) => {
    if (socketRef.current && socketRef.current.connected) {
      // Unsubscribe from old job if exists
      if (jobId) {
        socketRef.current.emit('job:unsubscribe', jobId);
      }
      // Subscribe to new job
      socketRef.current.emit('job:subscribe', newJobId);
    }
  }, [jobId]);

  return {
    ...state,
    subscribeToJob,
  };
}

/**
 * Hook for listening to all jobs (global feed)
 */
export function useWebSocketGlobal() {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [latestEvents, setLatestEvents] = useState<Array<{
    type: string;
    data: JobCreatedEvent | JobUpdatedEvent | JobCompletedEvent;
    timestamp: number;
  }>>([]);

  useEffect(() => {
    const socket = io(WS_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Listen to all job events globally
    socket.on('job:created', (data: JobCreatedEvent) => {
      setLatestEvents(prev => [{ type: 'job:created', data, timestamp: Date.now() }, ...prev].slice(0, 50));
    });

    socket.on('job:updated', (data: JobUpdatedEvent) => {
      setLatestEvents(prev => [{ type: 'job:updated', data, timestamp: Date.now() }, ...prev].slice(0, 50));
    });

    socket.on('job:completed', (data: JobCompletedEvent) => {
      setLatestEvents(prev => [{ type: 'job:completed', data, timestamp: Date.now() }, ...prev].slice(0, 50));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return {
    isConnected,
    latestEvents,
  };
}
