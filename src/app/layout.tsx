import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

export const metadata: Metadata = {
  title: '9.81',
  description: 'Street Lifting performance tracker — strength, progression, nutrition.',
  applicationName: '9.81',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    title: '9.81',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#0f0f0e',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="9.81" />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body
        className={`font-sans bg-slate-50 text-slate-900 min-h-screen antialiased ${geist.variable} ${geistMono.variable}`}
      >
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
