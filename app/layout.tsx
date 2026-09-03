import type { Metadata, Viewport } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { Providers } from "@/components/providers";
import "./globals.css";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const PRETENDARD = "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: "RANKING.GG — 모든 콘텐츠 티어표", template: "%s | RANKING.GG" },
  description: "웹툰·영화·드라마·애니·게임·음악·도서를 op.gg 스타일 티어표로. 별점 주고, 대결 투표하고, 순위를 바꿔보세요.",
  openGraph: { siteName: "RANKING.GG", type: "website", locale: "ko_KR" },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#1c1c1f",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();
  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://image.tmdb.org" />
        {/* Pretendard 를 렌더 비차단으로 로드 (시스템 폰트로 먼저 그리고 swap) */}
        <link rel="preload" as="style" href={PRETENDARD} crossOrigin="anonymous" />
        <noscript>
          <link rel="stylesheet" href={PRETENDARD} crossOrigin="anonymous" />
        </noscript>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var l=document.createElement('link');l.rel='stylesheet';l.href='${PRETENDARD}';l.crossOrigin='anonymous';document.head.appendChild(l);})();`,
          }}
        />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
