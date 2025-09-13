import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import '@/styles/globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Real-Time Posture Detection',
  description: 'Monitor your posture in real-time using AI-powered pose detection with MediaPipe Tasks',
  keywords: ['posture', 'pose detection', 'health', 'wellness', 'MediaPipe', 'AI'],
  authors: [{ name: 'HTN 2025' }],
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
