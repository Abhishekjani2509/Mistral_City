/**
 * Root layout
 */

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mistral City Demo",
  description: "Demo repo for Mistral City",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
