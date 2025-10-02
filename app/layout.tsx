import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Nu SkyNet - Advanced AI Assistant | Nuskynet.com',
  description: 'Nu SkyNet - Advanced AI Assistant powered by cutting-edge artificial intelligence. Chat with Nu SkyNet at Nuskynet.com',
  keywords: 'AI, artificial intelligence, chatbot, Nu SkyNet, Nuskynet.com, AI assistant',
  openGraph: {
    title: 'Nu SkyNet - Advanced AI Assistant',
    description: 'Experience the power of Nu SkyNet, an advanced AI assistant available at Nuskynet.com',
    type: 'website',
    url: 'https://nuskynet.com',
  },
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
