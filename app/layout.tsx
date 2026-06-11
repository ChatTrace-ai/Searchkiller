import type { Metadata } from 'next';
import { EB_Garamond } from 'next/font/google';
import './globals.css';

const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
});

export const metadata: Metadata = {
  title: "Laplace's Demon | AI Prediction Explorer",
  description: 'Explore evidence-based forecasts, probabilities, and source-backed analysis.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={ebGaramond.variable}>
      <body className="min-h-screen bg-laplace-parchment text-[#2C2417] antialiased">
        {children}
      </body>
    </html>
  );
}
