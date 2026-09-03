"use client";
import { ThemeProvider } from "next-themes";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import dynamic from "next/dynamic";
const GlobalCommandPalette = dynamic(() => import("@/components/search/command-palette").then((m) => m.GlobalCommandPalette), { ssr: false });

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <NuqsAdapter>
        <TooltipProvider>{children}</TooltipProvider>
        <GlobalCommandPalette />
        <Toaster richColors position="bottom-center" />
      </NuqsAdapter>
    </ThemeProvider>
  );
}
