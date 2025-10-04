export type ClassifierResult = {
  bucket: "Task" | "Calendar Event" | "Habit" | "Goal/Project" | "Note/Reflection";
  confidence: number;
  explain: string;
};

export async function classifyText(text: string): Promise<ClassifierResult> {
  const res = await fetch("/api/classify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}
