import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DH Global AI",
  description: "DH Global AI running locally on Ollama",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}