# ranking.gg — 데이터 출처 · 수집 통계

마지막 갱신: 2026-09-04. 전부 **키 없는 공개 소스**로 수집(TMDB/RAWG 는 선택). 호스팅(Supabase 무료 500MB)에는 합성 별점을 25% 규모(`--scale=0.25 --weeks=4`)로 시드.

## 요약

| 소스 | 카테고리 | 수집 개수 | 포스터 | 줄거리 | 외부 점수 | 소요 | 상태 |
|---|---|---:|---:|---:|---:|---:|---|
| 네이버 웹툰 | webtoon | 4,140 | 100% | 100% | 100% (starScore) | 1.5분 | ✅ |
| 카카오웹툰 | webtoon | 3,077 | 100% | 100% | 100% (인기 순위 기반 추정) | 0.3분 | ✅ |
| Apple Music | music | 4,010 | 100% | 95% (copyright) | 100% (차트 순위/지터 추정) | 2.4분 | ✅ |
| IMDb 데이터셋 + Wikipedia | movie | 3,500 | 98.9% | 98.9% | 100% (IMDb 평점·투표수) | 58분 | ✅ 무키 대안 (한글 제목 97%) |
| TVmaze | drama | 3,500 | 100% | 99.8% | 74% (rating.average) | 0.4분 | ✅ 무키 대안 (영문 위주) |
| AniList GraphQL | anime | 3,500 | 100% | 99.9% | 98% (averageScore) | 3.4분 | ✅ 무키 대안 (Jikan 은 504 잦아 교체) |
| SteamSpy + Steam 스토어 | game | 3,906 | 100% | 62.5% (상위 2,470 한글 설명) | 100% (긍정/부정 비율) | 73분 (429 대기 포함) | ✅ 무키 대안 (PC 게임) |
| Apple Books(iTunes) | book | 5,261 | 100% | 94% | 일부 실평점, 나머지 추정 | 3분 | ✅ 무키 대안 |
| Open Library | book | 2,363 | 100% | 0% | 100% (ratings_average) | (동시) | ✅ 무키 대안 (영문) |
| TMDB / RAWG / 알라딘 | movie·drama·anime·game·book | – | | | | | 구현 완료, 키 넣으면 `pnpm collect:all -- --source=tmdb,rawg,books` 로 보강 |
| 유저 카테고리(예시 3개) | ramen/chicken/programming-language | 46 | 39% | | – | | ✅ 시드 |
| **합계** | | **33,303** | | | | | ✅ 목표 15,000+ 달성 (TMDB/RAWG 키 넣으면 더 보강 가능) |

합성 활동 데이터(`pnpm seed:synthetic`, 전부 `profiles.is_seed=true`): 유저 600 · 별점 1,736,974 · 리뷰 30,363 · 댓글 110,055 · 대결 200 · 게시글 80 · 순위 스냅샷 89,906(8주) · 장르 164개.

## 소스별 상세 (2026-09-03 curl 로 응답 확인한 엔드포인트만 사용)

### 네이버 웹툰 (키 불필요, 비공식 JSON)
- 목록 `GET https://comic.naver.com/api/webtoon/titlelist/weekday?week={mon..sun,dailyPlus}&order=user` → `titleList[]` (titleId, titleName, author, writers[], painters[], thumbnailUrl, starScore, adult, rest, finish, new). **viewCount 는 항상 0** → 표본 수는 상세의 `favoriteCount` 사용.
- 완결 `GET /api/webtoon/titlelist/finished?page=N&order=UPDATE` → `pageInfo.totalPages=70`, 3,114편.
- 상세 `GET /api/article/list/info?titleId=` → synopsis, favoriteCount, age.description, publishDayOfWeekList, curationTagList[].tagName, gfpAdCustomParam.genreTypes[].
- 헤더: 일반 크롬 UA + `Referer: https://comic.naver.com/`. 동시성 5.
- 이미지: Referer 없이 403 → **Supabase Storage `thumbs/naver/{titleId}.webp`** 로 업로드(sharp, 폭 400, webp q82). 실패 시 `/api/img?u=&ref=` 프록시 URL 폴백. 로컬 수집분은 `http://127.0.0.1:54321/...` 이므로 호스팅 전환 시 `--reset` 재수집 필요.
- `external_score = starScore`, `external_score_count = favoriteCount`, `metadata.platform='naver'`, weekdays/status/age/tags/genres.

### 카카오웹툰 (키 불필요)
- 스펙의 `placement=timetable` 은 **404**. 실제: `GET https://gateway-kw.kakao.com/section/v2/timetables/days?placement=timetable_{mon..sun}` (요일별 130~163개) + `placement=timetable_completed` (2,058개, 3.8MB 단일 응답). 헤더 `Accept-Language: ko`, `Referer: https://webtoon.kakao.com/`.
- 카드 필드: `content.{id,title,seoId,adult,authors[],featuredCharacterImageA,backgroundImage,badges[]}`, `sorting.{popularity,views}` (**1 = 가장 인기, 순위값**), `genreFilters[]`.
- 상세 `GET /decorator/v2/decorator/contents/{id}` → synopsis, genre(한글), status, authors, thumbnailImage.
- 이미지: 원본 URL 그대로는 404, **`.webp` 확장자를 붙이면 Referer 없이 200** → 그대로 저장(Storage 불필요).
- 점수 없음 → `popularity` 순위를 9.5~7.0 으로 선형 매핑, 표본 수 `300000 / rank^0.6` (metadata.score_estimated=true).
- 카카오페이지(GraphQL)는 시도하지 않음 — 카카오웹툰만으로 3,077편 확보.

### Apple Music (키 불필요)
- RSS `https://rss.marketingtools.apple.com/api/v2/{kr,us}/music/most-played/100/albums.json` (구 도메인 폴백 포함).
- iTunes Search `https://itunes.apple.com/search?term=…&country=kr&media=music&entity=album&limit=200&lang=ko_kr`. **kr 스토어는 영문 term(IU, kpop) 이 0건** → 한글 아티스트/장르 키워드 60개 + `lang=ko_kr`; us 스토어는 영문 20개. 요청 간 3초 간격(약 20 req/min 제한).
- artwork `100x100bb` → `600x600bb`. RSS 순위 1~100 → 9.0~7.5, 검색 결과 7.0±지터(id 해시) — 전부 `score_estimated`.

### 영화 — IMDb 공개 데이터셋 + Wikipedia (키 불필요)
- `https://datasets.imdbws.com/title.ratings.tsv.gz`(7MB) + `title.basics.tsv.gz`(190MB gz, 1,200만 행 스트리밍 파싱 30초). `titleType=movie`, `numVotes ≥ 25,000` → 7,275편 중 투표수 상위 3,500편. IMDb 데이터셋은 개인·비상업 용도 라이선스.
- Wikipedia **Action API 배치**: `action=query&prop=extracts|pageimages|langlinks|pageprops&exintro&explaintext&piprop=original|thumbnail&pilicense=any&lllang=ko&redirects=1&titles=A|B|…` — 영화 6편(후보 제목 18개)당 1요청. 후보 `"{title} ({year} film)" → "{title} (film)" → "{title}"` 중 첫 번째 존재하는 문서(동음이의 제외, 인트로에 film/movie 포함)를 채택. `pilicense=any` 가 없으면 비자유 포스터가 빠져 포스터 0% 가 됨(실측). 동시 요청은 429 → 순차 + 250ms 간격.
- 결과: 한글 제목(kowiki langlink) · 포스터(upload.wikimedia.org) · 영문 인트로. `external_score = IMDb 평점`, `external_score_count = 투표수`.

### 드라마 — TVmaze (키 불필요)
- `GET https://api.tvmaze.com/shows?page=N`(240/페이지, 20 req/10s) 0~41페이지 ≈ 10,000편 → 이미지 있고 `weight ≥ 60` 또는 평점 ≥ 7 인 것 → weight 순 상위 3,500. type 별 kind(tv/variety/animation/documentary), 네트워크/웹채널 → providers(넷플릭스 필터 동작). 표본 수는 weight 지수 스케일 추정.

### 애니 — AniList GraphQL (키 불필요)
- `POST https://graphql.anilist.co` `Page(perPage:50) media(type:ANIME, sort:POPULARITY_DESC, isAdult:false)` 70페이지 = 3,500편, 2.1s 간격(분당 30 제한 시). averageScore/10, popularity 를 표본 수로. Jikan(MyAnimeList) 수집기도 남겨 두었으나 21페이지 이후 504 가 잦아 기본 경로에서 제외.

### 게임 — SteamSpy + Steam 스토어 (키 불필요)
- `https://steamspy.com/api.php?request=all&page=0..3`(1,000/페이지, 1 req/min) → 리뷰 50개 이상 → 리뷰 수 상위 정렬. 상위 2,500개는 `store.steampowered.com/api/appdetails?appids=&l=koreana&cc=kr`(0.35s 간격, 429 시 60s 대기)로 한글 이름·설명·장르·출시일·메타크리틱. 이미지는 `cdn.cloudflare.steamstatic.com/steam/apps/{appid}/header.jpg` 핫링크. 점수 = 긍정/(긍정+부정)×10.

### 도서 — Apple Books + Open Library (키 불필요)
- Apple RSS `kr,us/books/top-paid|top-free/100` + iTunes Search `media=ebook`(kr 한글 키워드 60개 + us 15개, `averageUserRating/userRatingCount` 있으면 실평점) + Open Library `search.json?subject=…&sort=rating`(영문, ratings_average/ratings_count, 표지 `covers.openlibrary.org`).

### TMDB (키 필요) — 구현 완료, 키 대기
- discover: 영화 popularity(150p, vote≥100) + vote_average(25p, vote≥1000) + KR(25p); 드라마 popularity(125p, vote≥50, 애니·뉴스 제외) + KR(40p, vote≥30) + top(15p); 애니 `with_genres=16&with_origin_country=JP` TV 75p + 영화 25p(스펙의 "모든 애니 영화" 대신 JP 원산으로 제한 — 서양 애니메이션은 영화 카테고리에 남김).
- 상세 `append_to_response=watch/providers,credits,keywords,external_ids`, ko 줄거리/제목 없으면 en-US 1회 폴백. `watch/providers.results.KR.flatrate` → metadata.providers/platforms(넷플릭스 필터). 예능(10764/10767)은 `metadata.kind='variety'`.

### RAWG (키 필요) — 구현 완료, 키 대기
- `-added` 75p + `-metacritic` 25p + 2023~ 최신 13p(page_size 40) → 상세 ≤4,500 → 총 요청 < 5,000. rating(0~5)×2, platforms 를 PC/PlayStation/Xbox/Nintendo Switch/Mobile 로 정규화.

### 도서 (키 필요)
- `ALADIN_TTB_KEY` 있으면 Bestseller/ItemNewSpecial/BlogBest × 22 카테고리 (customerReviewRank 사용), 없으면 `GOOGLE_BOOKS_API_KEY` 로 subject 30개×5페이지. **Google Books 익명 호출은 429 (quota_limit_value 0)** 로 확인 → 키 없이는 스킵.

## 수집 후 처리
- slug: 한글 유지 `slugify(title) + '-' + external_id` (카테고리 내 유니크).
- upsert: `(external_source, external_id)` 유니크 충돌 시 갱신(metadata 는 병합, poster 는 coalesce).
- 장르: `genres`/`content_genres` 정규화 + `metadata.genres` 병행. 플랫폼/OTT 는 `metadata.platforms` + GIN 인덱스.
- 체크포인트 `.cache/collect/<source>.json` + `collection_runs` 테이블(관리자 → 수집 로그).

## 재현
```bash
pnpm collect -- --source=naver --limit=50      # 소량 테스트
pnpm collect:all                                # 전체 (naver→kakao→tmdb→rawg→apple→books)
pnpm collect:all -- --source=tmdb,rawg          # 키 추가 후 부분 실행
pnpm seed:synthetic && pnpm recompute           # 증분 시드(이미 별점 있는 항목은 건너뜀)
```
