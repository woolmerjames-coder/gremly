"use client";

import { useEffect, useState } from "react";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<unknown>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const mod = await import("@/lib/supabaseClient");
        const supabase = mod.supabase;
        if (!supabase) {
          if (mounted) setLoading(false);
          return;
        }
  const { data: sessionData } = await supabase.auth.getSession();
  if (!mounted) return;
  setSession(sessionData.session ?? null);
        setLoading(false);

        const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
          if (!mounted) return;
          setSession(s);
        });
        return () => sub.subscription.unsubscribe();
      } catch {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  if (loading) return <p style={{ padding: 16 }}>Loading...</p>;
  if (!session)
    return (
      <p style={{ padding: 16 }}>
        Please <a href="/signin">sign in</a> to continue.
      </p>
    );
  return <>{children}</>;
}
