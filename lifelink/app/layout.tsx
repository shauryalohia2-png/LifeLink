import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'LifeLink — Connecting People. Supporting Lives.',
  description: 'Discover nearby mapped blood banks, prepare donor registration details, and request organ donation consultations through authorized pathways.'
};
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
