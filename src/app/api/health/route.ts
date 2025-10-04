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
  const details: Record<string, unknown> = {};

  // Check env
  const openaiPresent = !!process.env.OPENAI_API_KEY;
  details.openai = {
    present: openaiPresent,
  };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const dbOk = !!supabaseUrl && !!supabaseKey;

  // Check DB column existence via a lightweight query
  if (!dbOk) {
    details.db = { ok: false, error: 'Supabase client not configured (missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY)' };
    return jsonResponse({ ok: false, details }, 500);
  }

  const supabase = createClient(supabaseUrl!, supabaseKey!);
  try {
    // Attempt to select the `status` column from `items`. If the column doesn't exist,
    // PostgREST will return an error which we can use to detect schema mismatch.
    const { error: testErr } = await supabase.from('items').select('status').limit(1);
    const dbDetail: { ok: boolean; error?: string } = testErr ? { ok: false, error: testErr.message || String(testErr) } : { ok: true };
    details.db = dbDetail;

    const ok = openaiPresent && dbDetail.ok;
    return jsonResponse({ ok, details }, 200);
  } catch (_err: unknown) {
    details.db = { ok: false, error: formatError(_err) };
    return jsonResponse({ ok: false, details }, 500);
  }
}
