import type { Metadata } from "next";
import "./globals.css";
import SourceParserBridge from "./source-parser-bridge";

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
      <body>
        <SourceParserBridge />
        {children}
      </body>
    </html>
  );
}
