import type { Metadata } from "next";
import { Outfit, Inter } from "next/font/google";
import "./globals.css";
import { AppProvider } from "../context/AppContext";
import PageViewTracker from "../components/analytics/PageViewTracker";
import { StoreConfigProvider } from "../context/StoreConfigContext";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Country Dairy | Organic A2 Vedic Ghee & Wood-Pressed Oils",
  description: "Experience premium, traceable organic A2 Vedic Ghee and cold-pressed oils delivered fresh from farm to home. Purity verified with batch lab test reports.",
  icons: {
    icon: "/images/logo-icon.png",
    shortcut: "/images/logo-icon.png",
    apple: "/images/logo-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${outfit.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#FAF8F3] text-[#2A2A2A] font-sans">
        <StoreConfigProvider>
          <AppProvider>
            <PageViewTracker />
            {children}
          </AppProvider>
        </StoreConfigProvider>
      </body>
    </html>
  );
}
