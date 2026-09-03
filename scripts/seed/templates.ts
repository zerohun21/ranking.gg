/** 합성 데이터 템플릿 — 한국어 닉네임 / 리뷰 / 댓글 / 게시글 */

export const NICK_ADJ = ["빡친", "행복한", "졸린", "배고픈", "심심한", "화난", "울적한", "신난", "지친", "느긋한", "진지한", "귓속말하는", "달리는", "숨은", "웃는", "냉정한", "따뜻한", "차가운", "미친", "평화로운", "새벽의", "야간", "주말", "월요일", "퇴근한", "출근하는", "등교하는", "야자하는", "고독한", "무념무상", "정직한", "솔직한", "까칠한", "다정한", "무서운", "귀여운", "쿨한", "핫한", "묵묵한", "투명한"];
export const NICK_NOUN = ["웹툰러", "넷플중독자", "티어표경찰", "평론가", "관종", "감자", "고구마", "붕어빵", "호랑이", "펭귄", "너구리", "수달", "고양이", "강아지", "햄스터", "라면", "떡볶이", "치킨", "피자", "커피", "덕후", "시청자", "독자", "게이머", "리스너", "시네필", "드라마퀸", "애니충", "빙의자", "먼치킨", "회귀자", "개근왕", "정주행러", "리뷰어", "댓글러", "눈팅러", "탐험가", "수집가", "감별사", "심판"];
export function nickname(i: number, rnd: () => number): string {
  const a = NICK_ADJ[Math.floor(rnd() * NICK_ADJ.length)];
  const n = NICK_NOUN[Math.floor(rnd() * NICK_NOUN.length)];
  const num = rnd() < 0.7 ? String(Math.floor(rnd() * 99) + 1) : "";
  return `${a}${n}${num}${i % 7 === 0 ? `_${i}` : ""}`.slice(0, 20);
}

type Vocab = { good: string[]; bad: string[]; aspects: string[]; verbs: string[] };
export const VOCAB: Record<string, Vocab> = {
  webtoon: {
    aspects: ["작화", "스토리", "연재텀", "캐릭터", "전개", "대사", "연출", "떡밥 회수", "컷 분할", "채색"],
    good: ["미쳤다", "역대급이다", "볼수록 빠져든다", "매주 기다리게 된다", "군더더기가 없다", "갓벽하다", "취향 저격이다", "안정적이다"],
    bad: ["점점 산으로 간다", "억지다", "늘어진다", "질질 끈다", "초반만 좋았다", "너무 뻔하다", "휴재가 너무 잦다", "캐릭터 붕괴가 심하다"],
    verbs: ["정주행했는데", "주간 연재 따라가는데", "완결까지 봤는데", "추천받아서 봤는데", "미리보기까지 결제했는데", "3번째 정주행 중인데"],
  },
  movie: {
    aspects: ["연출", "각본", "연기", "결말", "촬영", "음악", "편집", "개연성", "주제 의식", "페이스"],
    good: ["압도적이다", "여운이 길다", "군더더기 없다", "재관람 각이다", "배우들이 살렸다", "명작이다", "기대 이상이다", "완벽하다"],
    bad: ["실망스럽다", "지루하다", "과대평가다", "결말이 허무하다", "예고편이 다였다", "설정 낭비다", "산만하다", "왜 평이 높은지 모르겠다"],
    verbs: ["극장에서 봤는데", "OTT로 봤는데", "두 번째 봤는데", "친구 추천으로 봤는데", "명작이라길래 봤는데", "심야 상영으로 봤는데"],
  },
  drama: {
    aspects: ["결말", "연기", "개연성", "연출", "OST", "케미", "후반 전개", "대본", "떡밥", "회차 분량"],
    good: ["정주행 각이다", "매회 미쳤다", "연기가 살렸다", "역대급이다", "몰입도가 대단하다", "웰메이드다", "케미가 터진다", "완벽하다"],
    bad: ["후반에 무너졌다", "늘어진다", "결말이 최악이다", "개연성이 없다", "PPL이 심하다", "용두사미다", "1화만 좋았다", "과대평가다"],
    verbs: ["정주행했는데", "본방 사수했는데", "몰아봤는데", "시즌2까지 봤는데", "추천받아서 봤는데", "밤새 봤는데"],
  },
  anime: {
    aspects: ["작화", "연출", "스토리", "성우", "OST", "원작 재현", "액션 씬", "캐릭터", "전개 속도", "결말"],
    good: ["미쳤다", "역대급이다", "작화 붕괴가 없다", "원작 이상이다", "매 화가 극장판급이다", "감동적이다", "명작이다", "완벽하다"],
    bad: ["원작 훼손이다", "작화가 무너진다", "질질 끈다", "필러가 너무 많다", "결말이 애매하다", "과대평가다", "1쿨만 좋았다", "산으로 간다"],
    verbs: ["1쿨 다 봤는데", "정주행했는데", "원작 팬으로서 봤는데", "극장판까지 봤는데", "추천받아 봤는데", "밤새 봤는데"],
  },
  game: {
    aspects: ["최적화", "과금", "타격감", "스토리", "그래픽", "조작감", "밸런스", "콘텐츠 양", "버그", "사운드"],
    good: ["미쳤다", "역대급이다", "손맛이 좋다", "시간 순삭이다", "갓겜이다", "가격 대비 최고다", "몰입감이 엄청나다", "완벽하다"],
    bad: ["똥겜이다", "발적화다", "과금 유도가 심하다", "반복 노가다다", "버그가 너무 많다", "과대평가다", "3시간 하고 접었다", "환불했다"],
    verbs: ["100시간 했는데", "엔딩 봤는데", "친구랑 했는데", "세일 때 샀는데", "출시일에 샀는데", "플레 찍었는데"],
  },
  music: {
    aspects: ["타이틀곡", "수록곡", "보컬", "프로듀싱", "가사", "구성", "믹싱", "콘셉트", "완성도", "곡 순서"],
    good: ["명반이다", "수록곡이 다 좋다", "버릴 곡이 없다", "무한 반복 중이다", "역대급이다", "완성도가 높다", "취향 저격이다", "완벽하다"],
    bad: ["타이틀만 좋다", "실망스럽다", "전작보다 못하다", "다 비슷하게 들린다", "과대평가다", "믹싱이 아쉽다", "기억에 남는 게 없다", "무난하다"],
    verbs: ["하루 종일 들었는데", "출근길에 들었는데", "LP로 들었는데", "추천받아 들었는데", "10번 넘게 들었는데", "밤에 들었는데"],
  },
  book: {
    aspects: ["문장", "구성", "결말", "번역", "주제", "캐릭터", "전개", "분량", "가독성", "통찰"],
    good: ["명작이다", "밤새 읽었다", "문장이 아름답다", "인생 책이다", "다시 읽고 싶다", "여운이 길다", "생각을 바꿨다", "완벽하다"],
    bad: ["지루하다", "과대평가다", "번역이 아쉽다", "결말이 허무하다", "늘어진다", "중간에 포기했다", "뻔하다", "실망스럽다"],
    verbs: ["완독했는데", "출퇴근길에 읽었는데", "추천받아 읽었는데", "두 번째 읽었는데", "밤새 읽었는데", "도서관에서 빌려 읽었는데"],
  },
  default: {
    aspects: ["퀄리티", "완성도", "가성비", "디자인", "만족도", "재미", "구성", "첫인상"],
    good: ["최고다", "역대급이다", "만족스럽다", "추천한다", "기대 이상이다", "완벽하다"],
    bad: ["실망스럽다", "별로다", "과대평가다", "다시 안 볼 것 같다", "무난하다", "아쉽다"],
    verbs: ["직접 써봤는데", "친구 추천으로 봤는데", "비교해봤는데", "두 번째인데"],
  },
};

const OPENERS_POS = ["솔직히 말하면", "개인적으로", "기대 안 하고 봤는데", "이건 인정.", "오랜만에", "요즘 본 것 중에", "이 정도면", "다 떠나서"];
const OPENERS_NEG = ["솔직히 말하면", "개인적으로", "기대가 너무 컸나", "미안한데", "다들 왜 좋다는지", "1등 후보라길래 봤는데", "논란 각오하고 쓴다.", "다 떠나서"];
const CLOSERS_POS = ["이건 S티어 맞다.", "순위 더 올라가야 한다.", "안 본 사람 부럽다.", "두 번 봐도 좋다.", "별 다섯 개 아깝지 않다.", "이게 왜 이 순위지? 더 위여야 한다.", "찬양합니다.", "믿고 보세요."];
const CLOSERS_NEG = ["이게 왜 이 순위인지 모르겠다.", "티어 조정 좀.", "별 두 개도 아깝다.", "과대평가의 표본.", "취향 문제라기엔 좀…", "2등이 말이 되나.", "커뮤니티 평이 의심스럽다.", "시간이 아깝다."];
const CLOSERS_NEU = ["호불호는 갈릴 듯.", "무난하게 볼만하다.", "기대치를 낮추면 괜찮다.", "취향 타는 작품.", "한 번은 볼만하다.", "평타는 친다."];
const DEBATE = ["1등이랑 비교하면 좀 아쉽다.", "바로 위 작품보다 이게 낫다고 본다.", "티어표 만든 사람 취향이 의심된다.", "댓글 보면 다들 싸우고 있네.", "이걸 A티어에 두는 건 범죄다.", "S티어 아니면 다 의미 없다.", "순위 매기는 게 웃기긴 한데 그래도 이건 좀.", "라이벌 작품이랑 대결 붙이면 이게 이긴다."];

export type ReviewKind = "pos" | "neg" | "neu" | "debate";
export function pickKind(scoreHalf: number, rnd: () => number): ReviewKind {
  // scoreHalf: 0.5~5
  const r = rnd();
  if (scoreHalf >= 4) return r < 0.75 ? "pos" : r < 0.9 ? "debate" : "neu";
  if (scoreHalf <= 2.5) return r < 0.7 ? "neg" : r < 0.9 ? "debate" : "neu";
  return r < 0.45 ? "neu" : r < 0.7 ? "pos" : r < 0.9 ? "neg" : "debate";
}
const pick = <T,>(a: T[], rnd: () => number) => a[Math.floor(rnd() * a.length)];

export function reviewText(category: string, title: string, kind: ReviewKind, rnd: () => number): string {
  const v = VOCAB[category] ?? VOCAB.default;
  const a1 = pick(v.aspects, rnd);
  let a2 = pick(v.aspects, rnd);
  if (a2 === a1) a2 = pick(v.aspects, rnd);
  const verb = pick(v.verbs, rnd);
  const shortTitle = title.length > 18 ? "이 작품" : `<${title}>`;
  const parts: string[] = [];
  if (kind === "pos") {
    parts.push(`${pick(OPENERS_POS, rnd)} ${shortTitle} ${verb} ${a1}${josa(a1, "이가")} ${pick(v.good, rnd)}.`);
    if (rnd() < 0.7) parts.push(`${a2}도 ${pick(v.good, rnd)}.`);
    parts.push(pick(CLOSERS_POS, rnd));
  } else if (kind === "neg") {
    parts.push(`${pick(OPENERS_NEG, rnd)} ${shortTitle} ${verb} ${a1}${josa(a1, "이가")} ${pick(v.bad, rnd)}.`);
    if (rnd() < 0.7) parts.push(`${a2}${josa(a2, "은는")} 그나마 ${pick(v.good, rnd)}만 그게 다다.`);
    parts.push(pick(CLOSERS_NEG, rnd));
  } else if (kind === "neu") {
    parts.push(`${shortTitle} ${verb} ${a1}${josa(a1, "은는")} ${pick(v.good, rnd)}. 다만 ${a2}${josa(a2, "은는")} ${pick(v.bad, rnd)}.`);
    parts.push(pick(CLOSERS_NEU, rnd));
  } else {
    parts.push(`${pick(DEBATE, rnd)} ${shortTitle} ${verb} ${a1}${josa(a1, "이가")} ${rnd() < 0.5 ? pick(v.good, rnd) : pick(v.bad, rnd)}.`);
    parts.push(pick(DEBATE, rnd));
    if (rnd() < 0.5) parts.push(pick(CLOSERS_NEU, rnd));
  }
  return parts.join(" ");
}

/** 초간단 조사 처리 (받침 유무) */
function josa(word: string, type: "이가" | "은는"): string {
  const last = word.charCodeAt(word.length - 1);
  const hasFinal = last >= 0xac00 && last <= 0xd7a3 ? (last - 0xac00) % 28 !== 0 : false;
  if (type === "이가") return hasFinal ? "이" : "가";
  return hasFinal ? "은" : "는";
}

export const COMMENT_TEMPLATES = [
  "2등이 말이 되냐 ㅋㅋ", "1등이랑 비교하면 ㅋㅋ 급이 다르지", "이게 S티어면 다 S티어다", "동의합니다", "이건 좀 과장 아닌가", "리뷰 보고 다시 봤는데 맞는 말이네", "취향 존중은 하는데 순위는 아니다", "댓글로 싸우지 말고 별점으로 말하자",
  "정확한 평가", "이 리뷰가 베스트인 게 이 사이트 수준", "반박 시 니 말이 맞음", "ㄹㅇ 이거 왜 이 순위임", "라이벌 작품이랑 대결 붙여봐라", "티어 경찰 출동", "저는 반대로 느꼈어요", "여기서 이 작품 까면 큰일나요",
  "순위 오르는 거 보니까 흐뭇하다", "▲ 화살표 뜬 거 보고 왔다", "떨어진 이유가 이거였구나", "결말 스포 하지 마세요", "스포 조심", "이 리뷰 때문에 봤는데 감사합니다", "저도 같은 생각", "이건 인정",
  "5점 준 사람 손", "0.5점 준 사람 나와라", "평가 수 적어서 그런 거임", "평가 더 쌓이면 내려갈 듯", "이 작품 A티어 갈 것 같음", "S티어 지켜라", "묻히기엔 아까운 작품", "다음 주 순위 기대됨",
  "작화 얘기 하나도 없는 게 신기", "이 정도면 명작 맞지", "친구한테 추천했다가 욕먹음", "어제 정주행 끝냈는데 공감", "이거 보고 넷플 구독함", "대결 투표 이기던데?", "ELO 보면 답 나옴", "이 리뷰 좋아요 왜 이렇게 많음",
];
export const REPLY_TEMPLATES = [
  "그건 좀 아닌 듯", "ㅇㅈ", "반박 불가", "근거는요?", "본인 취향이 정답은 아니죠", "ㅋㅋㅋㅋ", "이 분 말이 맞음", "저는 다르게 봤어요", "위 댓글 반박해봐", "시간 지나면 평가 달라질 거임", "이래서 댓글창 못 끊음", "둘 다 맞는 말인데 왜 싸움",
];

export const POST_TITLES: Record<string, string[]> = {
  debate: ["{a} vs {b} 솔직히 뭐가 위냐", "{a} S티어 인정하는 사람 있음?", "{a} 순위 이거 맞냐", "{a} 과대평가 아니냐 진지하게", "{a} 이번 주 순위 떨어진 이유", "티어표 보고 빡친 사람 모여", "{a} 2등인 게 납득이 안 됨", "{a}가 {b}보다 아래인 게 말이 되나"],
  free: ["{a} 정주행 후기", "요즘 뭐 봄?", "{a} 처음 봤는데 소감", "이 카테고리 티어표 누가 만듦", "{a} 좋아하는 사람 손", "오늘 {a} 순위 확인하고 옴", "심심해서 티어표 정독함", "{a} 얘기 좀 하자"],
  question: ["{a} 볼만함?", "{a}랑 비슷한 거 추천 좀", "{a} 어디까지 봐야 재밌어짐?", "{a} 결말 어때요 (스포 X)", "티어 어떻게 정해지는 거임?", "{a} 입문 순서 알려줘", "{a} vs {b} 뭐부터 볼까", "{a} 왜 이렇게 평이 갈림?"],
  recommend: ["{a} 안 본 사람 꼭 봐라", "{a} 추천합니다 (스포 없음)", "{a} 이거 진짜 숨은 명작", "저평가된 {a} 재평가 가자", "S티어 중에 {a} 가 제일 낫다", "{a} 첫 화만 봐라 그 뒤는 알아서 됨", "{a} 입문용으로 딱", "{a} 이 정도면 A티어 이상 가야 함"],
};
export const POST_BODIES = [
  "제목이 다 했다. 반박은 댓글로.\n\n근거 1) 최근 순위 변동\n근거 2) 대결 승률\n근거 3) 내 취향",
  "어제 정주행 끝내고 티어표 봤는데 순위가 이해가 안 감. 다들 어떻게 생각하는지 궁금.",
  "**요약**\n- 장점: 확실함\n- 단점: 있음\n- 결론: 그래도 봐라\n\n> 순위는 별점으로 말하세요",
  "커뮤니티 여론이랑 실제 별점 분포가 너무 다른 것 같아서 글 씀. 분포 그래프 보면 양극화 심함.",
  "대결 탭에서 10연속 돌려봤는데 이 작품 승률 보고 놀랐다. 순위랑 승률 괴리 있는 작품 뭐 있음?",
  "1. 처음엔 별 기대 없었음\n2. 3화부터 몰입\n3. 지금은 티어표 매일 확인함\n\n이게 도파민이지.",
  "라이벌 비교 카드 보고 왔는데, 바로 위 작품보다 평가 수는 많은데 점수가 낮음. 이런 경우 어떻게 생각함?",
  "스포 없이 말하면 후반 전개가 호불호. 근데 그게 이 작품 매력이라고 봄.",
];

export const USER_CATEGORY_SEEDS: { slug: string; nameKo: string; nameEn: string; icon: string; color: string; description: string; items: { title: string; description?: string; image?: string; link?: string }[] }[] = [
  {
    slug: "ramen", nameKo: "편의점 라면", nameEn: "Convenience Store Ramen", icon: "🍜", color: "#ff8a3d", description: "편의점에서 파는 라면 줄 세우기. 국물·면발·가성비 기준.",
    items: [
      { title: "신라면", description: "농심의 국민 라면. 얼큰한 소고기 국물." }, { title: "진라면 매운맛", description: "오뚜기 대표 라면." }, { title: "너구리", description: "굵은 면발과 다시마." }, { title: "삼양라면", description: "원조 라면." },
      { title: "불닭볶음면", description: "삼양의 매운 볶음면." }, { title: "짜파게티", description: "농심 짜장라면." }, { title: "안성탕면", description: "구수한 된장 베이스." }, { title: "육개장 사발면", description: "농심 컵라면의 클래식." },
      { title: "참깨라면", description: "오뚜기, 계란블록과 참깨." }, { title: "틈새라면", description: "매운맛 마니아용." }, { title: "김치 사발면", description: "농심 컵라면." }, { title: "신라면 블랙", description: "사골 국물 프리미엄." },
      { title: "열라면", description: "오뚜기 매운 라면." }, { title: "팔도 비빔면", description: "여름의 정석." }, { title: "왕뚜껑", description: "팔도 대형 컵라면." },
    ],
  },
  {
    slug: "chicken", nameKo: "치킨 브랜드", nameEn: "Fried Chicken Brands", icon: "🍗", color: "#e84057", description: "한국 치킨 프랜차이즈 티어표. 맛·양·가격·배달 속도.",
    items: [
      { title: "BBQ", description: "황금올리브의 그 집." }, { title: "BHC", description: "뿌링클로 유명." }, { title: "교촌치킨", description: "간장 치킨의 원조." }, { title: "굽네치킨", description: "오븐 구이 치킨." },
      { title: "네네치킨", description: "스노윙 치킨." }, { title: "처갓집 양념치킨", description: "슈프림 양념." }, { title: "페리카나", description: "양념치킨의 원조 논쟁." }, { title: "호식이 두마리치킨", description: "두 마리의 가성비." },
      { title: "60계치킨", description: "매일 새 기름." }, { title: "푸라닭", description: "블랙 알리오." }, { title: "노랑통닭", description: "옛날 통닭 스타일." }, { title: "멕시카나", description: "치토스 치킨." }, { title: "자담치킨", description: "맵슐랭." },
    ],
  },
  {
    slug: "programming-language", nameKo: "프로그래밍 언어", nameEn: "Programming Languages", icon: "💻", color: "#5383e8", description: "개발자들 싸움 유발 카테고리. 생산성·성능·생태계·재미.",
    items: [
      { title: "TypeScript", image: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg", link: "https://www.typescriptlang.org/" },
      { title: "Python", image: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg", link: "https://www.python.org/" },
      { title: "Rust", image: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/rust/rust-original.svg", link: "https://www.rust-lang.org/" },
      { title: "Go", image: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/go/go-original.svg", link: "https://go.dev/" },
      { title: "Java", image: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/java/java-original.svg" },
      { title: "Kotlin", image: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/kotlin/kotlin-original.svg" },
      { title: "Swift", image: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/swift/swift-original.svg" },
      { title: "C++", image: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/cplusplus/cplusplus-original.svg" },
      { title: "C", image: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/c/c-original.svg" },
      { title: "C#", image: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/csharp/csharp-original.svg" },
      { title: "JavaScript", image: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/javascript/javascript-original.svg" },
      { title: "Ruby", image: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/ruby/ruby-original.svg" },
      { title: "PHP", image: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/php/php-original.svg" },
      { title: "Elixir", image: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/elixir/elixir-original.svg" },
      { title: "Haskell", image: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/haskell/haskell-original.svg" },
      { title: "Zig", image: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/zig/zig-original.svg" },
      { title: "Dart", image: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/dart/dart-original.svg" },
      { title: "Scala", image: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/scala/scala-original.svg" },
    ],
  },
];

export const POPULAR_SEARCHES = ["나 혼자만 레벨업", "참교육", "오펜하이머", "더 글로리", "진격의 거인", "엘든 링", "뉴진스", "불편한 편의점", "화산귀환", "기생충"];
