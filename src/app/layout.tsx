import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Source_Sans_3 } from "next/font/google";
import { siteUrl } from "./site-url";
import "./globals.css";

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  weight: ["400", "500", "600"],
  subsets: ["latin"],
});

const DESCRIPTION =
  "Student-focused AI project manager for class projects, hackathons, and portfolio apps. A Manager Agent clarifies scope, drafts requirements, assigns specialists, and waits for your approval.";

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: { default: "ProjectPilot AI", template: "%s · ProjectPilot AI" },
  description: DESCRIPTION,
  applicationName: "ProjectPilot AI",
  openGraph: {
    type: "website",
    siteName: "ProjectPilot AI",
    title: "ProjectPilot AI",
    description: DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary",
    title: "ProjectPilot AI",
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0f766e" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1117" },
  ],
  colorScheme: "light dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${sourceSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
