import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Book a Service',
  description:
    'Book dog and cat grooming, daycare, and boarding with live availability at Good Pets in Victoria Island, Lagos.',
  robots: {
    index: false,
    follow: true,
  },
};

export default function BookLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

