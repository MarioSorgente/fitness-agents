"use client";

import DOMPurify from "dompurify";
import { marked } from "marked";
import { useEffect, useMemo, useState } from "react";

/**
 * Render Markdown to sanitized HTML for an on-screen preview. Sanitization runs
 * only in the browser (DOMPurify needs the DOM), so we gate it behind a mounted
 * flag to stay SSR-safe.
 */
export function MarkdownPreview({ markdown }: { markdown: string }) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const html = useMemo(() => {
    if (!mounted) return "";
    const raw = marked.parse(markdown, { async: false, gfm: true, breaks: false }) as string;
    return DOMPurify.sanitize(raw);
  }, [markdown, mounted]);

  if (!mounted) {
    return <div className="markdown-preview muted-copy">Rendering preview…</div>;
  }

  return <div className="markdown-preview" dangerouslySetInnerHTML={{ __html: html }} />;
}
