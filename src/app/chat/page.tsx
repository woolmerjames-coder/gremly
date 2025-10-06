"use client";

import { useEffect, useState } from "react";
import ChatWindow from "@/components/ChatWindow";

export default function ChatPage() {
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const mod = await import("@/lib/supabaseClient");
        const supabase = mod.supabase;
        if (!supabase) return;
        const { data } = await supabase.auth.getSession();
        const t = data?.session?.access_token;
        if (t) setToken(t);
      } catch {
        // ignore
      }
    })();
  }, []);

  return (
    <div>
      <h1 style={{ textAlign: "center", marginTop: 24 }}>Chat & Organize</h1>
      <ChatWindow accessToken={token} />
    </div>
  );
}
