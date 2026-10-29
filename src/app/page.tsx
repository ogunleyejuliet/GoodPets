import type { Metadata } from 'next';
import LandingContent from './LandingContent';

export const metadata: Metadata = {
  title: 'Good Pets | Premium Pet Care in Lagos',
  description:
    'From grooming and playful daycare to comfortable overnight stays, Good Pets provides premium pet care in Victoria Island, Lagos. Your Pet’s Favourite Place.',
  keywords: [
    'pet care Lagos',
    'dog grooming Victoria Island',
    'cat boarding Lagos',
    'pet daycare Lagos',
    'Good Pets Lagos',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Good Pets | Premium Dog & Cat Care in Lagos',
    description:
      'From grooming and playful daycare to comfortable overnight boarding in Victoria Island, Lagos. Your Pet’s Favourite Place.',
    url: '/',
    siteName: 'Good Pets',
    images: [
      {
        url: '/images/hero-grooming.jpg',
        width: 1200,
        height: 630,
        alt: 'Good Pets Dog Grooming in Victoria Island, Lagos',
      },
    ],
    locale: 'en_NG',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Good Pets | Premium Dog & Cat Care in Lagos',
    description:
      'From grooming and playful daycare to comfortable overnight stays in Victoria Island, Lagos.',
    images: ['/images/hero-grooming.jpg'],
  },
};

export default function HomePage() {
  return <LandingContent />;
}
