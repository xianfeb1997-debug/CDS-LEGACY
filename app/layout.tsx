import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Learning Design Studio",
  description:
    "Professional lesson design, LAS, and presentation workspace for modern classrooms."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
