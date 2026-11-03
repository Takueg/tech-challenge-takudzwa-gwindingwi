const CATEGORY_KEYWORDS: Record<string, string[]> = {
  Food: ["dinner", "lunch", "breakfast", "groceries", "restaurant", "cafe"],
  Travel: ["flight", "train", "taxi", "uber", "cab", "gas", "gasoline", "fuel"],
  Lodging: ["hotel", "cabin", "airbnb", "rental", "hostel"],
  Fun: ["tickets", "museum", "movie", "concert", "bar"],
};

// Whole words only, so "cabin" doesn't match "cab" and "barber" doesn't match "bar". Plurals still match.
const CATEGORY_PATTERNS = Object.entries(CATEGORY_KEYWORDS).map(([category, keywords]) => ({
  category,
  patterns: keywords.map((keyword) => new RegExp(`\\b${keyword}(?:e?s)?\\b`, "i")),
}));

/** Placeholder for a real categorization service; simulates network latency. */
export async function detectExpenseCategory(description: string): Promise<string> {
  await new Promise((resolve) => setTimeout(resolve, 40 + Math.random() * 120));

  for (const { category, patterns } of CATEGORY_PATTERNS) {
    if (patterns.some((pattern) => pattern.test(description))) return category;
  }
  return "Other";
}
