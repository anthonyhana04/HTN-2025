'use client';

import { useState } from 'react';
import PoseDetection from '@/components/PoseDetection';
import { PostureAnalysis } from '@/lib/poseUtils';

export default function Home() {
  const [currentAnalysis, setCurrentAnalysis] = useState<PostureAnalysis | null>(null);
  const [showInstructions, setShowInstructions] = useState(true);

  const handlePostureUpdate = (analysis: PostureAnalysis) => {
    setCurrentAnalysis(analysis);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-4">
            Real-Time Posture Detection
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Monitor your posture in real-time using AI-powered pose detection. 
            Get instant feedback and tips to improve your sitting posture.
          </p>
        </div>

        {/* Instructions Modal */}
        {showInstructions && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-md mx-4">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                Getting Started
              </h2>
              <div className="space-y-3 text-gray-600">
                <p>1. Allow camera access when prompted</p>
                <p>2. Position yourself in front of the camera</p>
                <p>3. Click "Start Detection" to begin monitoring</p>
                <p>4. Keep your entire body visible in the frame</p>
                <p>5. Ensure good lighting for best results</p>
              </div>
              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setShowInstructions(false)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Got it!
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
                >
                  Refresh
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="max-w-6xl mx-auto">
          <PoseDetection onPostureUpdate={handlePostureUpdate} />
        </div>

        {/* Footer Info */}
        <div className="mt-12 text-center text-gray-500">
          <p className="mb-2">
            Built with Next.js 14, MediaPipe Tasks, and TypeScript
          </p>
          <p className="text-sm">
            This app runs entirely in your browser - no data is sent to external servers.
          </p>
        </div>
      </div>
    </main>
  );
}
