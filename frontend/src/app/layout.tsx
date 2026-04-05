import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CompressX · A. Smith Labs",
  description:
    "Compress LLM models for Ollama in one command. Keeps your originals, adds a -cx variant. An A. Smith Labs product by A. Smith Media.",
  authors: [{ name: "A. Smith Media", url: "https://asmith.media" }],
  creator: "A. Smith Media",
  publisher: "A. Smith Labs",
  openGraph: {
    title: "CompressX · A. Smith Labs",
    description:
      "Compress LLM models for Ollama in one command. Keeps your originals, adds a -cx variant.",
    siteName: "CompressX",
    type: "website",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
