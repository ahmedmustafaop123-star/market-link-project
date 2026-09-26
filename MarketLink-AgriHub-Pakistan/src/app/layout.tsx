import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "@/components/providers";

export const metadata: Metadata = {
  title: {
    default: "MARKETLINK AGRI-HUB | Farm to Market",
    template: "%s | MARKETLINK AGRI-HUB",
  },
  description: "MARKETLINK AGRI-HUB connects Pakistani farmers directly with commercial buyers through graded crop listings, transparent mandi rates, secure bidding, escrow and shipment tracking.",
  applicationName: "MARKETLINK AGRI-HUB",
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
    apple: "/apple-icon.png",
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#01411c" },
    { media: "(prefers-color-scheme: dark)", color: "#003e27" },
  ],
};

const themeScript = `(function(){try{var t=localStorage.getItem('ml-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}var l=localStorage.getItem('ml-lang');if(l==='ur'){document.documentElement.dir='rtl';document.documentElement.lang='ur'}}catch(e){}})();`;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
