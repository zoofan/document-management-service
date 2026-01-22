import { useState } from 'react';
import { applyChanges } from '../api/client';
import type { Change, ApplyChangesResponse } from '../api/types';

interface RedlineEditorProps {
  documentId: string;
  documentTitle: string;
  currentContent: string;
  currentEtag: string;
  onApplied: (response: ApplyChangesResponse) => void;
  onCancel: () => void;
}

interface ChangeRow extends Change {
  id: string;
}

export function RedlineEditor({
  documentId,
  documentTitle,
  currentContent,
  currentEtag,
  onApplied,
  onCancel,
}: RedlineEditorProps) {
  const [changes, setChanges] = useState<ChangeRow[]>([
    {
      id: crypto.randomUUID(),
      searchText: '',
      replaceText: '',
      matchCase: true,
      matchWholeWord: false,
      replaceAll: true,
    },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApplyChangesResponse | null>(null);
  const [showAdvanced, setShowAdvanced] = useState<Record<string, boolean>>({});

  const addChange = () => {
    setChanges(prev => [
      ...prev,
      {
        id: crypto.randomUUID(),
        searchText: '',
        replaceText: '',
        matchCase: true,
        matchWholeWord: false,
        replaceAll: true,
      },
    ]);
  };

  const removeChange = (id: string) => {
    setChanges(prev => prev.filter(c => c.id !== id));
  };

  const updateChange = (id: string, field: keyof Change, value: string | boolean | number | undefined) => {
    setChanges(prev =>
      prev.map(c => (c.id === id ? { ...c, [field]: value } : c))
    );
  };

  const toggleAdvanced = (id: string) => {
    setShowAdvanced(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const previewMatches = (searchText: string, matchCase: boolean, matchWholeWord: boolean) => {
    if (!searchText) return 0;
    try {
      let pattern = searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (matchWholeWord) pattern = `\\b${pattern}\\b`;
      const regex = new RegExp(pattern, matchCase ? 'g' : 'gi');
      const matches = currentContent.match(regex);
      return matches?.length || 0;
    } catch {
      return 0;
    }
  };

  const handleApply = async () => {
    const validChanges = changes.filter(c => c.searchText.trim());
    if (validChanges.length === 0) {
      setError('Please add at least one change with search text');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const changeRequests: Change[] = validChanges.map(c => {
        const change: Change = {
          searchText: c.searchText,
          replaceText: c.replaceText,
          matchCase: c.matchCase,
          matchWholeWord: c.matchWholeWord,
          replaceAll: c.replaceAll,
        };
        if (!c.replaceAll && c.occurrence) change.occurrence = c.occurrence;
        if (c.startIndex !== undefined) change.startIndex = c.startIndex;
        if (c.endIndex !== undefined) change.endIndex = c.endIndex;
        if (c.beforeContext) change.beforeContext = c.beforeContext;
        if (c.afterContext) change.afterContext = c.afterContext;
        return change;
      });

      const response = await applyChanges(documentId, { changes: changeRequests }, currentEtag);
      setResult(response);
      onApplied(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply changes');
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <h3 className="text-lg font-medium text-green-800">Changes Applied Successfully</h3>
          <p className="mt-1 text-sm text-green-600">
            Total replacements: <strong>{result.totalReplacements}</strong>
          </p>
          <p className="text-sm text-green-600">
            Version: {result.previousVersion} → {result.newVersion}
          </p>
        </div>

        <div className="divide-y divide-gray-200 border border-gray-200 rounded-lg bg-white">
          {result.results.map((r, i) => (
            <div key={i} className="p-3">
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-mono text-sm bg-red-100 text-red-700 px-1 rounded line-through">
                    {r.searchText}
                  </span>
                  <span className="mx-2">→</span>
                  <span className="font-mono text-sm bg-green-100 text-green-700 px-1 rounded">
                    {r.replaceText || '(deleted)'}
                  </span>
                </div>
                <div className="text-sm text-gray-500">
                  {r.replacementsMade} of {r.matchesFound} replaced
                </div>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onCancel}
          className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h3 className="text-lg font-medium text-blue-800">Redline Editor</h3>
        <p className="mt-1 text-sm text-blue-600">
          Apply find/replace changes to: <strong>{documentTitle}</strong>
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div className="space-y-4">
        {changes.map((change, index) => (
          <div key={change.id} className="border border-gray-200 rounded-lg p-4 bg-white">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700">Change #{index + 1}</span>
              {changes.length > 1 && (
                <button
                  onClick={() => removeChange(change.id)}
                  className="text-red-500 hover:text-red-700 text-sm"
                >
                  Remove
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Find
                </label>
                <input
                  type="text"
                  value={change.searchText}
                  onChange={e => updateChange(change.id, 'searchText', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  placeholder="Text to find"
                />
                {change.searchText && (
                  <div className="mt-1 text-xs text-gray-500">
                    {previewMatches(change.searchText, change.matchCase ?? true, change.matchWholeWord ?? false)} matches found
                  </div>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">
                  Replace with
                </label>
                <input
                  type="text"
                  value={change.replaceText}
                  onChange={e => updateChange(change.id, 'replaceText', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                  placeholder="Replacement text (empty to delete)"
                />
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-4">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={change.matchCase ?? true}
                  onChange={e => updateChange(change.id, 'matchCase', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-600">Match case</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={change.matchWholeWord ?? false}
                  onChange={e => updateChange(change.id, 'matchWholeWord', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-600">Whole word</span>
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={change.replaceAll ?? true}
                  onChange={e => updateChange(change.id, 'replaceAll', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-gray-600">Replace all</span>
              </label>
              <button
                type="button"
                onClick={() => toggleAdvanced(change.id)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                {showAdvanced[change.id] ? 'Hide' : 'Show'} advanced options
              </button>
            </div>

            {showAdvanced[change.id] && (
              <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
                {!change.replaceAll && (
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      Specific occurrence (1-indexed)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={change.occurrence || ''}
                      onChange={e => updateChange(change.id, 'occurrence', e.target.value ? Number(e.target.value) : undefined)}
                      className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="e.g., 2"
                    />
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      Before context (validation)
                    </label>
                    <input
                      type="text"
                      value={change.beforeContext || ''}
                      onChange={e => updateChange(change.id, 'beforeContext', e.target.value || undefined)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                      placeholder="Text that must precede"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      After context (validation)
                    </label>
                    <input
                      type="text"
                      value={change.afterContext || ''}
                      onChange={e => updateChange(change.id, 'afterContext', e.target.value || undefined)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                      placeholder="Text that must follow"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      Start index (character position)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={change.startIndex ?? ''}
                      onChange={e => updateChange(change.id, 'startIndex', e.target.value ? Number(e.target.value) : undefined)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      End index (exclusive)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={change.endIndex ?? ''}
                      onChange={e => updateChange(change.id, 'endIndex', e.target.value ? Number(e.target.value) : undefined)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="Content length"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={addChange}
        className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-500 hover:border-gray-400 hover:text-gray-600"
      >
        + Add another change
      </button>

      <div className="flex gap-3 pt-4">
        <button
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          onClick={handleApply}
          disabled={loading || !changes.some(c => c.searchText.trim())}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Applying...' : 'Apply Changes'}
        </button>
      </div>
    </div>
  );
}
