"use client";

import { useEffect, useState } from "react";
import AuthGate from "@/components/AuthGate";

type Item = {
  id: string;
  raw_text: string;
  bucket?: string | null;
  created_at: string;
};

export default function Home() {
  const [text, setText] = useState("");
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const mod = await import("@/lib/supabaseClient");
        const supabase = mod.supabase;
        if (!supabase) return setLoading(false);

        const { data, error } = await supabase
          .from("items")
          .select("id, raw_text, bucket, created_at")
          .order("created_at", { ascending: false });

        if (!mounted) return;
        if (!error && data) setItems(data as Item[]);
      } catch (err) {
        // ignore
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  async function addItem() {
    if (!text.trim()) return;
    const mod = await import("@/lib/supabaseClient");
    const supabase = mod.supabase;
    if (!supabase) return alert("Supabase not configured");

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) return alert("Please sign in");

    const { data, error } = await supabase
      .from("items")
      .insert({ raw_text: text.trim(), user_id: user.id })
      .select()
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    setItems((prev) => [data as Item, ...(prev || [])]);
    setText("");

    // ask the server to classify it, then update the visible list
    fetch("/api/classify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: (data as Item).id, text: (data as Item).raw_text })
    })
      .then((r) => r.json())
      .then((res) => {
        if (res?.bucket) {
          setItems((prev) => prev.map((it) => it.id === (data as Item).id ? { ...it, bucket: res.bucket } : it));
        }
      })
      .catch(() => {});
  }

  return (
    <AuthGate>
      <div style={{ maxWidth: 640, margin: "24px auto", padding: 16 }}>
        <h1>Brain Dump</h1>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type any thought..."
            style={{ flex: 1, padding: 8 }}
          />
          <button onClick={addItem} style={{ padding: "8px 12px" }}>
            Add
          </button>
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : items.length === 0 ? (
          <p>No items yet. Add one above.</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0 }}>
            {items.map((it) => (
              <li key={it.id} style={{ padding: 8, borderBottom: "1px solid #eee" }}>
                <div style={{ fontWeight: 600 }}>{it.raw_text}</div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Bucket: {it.bucket ?? "—"}</div>
                <div style={{ fontSize: 11, color: "#666", marginTop: 6 }}>{new Date(it.created_at).toLocaleString()}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AuthGate>
  );
}
