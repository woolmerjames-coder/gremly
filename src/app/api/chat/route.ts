import { NextResponse } from "next/server";
import OpenAI from "openai";
import { createClient } from "@supabase/supabase-js";

type ReqBody = {
  conversationId?: string;
  message: string;
  systemPrompt?: string;
  classification?: Record<string, unknown>;
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

    // 3) Obtain classification: prefer classification supplied by client;
    // otherwise call the classify API internally.
    const supplied = (body as any).classification as Record<string, unknown> | undefined;
    let classification = supplied;
    if (!classification) {
      try {
        const r = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/classify`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: message })
        });
        if (r.ok) classification = await r.json();
      } catch {
        // ignore and continue
      }
    }

    // Basic safe defaults if classification missing
    const parsedRec = (classification ?? {}) as Record<string, unknown>;
    const bucket = (parsedRec?.bucket as string) || "Note/Reflection";
    const confidence = Number(parsedRec?.confidence ?? 0.5) as number;
    const AUTO_CREATE_NOTES = process.env.AUTO_CREATE_NOTES === 'true';

    // 4) persist assistant message and create an item when bucket indicates
  let savedItem: unknown = null;
    if (userId) {
      if (convId) {
        // Save the short assistant text (we'll generate below)
        // placeholder: assistantText will be generated server-side below
      }

      // create an item for Task/Goal/Habit/Calendar, optionally Notes
    if (["Task", "Goal/Project", "Habit", "Calendar Event"].includes(bucket) || (bucket === 'Note/Reflection' && AUTO_CREATE_NOTES)) {
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

    // Build a short assistant sentence from classification (no JSON)
    const explain = (parsedRec?.explain as string) || '';
    const suggested = (parsedRec?.suggestedNextStep as string) || '';
    const when = (parsedRec?.when as string) || '';
    let assistantText = '';
    if (bucket === 'Task') {
      assistantText = `Captured as a Task${when ? ' — ' + when : ''}${suggested ? ` — ${suggested}` : ''}`;
      // prefer brief: if suggested present, ask to set reminder
      assistantText = suggested ? `Captured as a Task — ${suggested}` : `Captured as a Task${when ? ' — ' + when : ''}`;
    } else if (bucket === 'Calendar Event') {
      assistantText = suggested ? `Saved as an event — ${suggested}` : `Saved as an event${when ? ' — ' + when : ''}`;
    } else if (bucket === 'Habit') {
      assistantText = suggested ? `Captured as a Habit — ${suggested}` : `Captured as a Habit`;
    } else if (bucket === 'Goal/Project') {
      assistantText = suggested ? `Captured as a Goal — ${suggested}` : `Captured as a Goal/Project`;
    } else {
      assistantText = suggested ? `Saved as a Note — ${suggested}` : `Saved as a Note`;
    }

    // persist assistant message now
    if (userId && convId) {
      try {
        await supabase.from("messages").insert({ conversation_id: convId, user_id: userId, role: "assistant", content: assistantText });
      } catch {
        // ignore
      }
    }

    return jsonResponse({ ok: true, assistant: assistantText, classification: { ...parsedRec }, conversationId: convId, savedItem }, 200);
  } catch (e: unknown) {
    return jsonResponse({ error: formatError(e) }, 500);
  }
}
