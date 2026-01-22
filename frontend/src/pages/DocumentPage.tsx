import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { getDocument, updateDocument, deleteDocument } from '../api/client';
import { RedlineEditor } from '../components/RedlineEditor';
import type { Document, ApplyChangesResponse } from '../api/types';

export function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [document, setDocument] = useState<Document | null>(null);
  const [etag, setEtag] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showRedline, setShowRedline] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    author: '',
    tags: [] as string[],
  });
  const [tagInput, setTagInput] = useState('');
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchDocument = async () => {
      setLoading(true);
      try {
        const { document: doc, etag: newEtag } = await getDocument(id);
        setDocument(doc);
        setEtag(newEtag);
        setEditForm({
          title: doc.title,
          author: doc.metadata.author || '',
          tags: doc.metadata.tags || [],
        });
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load document');
      } finally {
        setLoading(false);
      }
    };

    fetchDocument();
  }, [id]);

  const handleSave = async () => {
    if (!id || !document) return;

    setSaveLoading(true);
    setSaveError(null);

    try {
      const { document: updatedDoc, etag: newEtag } = await updateDocument(
        id,
        {
          title: editForm.title,
          author: editForm.author || undefined,
          tags: editForm.tags.length > 0 ? editForm.tags : undefined,
        },
        etag
      );
      setDocument(updatedDoc);
      setEtag(newEtag);
      setIsEditing(false);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaveLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id) return;

    try {
      await deleteDocument(id);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete document');
    }
  };

  const handleRedlineApplied = (response: ApplyChangesResponse) => {
    setDocument(response.document);
    setEtag(response.etag);
    setEditForm(prev => ({
      ...prev,
      title: response.document.title,
      author: response.document.metadata.author || '',
      tags: response.document.metadata.tags || [],
    }));
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (tag && !editForm.tags.includes(tag)) {
      setEditForm(prev => ({ ...prev, tags: [...prev.tags, tag] }));
      setTagInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setEditForm(prev => ({
      ...prev,
      tags: prev.tags.filter(t => t !== tagToRemove),
    }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
        <Link to="/" className="mt-4 inline-block text-blue-600 hover:text-blue-800">
          ← Back to documents
        </Link>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-gray-500">Document not found</div>
        <Link to="/" className="mt-4 inline-block text-blue-600 hover:text-blue-800">
          ← Back to documents
        </Link>
      </div>
    );
  }

  if (showRedline) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Link to="/" className="text-blue-600 hover:text-blue-800 mb-4 inline-block">
          ← Back to documents
        </Link>
        <RedlineEditor
          documentId={document.id}
          documentTitle={document.title}
          currentContent={document.content}
          currentEtag={etag}
          onApplied={handleRedlineApplied}
          onCancel={() => setShowRedline(false)}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <Link to="/" className="text-blue-600 hover:text-blue-800">
          ← Back to documents
        </Link>
        <div className="flex gap-2">
          <button
            onClick={() => setShowRedline(true)}
            className="px-3 py-1.5 text-sm bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200"
          >
            Redline Editor
          </button>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1.5 text-sm bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
            >
              Edit Metadata
            </button>
          )}
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200"
          >
            Delete
          </button>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Are you sure you want to delete this document?</p>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleDelete}
              className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Yes, delete
            </button>
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {isEditing ? (
        <div className="bg-white border border-gray-200 rounded-lg p-6 space-y-4">
          <h2 className="text-lg font-medium text-gray-900">Edit Document Metadata</h2>

          {saveError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {saveError}
            </div>
          )}

          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Title
            </label>
            <input
              type="text"
              id="title"
              value={editForm.title}
              onChange={e => setEditForm(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label htmlFor="author" className="block text-sm font-medium text-gray-700 mb-1">
              Author
            </label>
            <input
              type="text"
              id="author"
              value={editForm.author}
              onChange={e => setEditForm(prev => ({ ...prev, author: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTag();
                  }
                }}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Add a tag"
              />
              <button
                type="button"
                onClick={addTag}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Add
              </button>
            </div>
            {editForm.tags.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {editForm.tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-sm"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="text-blue-500 hover:text-blue-700"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <button
              onClick={() => {
                setIsEditing(false);
                setEditForm({
                  title: document.title,
                  author: document.metadata.author || '',
                  tags: document.metadata.tags || [],
                });
              }}
              className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saveLoading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saveLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-gray-900">{document.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-gray-500">
              <span>Version {document.version}</span>
              {document.metadata.author && (
                <span>By {document.metadata.author}</span>
              )}
              <span>{document.metadata.wordCount} words</span>
              <span>{document.metadata.characterCount} characters</span>
            </div>
            {document.metadata.tags && document.metadata.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {document.metadata.tags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="px-6 py-4">
            <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 leading-relaxed">
              {document.content}
            </pre>
          </div>

          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
            <div className="flex justify-between">
              <span>Created: {formatDate(document.createdAt)}</span>
              <span>Updated: {formatDate(document.updatedAt)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
