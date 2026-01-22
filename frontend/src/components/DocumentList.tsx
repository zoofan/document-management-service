import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { listDocuments } from '../api/client';
import type { Document, DocumentListParams, Pagination } from '../api/types';

interface DocumentListProps {
  onSelectDocument?: (doc: Document) => void;
  refreshTrigger?: number;
}

export function DocumentList({ onSelectDocument, refreshTrigger }: DocumentListProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [params, setParams] = useState<DocumentListParams>({
    page: 1,
    limit: 10,
    sortBy: 'updatedAt',
    sortOrder: 'desc',
  });

  useEffect(() => {
    const fetchDocuments = async () => {
      setLoading(true);
      try {
        const response = await listDocuments(params);
        setDocuments(response.data);
        setPagination(response.pagination);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load documents');
      } finally {
        setLoading(false);
      }
    };

    fetchDocuments();
  }, [params, refreshTrigger]);

  const handleSortChange = (sortBy: 'createdAt' | 'updatedAt' | 'title') => {
    setParams(prev => ({
      ...prev,
      sortBy,
      sortOrder: prev.sortBy === sortBy && prev.sortOrder === 'desc' ? 'asc' : 'desc',
      page: 1,
    }));
  };

  const handlePageChange = (newPage: number) => {
    setParams(prev => ({ ...prev, page: newPage }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading && documents.length === 0) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
        {error}
      </div>
    );
  }

  if (documents.length === 0) {
    return (
      <div className="text-center py-12 bg-gray-50 rounded-lg">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 className="mt-2 text-sm font-medium text-gray-900">No documents</h3>
        <p className="mt-1 text-sm text-gray-500">Get started by creating a new document.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 text-sm">
        <span className="text-gray-500">Sort by:</span>
        {(['title', 'createdAt', 'updatedAt'] as const).map(field => (
          <button
            key={field}
            onClick={() => handleSortChange(field)}
            className={`px-2 py-1 rounded ${
              params.sortBy === field
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {field === 'createdAt' ? 'Created' : field === 'updatedAt' ? 'Updated' : 'Title'}
            {params.sortBy === field && (
              <span className="ml-1">{params.sortOrder === 'asc' ? '↑' : '↓'}</span>
            )}
          </button>
        ))}
      </div>

      <div className="divide-y divide-gray-200 border border-gray-200 rounded-lg bg-white">
        {documents.map(doc => (
          <div
            key={doc.id}
            className="p-4 hover:bg-gray-50 cursor-pointer transition-colors"
            onClick={() => onSelectDocument?.(doc)}
          >
            <div className="flex justify-between items-start">
              <div className="flex-1 min-w-0">
                <Link
                  to={`/documents/${doc.id}`}
                  className="text-lg font-medium text-blue-600 hover:text-blue-800 hover:underline"
                  onClick={e => e.stopPropagation()}
                >
                  {doc.title}
                </Link>
                <p className="mt-1 text-sm text-gray-500 truncate">
                  {doc.content.substring(0, 150)}
                  {doc.content.length > 150 && '...'}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {doc.metadata.tags?.map(tag => (
                    <span
                      key={tag}
                      className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <div className="ml-4 flex-shrink-0 text-right text-xs text-gray-500">
                <div>v{doc.version}</div>
                <div className="mt-1">{formatDate(doc.updatedAt)}</div>
                {doc.metadata.author && (
                  <div className="mt-1 text-gray-400">{doc.metadata.author}</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} documents
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-sm text-gray-600">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1 border border-gray-300 rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
