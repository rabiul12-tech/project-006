import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, JetBrains_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: 'STOCKORA ERP — Inventory & Warehouse Management',
  description:
    'Every Product. Every Movement. Under Control. Enterprise browser-local inventory, multi-warehouse, purchasing, receiving, and stock movement ledger system.',
  openGraph: {
    title: 'STOCKORA ERP — Inventory & Warehouse Management',
    description:
      'Every Product. Every Movement. Under Control. Enterprise browser-local inventory, multi-warehouse, purchasing, receiving, and stock movement ledger system.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'STOCKORA ERP — Inventory & Warehouse Management',
    description:
      'Every Product. Every Movement. Under Control. Enterprise browser-local inventory, multi-warehouse, purchasing, receiving, and stock movement ledger system.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${plusJakarta.variable} ${jetbrainsMono.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
