export type Classification = {
  bucket: "Task" | "Calendar Event" | "Habit" | "Goal/Project" | "Note/Reflection";
  confidence: number; // 0..1
  explain: string;    // 1 short sentence
  suggestedNextStep?: string; // optional, short imperative
  when?: string;      // optional: ISO or natural text if user mentions time
};
