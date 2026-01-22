import { describe, it, expect } from 'vitest';
import { applySingleChange, applyChanges } from '../../../src/services/change.service';

describe('Change Service', () => {
  describe('applySingleChange', () => {
    it('should replace all occurrences by default', () => {
      const content = 'foo bar foo baz foo';
      const { newContent, result } = applySingleChange(content, {
        searchText: 'foo',
        replaceText: 'qux',
      });

      expect(newContent).toBe('qux bar qux baz qux');
      expect(result.matchesFound).toBe(3);
      expect(result.replacementsMade).toBe(3);
    });

    it('should respect case sensitivity', () => {
      const content = 'Foo foo FOO';
      const { newContent, result } = applySingleChange(content, {
        searchText: 'foo',
        replaceText: 'bar',
        matchCase: true,
      });

      expect(newContent).toBe('Foo bar FOO');
      expect(result.matchesFound).toBe(1);
      expect(result.replacementsMade).toBe(1);
    });

    it('should handle case-insensitive replacement', () => {
      const content = 'Foo foo FOO';
      const { newContent, result } = applySingleChange(content, {
        searchText: 'foo',
        replaceText: 'bar',
        matchCase: false,
      });

      expect(newContent).toBe('bar bar bar');
      expect(result.matchesFound).toBe(3);
      expect(result.replacementsMade).toBe(3);
    });

    it('should match whole words only', () => {
      const content = 'foobar foo barfoo';
      const { newContent, result } = applySingleChange(content, {
        searchText: 'foo',
        replaceText: 'qux',
        matchWholeWord: true,
      });

      expect(newContent).toBe('foobar qux barfoo');
      expect(result.matchesFound).toBe(1);
      expect(result.replacementsMade).toBe(1);
    });

    it('should replace specific occurrence', () => {
      const content = 'foo bar foo baz foo';
      const { newContent, result } = applySingleChange(content, {
        searchText: 'foo',
        replaceText: 'qux',
        replaceAll: false,
        occurrence: 2,
      });

      expect(newContent).toBe('foo bar qux baz foo');
      expect(result.matchesFound).toBe(3);
      expect(result.replacementsMade).toBe(1);
    });

    it('should replace first occurrence when replaceAll is false', () => {
      const content = 'foo bar foo';
      const { newContent, result } = applySingleChange(content, {
        searchText: 'foo',
        replaceText: 'qux',
        replaceAll: false,
      });

      expect(newContent).toBe('qux bar foo');
      expect(result.matchesFound).toBe(2);
      expect(result.replacementsMade).toBe(1);
    });

    it('should handle no matches', () => {
      const content = 'hello world';
      const { newContent, result } = applySingleChange(content, {
        searchText: 'xyz',
        replaceText: 'abc',
      });

      expect(newContent).toBe('hello world');
      expect(result.matchesFound).toBe(0);
      expect(result.replacementsMade).toBe(0);
    });

    it('should escape regex special characters', () => {
      const content = 'price is $100.00 (USD)';
      const { newContent, result } = applySingleChange(content, {
        searchText: '$100.00',
        replaceText: '$200.00',
      });

      expect(newContent).toBe('price is $200.00 (USD)');
      expect(result.matchesFound).toBe(1);
    });
  });

  describe('character range targeting', () => {
    it('should replace only within specified range', () => {
      const content = 'foo bar foo baz foo';
      const { newContent, result } = applySingleChange(content, {
        searchText: 'foo',
        replaceText: 'XXX',
        startIndex: 8,
        endIndex: 15,
      });

      expect(newContent).toBe('foo bar XXX baz foo');
      expect(result.matchesFound).toBe(3);
      expect(result.replacementsMade).toBe(1);
    });

    it('should replace multiple matches within range', () => {
      const content = 'foo foo foo foo foo';
      const { newContent, result } = applySingleChange(content, {
        searchText: 'foo',
        replaceText: 'X',
        startIndex: 4,
        endIndex: 12,
      });

      expect(newContent).toBe('foo X X foo foo');
      expect(result.replacementsMade).toBe(2);
    });

    it('should not replace when match extends beyond range', () => {
      const content = 'hello world';
      const { newContent, result } = applySingleChange(content, {
        searchText: 'world',
        replaceText: 'X',
        startIndex: 0,
        endIndex: 8, // "world" starts at 6, ends at 11
      });

      expect(newContent).toBe('hello world');
      expect(result.replacementsMade).toBe(0);
    });

    it('should return positions of replacements when using advanced targeting', () => {
      const content = 'foo bar foo';
      const { result } = applySingleChange(content, {
        searchText: 'foo',
        replaceText: 'X',
        startIndex: 0, // Use advanced targeting to get positions
        endIndex: 20,
      });

      expect(result.positions).toEqual([0, 8]);
    });

    it('should not return positions for fast path (replaceAll)', () => {
      const content = 'foo bar foo';
      const { result } = applySingleChange(content, {
        searchText: 'foo',
        replaceText: 'X',
      });

      // Fast path doesn't track positions for performance
      expect(result.positions).toBeUndefined();
    });
  });

  describe('contextual matching', () => {
    it('should only replace when beforeContext matches', () => {
      const content = 'the foo and a foo';
      const { newContent, result } = applySingleChange(content, {
        searchText: 'foo',
        replaceText: 'bar',
        beforeContext: 'the ',
      });

      expect(newContent).toBe('the bar and a foo');
      expect(result.matchesFound).toBe(2);
      expect(result.replacementsMade).toBe(1);
    });

    it('should only replace when afterContext matches', () => {
      const content = 'foo! and foo?';
      const { newContent, result } = applySingleChange(content, {
        searchText: 'foo',
        replaceText: 'bar',
        afterContext: '!',
      });

      expect(newContent).toBe('bar! and foo?');
      expect(result.replacementsMade).toBe(1);
    });

    it('should require both beforeContext and afterContext when specified', () => {
      const content = 'x foo y and a foo b';
      const { newContent, result } = applySingleChange(content, {
        searchText: 'foo',
        replaceText: 'bar',
        beforeContext: 'x ',
        afterContext: ' y',
      });

      expect(newContent).toBe('x bar y and a foo b');
      expect(result.replacementsMade).toBe(1);
    });

    it('should not replace when context does not match', () => {
      const content = 'hello foo world';
      const { newContent, result } = applySingleChange(content, {
        searchText: 'foo',
        replaceText: 'bar',
        beforeContext: 'xyz ',
      });

      expect(newContent).toBe('hello foo world');
      expect(result.replacementsMade).toBe(0);
    });

    it('should handle context at document boundaries', () => {
      const content = 'foo bar';
      const { result } = applySingleChange(content, {
        searchText: 'foo',
        replaceText: 'bar',
        beforeContext: 'x', // No room for context at start
      });

      expect(result.replacementsMade).toBe(0);
    });
  });

  describe('combined targeting', () => {
    it('should combine character range with contextual matching', () => {
      const content = 'the foo and the foo and the foo';
      const { newContent, result } = applySingleChange(content, {
        searchText: 'foo',
        replaceText: 'bar',
        beforeContext: 'the ',
        startIndex: 10,
        endIndex: 25,
      });

      expect(newContent).toBe('the foo and the bar and the foo');
      expect(result.replacementsMade).toBe(1);
    });
  });

  describe('applyChanges', () => {
    it('should apply multiple changes sequentially', () => {
      const content = 'The quick brown fox jumps over the lazy dog';
      const { newContent, results, totalReplacements } = applyChanges(content, [
        { searchText: 'quick', replaceText: 'slow' },
        { searchText: 'brown', replaceText: 'red' },
        { searchText: 'lazy', replaceText: 'energetic' },
      ]);

      expect(newContent).toBe('The slow red fox jumps over the energetic dog');
      expect(results.length).toBe(3);
      expect(totalReplacements).toBe(3);
    });

    it('should handle changes that depend on previous changes', () => {
      const content = 'foo bar';
      const { newContent } = applyChanges(content, [
        { searchText: 'foo', replaceText: 'baz' },
        { searchText: 'baz', replaceText: 'qux' },
      ]);

      expect(newContent).toBe('qux bar');
    });

    it('should aggregate results correctly', () => {
      const content = 'a b a b a';
      const { results, totalReplacements } = applyChanges(content, [
        { searchText: 'a', replaceText: 'x' },
        { searchText: 'b', replaceText: 'y' },
      ]);

      expect(results[0].replacementsMade).toBe(3);
      expect(results[1].replacementsMade).toBe(2);
      expect(totalReplacements).toBe(5);
    });
  });
});
