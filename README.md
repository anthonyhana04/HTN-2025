# Real-Time Posture Detection

A Next.js 14 application that uses MediaPipe Tasks to detect and analyze posture in real-time from your webcam. Get instant feedback on your sitting posture with AI-powered pose detection.

## Features

- 🎥 **Real-time webcam pose detection** using MediaPipe Tasks
- 📊 **Live posture analysis** with angle calculations and classification
- 🎨 **Beautiful UI** with real-time skeleton overlay
- ⚡ **Performance optimized** with optional Web Worker support
- 📱 **Responsive design** that works on desktop and mobile
- 🔒 **Privacy-first** - all processing happens in your browser

## Posture Analysis

The app analyzes key metrics:

1. **Head-Neck Angle**: Measures the angle between your head and neck relative to vertical
2. **Trunk Flexion**: Measures the angle of your torso relative to vertical

### Classification

- ✅ **Good**: Trunk ≤15°
- ⚠️ **Slouching**: Trunk flexion >25°
- ⚪ **Borderline**: Other combinations

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Pose Detection**: MediaPipe Tasks (@mediapipe/tasks-vision)
- **Styling**: Tailwind CSS
- **Performance**: Web Workers for off-main-thread processing

## Getting Started

### Prerequisites

- Node.js 18+ 
- Modern browser with WebRTC support
- HTTPS or localhost (required for camera access)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd HTN-2025
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Production Build

```bash
npm run build
npm start
```

## Usage

1. **Allow camera access** when prompted
2. **Position yourself** in front of the camera with good lighting
3. **Click "Start Detection"** to begin monitoring
4. **Keep your entire body visible** in the frame for best results
5. **Follow the posture tips** displayed in real-time

## Browser Compatibility

- Chrome 80+
- Firefox 75+
- Safari 13+
- Edge 80+

## Performance Tips

- Use a well-lit environment for better landmark detection
- Ensure your entire upper body is visible in the frame
- Close other camera-using applications
- Use a modern device with good processing power for smooth performance

## Architecture

```
/app
  page.tsx                # Main pose detection page
  layout.tsx              # Root layout with metadata
/components
  PoseDetection.tsx       # Webcam, MediaPipe, canvas overlay
  PostureAnalyzer.tsx     # Angle calculations & classification
/lib
  poseUtils.ts            # Types, math utils, analysis functions
/workers
  poseWorker.ts           # Optional Web Worker for inference
/styles
  globals.css             # Global styles and Tailwind imports
```

## Development

### Key Components

- **PoseDetection**: Handles webcam access, MediaPipe initialization, and real-time detection
- **PostureAnalyzer**: Processes landmarks to calculate posture metrics and provide feedback
- **poseUtils**: Contains all the math utilities and analysis algorithms

### MediaPipe Integration

The app uses the latest MediaPipe Tasks API with the Pose Landmarker model:

- 33 pose landmarks with image and world coordinates
- Real-time video mode with GPU acceleration
- Confidence-based landmark filtering
- Skeleton visualization with connections

### Performance Optimizations

- RequestAnimationFrame for smooth video processing
- Smoothing filters to reduce jitter in posture analysis
- Optional Web Worker for off-main-thread inference
- Efficient canvas rendering with landmark confidence gating

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [MediaPipe](https://mediapipe.dev/) for the pose detection technology
- [Next.js](https://nextjs.org/) for the React framework
- [Tailwind CSS](https://tailwindcss.com/) for styling
