import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

type ReqBody = { id?: string; text?: string };

function jsonResponse(body: unknown, status = 200) {
  return NextResponse.json(body as Record<string, unknown>, { status });
}

function formatError(e: unknown) {
  if (!e) return 'Unknown error';
  if (typeof e === 'string') return e;
  if (typeof e === 'object' && 'message' in e) return (e as { message?: string }).message;
  return String(e);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ReqBody;
    const { id, text } = body;
    if (!id || !text) return jsonResponse({ error: "Missing id/text" }, 400);

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) return jsonResponse({ error: "OPENAI_API_KEY is not configured on the server." }, 500);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    // Prefer a server/service role key for server-side updates. Fall back to anon key only if present (may fail with RLS).
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseServiceKey)
      return jsonResponse({ error: "Supabase URL or key not configured (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)." }, 500);

    // create clients only after env checks so imports don't throw at module load
    const openai = new OpenAI({ apiKey: openaiKey });

    // 1) Ask the model to classify
    const sys =
      "Classify the user's note into exactly one of: Task, Calendar, Habit, Goal, Note. Return JSON: {\"bucket\": <one of those>, \"confidence\": number between 0 and 1, \"explain\": short explanation}. Respond with valid JSON only.";

    const chat = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: text }
      ],
      response_format: { type: "json_object" }
    });

    const raw = chat.choices?.[0]?.message?.content || "{}";
    let parsed: unknown = {};
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      // fallback: try to extract JSON substring
      const m = String(raw).match(/\{[\s\S]*\}/);
      if (m) {
        try {
          parsed = JSON.parse(m[0]);
        } catch {
          parsed = {};
        }
      }
    }

  const parsedRec = parsed as Record<string, unknown> | null;
  const bucket = (parsedRec?.bucket as string) || "Note";
  const confidence = (parsedRec?.confidence as number) ?? 0.5;

    // 2) Update Supabase row server-side (use service key when available)
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { error } = await supabase.from("items").update({ bucket, ai_score: confidence }).eq("id", id);
    if (error) return jsonResponse({ error: error.message }, 500);

    return jsonResponse({ ok: true, bucket, confidence }, 200);
    } catch (e: unknown) {
    return jsonResponse({ error: formatError(e) }, 500);
  }
}
