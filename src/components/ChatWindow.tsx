"use client";

import React, { useState } from "react";

type Message = { id: string; role: "user" | "assistant"; text: string };
type Classification = { bucket: string; confidence?: number; explain?: string } | null;

export default function ChatWindow({ accessToken, showSidebar = true }: { accessToken?: string | null; showSidebar?: boolean }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<Array<{ id: string; raw_text: string; bucket?: string; status?: string }>>([]);
  const [lastClassification, setLastClassification] = useState<Classification>(null);
  const [toasts, setToasts] = useState<Array<{ id: string; text: string }>>([]);
  const [autoCreateNotes, setAutoCreateNotes] = useState(false);

  async function send() {
    if (!input.trim()) return;
    const userMsg: Message = { id: String(Date.now()), role: "user", text: input };
    setMessages((m) => [...m, userMsg]);
    setInput("");
    setLoading(true);

      try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {})
        },
        body: JSON.stringify({ message: userMsg.text })
      });
      const data = await res.json();
      if (data?.assistant) {
        const assistantMsg: Message = { id: String(Date.now() + 1), role: "assistant", text: data.assistant };
        setMessages((m) => [...m, assistantMsg]);
        // store classification for UI actions
        if (data?.classification) setLastClassification(data.classification);
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
              <div style={{ padding: 8, background: m.role === "user" ? "#f0f9ff" : "#f7f7f7", borderRadius: 6, color: '#000' }}>{m.text}</div>
            </div>
          ))
        )}
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input value={input} onChange={(e) => setInput(e.target.value)} style={{ flex: 1, padding: 8, color: '#000' }} placeholder="Type a message..." />
        <button disabled={loading} onClick={send} style={{ padding: "8px 12px" }}>{loading ? "Sending..." : "Send"}</button>
      </div>

      {/* Classification / Save UI */}
      {lastClassification && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 13, fontWeight: 600 }}>Last classification</div>
          <div style={{ marginTop: 6, color: '#000' }}>
            <div>Bucket: {lastClassification.bucket}</div>
            <div>Confidence: {Math.round((lastClassification.confidence ?? 0) * 100)}%</div>
            <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input type="checkbox" checked={autoCreateNotes} onChange={(e) => setAutoCreateNotes(e.target.checked)} />
                <span style={{ fontSize: 13 }}>Auto-create Notes</span>
              </label>
              <button onClick={async () => {
                // optimistic save: add to UI first
                const lastUser = [...messages].reverse().find(x => x.role === 'user');
                const textToSave = lastUser ? lastUser.text : input;
                const optimisticId = `opt-${Date.now()}`;
                const optimisticItem = { id: optimisticId, raw_text: textToSave, bucket: lastClassification.bucket };
                setItems(prev => [optimisticItem, ...prev]);
                // show toast
                const toastId = String(Date.now());
                setToasts(t => [...t, { id: toastId, text: 'Saving...' }]);

                try {
                  const res = await fetch('/api/items', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}) },
                    body: JSON.stringify({ raw_text: textToSave, bucket: lastClassification.bucket })
                  });
                  const j = await res.json();
                  if (j?.ok && j.item) {
                    // replace optimistic item with returned item
                    setItems(prev => [j.item, ...prev.filter(it => it.id !== optimisticId)]);
                    setToasts(t => t.map(x => x.id === toastId ? { ...x, text: 'Saved' } : x));
                    setTimeout(() => setToasts(t => t.filter(x => x.id !== toastId)), 2000);
                  } else {
                    // rollback optimistic
                    setItems(prev => prev.filter(it => it.id !== optimisticId));
                    setToasts(t => t.map(x => x.id === toastId ? { ...x, text: 'Save failed' } : x));
                    setTimeout(() => setToasts(t => t.filter(x => x.id !== toastId)), 3000);
                  }
                } catch {
                  setItems(prev => prev.filter(it => it.id !== optimisticId));
                  setToasts(t => t.map(x => x.id === toastId ? { ...x, text: 'Save failed' } : x));
                  setTimeout(() => setToasts(t => t.filter(x => x.id !== toastId)), 3000);
                } finally {
                  setLastClassification(null);
                }
              }} style={{ padding: 8 }}>Save as item</button>
            </div>
          </div>
        </div>
      )}
      </div>

      {showSidebar && (
        <aside style={{ width: 320, borderLeft: '1px solid #eee', paddingLeft: 12 }}>
          <h3>Collected items</h3>
          {items.length === 0 ? (
            <div style={{ color: '#666' }}>No items yet</div>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {items.map(it => (
                <li key={it.id} style={{ padding: 8, borderBottom: '1px solid #f2f2f2' }}>
                  <div style={{ fontWeight: 600 }}>{it.raw_text}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>{it.bucket ?? '—'}</div>
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
