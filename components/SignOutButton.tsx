"use client";

import { useState } from "react";

export default function SignOutButton({ className }: { className?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signOut() {
    setError(null);
    setLoading(true);
    try {
      const mod = await import("@/lib/supabaseClient");
      const supabase = mod.supabase;
      if (!supabase) {
        setError("Supabase is not configured. Sign out cannot proceed.");
        return;
      }

      const { error } = await supabase.auth.signOut();
      if (error) setError(error.message);
      else {
        // reload to reflect signed-out UI; apps may instead update auth state.
        window.location.reload();
      }
    } catch (err: any) {
      setError(err?.message ?? String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={className}>
      <button onClick={signOut} disabled={loading} style={{ padding: "6px 10px" }}>
        {loading ? "Signing out…" : "Sign out"}
      </button>
      {error && <div style={{ color: "red", marginTop: 8 }}>{error}</div>}
    </div>
  );
}
