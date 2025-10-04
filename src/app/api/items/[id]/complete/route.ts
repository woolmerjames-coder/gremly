import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body as Record<string, unknown>, { status });
}

function formatError(e: unknown) {
  if (!e) return 'Unknown error';
  if (typeof e === 'string') return e;
  if (typeof e === 'object' && 'message' in e) return (e as { message?: string }).message;
  return String(e);
}

export async function POST(req: Request, context: unknown) {
  try {
    let id: string | undefined = undefined;
    if (context && typeof context === 'object' && 'params' in context) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const c = context as any;
      if (c.params && typeof c.params.id === 'string') id = c.params.id;
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) return jsonResponse({ error: "Supabase not configured" }, 500);

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data, error } = await supabase
      .from("items")
      .update({ status: "complete", completed_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error) return jsonResponse({ error: error.message }, 500);
    return jsonResponse({ ok: true, item: data }, 200);
  } catch (e: unknown) {
    return jsonResponse({ error: formatError(e) }, 500);
  }
}
