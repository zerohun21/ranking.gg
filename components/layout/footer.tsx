import { getTranslations } from "next-intl/server";
import { Logo } from "./logo";

export async function Footer() {
  const t = await getTranslations("common");
  return (
    <footer className="mt-10 border-t border-border bg-header text-header-foreground/80">
      <div className="mx-auto grid max-w-[1080px] gap-6 px-4 py-8 text-xs sm:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-md leading-relaxed">{t("footerDesc")}</p>
          <p className="text-white/50">{t("tmdbNotice")}</p>
        </div>
        <div className="space-y-1">
          <div className="font-semibold text-white">{t("dataSources")}</div>
          <ul className="grid grid-cols-2 gap-x-6 sm:grid-cols-1">
            <li><a className="inline-block py-1.5 hover:text-white" href="https://www.themoviedb.org/" target="_blank" rel="noreferrer">TMDB</a></li>
            <li><a className="inline-block py-1.5 hover:text-white" href="https://rawg.io/" target="_blank" rel="noreferrer">RAWG</a></li>
            <li><a className="inline-block py-1.5 hover:text-white" href="https://comic.naver.com/" target="_blank" rel="noreferrer">네이버웹툰</a></li>
            <li><a className="inline-block py-1.5 hover:text-white" href="https://webtoon.kakao.com/" target="_blank" rel="noreferrer">카카오웹툰</a></li>
            <li><a className="inline-block py-1.5 hover:text-white" href="https://music.apple.com/" target="_blank" rel="noreferrer">Apple Music</a></li>
            <li><a className="inline-block py-1.5 hover:text-white" href="https://books.google.com/" target="_blank" rel="noreferrer">Google Books</a></li>
            <li><a className="inline-block py-1.5 hover:text-white" href="https://www.aladin.co.kr/" target="_blank" rel="noreferrer">알라딘</a></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-white/10 py-3 text-center text-[11px] text-white/40">© {new Date().getFullYear()} RANKING.GG</div>
    </footer>
  );
}
