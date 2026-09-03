# ranking.gg — 재현 절차

## 0. 요구사항
- Node 20+, pnpm 10+, gh CLI(로그인), Vercel 계정
- Supabase 프로젝트(무료), TMDB API 키, RAWG API 키, (선택) Google Books 또는 알라딘 TTB 키

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
