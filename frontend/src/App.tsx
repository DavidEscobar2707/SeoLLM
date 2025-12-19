import { useState, useCallback } from 'react';
import { Search, Loader2, Sparkles, Network, Table2 } from 'lucide-react';
import { ErrorBoundary, ErrorDisplay } from './components/ErrorBoundary';
import { NetworkGraph } from './components/NetworkGraph';
import { ResultsTable } from './components/ResultsTable';
import { analyzeQuery, pollForResults } from './lib/api';
import type { QueryResult, QueryExpansion } from './types';

type AppStatus = 'idle' | 'loading' | 'success' | 'error';
type ViewMode = 'graph' | 'table' | 'split';

function App() {
  // Form state
  const [query, setQuery] = useState('');
  const [maxQueries, setMaxQueries] = useState(25);
  
  // Job state
  const [status, setStatus] = useState<AppStatus>('idle');
  const [results, setResults] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  
  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [selectedNode, setSelectedNode] = useState<QueryExpansion | null>(null);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!query.trim()) return;

    setStatus('loading');
    setError(null);
    setResults(null);
    setSelectedNode(null);
    setProgress('Starting analysis...');

    try {
      // Start the job
      setProgress('Creating analysis job...');
      const jobResponse = await analyzeQuery(query.trim(), maxQueries);
      
      setProgress('Generating query expansions with AI...');
      
      // Poll for results
      const result = await pollForResults(
        jobResponse.job_id,
        2000,
        120,
        (r) => {
          if (r.status === 'processing') {
            if (r.expansions && r.expansions.length > 0) {
              setProgress(`Generated ${r.expansions.length} expansions, validating...`);
            }
          }
        }
      );

      if (result.status === 'failed') {
        throw new Error(result.error_message || 'Analysis failed');
      }

      setResults(result);
      setStatus('success');
      setProgress('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'An error occurred';
      setError(message);
      setStatus('error');
      setProgress('');
    }
  }, [query, maxQueries]);

  const handleReset = useCallback(() => {
    setStatus('idle');
    setResults(null);
    setError(null);
    setSelectedNode(null);
    setProgress('');
  }, []);

  const handleNodeClick = useCallback((node: QueryExpansion) => {
    setSelectedNode(node);
  }, []);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-xl">
                <Network className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-display font-bold text-slate-900">
                  Query Fan-Out Analysis
                </h1>
                <p className="text-xs text-slate-500">
                  AI-powered query expansion and validation
                </p>
              </div>
            </div>
            
            {status === 'success' && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewMode('graph')}
                  className={`p-2 rounded-lg transition-colors ${
                    viewMode === 'graph' 
                      ? 'bg-violet-100 text-violet-700' 
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                  title="Graph view"
                >
                  <Network className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-2 rounded-lg transition-colors ${
                    viewMode === 'table' 
                      ? 'bg-violet-100 text-violet-700' 
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                  title="Table view"
                >
                  <Table2 className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setViewMode('split')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    viewMode === 'split' 
                      ? 'bg-violet-100 text-violet-700' 
                      : 'text-slate-500 hover:bg-slate-100'
                  }`}
                  title="Split view"
                >
                  Split
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Form */}
        <div className="mb-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-white rounded-2xl shadow-lg shadow-slate-200/50 border border-slate-200 p-6">
              <div className="flex flex-col lg:flex-row gap-4">
                <div className="flex-1">
                  <label htmlFor="query" className="block text-sm font-medium text-slate-700 mb-2">
                    Enter your seed query
                  </label>
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input
                      id="query"
                      type="text"
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder="e.g., best project management software for startups"
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                      disabled={status === 'loading'}
                    />
                  </div>
                </div>
                
                <div className="w-full lg:w-48">
                  <label htmlFor="maxQueries" className="block text-sm font-medium text-slate-700 mb-2">
                    Max expansions
                  </label>
                  <select
                    id="maxQueries"
                    value={maxQueries}
                    onChange={(e) => setMaxQueries(Number(e.target.value))}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all"
                    disabled={status === 'loading'}
                  >
                    <option value={10}>10 queries</option>
                    <option value={15}>15 queries</option>
                    <option value={25}>25 queries</option>
                    <option value={35}>35 queries</option>
                    <option value={50}>50 queries</option>
                  </select>
                </div>
                
                <div className="flex items-end">
                  <button
                    type="submit"
                    disabled={status === 'loading' || !query.trim()}
                    className="w-full lg:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-violet-600 to-indigo-600 text-white font-medium rounded-xl hover:from-violet-700 hover:to-indigo-700 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-violet-500/25"
                  >
                    {status === 'loading' ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5" />
                        Analyze
                      </>
                    )}
                  </button>
                </div>
              </div>
              
              {status === 'loading' && progress && (
                <div className="mt-4 flex items-center gap-3 text-sm text-slate-600">
                  <div className="w-2 h-2 bg-violet-500 rounded-full animate-pulse" />
                  {progress}
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Results */}
        <ErrorBoundary>
          {status === 'error' && error && (
            <ErrorDisplay message={error} onRetry={handleReset} />
          )}

          {status === 'success' && results && (
            <div className="space-y-6 animate-fade-in">
              {/* Stats bar */}
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div className="bg-white rounded-lg px-4 py-2 border border-slate-200 shadow-sm">
                  <span className="text-slate-500">Original query:</span>{' '}
                  <span className="font-medium text-slate-900">{results.original_query}</span>
                </div>
                <div className="bg-white rounded-lg px-4 py-2 border border-slate-200 shadow-sm">
                  <span className="text-slate-500">Expansions:</span>{' '}
                  <span className="font-semibold text-violet-600">{results.expansions.length}</span>
                </div>
                <div className="bg-white rounded-lg px-4 py-2 border border-slate-200 shadow-sm">
                  <span className="text-slate-500">Validated:</span>{' '}
                  <span className="font-semibold text-emerald-600">{results.validated_results.length}</span>
                </div>
                <button
                  onClick={handleReset}
                  className="ml-auto text-slate-500 hover:text-slate-700 underline underline-offset-4"
                >
                  New analysis
                </button>
              </div>

              {/* Content based on view mode */}
              {viewMode === 'graph' && (
                <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                  <NetworkGraph
                    originalQuery={results.original_query}
                    expansions={results.expansions}
                    onNodeClick={handleNodeClick}
                  />
                </div>
              )}

              {viewMode === 'table' && (
                <ResultsTable
                  expansions={results.expansions}
                  validations={results.validated_results}
                  originalQuery={results.original_query}
                />
              )}

              {viewMode === 'split' && (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <div className="bg-white rounded-2xl shadow-lg border border-slate-200 overflow-hidden">
                    <NetworkGraph
                      originalQuery={results.original_query}
                      expansions={results.expansions}
                      onNodeClick={handleNodeClick}
                    />
                  </div>
                  <div className="space-y-4">
                    {selectedNode && (
                      <div className="bg-white rounded-xl border border-slate-200 p-4 animate-slide-up">
                        <h3 className="font-semibold text-slate-900 mb-3">Selected Query</h3>
                        <div className="space-y-2 text-sm">
                          <p><span className="text-slate-500">Query:</span> {selectedNode.query}</p>
                          <p><span className="text-slate-500">Type:</span> <span className={`type-badge type-badge-${selectedNode.type}`}>{selectedNode.type}</span></p>
                          <p><span className="text-slate-500">Intent:</span> {selectedNode.user_intent}</p>
                          <p><span className="text-slate-500">Format:</span> {selectedNode.routing_format}</p>
                          <p className="text-slate-600 italic">{selectedNode.reasoning}</p>
                        </div>
                      </div>
                    )}
                    <ResultsTable
                      expansions={results.expansions}
                      validations={results.validated_results}
                      originalQuery={results.original_query}
                      compact
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {status === 'idle' && (
            <div className="text-center py-16">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-violet-100 to-indigo-100 rounded-2xl mb-6">
                <Sparkles className="w-10 h-10 text-violet-600" />
              </div>
              <h2 className="text-2xl font-display font-bold text-slate-900 mb-3">
                Discover Query Opportunities
              </h2>
              <p className="text-slate-600 max-w-md mx-auto">
                Enter a seed query above to generate AI-powered expansions across 6 different intent types,
                validated with real-time search data.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3">
                {['reformulation', 'related', 'implicit', 'comparative', 'entity_expansion', 'personalized'].map((type) => (
                  <span key={type} className={`type-badge type-badge-${type}`}>
                    {type.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </div>
          )}
        </ErrorBoundary>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white/50 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-sm text-slate-500">
            Query Fan-Out Analysis Tool • Powered by Gemini 2.0 & Perplexity
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;

