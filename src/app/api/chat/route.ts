import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

type ReqBody = {
  conversationId?: string;
  message: string;
  systemPrompt?: string;
};

async function jsonResponse(body: unknown, status = 200) {
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
    const { conversationId, message, systemPrompt } = body;
    if (!message || typeof message !== "string") {
      return jsonResponse({ error: "Missing message" }, 400);
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) return jsonResponse({ error: "OPENAI_API_KEY not configured" }, 500);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseServiceKey)
      return jsonResponse({ error: "Supabase URL or service key not configured" }, 500);

    const openai = new OpenAI({ apiKey: openaiKey });
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // 1) get session from Supabase auth header if possible (server-side write needs service key)
    // We'll rely on client-side to provide a session; as a fallback we won't persist without user context.

    // For now, try to read the user id from an Authorization header with a supabase access token
    let userId: string | null = null;
    try {
      const authHeader = req.headers.get("authorization");
      if (authHeader && authHeader.startsWith("Bearer ")) {
        const token = authHeader.replace(/^Bearer\s+/, "");
        // validate session with Supabase
        const { data } = await supabase.auth.getUser(token);
        userId = data?.user?.id || null;
      }
    } catch {
      // ignore — we'll still allow operation but won't persist user-scoped data without a user
    }

    // 2) Persist user message to messages/conversations if userId exists
    let convId = conversationId;
    if (userId) {
      if (!convId) {
        const { data: conv, error: convErr } = await supabase
          .from("conversations")
          .insert({ user_id: userId, title: null })
          .select()
          .single();
        if (!convErr && conv?.id) convId = conv.id;
      }

      if (convId) {
        await supabase.from("messages").insert({ conversation_id: convId, user_id: userId, role: "user", content: message });
      }
    }

    // 3) Call OpenAI to get an assistant response and classification
    const system = systemPrompt ||
      "You are an assistant that organizes user input into one bucket: Task, Calendar, Habit, Goal, Note. Reply conversationally and also produce a JSON classification with bucket, confidence (0-1) and a short explain field. Return the JSON only inside a markdown code block labeled JSON when asked to output it.";

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: system },
        { role: "user", content: message }
      ],
      response_format: { type: "json_object" }
    });

    const raw = completion.choices?.[0]?.message?.content || "{}";
    let assistantText = "";
    let parsed: unknown = {};
    try {
      if (typeof raw === "string") {
        assistantText = raw;
        parsed = JSON.parse(raw);
      } else {
        parsed = raw;
        assistantText = JSON.stringify(raw);
      }
    } catch {
      // fallback: try to extract JSON substring
      assistantText = String(raw);
      const m = String(raw).match(/\{[\s\S]*\}/);
      if (m) {
        try { parsed = JSON.parse(m[0]); } catch { parsed = {}; }
      }
    }

  const parsedRec = parsed as Record<string, unknown> | null;
  const bucket = (parsedRec?.bucket as string) || "Note";
  const confidence = (parsedRec?.confidence as number) ?? 0.5;
  const AUTO_CREATE_NOTES = process.env.AUTO_CREATE_NOTES === 'true';

    // 4) persist assistant message and create an item when bucket indicates
  let savedItem: unknown = null;
    if (userId) {
      if (convId) {
        await supabase.from("messages").insert({ conversation_id: convId, user_id: userId, role: "assistant", content: assistantText });
      }

      // create an item for Task/Goal/Habit/Calendar, optionally Notes
      if (["Task", "Goal", "Habit", "Calendar"].includes(bucket) || (bucket === 'Note' && AUTO_CREATE_NOTES)) {
  const toInsert: Record<string, unknown> = { user_id: userId, raw_text: message, bucket, source_conversation: convId };
        // only include confidence if column exists (avoid failures if column not present)
        try {
          const { data: item, error: itemErr } = await supabase
            .from("items")
            .insert(toInsert)
            .select()
            .single();
          if (!itemErr) savedItem = item;
        } catch {
          // insert failed (schema mismatch) — ignore gracefully
        }
      }
    }

  return jsonResponse({ ok: true, assistant: assistantText, classification: { bucket, confidence, explain: parsedRec?.explain as string | undefined }, conversationId: convId, savedItem }, 200);
  } catch (e: unknown) {
    return jsonResponse({ error: formatError(e) }, 500);
  }
}
