import type { Metadata, Viewport } from 'next'
import { Space_Grotesk } from 'next/font/google'
import './globals.css'
import BottomNav from '@/components/BottomNav'

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Webbes',
  description: 'Finance dashboard — Webbes Digital Agency',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Webbes' },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#000000',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${spaceGrotesk.variable} font-sans bg-black text-white antialiased`}>
        {children}
        <BottomNav />
      </body>
    </html>
  )
}
