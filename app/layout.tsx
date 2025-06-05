import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.scss";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Converse",
  description: "Open source XMPP chat",
  openGraph: {
    title: 'Converse',
    description: 'Open source, decentralized and encrypted chat for the web',
    images: 'https://conversejs.org/logo/conversejs-transparent.svg',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased converse-website`}
      >
        {children}
      </body>
    </html>
  );
}
