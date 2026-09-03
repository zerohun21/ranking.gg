import type { ReactNode } from "react";

/** 초간단 마크다운: **굵게**, *기울임*, - 목록, > 인용, 줄바꿈. HTML 은 렌더하지 않음 */
export function renderMarkdown(src: string): ReactNode {
  const lines = src.split(/\r?\n/);
  const out: ReactNode[] = [];
  let list: ReactNode[] = [];
  const flush = () => {
    if (list.length) {
      out.push(<ul key={`ul-${out.length}`} className="my-1 list-disc pl-5">{list}</ul>);
      list = [];
    }
  };
  const inline = (s: string): ReactNode[] =>
    s.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, i) => {
      if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>;
      if (/^\*[^*]+\*$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>;
      return part;
    });
  lines.forEach((ln, i) => {
    if (/^\s*[-*]\s+/.test(ln)) return void list.push(<li key={i}>{inline(ln.replace(/^\s*[-*]\s+/, ""))}</li>);
    flush();
    if (/^\s*>\s?/.test(ln)) out.push(<blockquote key={i} className="my-1 border-l-2 border-primary/50 pl-3 text-muted-foreground">{inline(ln.replace(/^\s*>\s?/, ""))}</blockquote>);
    else if (/^\s*\d+\.\s+/.test(ln)) out.push(<div key={i} className="pl-1">{inline(ln)}</div>);
    else if (ln.trim() === "") out.push(<div key={i} className="h-2" />);
    else out.push(<p key={i}>{inline(ln)}</p>);
  });
  flush();
  return <div className="text-sm leading-relaxed [&_p]:my-0.5">{out}</div>;
}
