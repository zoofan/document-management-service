import { Change, ChangeResult } from '../types/document';

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildPattern(change: Change): RegExp {
  const { searchText, matchCase = true, matchWholeWord = false } = change;

  let pattern = escapeRegex(searchText);

  if (matchWholeWord) {
    pattern = `\\b${pattern}\\b`;
  }

  const flags = matchCase ? 'g' : 'gi';
  return new RegExp(pattern, flags);
}

function usesAdvancedTargeting(change: Change): boolean {
  return (
    change.startIndex !== undefined ||
    change.endIndex !== undefined ||
    change.beforeContext !== undefined ||
    change.afterContext !== undefined ||
    (change.replaceAll === false && change.occurrence !== undefined)
  );
}

function applyFastPath(
  content: string,
  change: Change
): { newContent: string; result: ChangeResult } {
  const { searchText, replaceText, replaceAll = true } = change;
  const pattern = buildPattern(change);

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
    newContent = content.replace(pattern, replaceText);
    replacementsMade = matchesFound;
  } else {
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

    if (match[0].length === 0) {
      searchPattern.lastIndex++;
    }
  }

  return matches;
}

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
      matchesToReplace = eligibleMatches;
    } else if (!replaceAll && occurrence !== undefined && occurrence > 0) {
      if (occurrence <= eligibleMatches.length) {
        matchesToReplace = [eligibleMatches[occurrence - 1]];
      } else {
        matchesToReplace = [];
      }
    } else if (!replaceAll) {
      matchesToReplace = [eligibleMatches[0]];
    } else {
      matchesToReplace = eligibleMatches;
    }

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

export function applySingleChange(
  content: string,
  change: Change
): { newContent: string; result: ChangeResult } {
  if (!usesAdvancedTargeting(change)) {
    return applyFastPath(content, change);
  }

  return applySlowPath(content, change);
}

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
