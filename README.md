# RANKING.GG — 모든 콘텐츠를 op.gg처럼 티어/랭킹으로

> 웹툰 · 영화 · 드라마 · 애니 · 게임 · 음악 · 도서 — 실데이터 수집 → 베이지안 랭킹 → 티어표 → 별점/리뷰/댓글/1:1 대결 커뮤니티.

핵심 루프: **순위 보고 → 빡쳐서 별점/댓글 달고 → 1:1 대결 투표하고 → 순위 바뀌는 걸 보고 → 또 온다.**

## 스택
Next.js 15 (App Router · RSC · Server Actions) · TypeScript strict · Tailwind v4 · shadcn/ui(base-ui) · Supabase (Postgres/Auth/Storage) · Drizzle ORM · next-intl(KO/EN) · nuqs · Recharts · Playwright · vitest · Vercel

## 빠르게 실행
```bash
pnpm install
cp .env.example .env.local        # Supabase/TMDB/RAWG 키 채우기 (로컬은 `pnpm supabase start` 값)
pnpm db:migrate                    # 스키마 + 함수/트리거/RLS + Storage 버킷
pnpm collect:all                   # 실데이터 수집 (체크포인트, 재시작 가능)
pnpm seed:synthetic                # 600 유저 · 별점 · 리뷰 · 댓글 · 대결 · 게시글 · 8주 스냅샷
pnpm recompute                     # 랭킹 재계산
pnpm dev
```
자세한 절차는 [docs/SETUP.md](docs/SETUP.md), 데이터 통계는 [docs/DATA.md](docs/DATA.md).

## 시연 시나리오 (5단계)
1. **홈 → "웹툰" 탭 → TOP 10** 캐러셀에서 순위·티어·변동 화살표 확인 → "티어표 보기" 로 `/ranking/webtoon`. 리스트/티어 보드 토글, 플랫폼(네이버/카카오)·장르·연재상태 필터가 URL 에 반영되는 것 확인. "왜 이게 2등이지?"
2. **상세 페이지에서 게스트 로그인 → 별점 5.0** (`별점 주기` 별을 클릭 → 로그인 시트 → "게스트로 1초 시작" → 다시 별 클릭). 순위가 바뀌면 "이 작품이 #N위로 올랐습니다 ▲1" 토스트. 분포 히스토그램에 내 별점 표시.
3. **리뷰 작성** "1등이랑 비교가 되냐" → 리뷰 카드의 "답글" 열어 대댓글 스레드 확인 → 좋아요/신고 버튼.
4. **대결 탭(`/battle`) 에서 5연속 투표** → "다음 대결" 루프 → "대결 랭킹" 탭에서 ELO 순위 변화 확인. 라이벌 비교 카드(상세 페이지)에서 즉석 대결도 가능.
5. **드라마 티어표 → 넷플릭스 필터**(`/ranking/drama?platform=Netflix`) → 헤더의 **EN** 토글 → 브라우저 폭을 줄여 **모바일 뷰**(테이블이 카드형으로 전환) 확인.

## 구조
```
app/(site)/          홈 · ranking/[category] · c/[category]/[slug] · battle · search · community · u/[nickname] · create · admin · login
app/api/             search · reviews · comments · battles · live-reviews · view · img(프록시) · og/* · cron/recompute
app/actions/         rating · review · comment · reaction · report · battle · post · profile · category · admin  (Server Actions, zod 검증)
lib/db/              schema.ts(Drizzle) · queries/* · index.ts(풀러 6543) · direct.ts(5432)
lib/ranking/         score(베이지안) · tier · rank · elo · hot   ← Postgres `recompute_category` 와 일치 (pglite 테스트)
drizzle/custom/      0001_core_functions.sql(함수·트리거) · 0002_auth_rls.sql(auth 트리거·RLS·Storage)
scripts/collect/     naver-webtoon · kakao-webtoon · tmdb · rawg · apple-music · books · common(체크포인트/백오프/upsert)
scripts/             seed-synthetic · recompute · run-all · migrate
tests/unit           ranking · pg-parity(pglite) · moderation · slug        tests/e2e  smoke.spec.ts (desktop + mobile)
```

## 랭킹 알고리즘
- 베이지안: `score = (v/(v+m))·R + (m/(v+m))·C`, m = 카테고리 평가 수 25백분위(최소 10), 10점 만점 표시
- 티어: 평가 5개 이상 항목 중 백분위 상위 5% S · 15% A · 35% B · 70% C · 나머지 D. 5개 미만은 `?`
- HOT: 7일 활동(별점 1 · 리뷰 3 · 댓글 1 · 투표 0.5) × 반감기 3일 감쇠 · 대결 ELO K=24
- Postgres 트리거가 별점/댓글/반응/투표/신고 시 `content_stats` 를 즉시 갱신하고 카테고리를 재계산

## 데이터 출처
TMDB · RAWG · 네이버웹툰 · 카카오웹툰 · Apple Music(RSS/iTunes Search) · 알라딘/Google Books.
*This product uses the TMDB API but is not endorsed or certified by TMDB.*
