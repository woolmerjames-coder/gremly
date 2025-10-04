"use client";

import React from "react";

// Minimal markdown-ish renderer for our simple assistant replies.
// Supports: paragraphs, single-line breaks, **bold**, *italic*, simple links [text](url)
// This avoids adding a dependency for a full markdown parser.

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderSimpleMarkdown(text: string) {
  // Escape HTML first
  let html = escapeHtml(text);
  // bold
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  // italic
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  // links
  html = html.replace(/\[(.*?)\]\((https?:\/\/[^)]+)\)/g, "<a href=\"$2\" target=\"_blank\" rel=\"noopener noreferrer\">$1</a>");
  // convert double newlines to paragraph breaks
  html = html.split(/\n\n+/).map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`).join('');
  return html;
}

export default function AssistantBubble({ text }: { text: string }) {
  const html = renderSimpleMarkdown(text);
  return (
    <div style={{ display: 'flex', marginBottom: 10 }}>
      <div style={{ maxWidth: '75%', background: '#f7f7f7', padding: 12, borderRadius: 12, color: '#0b0b0b', boxShadow: '0 1px 0 rgba(0,0,0,0.02)' }}>
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    </div>
  );
}
