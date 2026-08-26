import type { Metadata } from "next";
import { Open_Sans, Poppins, Raleway } from "next/font/google";
import "./globals.css";

/**
 * The school's own typefaces, self-hosted by next/font rather than requested
 * from Google at runtime. Same visual identity, no third-party request on page
 * load, and no dependency on an external service the school would inherit.
 */
const raleway = Raleway({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-raleway",
  display: "swap",
});

const openSans = Open_Sans({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-open-sans",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-poppins",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "1A1 Research Cell — Lahore Grammar School",
    template: "%s — 1A1 Research Cell",
  },
  description:
    "The research archive and publication platform of the 1A1 Research Cell, Lahore Grammar School 1-A-1, Lahore.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${raleway.variable} ${openSans.variable} ${poppins.variable}`}
      >
        {children}
      </body>
    </html>
  );
}
