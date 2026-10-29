import type { Metadata } from 'next';
import { Nunito } from 'next/font/google';
import './globals.css';

const nunito = Nunito({
  subsets: ['latin'],
  variable: '--font-nunito',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'),
  title: {
    default: 'Good Pets | Premium Pet Care in Lagos',
    template: '%s | Good Pets',
  },
  description:
    'Good Pets is a web app where pet owners in Victoria Island, Lagos book and pay for dog and cat grooming, daycare and boarding, ask an AI assistant questions, and where front desk and manager staff run arrivals, pickups and settings.',
  icons: {
    icon: '/images/favicon.svg',
    shortcut: '/images/favicon.svg',
    apple: '/images/favicon.svg',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="light" className={nunito.variable}>
      <body>{children}</body>
    </html>
  );
}
