import type { Metadata } from "next";
import Link from "next/link";
import { HealthBadge } from "@/components/HealthBadge";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tenet",
  description: "Turn an AI policy into typed rules, test each rule the way its type demands, and report where behavior departs from policy.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={cn("h-full antialiased", "font-sans")}>
      <body className="flex min-h-full flex-col bg-zinc-50 text-zinc-900">
        <TooltipProvider>
          <header className="border-b border-zinc-200 bg-white">
            <nav className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-6">
              <Link href="/" className="text-lg font-semibold tracking-tight">
                Tenet
              </Link>
              <Link href="/" className="text-sm text-zinc-600 hover:text-zinc-900">
                Policies
              </Link>
              <Link href="/runs" className="text-sm text-zinc-600 hover:text-zinc-900">
                Runs
              </Link>
              <span className="ml-auto hidden text-xs text-zinc-400 sm:block">Typed tests for AI policies</span>
            </nav>
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">{children}</main>
          <footer className="border-t border-zinc-200 bg-white">
            <div className="mx-auto max-w-6xl px-6 py-3 text-xs text-zinc-500">
              <HealthBadge />
            </div>
          </footer>
        </TooltipProvider>
      </body>
    </html>
  );
}
