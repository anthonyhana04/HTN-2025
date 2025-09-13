'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { PoseLandmarker, FilesetResolver, PoseLandmarkerResult } from '@mediapipe/tasks-vision';
import { PoseLandmarks, PostureAnalysis } from '@/lib/poseUtils';
import PostureAnalyzer from './PostureAnalyzer';

interface PoseDetectionProps {
  onPostureUpdate?: (analysis: PostureAnalysis) => void;
  onLandmarksUpdate?: (landmarks: PoseLandmarks) => void;
}

export default function PoseDetection({ onPostureUpdate, onLandmarksUpdate }: PoseDetectionProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const animationRef = useRef<number | null>(null);
  const lastVideoTimeRef = useRef<number>(-1);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [landmarks, setLandmarks] = useState<PoseLandmarks | null>(null);
  const [videoReady, setVideoReady] = useState(false);

  // Initialize MediaPipe Pose Landmarker
  const initializePoseLandmarker = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.11/wasm'
      );

      const poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/1/pose_landmarker_heavy.task',
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numPoses: 1,
        minPoseDetectionConfidence: 0.5,
        minPosePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
      });

      poseLandmarkerRef.current = poseLandmarker;
      setIsLoading(false);
    } catch (err) {
      console.error('Failed to initialize pose landmarker:', err);
      setError('Failed to initialize pose detection. Please refresh the page.');
      setIsLoading(false);
    }
  }, []);

  // Start webcam
  const startWebcam = useCallback(async () => {
    try {
      console.log('Requesting camera access...');
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        }
      });

      console.log('Camera stream obtained:', stream);
      console.log('Stream tracks:', stream.getTracks());
      
      if (videoRef.current) {
        // Set the stream
        videoRef.current.srcObject = stream;
        
        // Add event listeners
        const video = videoRef.current;
        
        video.onloadedmetadata = () => {
          console.log('Video metadata loaded:', {
            videoWidth: video.videoWidth,
            videoHeight: video.videoHeight,
            readyState: video.readyState,
            duration: video.duration
          });
        };

        video.oncanplay = () => {
          console.log('Video can play - attempting to play');
          video.play().catch(err => {
            console.error('Play failed:', err);
          });
        };

        video.onplaying = () => {
          console.log('Video is playing!');
          setVideoReady(true);
        };

        video.onerror = (e) => {
          console.error('Video error:', e);
        };

        // Try to play immediately
        try {
          await video.play();
          console.log('Video play initiated');
        } catch (playError) {
          console.log('Initial play failed, waiting for canplay:', playError);
        }
      }
    } catch (err) {
      console.error('Failed to access webcam:', err);
      setError('Camera access denied. Please allow camera access and refresh the page.');
    }
  }, []);

  // Draw pose landmarks on canvas
  const drawPoseLandmarks = useCallback((result: PoseLandmarkerResult) => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    
    if (!canvas || !video || !result.landmarks) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw landmarks (skip all face points 0-10: nose, eyes, ears, mouth)
    result.landmarks.forEach((landmarkList) => {
      landmarkList.forEach((landmark, index) => {
        if (index >= 0 && index <= 10) return;
        if (landmark.visibility && landmark.visibility > 0.3) {
          const x = landmark.x * canvas.width;
          const y = landmark.y * canvas.height;

          // Draw landmark point
          ctx.beginPath();
          ctx.arc(x, y, 4, 0, 2 * Math.PI);
          ctx.fillStyle = '#00FF00';
          ctx.fill();

          // Draw landmark index
          ctx.fillStyle = '#FFFFFF';
          ctx.font = '12px Arial';
          ctx.fillText(index.toString(), x + 6, y - 6);
        }
      });

      // Draw skeleton connections
      drawSkeleton(ctx, landmarkList, canvas.width, canvas.height);
    });
  }, []);

  // Draw skeleton connections
  const drawSkeleton = useCallback((
    ctx: CanvasRenderingContext2D,
    landmarks: any[],
    width: number,
    height: number
  ) => {
    const connections = [
      // Torso
      [11, 12], // Shoulders
      [11, 23], [12, 24], // Shoulder to hip
      [23, 24], // Hips
      // Left arm
      [11, 13], [13, 15], // Left shoulder to wrist
      [15, 17], [15, 19], [15, 21], // Left hand
      [17, 19], [19, 21], [21, 17], // Left hand connections
      // Right arm
      [12, 14], [14, 16], // Right shoulder to wrist
      [16, 18], [16, 20], [16, 22], // Right hand
      [18, 20], [20, 22], [22, 18], // Right hand connections
      // Left leg
      [23, 25], [25, 27], [27, 29], [27, 31], // Left leg
      [29, 31], // Left foot
      // Right leg
      [24, 26], [26, 28], [28, 30], [28, 32], // Right leg
      [30, 32], // Right foot
    ];

    ctx.strokeStyle = '#00FF00';
    ctx.lineWidth = 2;

    connections.forEach(([startIdx, endIdx]) => {
      const start = landmarks[startIdx];
      const end = landmarks[endIdx];
      
      if (start && end && 
          start.visibility && start.visibility > 0.3 &&
          end.visibility && end.visibility > 0.3) {
        ctx.beginPath();
        ctx.moveTo(start.x * width, start.y * height);
        ctx.lineTo(end.x * width, end.y * height);
        ctx.stroke();
      }
    });

    // Draw an inferred neck line from shoulder midpoint to head center (ears midpoint or nose)
    const leftShoulder = landmarks[11];
    const rightShoulder = landmarks[12];
    const leftEar = landmarks[7];
    const rightEar = landmarks[8];
    const nose = landmarks[0];

    const isVisible = (lm: any) => lm && lm.visibility && lm.visibility > 0.3;

    let headCenter: any | null = null;
    if (isVisible(leftEar) && isVisible(rightEar)) {
      headCenter = {
        x: (leftEar.x + rightEar.x) / 2,
        y: (leftEar.y + rightEar.y) / 2,
        visibility: Math.min(leftEar.visibility, rightEar.visibility),
      };
    } else if (isVisible(nose)) {
      headCenter = nose;
    }

    if (isVisible(leftShoulder) && isVisible(rightShoulder) && headCenter) {
      const shoulderMid = {
        x: (leftShoulder.x + rightShoulder.x) / 2,
        y: (leftShoulder.y + rightShoulder.y) / 2,
      };

      ctx.beginPath();
      ctx.moveTo(shoulderMid.x * width, shoulderMid.y * height);
      ctx.lineTo(headCenter.x * width, headCenter.y * height);
      ctx.stroke();
    }
  }, []);

  // Detection loop
  const detectPose = useCallback(async () => {
    const video = videoRef.current;
    const poseLandmarker = poseLandmarkerRef.current;

    if (!video || !poseLandmarker) {
      console.log('Missing video or poseLandmarker');
      animationRef.current = requestAnimationFrame(detectPose);
      return;
    }

    if (video.currentTime === lastVideoTimeRef.current) {
      animationRef.current = requestAnimationFrame(detectPose);
      return;
    }

    // Check if video has valid dimensions
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.log('Video dimensions not ready:', video.videoWidth, video.videoHeight);
      animationRef.current = requestAnimationFrame(detectPose);
      return;
    }

    lastVideoTimeRef.current = video.currentTime;

    try {
      console.log('Running pose detection...');
      const result = poseLandmarker.detectForVideo(video, performance.now());
      console.log('Detection result:', result);
      
      if (result.landmarks && result.landmarks.length > 0) {
        console.log('Found landmarks:', result.landmarks[0].length);
        const poseData: PoseLandmarks = {
          landmarks: result.landmarks[0],
          worldLandmarks: result.worldLandmarks?.[0]
        };
        
        setLandmarks(poseData);
        if (onLandmarksUpdate) {
          onLandmarksUpdate(poseData);
        }
        drawPoseLandmarks(result);
      } else {
        console.log('No landmarks detected');
      }
    } catch (err) {
      console.error('Pose detection error:', err);
    }

    animationRef.current = requestAnimationFrame(detectPose);
  }, [drawPoseLandmarks]);

  // Start detection
  const startDetection = useCallback(() => {
    if (poseLandmarkerRef.current && videoRef.current && videoRef.current.videoWidth > 0) {
      console.log('Starting pose detection...');
      setIsDetecting(true);
      detectPose();
    } else {
      console.log('Cannot start detection - missing requirements:', {
        poseLandmarker: !!poseLandmarkerRef.current,
        video: !!videoRef.current,
        videoWidth: videoRef.current?.videoWidth
      });
    }
  }, [detectPose]);

  // Stop detection
  const stopDetection = useCallback(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    setIsDetecting(false);
  }, []);

  // Initialize on mount
  useEffect(() => {
    initializePoseLandmarker();
  }, [initializePoseLandmarker]);

  // Don't auto-start webcam - let user click the button

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopDetection();
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stopDetection]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading pose detection...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4">
      <div className="pose-container relative inline-block">
        <video
          ref={videoRef}
          className="pose-video w-full max-w-2xl h-auto border-2 border-gray-300 rounded-lg"
          playsInline
          muted
          autoPlay
          style={{ transform: 'scaleX(-1)', minHeight: '300px' }}
        />
        <canvas
          ref={canvasRef}
          className="pose-canvas absolute top-0 left-0 w-full max-w-2xl h-auto"
          style={{ transform: 'scaleX(-1)', pointerEvents: 'none' }}
        />
      </div>
      
      <div className="mt-4 p-4 bg-gray-100 rounded text-sm hidden">
        <p>Video Status: {videoRef.current ? 'Element exists' : 'No element'}</p>
        <p>Video Dimensions: {videoRef.current ? `${videoRef.current.videoWidth}x${videoRef.current.videoHeight}` : 'Unknown'}</p>
        <p>Video Ready State: {videoRef.current ? videoRef.current.readyState : 'Unknown'}</p>
        <p>Video Ready: {videoReady ? 'Yes' : 'No'}</p>
        <p>Pose Landmarker: {poseLandmarkerRef.current ? 'Initialized' : 'Not initialized'}</p>
        <p>Detection Status: {isDetecting ? 'Running' : 'Stopped'}</p>
      </div>

      <div className="mt-4 flex gap-4 justify-center">
        <button
          onClick={startWebcam}
          className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Start Camera
        </button>
        <button
          onClick={isDetecting ? stopDetection : startDetection}
          className={`px-6 py-2 rounded font-medium ${
            isDetecting
              ? 'bg-red-600 text-white hover:bg-red-700'
              : videoReady
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-400 text-white cursor-not-allowed'
          }`}
          disabled={!videoReady || isDetecting}
        >
          {isDetecting ? 'Stop Detection' : videoReady ? 'Start Detection' : 'Video Not Ready'}
        </button>
      </div>

      {/* PostureAnalyzer is now handled in the main page layout */}
    </div>
  );
}
