import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from '@/components/ui/sonner';

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' });

export const metadata: Metadata = {
  title: 'Street Flow',
  description: 'Street Lifting App - Force & Progression',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <body
        className={`font-sans bg-slate-50 text-slate-900 min-h-screen antialiased ${geist.variable} ${geistMono.variable}`}
      >
        {children}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
