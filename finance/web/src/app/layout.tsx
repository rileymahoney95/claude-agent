import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Sidebar } from "@/components/layout/sidebar";
import { MobileHeader } from "@/components/layout/mobile-header";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Finance Dashboard",
  description: "Personal finance portfolio management dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          <div className="flex min-h-screen">
            {/* Desktop sidebar - hidden on mobile */}
            <Sidebar className="hidden lg:flex" />

            {/* Mobile header - shown only on mobile */}
            <MobileHeader className="lg:hidden" />

            {/* Main content - offset for mobile header, full on desktop */}
            <main className="flex-1 overflow-auto bg-background pt-14 lg:pt-0">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
