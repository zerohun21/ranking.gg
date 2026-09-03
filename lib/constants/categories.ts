export type OfficialCategory = {
  slug: string;
  nameKo: string;
  nameEn: string;
  icon: string;
  color: string;
  sortOrder: number;
  description: string;
};

/** 공식 카테고리 7개 — 수집 스크립트와 네비 폴백에서 공유 */
export const OFFICIAL_CATEGORIES: OfficialCategory[] = [
  { slug: "webtoon", nameKo: "웹툰", nameEn: "Webtoon", icon: "📚", color: "#00d564", sortOrder: 1, description: "네이버·카카오 웹툰 전체" },
  { slug: "movie", nameKo: "영화", nameEn: "Movie", icon: "🎬", color: "#e84057", sortOrder: 2, description: "TMDB 기반 영화" },
  { slug: "drama", nameKo: "드라마", nameEn: "Drama", icon: "📺", color: "#5383e8", sortOrder: 3, description: "드라마·예능 (넷플릭스·디즈니+·티빙·웨이브)" },
  { slug: "anime", nameKo: "애니", nameEn: "Anime", icon: "🎌", color: "#ff8a3d", sortOrder: 4, description: "일본 TV 애니·극장판" },
  { slug: "game", nameKo: "게임", nameEn: "Game", icon: "🎮", color: "#9b59b6", sortOrder: 5, description: "RAWG 기반 PC·콘솔·모바일 게임" },
  { slug: "music", nameKo: "음악", nameEn: "Music", icon: "🎵", color: "#ff2d55", sortOrder: 6, description: "Apple Music 앨범" },
  { slug: "book", nameKo: "도서", nameEn: "Book", icon: "📖", color: "#00bba3", sortOrder: 7, description: "도서" },
];

export const OFFICIAL_SLUGS = OFFICIAL_CATEGORIES.map((c) => c.slug);

export const PLATFORM_FILTERS: Record<string, { key: string; label: string }[]> = {
  drama: [
    { key: "Netflix", label: "넷플릭스" },
    { key: "Disney Plus", label: "디즈니+" },
    { key: "TVING", label: "티빙" },
    { key: "wavve", label: "웨이브" },
    { key: "Coupang Play", label: "쿠팡플레이" },
    { key: "Watcha", label: "왓챠" },
  ],
  webtoon: [
    { key: "naver", label: "네이버" },
    { key: "kakao", label: "카카오" },
  ],
  game: [
    { key: "PC", label: "PC" },
    { key: "Mac", label: "Mac" },
    { key: "Linux", label: "Linux" },
    { key: "PlayStation", label: "PS" },
    { key: "Xbox", label: "Xbox" },
    { key: "Nintendo Switch", label: "Switch" },
    { key: "Mobile", label: "모바일" },
  ],
  anime: [
    { key: "TV", label: "TV" },
    { key: "Movie", label: "극장판" },
    { key: "OVA", label: "OVA" },
    { key: "ONA", label: "ONA" },
    { key: "Netflix", label: "넷플릭스" },
  ],
  book: [
    { key: "Apple Books", label: "Apple Books" },
    { key: "Open Library", label: "Open Library" },
  ],
  movie: [
    { key: "iTunes", label: "iTunes" },
    { key: "Netflix", label: "넷플릭스" },
    { key: "Disney Plus", label: "디즈니+" },
  ],
};
