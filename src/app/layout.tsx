import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tenet",
  description: "Turn an AI policy into typed rules, test each rule the way its type demands, and report where behavior departs from policy.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
