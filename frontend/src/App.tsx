import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { DocumentPage } from './pages/DocumentPage';
import { HealthIndicator } from './components/HealthIndicator';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3">
              <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h1 className="text-xl font-semibold text-gray-900">Document Manager</h1>
            </Link>
            <HealthIndicator />
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-4 py-8">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/documents/:id" element={<DocumentPage />} />
          </Routes>
        </main>

        <footer className="border-t border-gray-200 mt-12">
          <div className="max-w-6xl mx-auto px-4 py-6 text-center text-sm text-gray-500">
            Document Management System
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
}

export default App;
