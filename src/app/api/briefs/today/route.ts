import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

async function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body as Record<string, unknown>, { status });
}

function formatError(e: unknown) {
  if (!e) return 'Unknown error';
  if (typeof e === 'string') return e;
  if (typeof e === 'object' && 'message' in e) return (e as { message?: string }).message;
  return String(e);
}

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnon) return jsonResponse({ error: "Supabase not configured" }, 500);

    const supabase = createClient(supabaseUrl, supabaseAnon);

    // For demo: return open items for the current user
    // In production, use auth session to scope results to user via RLS
    const todayStart = new Date();
    todayStart.setHours(0,0,0,0);
    const todayEnd = new Date();
    todayEnd.setHours(23,59,59,999);

    const { data, error } = await supabase
      .from("items")
      .select("id, raw_text, bucket, due_date, status, created_at")
      .order("due_date", { ascending: true })
      .gte("created_at", todayStart.toISOString())
      .lte("created_at", todayEnd.toISOString());

    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ ok: true, items: data }, 200);
  } catch (_err: unknown) {
    return jsonResponse({ error: formatError(_err) }, 500);
  }
}
