/** 한국어 비속어 필터 — 우회 문자 정규화 후 마스킹 */
const WORDS = [
  "시발", "씨발", "씨빨", "시빨", "쉬발", "씹", "병신", "븅신", "빙신", "개새끼", "개세끼", "새끼", "쌔끼", "미친놈", "미친년", "지랄", "지럴", "좆", "졸라", "존나", "존니", "존내", "느금", "니애미", "니엄마", "애미", "애비", "엠창", "엿먹", "닥쳐", "꺼져", "죽어라", "죽여", "한남", "김치녀", "된장녀", "맘충", "틀딱", "급식충", "한녀", "장애인같", "장애냐", "정박아", "찐따", "호구새", "걸레", "창녀", "창남", "보지", "자지", "딸딸이", "섹스", "야동", "포르노", "강간", "성폭행", "빠구리", "후장", "똥꼬", "젖", "유두", "sex", "fuck", "shit", "bitch", "asshole", "dick", "pussy", "cunt", "nigger", "faggot", "retard", "whore", "slut", "bastard", "motherfucker", "wtf", "stfu", "ㅅㅂ", "ㅆㅂ", "ㅄ", "ㅂㅅ", "ㅈㄹ", "ㄲㅈ", "ㅗ", "개돼지", "쓰레기같은놈", "노무", "노알라", "일베", "메갈", "재기해", "자살해", "뒤져", "뒤질", "꼴통", "돌대가리", "머저리", "얼간이", "등신", "멍청이", "바보새", "개같", "개년", "개놈", "개소리", "개차반", "썅", "쌍놈", "쌍년",
];
const NORMALIZE: [RegExp, string][] = [
  [/[\s._\-*~^]+/g, ""],
  [/[1!|]/g, "i"],
  [/[0]/g, "o"],
  [/[3]/g, "e"],
  [/[4@]/g, "a"],
  [/[5$]/g, "s"],
];
function normalize(s: string) {
  let t = s.toLowerCase();
  for (const [re, rep] of NORMALIZE) t = t.replace(re, rep);
  return t;
}
const PATTERNS = WORDS.map((w) => new RegExp(w.split("").map((c) => c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[\\s._\\-*~^]*"), "gi"));

export function containsProfanity(text: string): boolean {
  const n = normalize(text);
  return WORDS.some((w) => n.includes(normalize(w)));
}

/** 비속어를 같은 길이의 * 로 마스킹 (첫 글자는 남김) */
export function maskProfanity(text: string): string {
  let out = text;
  for (const re of PATTERNS) out = out.replace(re, (m) => (m.length <= 1 ? "*" : m[0] + "*".repeat(m.length - 1)));
  return out;
}
