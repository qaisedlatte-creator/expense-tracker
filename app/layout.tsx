import type { Metadata, Viewport } from 'next'
import { Space_Grotesk } from 'next/font/google'
import './globals.css'
import BottomNav from '@/components/BottomNav'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-space-grotesk',
})

export const metadata: Metadata = {
  title: 'Webbes Dashboard',
  description: 'Finance dashboard for Webbes digital agency',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#000000',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="bg-black">
      <body className={`${spaceGrotesk.variable} font-sans antialiased bg-black text-white`}>
        <main className="min-h-screen bg-black">
          {children}
        </main>
        <BottomNav />
      </body>
    </html>
  )
}
