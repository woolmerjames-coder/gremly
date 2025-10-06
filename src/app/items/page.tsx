"use client";

import { useEffect, useState } from "react";

type Item = { id: string; raw_text: string; bucket?: string; status?: string };

export default function ItemsPage() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/briefs/today");
        const data = await res.json();
        if (mounted && data?.ok) setItems(data.items || []);
      } catch {
        // ignore
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false };
  }, []);

  async function markComplete(id: string) {
    const res = await fetch(`/api/items/${id}/complete`, { method: "POST" });
    const data = await res.json();
    if (data?.ok) setItems((prev) => prev ? prev.map(i => i.id === id ? { ...i, status: 'complete' } : i) : prev);
  }

  if (loading) return <div style={{ padding: 20 }}>Loading...</div>;
  if (!items || items.length === 0) return <div style={{ padding: 20 }}>No items for today.</div>;

  return (
    <div style={{ maxWidth: 720, margin: "24px auto", padding: 12 }}>
  <h2>Today&apos;s items</h2>
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {items.map(it => (
          <li key={it.id} style={{ padding: 8, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontWeight: 600 }}>{it.raw_text}</div>
              <div style={{ fontSize: 12, color: '#666' }}>{it.bucket ?? '—'}</div>
            </div>
            <div>
              {it.status === 'complete' ? (
                <span style={{ color: 'green' }}>Done</span>
              ) : (
                <button onClick={() => markComplete(it.id)}>Mark complete</button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
