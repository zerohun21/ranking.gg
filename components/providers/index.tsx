"use client";
import { ThemeProvider } from "next-themes";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { GlobalCommandPalette } from "@/components/search/command-palette";

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
