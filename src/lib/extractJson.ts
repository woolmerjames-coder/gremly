export function extractJson(text: string) {
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();
  const match = cleaned.match(/\{[\s\S]*\}$/);
  return JSON.parse(match ? match[0] : cleaned);
}

export function stripCodeFences(s: string) {
  return s.replace(/```(?:json)?\n?/gi, "").replace(/```/g, "").trim();
}
