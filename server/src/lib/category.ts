const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Food: ["dinner", "lunch", "breakfast", "groceries", "restaurant", "cafe"],
  Travel: ["flight", "train", "taxi", "uber", "cab", "gas", "fuel"],
  Lodging: ["hotel", "cabin", "airbnb", "rental", "hostel"],
  Fun: ["tickets", "museum", "movie", "concert", "bar"],
};

/** Placeholder for a real categorization service; simulates network latency. */
export async function detectExpenseCategory(description: string): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 40 + Math.random() * 120));

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    // Whole words only (plurals allowed), so "cabin" doesn't match "cab" and "barber" doesn't match "bar".
    if (keywords.some((kw) => new RegExp(`\\b${kw}s?\\b`, "i").test(description))) return category;
  }
  return "Other";
}
