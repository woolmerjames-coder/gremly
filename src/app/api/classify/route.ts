import { NextResponse } from "next/server";
import OpenAI from "openai";
import { extractJson } from "../../../lib/extractJson";
import type { Classification } from "../../../lib/types";

type ReqBody = { text?: string };

function formatError(e: unknown) {
  if (!e) return "Unknown error";
  if (typeof e === "string") return e;
  if (typeof e === "object" && "message" in e) return (e as { message?: string }).message;
  return String(e);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ReqBody;
    const text = body?.text;
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) return NextResponse.json({ error: "OPENAI_API_KEY not configured" }, { status: 500 });

    const openai = new OpenAI({ apiKey: openaiKey });

  const system = `You are a classifier for an ADHD-friendly BrainDump.\nReturn ONLY a single JSON object and nothing else.\nDo not include code fences, labels, or explanations.\nKeys: bucket, confidence, explain, suggestedNextStep, when.\nConfidence is 0..1 with one decimal. Keep strings short.`;

    const exampleUser = "Note: remember to water the plants tomorrow";
    const exampleAssistant = JSON.stringify({ bucket: "Note/Reflection", confidence: 0.9, explain: "Explicit 'Note:' and reminder tone." });

    const schema = {
      type: "object",
      additionalProperties: false,
      // Provider requires 'required' to include every key in properties; include optional keys too
      required: ["bucket", "confidence", "explain", "suggestedNextStep", "when"],
      properties: {
        bucket: { type: "string", enum: ["Task", "Calendar Event", "Habit", "Goal/Project", "Note/Reflection"] },
        confidence: { type: "number", minimum: 0, maximum: 1 },
        explain: { type: "string" },
        suggestedNextStep: { type: "string" },
        when: { type: "string" }
      }
    } as const;

    // Responses API call - cast to any so we can include the `seed` field per spec
    // note: the Responses API expects the previous `messages` param under `input`
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const resp = await (openai.responses.create as any)({
      model: "gpt-4o-mini",
      temperature: 0.2,
      input: [
        { role: "system", content: system },
        { role: "user", content: exampleUser },
        { role: "assistant", content: exampleAssistant },
        { role: "user", content: text }
      ],
      text: {
        format: {
          name: "classification",
          type: "json_schema",
          schema: schema
        }
      }
    });

  // Prefer output_text when available
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const anyResp: any = resp;
    let outputText: string | undefined = anyResp.output_text;
    if (!outputText) {
      try {
        const out = anyResp.output?.[0]?.content?.find((c: any) => c.type === "output_text")?.text;
        if (typeof out === "string") outputText = out;
      } catch {
        // ignore
      }
    }

    // Try to extract JSON using our helper, falling back to the SDK json_schema block
    let parsed: unknown = null;
    if (outputText) {
      try {
        parsed = extractJson(String(outputText));
      } catch {
        // fallthrough
      }
    }

    if (!parsed && anyResp.output?.[0]?.content) {
      try {
        const js = anyResp.output[0].content.find((c: any) => c.type === 'json_schema');
        if (js && js?.json_schema && js?.json_schema?.classification?.value) {
          parsed = js.json_schema.classification.value;
        }
      } catch {
        // ignore
      }
    }

    if (!parsed) {
      return NextResponse.json({ error: "Model did not return valid JSON", raw: outputText ?? anyResp }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }

    // Basic runtime validation / coercion to Classification
    try {
      const obj = parsed as Partial<Classification>;
      const buckets = ["Task", "Calendar Event", "Habit", "Goal/Project", "Note/Reflection"] as const;
      if (!obj.bucket || !buckets.includes(obj.bucket as any)) throw new Error('invalid bucket');
      if (typeof obj.confidence !== 'number' || Number.isNaN(obj.confidence)) throw new Error('invalid confidence');
      // clamp and one decimal
      let conf = Math.max(0, Math.min(1, Number(obj.confidence)));
      conf = Math.round(conf * 10) / 10;
      if (!obj.explain || typeof obj.explain !== 'string') throw new Error('invalid explain');

      const classification: Classification = {
        bucket: obj.bucket as Classification['bucket'],
        confidence: conf,
        explain: String(obj.explain).slice(0, 200),
      };
      if (obj.suggestedNextStep && typeof obj.suggestedNextStep === 'string') classification.suggestedNextStep = obj.suggestedNextStep.slice(0, 200);
      if (obj.when && typeof obj.when === 'string') classification.when = obj.when.slice(0, 200);

      return NextResponse.json(classification, { status: 200, headers: { "Cache-Control": "no-store" } });
    } catch (err) {
      return NextResponse.json({ error: String(err), raw: parsed }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }
  } catch (e: unknown) {
    return NextResponse.json({ error: formatError(e) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, methods: ["POST"], note: "POST to this endpoint with { text } to get a classification" }, { status: 200, headers: { "Cache-Control": "no-store" } });
}
