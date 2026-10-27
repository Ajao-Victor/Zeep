import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { config } from "@/lib/config";
import { Providers } from "@/components/Providers";
import { accountHintScript } from "@/lib/account/hint";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(config.appUrl),
  title: { default: config.appName, template: `%s · ${config.appName}` },
  description:
    "Deposit ZEC. Half stays ZEC and half becomes dollars. Private AI, search, health lookups, blockchain access and an anonymous inbox are paid from that dollar balance, one zero-knowledge proof per request.",
  referrer: "no-referrer",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`}>
      <head>
        {/* Before first paint: a returning device skips the landing page (see lib/account/hint.ts). */}
        <script dangerouslySetInnerHTML={{ __html: accountHintScript }} />
      </head>
      <body className="bg-bg font-sans text-[15px] text-text antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
