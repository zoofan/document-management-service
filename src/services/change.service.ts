/**
 * Change Service - Find/Replace Operations
 *
 * Performance Characteristics:
 * - Time Complexity: O(n × k) where n = document length, k = number of changes
 * - Space Complexity: O(n) for result string (JS strings are immutable)
 *
 * Implementation uses native V8 RegExp and String.replace() which are
 * implemented in optimized C++ and run in linear time for literal patterns.
 *
 * ReDoS Prevention: User input is escaped to prevent regex injection.
 * Only literal string matching is supported (no user-supplied regex patterns).
 *
 * Targeting Options:
 * - replaceAll: Replace all occurrences (default) - uses fast native String.replace()
 * - occurrence: Replace specific occurrence by number (1-indexed)
 * - startIndex/endIndex: Replace within character range
 * - beforeContext/afterContext: Validate surrounding text before replacing
 */

import { Change, ChangeResult } from '../types/document';

/**
 * Escape special regex characters to prevent ReDoS attacks.
 * Converts user input into a safe literal pattern.
 * Time: O(n) where n = string length
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Build regex pattern for find/replace.
 */
function buildPattern(change: Change): RegExp {
  const { searchText, matchCase = true, matchWholeWord = false } = change;

  let pattern = escapeRegex(searchText);

  if (matchWholeWord) {
    pattern = `\\b${pattern}\\b`;
  }

  const flags = matchCase ? 'g' : 'gi';
  return new RegExp(pattern, flags);
}

/**
 * Check if change uses advanced targeting (requires slow path).
 */
function usesAdvancedTargeting(change: Change): boolean {
  return (
    change.startIndex !== undefined ||
    change.endIndex !== undefined ||
    change.beforeContext !== undefined ||
    change.afterContext !== undefined ||
    (change.replaceAll === false && change.occurrence !== undefined)
  );
}

/**
 * Fast path: Use native String.replace() for simple replaceAll operations.
 * Time: O(n) - single pass with native V8 implementation
 */
function applyFastPath(
  content: string,
  change: Change
): { newContent: string; result: ChangeResult } {
  const { searchText, replaceText, replaceAll = true } = change;
  const pattern = buildPattern(change);

  // Count matches first
  const matches = content.match(pattern);
  const matchesFound = matches ? matches.length : 0;

  if (matchesFound === 0) {
    return {
      newContent: content,
      result: { searchText, replaceText, matchesFound: 0, replacementsMade: 0 },
    };
  }

  let newContent: string;
  let replacementsMade: number;

  if (replaceAll) {
    // Replace all occurrences using native replace
    newContent = content.replace(pattern, replaceText);
    replacementsMade = matchesFound;
  } else {
    // Replace first occurrence only
    const nonGlobalPattern = new RegExp(
      pattern.source,
      pattern.flags.replace('g', '')
    );
    newContent = content.replace(nonGlobalPattern, replaceText);
    replacementsMade = 1;
  }

  return {
    newContent,
    result: { searchText, replaceText, matchesFound, replacementsMade },
  };
}

/**
 * Find all match positions in content.
 * Returns array of { index, length, text } for each match.
 */
function findAllMatches(
  content: string,
  pattern: RegExp
): Array<{ index: number; length: number; text: string }> {
  const matches: Array<{ index: number; length: number; text: string }> = [];
  const searchPattern = new RegExp(pattern.source, pattern.flags);

  let match;
  while ((match = searchPattern.exec(content)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      text: match[0],
    });

    // Prevent infinite loop for zero-length matches
    if (match[0].length === 0) {
      searchPattern.lastIndex++;
    }
  }

  return matches;
}

/**
 * Validate contextual matching constraints.
 */
function validateContext(
  content: string,
  matchIndex: number,
  matchLength: number,
  beforeContext?: string,
  afterContext?: string
): boolean {
  if (beforeContext) {
    const beforeStart = matchIndex - beforeContext.length;
    if (beforeStart < 0) return false;
    const actualBefore = content.substring(beforeStart, matchIndex);
    if (actualBefore !== beforeContext) return false;
  }

  if (afterContext) {
    const afterEnd = matchIndex + matchLength + afterContext.length;
    if (afterEnd > content.length) return false;
    const actualAfter = content.substring(matchIndex + matchLength, afterEnd);
    if (actualAfter !== afterContext) return false;
  }

  return true;
}

/**
 * Check if a match falls within the specified character range.
 */
function isInRange(
  matchIndex: number,
  matchLength: number,
  startIndex?: number,
  endIndex?: number
): boolean {
  if (startIndex === undefined && endIndex === undefined) {
    return true;
  }

  const matchEnd = matchIndex + matchLength;

  if (startIndex !== undefined && matchIndex < startIndex) {
    return false;
  }

  if (endIndex !== undefined && matchEnd > endIndex) {
    return false;
  }

  return true;
}

/**
 * Slow path: Handle advanced targeting (ranges, context, specific occurrence).
 * Time: O(n) for finding matches + O(m) for applying replacements
 */
function applySlowPath(
  content: string,
  change: Change
): { newContent: string; result: ChangeResult } {
  const {
    searchText,
    replaceText,
    replaceAll = true,
    occurrence,
    startIndex,
    endIndex,
    beforeContext,
    afterContext,
  } = change;

  const pattern = buildPattern(change);
  const allMatches = findAllMatches(content, pattern);
  const matchesFound = allMatches.length;

  // Filter matches based on targeting criteria
  const eligibleMatches = allMatches.filter((match) => {
    if (!isInRange(match.index, match.length, startIndex, endIndex)) {
      return false;
    }
    if (!validateContext(content, match.index, match.length, beforeContext, afterContext)) {
      return false;
    }
    return true;
  });

  const positions: number[] = [];
  let newContent = content;
  let replacementsMade = 0;

  if (eligibleMatches.length > 0) {
    let matchesToReplace: typeof eligibleMatches;

    if (startIndex !== undefined || endIndex !== undefined) {
      // Character range: replace all eligible matches within range
      matchesToReplace = eligibleMatches;
    } else if (!replaceAll && occurrence !== undefined && occurrence > 0) {
      // Specific occurrence
      if (occurrence <= eligibleMatches.length) {
        matchesToReplace = [eligibleMatches[occurrence - 1]];
      } else {
        matchesToReplace = [];
      }
    } else if (!replaceAll) {
      // First occurrence only
      matchesToReplace = [eligibleMatches[0]];
    } else {
      // All eligible matches
      matchesToReplace = eligibleMatches;
    }

    // Apply replacements in reverse order to preserve indices
    matchesToReplace.sort((a, b) => b.index - a.index);

    for (const match of matchesToReplace) {
      newContent =
        newContent.substring(0, match.index) +
        replaceText +
        newContent.substring(match.index + match.length);
      positions.unshift(match.index);
      replacementsMade++;
    }
  }

  return {
    newContent,
    result: {
      searchText,
      replaceText,
      matchesFound,
      replacementsMade,
      positions: positions.length > 0 ? positions : undefined,
    },
  };
}

/**
 * Apply a single find/replace change to content.
 * Automatically selects fast or slow path based on targeting options.
 *
 * Time: O(n) for fast path, O(n + m) for slow path
 * Space: O(n) for the new string
 */
export function applySingleChange(
  content: string,
  change: Change
): { newContent: string; result: ChangeResult } {
  // Use fast path for simple operations
  if (!usesAdvancedTargeting(change)) {
    return applyFastPath(content, change);
  }

  // Use slow path for advanced targeting
  return applySlowPath(content, change);
}

/**
 * Apply multiple changes to content sequentially.
 * Changes are applied in order, allowing later changes to operate
 * on results of earlier changes.
 *
 * Note: When using character ranges with multiple changes, be aware that
 * earlier changes may shift positions. Consider using contextual matching
 * for more robust targeting.
 *
 * Time: O(n × k) where n = content length, k = number of changes
 * Space: O(n) - only one copy of content exists at a time
 */
export function applyChanges(
  content: string,
  changes: Change[]
): { newContent: string; results: ChangeResult[]; totalReplacements: number } {
  let currentContent = content;
  const results: ChangeResult[] = [];
  let totalReplacements = 0;

  for (const change of changes) {
    const { newContent, result } = applySingleChange(currentContent, change);
    currentContent = newContent;
    results.push(result);
    totalReplacements += result.replacementsMade;
  }

  return {
    newContent: currentContent,
    results,
    totalReplacements,
  };
}
