import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DBX — Direct Box USA | E-commerce Operating System",
  description:
    "US infrastructure for sellers scaling Amazon, Walmart, TikTok Shop, Shopify, eBay & Mercado Livre. AI, logistics, repricing, sourcing — one operating system.",
  openGraph: {
    title: "DBX — Scale US Marketplaces Like a Machine",
    description: "Bundles from $59. Full stack: AI listings, Buy Box repricing, leads, compliance, logistics.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body className="min-h-screen bg-zinc-950 font-sans text-zinc-100 antialiased">{children}</body>
    </html>
  );
}
