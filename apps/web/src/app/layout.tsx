import type { Metadata } from "next";
import { Newsreader, Jost } from "next/font/google";
import "./globals.css";
import { AppProvider } from "../context/AppContext";
import PageViewTracker from "../components/analytics/PageViewTracker";
import { StoreConfigProvider } from "../context/StoreConfigContext";

/**
 * The two faces of the Himalayan redesign.
 *
 * Newsreader carries the editorial voice, Jost everything transactional. Both
 * are variable, so no weight list is given and every weight the design uses
 * arrives in one file. Loaded through next/font rather than a stylesheet link,
 * which self-hosts them and removes the render-blocking request that a
 * <link> to Google would add to every page.
 *
 * Italic is requested explicitly: the display face uses it for the accented
 * word in a headline, and without it the browser would slant the roman.
 */
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

const jost = Jost({
  variable: "--font-jost",
  subsets: ["latin"],
  display: "swap",
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
      className={`${newsreader.variable} ${jost.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[var(--ivory)] text-[var(--ink)] font-sans">
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
