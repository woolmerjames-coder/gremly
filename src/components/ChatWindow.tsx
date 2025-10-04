"use client";

import React, { useState } from "react";
import { classifyText, ClassifierResult } from "../lib/classify";
import AssistantBubble from "./AssistantBubble";
import ClassificationBadge from "./ClassificationBadge";

type Message = { id: string; role: "user" | "assistant"; text: string; classification?: Classification };
type Classification = ClassifierResult | null;

export default function ChatWindow({ accessToken, showSidebar = true }: { accessToken?: string | null; showSidebar?: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Array<{ id: string; raw_text: string; bucket?: string; status?: string; when?: string; suggestedNextStep?: string }>>([]);
  // classification is stored on the user message object itself
  const [toasts, setToasts] = useState<Array<{ id: string; text: string }>>([]);
  const [autoCreateNotes, setAutoCreateNotes] = useState(false);

  async function send() {
    if (!input.trim()) return;
    const userMsg: Message = { id: String(Date.now()), role: "user", text: input };
    setMessages((m) => [...m, userMsg]);
    // 1) classify via API
    let classification: Classification = null;
    try {
      const r = await fetch('/api/classify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: userMsg.text }) });
        if (r.ok) {
        const json = await r.json();
        classification = json as any;
        // attach classification to message in state
        setMessages((m) => m.map(msg => msg.id === userMsg.id ? { ...msg, classification } : msg));
        // append to collected items (optimistic id)
        setItems(it => [{ id: String(Date.now()), raw_text: userMsg.text, bucket: classification?.bucket, when: classification?.when, suggestedNextStep: classification?.suggestedNextStep }, ...it]);
      }
    } catch {
      // ignore
    }
    setInput("");
    setLoading(true);

      try {
      // 2) ask server to generate short assistant text using classification
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({ message: userMsg.text, classification })
      });
      const data = await res.json();
      if (data?.assistant) {
        const assistantMsg: Message = { id: String(Date.now() + 1), role: "assistant", text: data.assistant };
        setMessages((m) => [...m, assistantMsg]);
        // store server classification on assistant response if provided
        if (data?.classification) {
          // save classification onto the last user message
          const lastUser = [...messages].reverse().find(x => x.role === 'user');
          if (lastUser) {
            setMessages(m => m.map(msg => msg.id === lastUser.id ? { ...msg, classification: data.classification } : msg));
          }
          // ensure collected items has the server classification details
          setItems(it => it.map(itm => itm.raw_text === userMsg.text ? { ...itm, bucket: data.classification.bucket, when: data.classification.when, suggestedNextStep: data.classification.suggestedNextStep } : itm));
        }
        // refresh items if the server created one
        if (data?.savedItem) fetchItems();
      } else if (data?.error) {
        const errMsg: Message = { id: String(Date.now() + 2), role: "assistant", text: `Error: ${data.error}` };
        setMessages((m) => [...m, errMsg]);
      }
    } catch (err: unknown) {
      const errMsg: Message = { id: String(Date.now() + 3), role: "assistant", text: `Error: ${String(err)}` };
      setMessages((m) => [...m, errMsg]);
    } finally {
      setLoading(false);
    }
  }

  async function fetchItems() {
    try {
      const res = await fetch("/api/briefs/today");
      const json = await res.json();
      if (json?.ok) setItems(json.items || []);
    } catch {
      // ignore
    }
  }

  // load items on mount
  React.useEffect(() => { fetchItems(); }, []);

  return (
    <div style={{ display: 'flex', maxWidth: 1100, margin: "24px auto", padding: 12, gap: 12 }}>
      <div style={{ flex: 1 }}>
        <div style={{ border: "1px solid #eee", padding: 12, borderRadius: 8, minHeight: 200 }}>
        {messages.length === 0 ? (
          <div style={{ color: "#666" }}>Say something to get started...</div>
        ) : (
          messages.map((m) => (
            <div key={m.id} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: "#888" }}>{m.role}</div>
              {m.role === 'assistant' ? (
                <AssistantBubble text={m.text} />
              ) : (
                <div style={{ padding: 8, background: m.role === "user" ? "#f0f9ff" : "#f7f7f7", borderRadius: 6, color: '#000' }}>{m.text}</div>
              )}
              {m.role === 'user' && m.classification && (
                <ClassificationBadge c={m.classification} />
              )}
            </div>
          ))
        )}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} style={{ flex: 1, padding: 8, color: '#000' }} placeholder="Type a message..." />
        <button disabled={loading} onClick={send} style={{ padding: "8px 12px" }}>{loading ? "Sending..." : "Send"}</button>
      </div>

      {/* Classification / Save UI */}
      {/* Render classification under each user message inside the message list */}
      </div>

      {showSidebar && (
        <aside style={{ width: 320, borderLeft: '1px solid #eee', paddingLeft: 12 }}>
          <h3>Collected items</h3>
          {items.length === 0 ? (
            <div style={{ color: '#666' }}>No items yet</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {items.map(it => (
                <li key={it.id} style={{ padding: 8, borderBottom: '1px solid #f2f2f2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>{it.raw_text.split(' ').slice(0,8).join(' ')}{it.raw_text.split(' ').length>8?'…':''}</div>
                    <div style={{ fontSize: 12, color: '#666' }}>{it.bucket ?? '—'} {it.when ? `· ${it.when}` : ''}</div>
                  </div>
                  <div>
                    {it.suggestedNextStep && (
                      <button onClick={() => setInput(it.suggestedNextStep || '')} style={{ fontSize: 12, padding: '6px 8px', borderRadius: 6 }}>Add next step</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </aside>
      )}
      {/* Toasts */}
      <div style={{ position: 'fixed', right: 20, bottom: 20, zIndex: 9999 }}>
        {toasts.map(t => (
          <div key={t.id} style={{ background: '#111', color: '#fff', padding: '8px 12px', borderRadius: 6, marginTop: 8 }}>{t.text}</div>
        ))}
      </div>
    </div>
  );
}
