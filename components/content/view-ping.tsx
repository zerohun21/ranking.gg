"use client";
import { useEffect } from "react";

export function ViewPing({ contentId }: { contentId: number }) {
  useEffect(() => {
    const key = `viewed:${contentId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {}
    fetch("/api/view", { method: "POST", body: JSON.stringify({ contentId }), headers: { "content-type": "application/json" } }).catch(() => {});
  }, [contentId]);
  return null;
}
