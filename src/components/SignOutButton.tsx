"use client";

import React, { useState, useEffect } from "react";

function getMessage(e: unknown) {
  if (!e) return String(e);
  if (typeof e === 'string') return e;
  if (typeof e === 'object' && 'message' in e) return (e as { message?: string }).message ?? String(e);
  return String(e);
}

export default function SignOutButton({ className }: { className?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

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
        window.location.reload();
      }
    } catch (err: unknown) {
      setError(getMessage(err));
    } finally {
      setLoading(false);
    }
  }

  // Load current user on mount
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const mod = await import("@/lib/supabaseClient");
        const supabase = mod.supabase;
        if (!supabase) return;
        // auth.getUser is sync in the client; use getSession to be safe
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        setEmail(data.session?.user?.email ?? null);
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className={className}>
      <button onClick={signOut} disabled={loading} style={{ padding: "6px 10px" }}>
        {loading ? "Signing out…" : "Sign out"}
      </button>
      {email && <div style={{ fontSize: 12, color: "#333", marginTop: 6 }}>Signed in as {email}</div>}
      {error && <div style={{ color: "red", marginTop: 8 }}>{error}</div>}
    </div>
  );
}
