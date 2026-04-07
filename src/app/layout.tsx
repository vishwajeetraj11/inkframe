import type { Metadata } from "next";
import { ClarityInit } from "@/components/analytics/ClarityInit";
import {
  Barlow_Condensed,
  Cormorant_Garamond,
  IBM_Plex_Mono,
  Plus_Jakarta_Sans,
  Sora,
  Source_Serif_4,
} from "next/font/google";
import "./globals.css";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-plus-jakarta-sans",
});

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-sora",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-ibm-plex-mono",
});

const sourceSerif4 = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-source-serif-4",
});

const cormorantGaramond = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-cormorant-garamond",
});

const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-barlow-condensed",
});

export const metadata: Metadata = {
  title: "Inkframe Video Editor",
  description: "Next.js + Remotion video editor for 9:16 and 16:9 exports",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const clarityId = process.env.NEXT_PUBLIC_CLARITY_ID?.trim();

  return (
    <html lang="en">
      <body
        className={`${plusJakartaSans.variable} ${sora.variable} ${ibmPlexMono.variable} ${sourceSerif4.variable} ${cormorantGaramond.variable} ${barlowCondensed.variable} antialiased`}
      >
        {clarityId ? <ClarityInit projectId={clarityId} /> : null}
        {children}
      </body>
    </html>
  );
}
