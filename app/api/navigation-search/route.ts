import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { getNavItems, OLD_NAME_ALIASES } from "@/lib/canonical-navigation-config";

/**
 * GET /api/navigation-search
 * 
 * Returns a permission-filtered navigation search index.
 * This is a security-critical endpoint - it must filter items server-side
 * based on user permissions before sending to the client.
 */
export async function GET(request: Request) {
  try {
    const user = await verifyAuth();
    if (!user) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") || "";
    const variant = user.variant || 1;

    // Get permission-filtered navigation items
    const navItems = getNavItems(variant, user.role);

    // If no query, return the full filtered index
    if (!query || query.trim().length < 2) {
      return NextResponse.json({
        success: true,
        data: {
          items: navItems,
          aliases: OLD_NAME_ALIASES,
          variant,
          userRole: user.role,
        },
      });
    }

    // Perform search with ranking
    const results = searchAndRank(query, navItems, OLD_NAME_ALIASES);

    return NextResponse.json({
      success: true,
      data: {
        items: results,
        query,
        variant,
        userRole: user.role,
      },
    });

  } catch (error) {
    console.error("Navigation Search API Error:", error);
    return NextResponse.json(
      { success: false, message: "Search failed" },
      { status: 500 }
    );
  }
}

/**
 * Search and rank navigation items
 * Implements deterministic ranking: exact match > prefix > partial > alias > fuzzy
 */
function searchAndRank(
  query: string,
  items: any[],
  aliases: Record<string, string>
): any[] {
  const q = query.toLowerCase().trim();
  const results: any[] = [];

  for (const item of items) {
    const label = item.label.toLowerCase();
    const key = item.key.toLowerCase();
    const keywords = item.keywords.map((k: string) => k.toLowerCase());
    const parentLabel = item.parentLabel?.toLowerCase() || "";

    // Check each match type
    const matchType = getMatchType(q, label, key, keywords, parentLabel, aliases);

    if (matchType) {
      results.push({
        ...item,
        matchType,
        matchScore: getMatchScore(matchType),
      });
    }
  }

  // Sort by match score (higher score = better match)
  results.sort((a, b) => b.matchScore - a.matchScore);

  // Limit results to 20
  return results.slice(0, 20);
}

/**
 * Determine match type for ranking
 */
function getMatchType(
  q: string,
  label: string,
  key: string,
  keywords: string[],
  parentLabel: string,
  aliases: Record<string, string>
): string | null {
  // 1. Exact match on label
  if (label === q) return "exact";

  // 2. Exact match on key
  if (key === q) return "exact";

  // 3. Prefix match on label
  if (label.startsWith(q)) return "prefix";

  // 4. Prefix match on key
  if (key.startsWith(q)) return "prefix";

  // 5. Prefix match on any keyword
  if (keywords.some(kw => kw.startsWith(q))) return "prefix";

  // 6. Partial match on label
  if (label.includes(q)) return "partial";

  // 7. Partial match on key
  if (key.includes(q)) return "partial";

  // 8. Partial match on any keyword
  if (keywords.some(kw => kw.includes(q))) return "partial";

  // 9. Partial match on parent label
  if (parentLabel.includes(q)) return "partial";

  // 10. Alias match
  const aliasTarget = aliases[q];
  if (aliasTarget && (key === aliasTarget || label.includes(aliasTarget))) {
    return "alias";
  }

  // 11. Fuzzy match (edit distance 1-2 for queries < 8 chars)
  if (q.length < 8) {
    if (fuzzyMatch(q, label) || fuzzyMatch(q, key)) {
      return "fuzzy";
    }
  }

  return null;
}

/**
 * Get match score for ranking
 */
function getMatchScore(matchType: string): number {
  const scores: Record<string, number> = {
    exact: 100,
    prefix: 80,
    partial: 60,
    alias: 40,
    fuzzy: 20,
  };
  return scores[matchType] || 0;
}

/**
 * Simple fuzzy match using edit distance
 * Returns true if edit distance <= 2
 */
function fuzzyMatch(query: string, target: string): boolean {
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  
  // Quick length check
  if (Math.abs(q.length - t.length) > 2) return false;
  
  const distance = levenshteinDistance(q, t);
  return distance <= 2;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix = [];
  
  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  // Fill matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
}
