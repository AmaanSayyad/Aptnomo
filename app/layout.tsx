import type { Metadata } from "next";
import { Geist, Geist_Mono, Orbitron } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://nomo.vercel.app'),
  title: "Nomo - Binary Options on Aptos",
  description:
    "On-chain binary options trading dApp on Aptos mainnet. Powered by Pyth Hermes price attestations and Supabase. Oracle-bound resolution, minimal trust.",
  keywords: [
    "binary options",
    "crypto trading",
    "Pyth oracle",
    "Aptos",
    "APT",
    "Web3",
    "prediction",
  ],
  icons: {
    icon: "/creditnomo-logo.ico",
    shortcut: "/creditnomo-logo.ico",
    apple: "/creditnomo-logo.ico",
  },
  openGraph: {
    title: "Nomo - Binary Options on Aptos",
    description:
      "On-chain binary options trading dApp on Aptos mainnet. Powered by Pyth Hermes and Supabase. Oracle-bound resolution, minimal trust.",
    images: [{ url: '/creditnomo-logo.png', width: 512, height: 512, alt: 'Nomo' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: "Nomo - Binary Options on Aptos",
    description: "On-chain binary options on Aptos mainnet. Oracle-bound resolution, minimal trust.",
    images: ['/creditnomo-logo.png'],
  },
};

import { Header } from "@/components/Header";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${orbitron.variable} antialiased bg-[#02040a] text-white h-screen overflow-hidden flex flex-col`}
      >
        <Providers>
          <Header />
          <main className="flex-1 relative overflow-y-auto overflow-x-hidden">
            {children}
          </main>
        </Providers>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
