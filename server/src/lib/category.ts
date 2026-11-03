const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Food: ["dinner", "lunch", "breakfast", "groceries", "restaurant", "cafe"],
  Travel: ["flight", "train", "taxi", "uber", "cab", "gas", "fuel"],
  Lodging: ["hotel", "cabin", "airbnb", "rental", "hostel"],
  Fun: ["tickets", "museum", "movie", "concert", "bar"],
};

/** Placeholder for a real categorization service; simulates network latency. */
export async function detectExpenseCategory(description: string): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 40 + Math.random() * 120));

  const lower = description.toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => lower.includes(kw))) return category;
  }
  return "Other";
}
