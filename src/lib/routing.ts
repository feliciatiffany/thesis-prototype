import type { IntentRule } from "../types.ts";

function includesKeyword(haystack: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // A keyword may be a whole word ("range") or a stem ("charg", "summar").
  const pattern = new RegExp(`(?:^|[^a-z0-9])${escaped}`, "i");
  return pattern.test(haystack);
}

/** First matching keyword wins. Rules are checked in the order written in the JSON. */
export function matchIntent(
  text: string,
  intents: IntentRule[],
): { goto: string; keyword: string } | null {
  const haystack = text.toLowerCase();
  for (const rule of intents) {
    for (const keyword of rule.keywords) {
      if (includesKeyword(haystack, keyword.toLowerCase())) {
        return { goto: rule.goto, keyword };
      }
    }
  }
  return null;
}
