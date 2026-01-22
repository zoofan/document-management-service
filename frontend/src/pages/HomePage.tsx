import { useState } from 'react';
import { DocumentList } from '../components/DocumentList';
import { CreateDocumentModal } from '../components/CreateDocumentModal';
import { SearchPanel } from '../components/SearchPanel';
import type { Document } from '../api/types';

type TabType = 'documents' | 'search';

export function HomePage() {
  const [activeTab, setActiveTab] = useState<TabType>('documents');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const handleDocumentCreated = (_doc: Document) => {
    setRefreshTrigger(prev => prev + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('documents')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'documents'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Documents
          </button>
          <button
            onClick={() => setActiveTab('search')}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              activeTab === 'search'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Search
          </button>
        </div>

        {activeTab === 'documents' && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Document
          </button>
        )}
      </div>

      {activeTab === 'documents' ? (
        <DocumentList refreshTrigger={refreshTrigger} />
      ) : (
        <SearchPanel />
      )}

      <CreateDocumentModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreated={handleDocumentCreated}
      />
    </div>
  );
}
