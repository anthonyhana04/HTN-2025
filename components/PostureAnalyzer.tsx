'use client';

import { useEffect, useState, useCallback } from 'react';
import { PoseLandmarks, PostureAnalysis, analyzePosture, SmoothingFilter, calculateSittingMetrics, SittingMetrics, OneEuroFilter, METRIC_THRESHOLDS, classify, classifyElbow, classifyKnee, classifyPelvicTilt } from '@/lib/poseUtils';

interface PostureAnalyzerProps {
  landmarks: PoseLandmarks;
  onPostureUpdate?: (analysis: PostureAnalysis) => void;
}

export default function PostureAnalyzer({ landmarks, onPostureUpdate }: PostureAnalyzerProps) {
  const [analysis, setAnalysis] = useState<PostureAnalysis | null>(null);
  const [smoothedAnalysis, setSmoothedAnalysis] = useState<PostureAnalysis | null>(null);
  const [sittingMetrics, setSittingMetrics] = useState<SittingMetrics | null>(null);
  const [baseline, setBaseline] = useState<{ pelvicTilt: number; shoulderWidth: number } | null>(null);
  const [neckHistory, setNeckHistory] = useState<number[]>([]);
  
  // Smoothing filters for different metrics
  const [angleFilter] = useState(() => new SmoothingFilter(3));
  const [trunkFilter] = useState(() => new SmoothingFilter(3));
  
  // One-Euro filters for comprehensive metrics
  const [cvaFilter] = useState(() => new OneEuroFilter());
  const [forwardHeadFilter] = useState(() => new OneEuroFilter());
  const [trunkFilterEuro] = useState(() => new OneEuroFilter());
  const [pelvicFilter] = useState(() => new OneEuroFilter());
  const [elbowFilter] = useState(() => new OneEuroFilter());
  const [wristFilter] = useState(() => new OneEuroFilter());
  const [kneeFilter] = useState(() => new OneEuroFilter());

  // Analyze posture when landmarks change
  const analyzeCurrentPosture = useCallback(() => {
    const currentAnalysis = analyzePosture(landmarks.landmarks);
    setAnalysis(currentAnalysis);

    // Calculate comprehensive sitting metrics
    const rawSittingMetrics = calculateSittingMetrics(landmarks.landmarks, baseline, neckHistory);
    
    // Apply One-Euro filtering to smooth the metrics
    const smoothedSittingMetrics: SittingMetrics = {
      cvaDeg: {
        ...rawSittingMetrics.cvaDeg,
        value: rawSittingMetrics.cvaDeg.visible ? cvaFilter.update(rawSittingMetrics.cvaDeg.value) : 0,
        level: rawSittingMetrics.cvaDeg.visible ? classify(rawSittingMetrics.cvaDeg.value, METRIC_THRESHOLDS.cvaDeg) : "na"
      },
      forwardHeadNorm: {
        ...rawSittingMetrics.forwardHeadNorm,
        value: rawSittingMetrics.forwardHeadNorm.visible ? forwardHeadFilter.update(rawSittingMetrics.forwardHeadNorm.value) : 0,
        level: rawSittingMetrics.forwardHeadNorm.visible ? classify(rawSittingMetrics.forwardHeadNorm.value, METRIC_THRESHOLDS.forwardHeadNorm) : "na"
      },
      trunkDeg: {
        ...rawSittingMetrics.trunkDeg,
        value: rawSittingMetrics.trunkDeg.visible ? trunkFilterEuro.update(rawSittingMetrics.trunkDeg.value) : 0,
        level: rawSittingMetrics.trunkDeg.visible ? classify(rawSittingMetrics.trunkDeg.value, METRIC_THRESHOLDS.trunkDeg) : "na"
      },
      pelvicTiltDegDelta: {
        ...rawSittingMetrics.pelvicTiltDegDelta,
        value: rawSittingMetrics.pelvicTiltDegDelta.visible ? pelvicFilter.update(rawSittingMetrics.pelvicTiltDegDelta.value) : 0,
        level: rawSittingMetrics.pelvicTiltDegDelta.visible ? classifyPelvicTilt(rawSittingMetrics.pelvicTiltDegDelta.value) : "na"
      },
      elbowDeg: {
        ...rawSittingMetrics.elbowDeg,
        value: rawSittingMetrics.elbowDeg.visible ? elbowFilter.update(rawSittingMetrics.elbowDeg.value) : 0,
        level: rawSittingMetrics.elbowDeg.visible ? classifyElbow(rawSittingMetrics.elbowDeg.value) : "na"
      },
      wristExtDeg: {
        ...rawSittingMetrics.wristExtDeg,
        value: rawSittingMetrics.wristExtDeg.visible ? wristFilter.update(rawSittingMetrics.wristExtDeg.value) : 0,
        level: rawSittingMetrics.wristExtDeg.visible ? classify(rawSittingMetrics.wristExtDeg.value, METRIC_THRESHOLDS.wristExtDeg) : "na"
      },
      kneeDeg: {
        ...rawSittingMetrics.kneeDeg,
        value: rawSittingMetrics.kneeDeg.visible ? kneeFilter.update(rawSittingMetrics.kneeDeg.value) : 0,
        level: rawSittingMetrics.kneeDeg.visible ? classifyKnee(rawSittingMetrics.kneeDeg.value) : "na"
      },
      feetSupported: rawSittingMetrics.feetSupported,
      neckVarDegPerMin: rawSittingMetrics.neckVarDegPerMin,
      ergoScore: rawSittingMetrics.ergoScore
    };

    setSittingMetrics(smoothedSittingMetrics);

    // Update neck history for variability calculation
    if (rawSittingMetrics.cvaDeg.visible) {
      setNeckHistory(prev => {
        const newHistory = [...prev, rawSittingMetrics.cvaDeg.value];
        return newHistory.slice(-1800); // Keep last 60 seconds at 30fps
      });
    }

    // Apply smoothing to key metrics
    const smoothedMetrics = {
      ...currentAnalysis.metrics,
      headNeckAngle: angleFilter.update(currentAnalysis.metrics.headNeckAngle),
      trunkFlexion: currentAnalysis.metrics.spineVisible
        ? trunkFilter.update(currentAnalysis.metrics.trunkFlexion)
        : 0,
      sittingMetrics: smoothedSittingMetrics
    };

    // Re-classify with smoothed metrics
    let smoothedStatus = currentAnalysis.status;
    let smoothedSeverity = currentAnalysis.severity;
    let smoothedMessage = currentAnalysis.message;

    if (!currentAnalysis.metrics.spineVisible) {
      smoothedStatus = 'borderline';
      smoothedSeverity = 'low';
      smoothedMessage = 'Spine not in view';
    } else if (smoothedMetrics.trunkFlexion <= 15) {
      smoothedStatus = 'good';
      smoothedSeverity = 'low';
      smoothedMessage = 'Good posture!';
    } else if (smoothedMetrics.trunkFlexion > 25) {
      smoothedStatus = 'slouching';
      smoothedSeverity = smoothedMetrics.trunkFlexion > 35 ? 'high' : 'medium';
      smoothedMessage = `Slouching detected (${smoothedMetrics.trunkFlexion.toFixed(1)}° trunk flexion)`;
    } else {
      smoothedStatus = 'borderline';
      smoothedSeverity = 'low';
      smoothedMessage = 'Posture needs improvement';
    }

    const smoothedAnalysis: PostureAnalysis = {
      status: smoothedStatus,
      metrics: smoothedMetrics,
      severity: smoothedSeverity,
      message: smoothedMessage,
    };

    setSmoothedAnalysis(smoothedAnalysis);
    
    if (onPostureUpdate) {
      onPostureUpdate(smoothedAnalysis);
    }
  }, [landmarks, onPostureUpdate, angleFilter, trunkFilter, baseline, neckHistory, cvaFilter, forwardHeadFilter, trunkFilterEuro, pelvicFilter, elbowFilter, wristFilter, kneeFilter]);

  // Calibration function
  const calibrateBaseline = useCallback(() => {
    if (!sittingMetrics) return;
    
    const pelvicTilt = sittingMetrics.pelvicTiltDegDelta.value;
    const shoulderWidth = analysis?.metrics.shoulderWidth || 0;
    
    setBaseline({ pelvicTilt, shoulderWidth });
  }, [sittingMetrics, analysis]);

  useEffect(() => {
    analyzeCurrentPosture();
  }, [analyzeCurrentPosture]);

  if (!analysis || !smoothedAnalysis) {
    return null;
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'good':
        return '✅';
      case 'slouching':
        return '⚠️';
      case 'head-forward':
        return '❌';
      default:
        return '⚪';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'good':
        return 'status-good';
      case 'slouching':
        return 'status-slouching';
      case 'head-forward':
        return 'status-head-forward';
      default:
        return 'status-borderline';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'confidence-high';
    if (confidence >= 0.6) return 'confidence-medium';
    return 'confidence-low';
  };

  const getConfidenceLabel = (confidence: number) => {
    if (confidence >= 0.8) return 'High';
    if (confidence >= 0.6) return 'Medium';
    return 'Low';
  };

  return (
    <div className="space-y-4">
      {/* Real-time Angle Display - Compact */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-3 border-2 border-blue-200">
        <h3 className="text-lg font-bold text-gray-800 mb-2 text-center">Live Posture Angles</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-xl font-bold text-blue-600">
              {smoothedAnalysis.metrics.headNeckAngle.toFixed(1)}°
            </div>
            <div className="text-xs text-gray-600">Neck Angle</div>
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-purple-600">
              {smoothedAnalysis.metrics.trunkFlexion.toFixed(1)}°
            </div>
            <div className="text-xs text-gray-600">Trunk Angle</div>
          </div>
        </div>
      </div>

      {/* Main Status Display - Compact */}
      <div className="bg-white rounded-lg shadow-lg p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800">Posture Status</h3>
          <div className={`status-badge ${getStatusColor(smoothedAnalysis.status)}`}>
            <span className="mr-2">{getStatusIcon(smoothedAnalysis.status)}</span>
            {smoothedAnalysis.status.charAt(0).toUpperCase() + smoothedAnalysis.status.slice(1).replace('-', ' ')}
          </div>
        </div>

        <p className="text-gray-600 mb-3 text-sm">{smoothedAnalysis.message}</p>

        {/* Confidence Bar */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-600 mb-1">
            <span>Tracking Quality</span>
            <span>{getConfidenceLabel(smoothedAnalysis.metrics.confidence)}</span>
          </div>
          <div className="confidence-bar">
            <div
              className={`confidence-fill ${getConfidenceColor(smoothedAnalysis.metrics.confidence)}`}
              style={{ width: `${smoothedAnalysis.metrics.confidence * 100}%` }}
            />
          </div>
        </div>
      </div>

      {/* Main Posture Angles Display */}
      <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4 text-center">Posture Analysis</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Neck Angle */}
          <div className="text-center">
            <div className="mb-2">
              <h4 className="text-lg font-semibold text-gray-700">Neck Angle</h4>
              <p className="text-sm text-gray-500">Head alignment with vertical</p>
            </div>
            <div className="relative inline-block">
              <div className="text-4xl font-bold text-blue-600 mb-2">
                {smoothedAnalysis.metrics.headNeckAngle.toFixed(1)}°
              </div>
              <div className="w-32 h-2 bg-gray-200 rounded-full mx-auto">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    smoothedAnalysis.metrics.headNeckAngle <= 15 ? 'bg-green-500' :
                    smoothedAnalysis.metrics.headNeckAngle <= 25 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(100, (smoothedAnalysis.metrics.headNeckAngle / 30) * 100)}%` }}
                />
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {smoothedAnalysis.metrics.headNeckAngle <= 15 ? '✅ Good' : 
                 smoothedAnalysis.metrics.headNeckAngle <= 25 ? '⚠️ Moderate' : '❌ Poor'}
              </div>
            </div>
          </div>

          {/* Trunk Angle */}
          <div className="text-center">
            <div className="mb-2">
              <h4 className="text-lg font-semibold text-gray-700">Trunk Angle</h4>
              <p className="text-sm text-gray-500">Spine alignment with vertical</p>
            </div>
            <div className="relative inline-block">
              {smoothedAnalysis.metrics.spineVisible ? (
                <div className="text-4xl font-bold text-purple-600 mb-2">
                  {smoothedAnalysis.metrics.trunkFlexion.toFixed(1)}°
                </div>
              ) : (
                <div className="text-4xl font-bold text-gray-500 mb-2">
                  Spine not in view
                </div>
              )}
              <div className="w-32 h-2 bg-gray-200 rounded-full mx-auto">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    !smoothedAnalysis.metrics.spineVisible ? 'bg-gray-400' :
                    smoothedAnalysis.metrics.trunkFlexion <= 15 ? 'bg-green-500' :
                    smoothedAnalysis.metrics.trunkFlexion <= 25 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${!smoothedAnalysis.metrics.spineVisible ? 0 : Math.min(100, (smoothedAnalysis.metrics.trunkFlexion / 40) * 100)}%` }}
                />
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {!smoothedAnalysis.metrics.spineVisible ? '⚪ Spine not in view' :
                 smoothedAnalysis.metrics.trunkFlexion <= 15 ? '✅ Good' : 
                 smoothedAnalysis.metrics.trunkFlexion <= 25 ? '⚠️ Moderate' : '❌ Poor'}
              </div>
            </div>
          </div>
        </div>

        {/* Forward Head Position */}
        <div className="mt-6">
          <div className="text-center">
            <div className="mb-2">
              <h4 className="text-lg font-semibold text-gray-700">Forward Head Position</h4>
              <p className="text-sm text-gray-500">Head forward from neutral position</p>
            </div>
            <div className="relative inline-block">
              <div className="text-4xl font-bold text-orange-600 mb-2">
                {smoothedAnalysis.metrics.headNeckAngle.toFixed(1)}°
              </div>
              <div className="w-32 h-2 bg-gray-200 rounded-full mx-auto">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    smoothedAnalysis.metrics.headNeckAngle <= 15 ? 'bg-green-500' :
                    smoothedAnalysis.metrics.headNeckAngle <= 25 ? 'bg-yellow-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(100, (smoothedAnalysis.metrics.headNeckAngle / 30) * 100)}%` }}
                />
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {smoothedAnalysis.metrics.headNeckAngle <= 15 ? '✅ Good' : 
                 smoothedAnalysis.metrics.headNeckAngle <= 25 ? '⚠️ Moderate' : '❌ Poor'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Comprehensive Sitting Metrics - Compact */}
      {sittingMetrics && (
        <div className="space-y-4">
          {/* Ergonomic Score - Compact Display */}
          <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4 border-2 border-green-200">
            <div className="text-center">
              <h3 className="text-lg font-bold text-gray-800 mb-2">Ergonomic Score</h3>
              <div className="text-3xl font-bold text-green-600 mb-1">
                {sittingMetrics.ergoScore.value.toFixed(0)}
              </div>
              <div className="text-sm text-gray-600">
                {sittingMetrics.ergoScore.value >= 80 ? 'Excellent' : 
                 sittingMetrics.ergoScore.value >= 60 ? 'Good' : 
                 sittingMetrics.ergoScore.value >= 40 ? 'Fair' : 'Needs Improvement'}
              </div>
            </div>
          </div>

          {/* Core Posture Metrics - Compact Grid */}
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              title="CVA Angle"
              value={sittingMetrics.cvaDeg.value}
              unit="°"
              level={sittingMetrics.cvaDeg.level}
              visible={sittingMetrics.cvaDeg.visible}
              description="Head-neck alignment"
              tip="Higher angle = better alignment"
            />
            <MetricCard
              title="Forward Head"
              value={sittingMetrics.forwardHeadNorm.value * 100}
              unit="%"
              level={sittingMetrics.forwardHeadNorm.level}
              visible={sittingMetrics.forwardHeadNorm.visible}
              description="Head forward position"
              tip="Lower % = better alignment"
            />
            <MetricCard
              title="Trunk Angle"
              value={sittingMetrics.trunkDeg.value}
              unit="°"
              level={sittingMetrics.trunkDeg.level}
              visible={sittingMetrics.trunkDeg.visible}
              description="Spine alignment"
              tip="Lower angle = better posture"
            />
            <MetricCard
              title="Pelvic Tilt"
              value={Math.abs(sittingMetrics.pelvicTiltDegDelta.value)}
              unit="°"
              level={sittingMetrics.pelvicTiltDegDelta.level}
              visible={sittingMetrics.pelvicTiltDegDelta.visible}
              description="Pelvis alignment"
              tip="Lower angle = better alignment"
            />
          </div>

          {/* Upper Limb Ergonomics - Compact */}
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              title="Elbow Angle"
              value={sittingMetrics.elbowDeg.value}
              unit="°"
              level={sittingMetrics.elbowDeg.level}
              visible={sittingMetrics.elbowDeg.visible}
              description="Elbow joint angle"
              tip="90-110° is ideal for typing"
            />
            <MetricCard
              title="Wrist Extension"
              value={sittingMetrics.wristExtDeg.value}
              unit="°"
              level={sittingMetrics.wristExtDeg.level}
              visible={sittingMetrics.wristExtDeg.visible}
              description="Wrist extension angle"
              tip="Lower angle = better wrist position"
            />
          </div>

          {/* Lower Body Support - Compact */}
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              title="Knee Angle"
              value={sittingMetrics.kneeDeg.value}
              unit="°"
              level={sittingMetrics.kneeDeg.level}
              visible={sittingMetrics.kneeDeg.visible}
              description="Knee joint angle"
              tip="90° is ideal for seated position"
            />
            <div className="bg-white rounded-lg shadow p-4">
              <h4 className="font-medium text-gray-700 mb-2">Feet Supported</h4>
              <div className={`text-2xl font-bold ${sittingMetrics.feetSupported.value ? 'text-green-600' : 'text-red-600'}`}>
                {sittingMetrics.feetSupported.visible ? (sittingMetrics.feetSupported.value ? 'Yes' : 'No') : 'N/A'}
              </div>
              <div className="text-sm text-gray-500">
                {sittingMetrics.feetSupported.visible ? 'Foot support status' : 'Feet not visible'}
              </div>
            </div>
          </div>

          {/* Stability Metrics - Compact */}
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              title="Neck Variability"
              value={sittingMetrics.neckVarDegPerMin.value}
              unit="°/min"
              level={sittingMetrics.neckVarDegPerMin.level}
              visible={sittingMetrics.neckVarDegPerMin.visible}
              description="Neck movement stability"
              tip="Lower variability = more stable posture"
            />
            <div className="bg-white rounded-lg shadow p-4">
              <h4 className="font-medium text-gray-700 mb-2">Calibration</h4>
              <div className="text-sm text-gray-600 mb-2">
                {baseline ? 'Baseline captured' : 'No baseline set'}
              </div>
              <button
                onClick={calibrateBaseline}
                className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                disabled={!sittingMetrics}
              >
                {baseline ? 'Recalibrate' : 'Set Baseline'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Basic Metrics - Compact */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-lg shadow p-3">
          <h4 className="font-medium text-gray-700 mb-1 text-sm">Neck Angle</h4>
          <div className="text-lg font-bold text-blue-600">
            {smoothedAnalysis.metrics.headNeckAngle.toFixed(1)}°
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-3">
          <h4 className="font-medium text-gray-700 mb-1 text-sm">Trunk Angle</h4>
          {smoothedAnalysis.metrics.spineVisible ? (
            <div className="text-lg font-bold text-purple-600">
              {smoothedAnalysis.metrics.trunkFlexion.toFixed(1)}°
            </div>
          ) : (
            <div className="text-lg font-bold text-gray-500">
              N/A
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-3">
          <h4 className="font-medium text-gray-700 mb-1 text-sm">Confidence</h4>
          <div className="text-lg font-bold text-green-600">
            {(smoothedAnalysis.metrics.confidence * 100).toFixed(0)}%
          </div>
        </div>
      </div>

      {/* Tips and Recommendations - Compact */}
      <div className="bg-blue-50 rounded-lg p-3">
        <h4 className="font-medium text-blue-800 mb-2 text-sm">💡 Quick Tips</h4>
        <ul className="text-xs text-blue-700 space-y-1">
          {smoothedAnalysis.status === 'good' && (
            <li>• Keep up the great posture! Remember to take breaks every 30 minutes.</li>
          )}
          {smoothedAnalysis.status === 'slouching' && (
            <>
              <li>• Sit up straight with your shoulders back and down</li>
              <li>• Keep your feet flat on the floor</li>
              <li>• Adjust your chair height so your knees are at 90 degrees</li>
            </>
          )}
          {smoothedAnalysis.status === 'head-forward' && (
            <>
              <li>• Bring your head back over your shoulders</li>
              <li>• Adjust your monitor height to eye level</li>
              <li>• Strengthen your neck and upper back muscles</li>
            </>
          )}
          {smoothedAnalysis.status === 'borderline' && (
            <>
              <li>• Make small adjustments to improve your posture</li>
              <li>• Focus on keeping your head aligned with your spine</li>
              <li>• Take regular breaks to stretch and move around</li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
}

// MetricCard component for displaying individual metrics
interface MetricCardProps {
  title: string;
  value: number;
  unit: string;
  level: "green"|"yellow"|"red"|"na";
  visible: boolean;
  description: string;
  tip: string;
}

function MetricCard({ title, value, unit, level, visible, description, tip }: MetricCardProps) {
  const getLevelColor = (level: string) => {
    switch (level) {
      case 'green': return 'text-green-600';
      case 'yellow': return 'text-yellow-600';
      case 'red': return 'text-red-600';
      default: return 'text-gray-500';
    }
  };

  const getLevelBgColor = (level: string) => {
    switch (level) {
      case 'green': return 'bg-green-500';
      case 'yellow': return 'bg-yellow-500';
      case 'red': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-3 relative group">
      <h4 className="font-medium text-gray-700 mb-1 text-sm">{title}</h4>
      <div className={`text-lg font-bold ${getLevelColor(level)}`}>
        {visible ? `${value.toFixed(1)}${unit}` : 'N/A'}
      </div>
      <div className="text-xs text-gray-500 mb-2">
        {visible ? description : 'Not visible'}
      </div>
      
      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-1.5 mb-1">
        <div 
          className={`h-1.5 rounded-full transition-all duration-300 ${getLevelBgColor(level)}`}
          style={{ 
            width: visible ? `${Math.min(100, Math.max(0, (value / 100) * 100))}%` : '0%' 
          }}
        />
      </div>
      
      {/* Tooltip */}
      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
        {tip}
      </div>
    </div>
  );
}
