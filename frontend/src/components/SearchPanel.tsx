import { useState } from 'react';
import { Link } from 'react-router-dom';
import { searchDocuments } from '../api/client';
import type { SearchResponse, SearchMatch } from '../api/types';

export function SearchPanel() {
  const [query, setQuery] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [contextSize, setContextSize] = useState(50);
  const [results, setResults] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const response = await searchDocuments({
        query: query.trim(),
        caseSensitive,
        contextSize,
        maxResults: 100,
      });
      setResults(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  const highlightMatch = (match: SearchMatch) => {
    const { context, matchedText } = match;
    const matchIndex = context.indexOf(matchedText);
    if (matchIndex === -1) return context;

    return (
      <>
        {context.substring(0, matchIndex)}
        <mark className="bg-yellow-200 px-0.5 rounded">{matchedText}</mark>
        {context.substring(matchIndex + matchedText.length)}
      </>
    );
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSearch} className="space-y-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search across all documents..."
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Searching
              </span>
            ) : (
              'Search'
            )}
          </button>
        </div>

        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={caseSensitive}
              onChange={e => setCaseSensitive(e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-gray-600">Case sensitive</span>
          </label>

          <div className="flex items-center gap-2">
            <label htmlFor="contextSize" className="text-gray-600">
              Context size:
            </label>
            <select
              id="contextSize"
              value={contextSize}
              onChange={e => setContextSize(Number(e.target.value))}
              className="px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={30}>30 chars</option>
              <option value={50}>50 chars</option>
              <option value={100}>100 chars</option>
              <option value={200}>200 chars</option>
            </select>
          </div>
        </div>
      </form>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {results && (
        <div className="space-y-4">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <span>
              Found <strong>{results.totalMatches}</strong> matches in{' '}
              <strong>{results.documentsSearched}</strong> documents
            </span>
            {results.results.length > 0 && results.totalMatches > results.results.length && (
              <span className="text-gray-400">
                Showing first {results.results.length} results
              </span>
            )}
          </div>

          {results.results.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No matches found for "{results.query}"
            </div>
          ) : (
            <div className="divide-y divide-gray-200 border border-gray-200 rounded-lg bg-white">
              {results.results.map((match, index) => (
                <div key={`${match.documentId}-${match.position}-${index}`} className="p-4">
                  <Link
                    to={`/documents/${match.documentId}`}
                    className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
                  >
                    {match.documentTitle}
                  </Link>
                  <div className="mt-2 text-sm text-gray-700 font-mono bg-gray-50 p-2 rounded">
                    ...{highlightMatch(match)}...
                  </div>
                  <div className="mt-1 text-xs text-gray-400">
                    Position: {match.position}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
