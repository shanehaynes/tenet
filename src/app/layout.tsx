import type { Metadata } from "next";
import "./globals.css";
import { cn } from "@/lib/utils";


export const metadata: Metadata = {
  title: "Tenet",
  description: "Turn an AI policy into typed rules, test each rule the way its type demands, and report where behavior departs from policy.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn("h-full antialiased", "font-sans")}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
