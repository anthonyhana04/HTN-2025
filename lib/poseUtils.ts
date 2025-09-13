// Pose landmark indices from MediaPipe
export const POSE_LANDMARKS = {
  NOSE: 0,
  LEFT_EYE_INNER: 1,
  LEFT_EYE: 2,
  LEFT_EYE_OUTER: 3,
  RIGHT_EYE_INNER: 4,
  RIGHT_EYE: 5,
  RIGHT_EYE_OUTER: 6,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  MOUTH_LEFT: 9,
  MOUTH_RIGHT: 10,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_ELBOW: 13,
  RIGHT_ELBOW: 14,
  LEFT_WRIST: 15,
  RIGHT_WRIST: 16,
  LEFT_PINKY: 17,
  RIGHT_PINKY: 18,
  LEFT_INDEX: 19,
  RIGHT_INDEX: 20,
  LEFT_THUMB: 21,
  RIGHT_THUMB: 22,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
  LEFT_HEEL: 29,
  RIGHT_HEEL: 30,
  LEFT_FOOT_INDEX: 31,
  RIGHT_FOOT_INDEX: 32,
} as const;

export type PoseLandmarkIndex = typeof POSE_LANDMARKS[keyof typeof POSE_LANDMARKS];

export interface PoseLandmark {
  x: number;
  y: number;
  z: number;
  visibility?: number;
  presence?: number;
}

export interface PoseLandmarks {
  landmarks: PoseLandmark[];
  worldLandmarks?: PoseLandmark[];
}

export type PostureStatus = 'good' | 'slouching' | 'head-forward' | 'borderline';

export interface PostureMetrics {
  headNeckAngle: number; // degrees
  forwardHeadOffset: number; // normalized by shoulder width
  trunkFlexion: number; // degrees
  shoulderWidth: number; // normalized
  confidence: number; // average visibility of key landmarks
}

export interface PostureAnalysis {
  status: PostureStatus;
  metrics: PostureMetrics;
  severity: 'low' | 'medium' | 'high';
  message: string;
}

// Math utilities
export function calculateAngle(
  point1: PoseLandmark,
  point2: PoseLandmark,
  point3: PoseLandmark
): number {
  const vector1 = {
    x: point1.x - point2.x,
    y: point1.y - point2.y,
  };
  const vector2 = {
    x: point3.x - point2.x,
    y: point3.y - point2.y,
  };

  const dotProduct = vector1.x * vector2.x + vector1.y * vector2.y;
  const magnitude1 = Math.sqrt(vector1.x * vector1.x + vector1.y * vector1.y);
  const magnitude2 = Math.sqrt(vector2.x * vector2.x + vector2.y * vector2.y);

  if (magnitude1 === 0 || magnitude2 === 0) return 0;

  const cosAngle = dotProduct / (magnitude1 * magnitude2);
  const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));
  return (angle * 180) / Math.PI;
}

export function calculateDistance(point1: PoseLandmark, point2: PoseLandmark): number {
  const dx = point1.x - point2.x;
  const dy = point1.y - point2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

export function getMidpoint(point1: PoseLandmark, point2: PoseLandmark): PoseLandmark {
  return {
    x: (point1.x + point2.x) / 2,
    y: (point1.y + point2.y) / 2,
    z: (point1.z + point2.z) / 2,
    visibility: Math.min(point1.visibility || 0, point2.visibility || 0),
  };
}

export function isLandmarkVisible(landmark: PoseLandmark, threshold: number = 0.3): boolean {
  return (landmark.visibility || 0) >= threshold;
}

// Posture analysis functions
export function analyzePosture(landmarks: PoseLandmark[]): PostureAnalysis {
  const leftShoulder = landmarks[POSE_LANDMARKS.LEFT_SHOULDER];
  const rightShoulder = landmarks[POSE_LANDMARKS.RIGHT_SHOULDER];
  const leftHip = landmarks[POSE_LANDMARKS.LEFT_HIP];
  const rightHip = landmarks[POSE_LANDMARKS.RIGHT_HIP];
  const nose = landmarks[POSE_LANDMARKS.NOSE];
  const leftEar = landmarks[POSE_LANDMARKS.LEFT_EAR];
  const rightEar = landmarks[POSE_LANDMARKS.RIGHT_EAR];

  // Check if key landmarks are visible
  const keyLandmarks = [leftShoulder, rightShoulder, leftHip, rightHip, nose];
  const visibleLandmarks = keyLandmarks.filter(landmark => 
    isLandmarkVisible(landmark, 0.3)
  );
  const confidence = visibleLandmarks.length / keyLandmarks.length;

  if (confidence < 0.6) {
    return {
      status: 'borderline',
      metrics: {
        headNeckAngle: 0,
        forwardHeadOffset: 0,
        trunkFlexion: 0,
        shoulderWidth: 0,
        confidence,
      },
      severity: 'low',
      message: 'Insufficient pose visibility for analysis',
    };
  }

  // Calculate shoulder width for normalization
  const shoulderWidth = calculateDistance(leftShoulder, rightShoulder);
  
  // Calculate shoulder and hip midpoints
  const shoulderMidpoint = getMidpoint(leftShoulder, rightShoulder);
  const hipMidpoint = getMidpoint(leftHip, rightHip);
  
  // Create vertical reference points
  const verticalUp = { ...shoulderMidpoint, y: shoulderMidpoint.y - 1 };
  const verticalDown = { ...shoulderMidpoint, y: shoulderMidpoint.y + 1 };
  
  // Calculate trunk flexion (shoulder to hip angle with vertical)
  // This measures how much the spine is bent forward
  const trunkFlexion = calculateAngle(verticalUp, shoulderMidpoint, hipMidpoint);
  
  // Calculate head-neck angle
  // Use ear midpoint for head position, or nose if ears not visible
  const headCenter = isLandmarkVisible(leftEar, 0.3) && isLandmarkVisible(rightEar, 0.3) 
    ? getMidpoint(leftEar, rightEar)
    : nose;
  
  const headNeckAngle = calculateAngle(verticalUp, shoulderMidpoint, headCenter);

  // Calculate forward head offset (lateral displacement)
  const shoulderCenterX = shoulderMidpoint.x;
  const headCenterX = headCenter.x;
  const forwardHeadOffset = Math.abs(headCenterX - shoulderCenterX) / shoulderWidth;

  const metrics: PostureMetrics = {
    headNeckAngle,
    forwardHeadOffset,
    trunkFlexion,
    shoulderWidth,
    confidence,
  };

  // Classification logic
  let status: PostureStatus;
  let severity: 'low' | 'medium' | 'high';
  let message: string;

  if (trunkFlexion <= 15 && forwardHeadOffset <= 0.15) {
    status = 'good';
    severity = 'low';
    message = 'Good posture!';
  } else if (trunkFlexion > 25) {
    status = 'slouching';
    severity = trunkFlexion > 35 ? 'high' : 'medium';
    message = `Slouching detected (${trunkFlexion.toFixed(1)}° trunk flexion)`;
  } else if (forwardHeadOffset > 0.30) {
    status = 'head-forward';
    severity = forwardHeadOffset > 0.45 ? 'high' : 'medium';
    message = `Forward head posture detected (${(forwardHeadOffset * 100).toFixed(1)}% offset)`;
  } else {
    status = 'borderline';
    severity = 'low';
    message = 'Posture needs improvement';
  }

  return {
    status,
    metrics,
    severity,
    message,
  };
}

// Smoothing utilities (simple moving average)
export class SmoothingFilter {
  private buffer: number[] = [];
  private maxSize: number;

  constructor(maxSize: number = 5) {
    this.maxSize = maxSize;
  }

  update(value: number): number {
    this.buffer.push(value);
    if (this.buffer.length > this.maxSize) {
      this.buffer.shift();
    }
    return this.buffer.reduce((sum, val) => sum + val, 0) / this.buffer.length;
  }

  reset(): void {
    this.buffer = [];
  }
}
