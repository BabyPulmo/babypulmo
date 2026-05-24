import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Baby Pulmo — AI Pediatric Cough Diagnostic",
  description:
    "Bangla voice-first WhatsApp AI that classifies pediatric respiratory disease from a 30-second cough recording. THE INFINITY AI BUILDFEST 2026.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+Bengali:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-pulmo-50 text-slate-900">{children}</body>
    </html>
  );
}
