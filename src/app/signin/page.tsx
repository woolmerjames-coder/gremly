"use client"; // runs in the browser

import { useState } from "react";

export default function SignInPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    // Dynamically import the supabase client to avoid importing it at module
    // load time in a client component (which can cause bundling/runtime issues).
    let supabase: any = null;
    try {
      const mod = await import("@/lib/supabaseClient");
      supabase = mod.supabase;
    } catch (err: any) {
      setError(
        `Failed to load Supabase client: ${err?.message ?? String(err)}`
      );
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
        options: {
          emailRedirectTo:
            typeof window !== "undefined" ? window.location.origin : undefined,
        },
      });

      if (signError) setError(signError.message);
      else setSent(true);
    } catch (err: any) {
      setError(err?.message ?? String(err));
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
}
