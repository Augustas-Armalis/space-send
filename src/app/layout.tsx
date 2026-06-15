import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/shell/Providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const metadata: Metadata = {
  title: "Space Send — Transmit anything. Instantly.",
  description:
    "A next-gen file transfer. Drop files into the cloud or Beam them live, peer-to-peer, straight from your device. No login. End-to-end encrypted. Built by Contles.",
  applicationName: "Space Send",
  metadataBase: new URL("https://spacesend.app"),
  openGraph: {
    title: "Space Send — Transmit anything. Instantly.",
    description: "Drop files into the void, or Beam them live from your device. No login.",
    siteName: "Space Send",
    type: "website",
  },
  twitter: { card: "summary_large_image", title: "Space Send", description: "Transmit anything. Instantly." },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Space Send" },
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#04040a",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`} suppressHydrationWarning>
      <body className="font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
