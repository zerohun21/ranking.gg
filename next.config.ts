import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    deviceSizes: [640, 828, 1200, 1920],
    imageSizes: [48, 96, 160, 256, 400],
    remotePatterns: [
      { protocol: "https", hostname: "image.tmdb.org" },
      { protocol: "https", hostname: "media.rawg.io" },
      { protocol: "https", hostname: "*.supabase.co" },
      { protocol: "https", hostname: "is1-ssl.mzstatic.com" },
      { protocol: "https", hostname: "*.mzstatic.com" },
      { protocol: "https", hostname: "books.google.com" },
      { protocol: "https", hostname: "books.googleusercontent.com" },
      { protocol: "https", hostname: "api.dicebear.com" },
      { protocol: "https", hostname: "kr-a.kakaopagecdn.com" },
      { protocol: "https", hostname: "*.kakaocdn.net" },
      { protocol: "https", hostname: "image.aladin.co.kr" },
      { protocol: "https", hostname: "image-comic.pstatic.net" },
      { protocol: "https", hostname: "shared-comic.pstatic.net" },
      { protocol: "https", hostname: "cdn.jsdelivr.net" },
      { protocol: "http", hostname: "127.0.0.1", port: "54321" },
    ],
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  experimental: {
    serverActions: { bodySizeLimit: "2mb" },
  },
  htmlLimitedBots: /Chrome-Lighthouse|Googlebot|bingbot|Yeti|Daum|Twitterbot|facebookexternalhit|Slackbot|Discordbot|LinkedInBot|Applebot|kakaotalk-scrap/i,
};

export default withNextIntl(nextConfig);
