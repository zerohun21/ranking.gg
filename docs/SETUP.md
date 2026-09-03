# ranking.gg — 재현 절차

## 0. 요구사항
- Node 20+, pnpm 10+, gh CLI(로그인), Vercel 계정
- Supabase 프로젝트(무료), TMDB API 키, RAWG API 키, (선택) Google Books 또는 알라딘 TTB 키

## 0.5 (선택) 로컬 Supabase 로 전부 돌리기 — 계정 없이
```bash
open -a Docker                      # Docker Desktop 실행
pnpm supabase start                 # supabase/config.toml (anonymous sign-ins ON, email confirm OFF 로 설정됨)
```
출력된 `API_URL`(54321) / `ANON_KEY` / `SERVICE_ROLE_KEY` / `DB_URL`(54322) 을 `.env.local` 에 넣으면 아래 절차가 그대로 동작한다.
`pnpm supabase status` 로 다시 볼 수 있고, `pnpm supabase stop` 으로 내린다. Studio 는 http://127.0.0.1:54323.
※ 로컬에서 수집한 네이버 썸네일 URL 은 `http://127.0.0.1:54321/storage/...` 로 저장되므로, 호스팅 Supabase 로 옮길 때는 `pnpm collect -- --source=naver --reset` 으로 다시 수집(업로드)한다.

## 1. 환경 변수
```bash
cp .env.example .env.local   # 값 채우기
```
| 변수 | 어디서 | 용도 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API | 브라우저/서버 인증 |
| `SUPABASE_SERVICE_ROLE_KEY` | 같은 곳 (service_role) | Storage 업로드·관리자 작업 (서버 전용) |
| `DATABASE_URL` | Settings → Database → Connection string → **Transaction pooler (6543)** | 앱 쿼리 |
| `DIRECT_URL` | 같은 곳 → **Session pooler / Direct (5432)** | 마이그레이션·수집 스크립트 |
| `TMDB_API_KEY` | https://www.themoviedb.org/settings/api | 영화/드라마/애니 |
| `RAWG_API_KEY` | https://rawg.io/apidocs | 게임 |
| `GOOGLE_BOOKS_API_KEY` | Google Cloud Console → Books API | 도서 (선택) |
| `ALADIN_TTB_KEY` | 알라딘 TTB | 도서 (선택, 있으면 우선) |
| `ADMIN_EMAILS` | 직접 | 이 이메일로 가입 시 관리자 |
| `CRON_SECRET` | 직접(랜덤) | Vercel Cron 인증 |

Supabase 대시보드에서 추가 설정:
- Authentication → Providers → **Anonymous sign-ins: ON**
- Authentication → Providers → Email → **Confirm email: OFF** (시연 편의)
- (배포 후) Authentication → URL Configuration → Site URL / Redirect URLs 에 배포 URL 추가

## 2. DB 마이그레이션
```bash
pnpm db:migrate          # drizzle 스키마 + 함수/트리거/RLS + Storage 버킷
```

## 3. 데이터 수집 (로컬 실행, 수 시간)
```bash
pnpm collect -- --source=naver --limit=50    # 소량 테스트
pnpm collect:all                             # 전체 (체크포인트 .cache/collect/*.json, 재시작 가능)
pnpm seed:synthetic                          # 가짜 유저/별점/리뷰/댓글/대결/스냅샷
pnpm recompute                               # 랭킹 전체 재계산
```

## 4. 로컬 실행 / 테스트
```bash
pnpm dev
pnpm typecheck && pnpm lint && pnpm build
pnpm test                # vitest (랭킹 알고리즘 + PG 함수 일치)
pnpm test:e2e            # playwright (로컬 prod 빌드)
E2E_BASE_URL=https://<deploy>.vercel.app pnpm test:e2e
```

## 5. 배포
```bash
gh repo create ranking-gg --private --source=. --push
pnpm dlx vercel login && pnpm dlx vercel link
# env 등록 (서버 전용 키는 NEXT_PUBLIC 아님)
pnpm dlx vercel env add ...
pnpm dlx vercel --prod
```
`vercel.json` 의 Cron 이 `/api/cron/recompute` 를 매일 호출한다(월요일엔 주간 스냅샷 포함).

## 설계 메모
- 앱 DB 접근은 Drizzle(postgres 역할)로 하고, 서버 액션에서 세션·소유권을 코드로 검증한다. RLS 는 anon 키로 PostgREST 를 직접 칠 때의 방어선.
- 랭킹 계산의 정본은 Postgres 함수 `recompute_category(int)`. `lib/ranking` 은 동일 로직의 TS 미러이며 `tests/unit/pg-parity.test.ts` 가 pglite 로 두 결과의 일치를 검증한다.
- `profiles.id` 는 `auth.users.id` 와 같지만 FK 를 걸지 않았다(시드 유저 대량 삽입 편의). 실제 가입은 `handle_new_user` 트리거가 프로필을 만든다.
- 시드처럼 대량 삽입 시 `set app.bulk = 'on'` 으로 행 트리거를 우회하고, 끝나면 `refresh_all_content_stats` + `recompute_category` 로 일괄 재계산.

## 6. 검증 결과 (2026-09-03, 로컬 prod 빌드 · 로컬 Supabase)
| 항목 | 결과 |
|---|---|
| `pnpm typecheck && pnpm lint && pnpm build` | ✅ 0 error / 0 warning |
| `pnpm test` (vitest) | ✅ 23/23 — 베이지안/티어/ELO/HOT, **PG `recompute_category` ↔ TS 일치(pglite)**, 비속어, slug |
| `pnpm test:e2e` (Playwright, desktop+mobile) | ✅ 16/16 — 홈, 티어표 50행+필터 URL, 자동완성, 게스트 로그인→별점→리뷰→댓글→대결→프로필, KO/EN·다크/라이트, 커뮤니티, 유저 카테고리 |
| Lighthouse 모바일(시뮬레이션) | 성능 74(홈)·74(티어표)·75(상세)·82(대결) / 접근성 96~97 / Best Practices 100 / SEO 92 |

- SEO 92 의 유일한 감점은 `meta-description`: Next 15 의 스트리밍 메타데이터가 일반 브라우저 UA 에는 `<body>` 로 내려가기 때문. Googlebot 등 크롤러 UA 에는 `<head>` 에 들어감(curl 로 확인). `next.config.ts` 의 `htmlLimitedBots` 에 주요 봇을 등록해 둠.
- 성능 74~82 는 로컬 Next 서버 + 로컬 Storage 이미지 기준 시뮬레이션. 실제 Vercel(엣지 캐시·Brotli) + Supabase CDN 환경에서 재측정 필요.

## 7. 운영 주의
- **`next start` 를 재시작할 때는 `pkill -f next-server`** 로 실제 서버 프로세스를 내려야 한다. `pkill -f "next start"` 는 pnpm 래퍼만 죽여서 이전 빌드 서버가 포트를 계속 점유하고, 새 빌드의 JS 청크가 400 으로 떨어져 페이지가 하이드레이션되지 않는다(로컬에서 실제로 겪은 문제).
- 시드 재실행은 증분: 이미 별점/리뷰/대결/게시글이 있는 항목·카테고리는 건너뛴다. 전체 초기화는 `pnpm seed:synthetic -- --reset`.
