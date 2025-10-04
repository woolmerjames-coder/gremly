import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

type ReqBody = { id?: string; text?: string };

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ReqBody;
    const { id, text } = body;
    if (!id || !text) return NextResponse.json({ error: "Missing id/text" }, { status: 400 });

    if (!process.env.OPENAI_API_KEY)
      return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });

    // 1) Ask the model to classify
    const sys = "Classify the user's note into exactly one of: Task, Calendar, Habit, Goal, Note. Return JSON: {\"bucket\": <one of those>, \"confidence\": number between 0 and 1, \"explain\": short explanation}. Respond with valid JSON only.";

    const chat = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: sys },
        { role: "user", content: text }
      ],
      response_format: { type: "json_object" }
    });

    const raw = chat.choices?.[0]?.message?.content || "{}";
    let parsed: any = {};
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch (e) {
      // fallback: try to extract JSON substring
      const m = String(raw).match(/\{[\s\S]*\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch (_) { parsed = {}; }
      }
    }

    const bucket = parsed.bucket || "Note";
    const confidence = parsed.confidence ?? 0.5;

    // 2) Update Supabase row server-side
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error } = await supabase
      .from("items")
      .update({ bucket, ai_score: confidence })
      .eq("id", id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ ok: true, bucket, confidence });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? String(e) }, { status: 500 });
  }
}
