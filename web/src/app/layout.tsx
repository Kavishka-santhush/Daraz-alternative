import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import Providers from './providers';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  title: {
    default: 'MarketPlace — Shop Everything, From Everyone',
    template: '%s | MarketPlace',
  },
  description:
    'A multi-vendor marketplace: electronics, fashion, home, beauty and more from thousands of sellers. Fast delivery, secure payments, easy returns.',
  keywords: ['marketplace', 'online shopping', 'electronics', 'fashion', 'daraz'],
  applicationName: 'MarketPlace',
};

export const viewport: Viewport = {
  themeColor: '#f57224',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
