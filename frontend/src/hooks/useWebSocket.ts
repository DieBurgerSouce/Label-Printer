/**
 * WebSocket Hook for Real-time Updates
 * Connects to Socket.IO server and provides job updates
 */

import { useEffect, useState, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3001';

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
  results: any;
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
  results: any | null;
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
  // Example: Step 2/4 at 50% = (1/4)*100 + (50/4) = 25 + 12.5 = 37.5%
  const completedStepsProgress = ((stepIndex - 1) / totalSteps) * 100;
  const currentProgress = (currentStepProgress / totalSteps);

  return Math.round(Math.max(0, completedStepsProgress + currentProgress));
}

/**
 * Hook to connect to WebSocket and listen to job updates
 */
export function useWebSocket(jobId?: string) {
  const socketRef = useRef<Socket | null>(null);
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

  useEffect(() => {
    // Fetch job data via REST API (and poll every 2 seconds as fallback)
    const fetchJobData = () => {
      if (jobId) {
        fetch(`${WS_URL}/api/automation/jobs/${jobId}`)
          .then(res => res.json())
          .then(data => {
            if (data.success && data.job) {
              const currentStep = data.job.progress?.currentStep || 'pending';
              const currentStepProgress = data.job.progress?.currentStepProgress || 0;
              const totalSteps = data.job.progress?.totalSteps || 4;
              const overallProgress = calculateOverallProgress(currentStep, currentStepProgress, totalSteps);

              console.log(`[Progress] Step: ${currentStep}, StepProgress: ${currentStepProgress}%, Overall: ${overallProgress}%`);

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
          })
          .catch(err => {
            console.error('[WebSocket] Failed to fetch job data:', err);
            setState(prev => ({ ...prev, error: err.message }));
          });
      }
    };

    // Initial fetch
    fetchJobData();

    // Poll every 2 seconds as fallback
    const pollInterval = setInterval(() => {
      fetchJobData();
    }, 2000);

    // Create socket connection
    console.log('[WebSocket] Connecting to:', WS_URL);
    const socket = io(WS_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    socketRef.current = socket;

    // Connection events
    socket.on('connect', () => {
      console.log('[WebSocket] Connected:', socket.id);
      setState(prev => ({ ...prev, isConnected: true }));

      // Subscribe to job if jobId provided
      if (jobId) {
        console.log('[WebSocket] Subscribing to job:', jobId);
        socket.emit('job:subscribe', jobId);
      }
    });

    socket.on('disconnect', () => {
      console.log('[WebSocket] Disconnected');
      setState(prev => ({ ...prev, isConnected: false }));
    });

    socket.on('connect_error', (error) => {
      console.error('[WebSocket] Connection error:', error);
      setState(prev => ({ ...prev, error: error.message, isConnected: false }));
    });

    // Job events
    socket.on('job:created', (data: JobCreatedEvent) => {
      console.log('[WebSocket] Job created:', data);
    });

    socket.on('job:updated', (data: JobUpdatedEvent) => {
      console.log('[WebSocket] Job updated:', data);
      setState(prev => ({
        ...prev,
        status: data.status,
        progress: data.progress || prev.progress,
        currentStage: data.currentStage || prev.currentStage,
      }));
    });

    socket.on('job:completed', (data: JobCompletedEvent) => {
      console.log('[WebSocket] Job completed:', data);
      setState(prev => ({
        ...prev,
        status: 'completed',
        progress: 100,
        results: data.results,
      }));
    });

    socket.on('job:failed', (data: JobFailedEvent) => {
      console.log('[WebSocket] Job failed:', data);
      setState(prev => ({
        ...prev,
        status: 'failed',
        error: data.error,
      }));
    });

    // Screenshot events
    socket.on('screenshot:captured', (data: ScreenshotCapturedEvent) => {
      console.log('[WebSocket] Screenshot captured:', data);
      setState(prev => ({
        ...prev,
        screenshots: [...prev.screenshots, data],
      }));
    });

    // OCR events
    socket.on('ocr:completed', (data: OCRCompletedEvent) => {
      console.log('[WebSocket] OCR completed:', data);
      setState(prev => ({
        ...prev,
        ocrResults: [...prev.ocrResults, data],
      }));
    });

    // Label events
    socket.on('label:generated', (data: LabelGeneratedEvent) => {
      console.log('[WebSocket] Label generated:', data);
      setState(prev => ({
        ...prev,
        labels: [...prev.labels, data],
      }));
    });

    // Cleanup
    return () => {
      clearInterval(pollInterval);
      if (jobId) {
        socket.emit('job:unsubscribe', jobId);
      }
      socket.disconnect();
    };
  }, [jobId]);

  // Helper function to subscribe to a different job
  const subscribeToJob = (newJobId: string) => {
    if (socketRef.current && socketRef.current.connected) {
      // Unsubscribe from old job if exists
      if (jobId) {
        socketRef.current.emit('job:unsubscribe', jobId);
      }
      // Subscribe to new job
      console.log('[WebSocket] Subscribing to new job:', newJobId);
      socketRef.current.emit('job:subscribe', newJobId);
    }
  };

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
  const [latestEvents, setLatestEvents] = useState<any[]>([]);

  useEffect(() => {
    const socket = io(WS_URL);
    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('[WebSocket Global] Connected:', socket.id);
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('[WebSocket Global] Disconnected');
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
