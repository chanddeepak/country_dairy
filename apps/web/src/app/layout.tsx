import type { Metadata } from "next";
import { Newsreader, Jost } from "next/font/google";
import "./globals.css";
import { AppProvider } from "../context/AppContext";
import PageViewTracker from "../components/analytics/PageViewTracker";
import { StoreConfigProvider } from "../context/StoreConfigContext";
import { SITE_URL } from "../lib/constants";

/** Origin of the image CDN, when one is configured. */
const CDN_ORIGIN = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
      : '';
  } catch {
    return '';
  }
})();

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

const TITLE = "Country Dairy | Organic A2 Vedic Ghee & Wood-Pressed Oils";
const DESCRIPTION =
  "Experience premium, traceable organic A2 Vedic Ghee and cold-pressed oils delivered fresh from farm to home. Purity verified with batch lab test reports.";

export const metadata: Metadata = {
  /*
   * Everything read off-site needs an absolute URL — a crawler or a chat app
   * unfurling a link has no idea which host served the page. Setting this once
   * lets every other route write `openGraph.url` and `alternates.canonical` as
   * a path and have Next resolve it.
   */
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    // Routes that set their own title get " | Country Dairy" for free rather
    // than each one remembering to append it.
    template: "%s | Country Dairy",
  },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Country Dairy",
    title: TITLE,
    description: DESCRIPTION,
    url: "/",
    locale: "en_IN",
    images: [
      {
        url: "/images/closing-valley.jpg",
        width: 1672,
        height: 941,
        alt: "Himalayan pasture above the Country Dairy farm",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: ["/images/closing-valley.jpg"],
  },
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
      <head>
        {/*
          The hero banner is served from object storage on another origin, so
          the browser had to resolve DNS and negotiate TLS before it could even
          start the download — time that landed squarely in the largest paint.
          Warming the connection while the HTML is still parsing takes that off
          the critical path.
        */}
        {CDN_ORIGIN && (
          <>
            <link rel="preconnect" href={CDN_ORIGIN} crossOrigin="" />
            <link rel="dns-prefetch" href={CDN_ORIGIN} />
          </>
        )}
      </head>
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
