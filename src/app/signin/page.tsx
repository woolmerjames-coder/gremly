"use client";

import { useState } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    let supabase: SupabaseClient | null = null;
    try {
      const mod = await import("@/lib/supabaseClient");
      supabase = mod.supabase;
    } catch (err: unknown) {
      setError(`Failed to load Supabase client: ${getMessage(err)}`);
      return;
    }

    if (!supabase) {
      setError(
        "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local"
      );
      return;
    }

    try {
      const { error: signError } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined },
      });
      if (signError) setError(signError.message);
      else setSent(true);
    } catch (err: unknown) {
      setError(getMessage(err));
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: "40px auto", padding: 16 }}>
      <h1>Sign in</h1>
      {sent ? (
        <p>Check your email for a magic link.</p>
      ) : (
        <form onSubmit={onSubmit}>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ width: "100%", padding: 8, marginBottom: 8 }}
            required
          />
          <button type="submit" style={{ padding: "8px 12px" }}>
            Send magic link
          </button>
        </form>
      )}
      {error && <p style={{ color: "red" }}>{error}</p>}
    </div>
  );

  function getMessage(e: unknown) {
    if (!e) return String(e);
    if (typeof e === "string") return e;
    if (typeof e === "object" && "message" in e) return (e as { message?: string }).message ?? String(e);
    return String(e);
  }
}
