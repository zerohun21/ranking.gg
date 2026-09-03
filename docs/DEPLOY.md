# ranking.gg 배포 가이드 (Supabase + Vercel, 전부 무료 티어)

> 총 소요 20~30분. 이미 로컬에서 전부 검증된 상태라 "값 옮기기 + 버튼 몇 번"이 전부입니다.

## 0. 준비물
| 것 | 어디서 | 왜 |
|---|---|---|
| Supabase 프로젝트 (Northeast Asia/Seoul) | https://supabase.com/dashboard | DB · 인증 · 썸네일 Storage |
| Supabase **Access Token** | 대시보드 우상단 아바타 → Account → **Access Tokens** → Generate | CLI 가 프로젝트를 만지려면 필요 (한 번만) |
| GitHub 레포 | https://github.com/zerohun21/ranking.gg | Vercel 이 여기서 빌드 |
| Vercel 계정 (GitHub 로그인) | https://vercel.com | 호스팅 + Cron |

## 1. Supabase 설정 (CLI 로 자동, 토큰만 있으면 됨)
```bash
export SUPABASE_ACCESS_TOKEN=sbp_xxx           # 위에서 만든 토큰
pnpm supabase projects list                    # ref 확인 (예: abcdefghijklmnop)
pnpm supabase link --project-ref <ref>         # DB 비밀번호 물으면 입력 (모르면 대시보드 Settings → Database → Reset)
pnpm supabase projects api-keys --project-ref <ref>   # anon / service_role 키
```
대시보드에서 클릭 2개:
- Authentication → Providers → Email → **Confirm email OFF**
- Authentication → Providers → **Anonymous sign-ins ON**
(관리 API 로도 가능: `PATCH /v1/projects/{ref}/config/auth` `{"external_anonymous_users_enabled":true,"mailer_autoconfirm":true}`)

## 2. `.env.local` 을 호스팅 값으로 교체
```
NEXT_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon>
SUPABASE_SERVICE_ROLE_KEY=<service_role>
DATABASE_URL=postgresql://postgres.<ref>:<PW>@aws-0-ap-northeast-2.pooler.supabase.com:6543/postgres   # Transaction pooler
DIRECT_URL=postgresql://postgres.<ref>:<PW>@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres     # Session pooler
NEXT_PUBLIC_SITE_URL=https://rangking-gg.vercel.app
ADMIN_EMAILS=zbzba3@cnalytics.com
CRON_SECRET=<랜덤 32자>
```
(Settings → Database → Connection string 탭에서 두 URL 복사. 비밀번호에 특수문자가 있으면 URL 인코딩)

## 3. 스키마 + 데이터 올리기
```bash
pnpm db:migrate                       # 테이블·함수·트리거·RLS·Storage 버킷 (idempotent)
pnpm collect:all                      # 전체 수집 (네이버 썸네일은 이번엔 호스팅 Storage 로 업로드됨). 20~40분
#   또는 로컬 DB 를 통째로 옮기기: docs/DEPLOY.md §7 참고
pnpm seed:synthetic && pnpm recompute # 시드 + 랭킹 재계산
```

## 4. GitHub 푸시
```bash
git remote add origin https://github.com/zerohun21/ranking.gg.git
git push -u origin main
```
(다른 계정으로 로그인돼 있으면: 레포 Settings → Collaborators 에 그 계정 추가, 또는 `gh auth login`)

## 5. Vercel
```bash
pnpm dlx vercel login                                # 브라우저 승인 1회
pnpm dlx vercel link --yes --project rangking-gg     # 프로젝트 이름 = URL (rangking-gg.vercel.app)
# env 등록 (NEXT_PUBLIC_ 만 클라이언트 노출, 나머지는 서버 전용)
for k in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE_KEY DATABASE_URL DIRECT_URL NEXT_PUBLIC_SITE_URL ADMIN_EMAILS CRON_SECRET; do
  grep "^$k=" .env.local | cut -d= -f2- | pnpm dlx vercel env add $k production
done
pnpm dlx vercel --prod                               # 배포 → https://rangking-gg.vercel.app
```
- `vercel.json` 의 Cron(`/api/cron/recompute`, 매일 03:00 KST) 은 배포와 함께 자동 등록됨. Hobby 플랜은 하루 1회 제한.
- 배포 후 Supabase → Authentication → URL Configuration: **Site URL** = `https://rangking-gg.vercel.app`, **Redirect URLs** 에 `https://rangking-gg.vercel.app/**` 추가 (이메일 링크·OAuth 콜백용).

## 6. 확인
```bash
E2E_BASE_URL=https://rangking-gg.vercel.app pnpm test:e2e
curl -H "Authorization: Bearer $CRON_SECRET" https://rangking-gg.vercel.app/api/cron/recompute
```

## 7. 로컬 DB 를 통째로 옮기는 방법 (재수집 대신)
```bash
docker exec supabase_db_rangking pg_dump -U postgres --data-only --no-owner \
  -t categories -t contents -t genres -t content_genres -t content_stats -t rank_snapshots -t profiles -t ratings -t reviews -t comments -t reactions -t battles -t battle_votes -t posts -t collection_runs \
  > .cache/data.sql
psql "$DIRECT_URL" -v ON_ERROR_STOP=1 -c "set session_replication_role = replica" -f .cache/data.sql
```
단, 네이버 썸네일 URL 이 `http://127.0.0.1:54321/...` 이므로 그 뒤 `pnpm collect -- --source=naver --reset` 로 이미지만 다시 올린다(약 2분).

## 7.5 무료 플랜 용량 주의 (실측)
Supabase Free 는 DB 500MB. 로컬 시드 그대로(별점 174만 행 ≈ 765MB) 올리면 **읽기 전용으로 잠긴다**. 호스팅에는 `pnpm seed:synthetic -- --scale=0.25 --weeks=4` (별점 ~40만 행) 로 시드하고, 잠겼을 때는 `set default_transaction_read_only = off; truncate ratings ...` 로 정리하면 풀린다. 또 Management API 토큰은 **read-only 가 아닌** 토큰이어야 비번 재설정·Auth 설정이 가능하다.

## 8. 도메인
`rangking.gg` 실제 도메인은 .gg 레지스트라(예: Namecheap, 연 $60~80)에서 구매 후 Vercel → Settings → Domains 에 추가하면 된다. 무료 범위에선 `rangking-gg.vercel.app`.
