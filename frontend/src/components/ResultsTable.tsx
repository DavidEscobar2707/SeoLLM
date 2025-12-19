import { useState, useMemo, useCallback } from 'react';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Copy,
  Check,
  Download,
  Filter,
  X,
  ExternalLink,
} from 'lucide-react';
import type { QueryExpansion, ValidationResult, QueryType } from '../types';
import { TYPE_LABELS, TYPE_COLORS } from '../types';

interface ResultsTableProps {
  expansions: QueryExpansion[];
  validations?: ValidationResult[];
  originalQuery?: string;
  compact?: boolean;
}

type SortField = 'query' | 'type' | 'user_intent' | 'routing_format';
type SortDirection = 'asc' | 'desc';

const ALL_TYPES: QueryType[] = [
  'reformulation',
  'related',
  'implicit',
  'comparative',
  'entity_expansion',
  'personalized',
];

/**
 * Results table component with filtering, sorting, search, and export.
 */
export function ResultsTable({ expansions, validations = [], originalQuery = '', compact = false }: ResultsTableProps) {
  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTypes, setSelectedTypes] = useState<Set<QueryType>>(new Set(ALL_TYPES));
  const [sortField, setSortField] = useState<SortField>('type');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Create validation lookup
  const validationMap = useMemo(() => {
    const map = new Map<string, ValidationResult>();
    validations.forEach((v) => map.set(v.query, v));
    return map;
  }, [validations]);

  // Filter and sort data
  const filteredData = useMemo(() => {
    let data = expansions.filter((exp) => {
      // Type filter
      if (!selectedTypes.has(exp.type)) return false;

      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          exp.query.toLowerCase().includes(query) ||
          exp.user_intent.toLowerCase().includes(query) ||
          exp.routing_format.toLowerCase().includes(query)
        );
      }

      return true;
    });

    // Sort
    data.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];
      const comparison = aValue.localeCompare(bValue);
      return sortDirection === 'asc' ? comparison : -comparison;
    });

    return data;
  }, [expansions, selectedTypes, searchQuery, sortField, sortDirection]);

  // Handlers
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleTypeToggle = (type: QueryType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    setSelectedTypes(new Set(ALL_TYPES));
  };

  const handleClearFilters = () => {
    setSelectedTypes(new Set(ALL_TYPES));
    setSearchQuery('');
  };

  const handleCopy = useCallback(async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, []);

  const handleExportCSV = useCallback(() => {
    // Title and seed query header
    const title = 'Query Fan-Out Analysis Results';
    const seedQueryRow = `Seed Query:,"${originalQuery.replace(/"/g, '""')}"`;
    const exportDate = `Export Date:,${new Date().toLocaleString()}`;
    const totalExpansions = `Total Expansions:,${filteredData.length}`;
    
    const headers = ['Query', 'Type', 'User Intent', 'Reasoning', 'Routing Format', 'Validation Answer', 'Citations'];
    
    const rows = filteredData.map((exp) => {
      const validation = validationMap.get(exp.query);
      return [
        `"${exp.query.replace(/"/g, '""')}"`,
        exp.type,
        `"${exp.user_intent.replace(/"/g, '""')}"`,
        `"${exp.reasoning.replace(/"/g, '""')}"`,
        exp.routing_format,
        validation ? `"${validation.answer.replace(/"/g, '""')}"` : '',
        validation ? validation.citations.join('; ') : '',
      ];
    });

    const csv = [
      title,
      seedQueryRow,
      exportDate,
      totalExpansions,
      '', // Empty row for spacing
      headers.join(','),
      ...rows.map((r) => r.join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `query-expansions-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [filteredData, validationMap, originalQuery]);

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-4 h-4 text-slate-400" />;
    return sortDirection === 'asc' ? (
      <ArrowUp className="w-4 h-4 text-violet-600" />
    ) : (
      <ArrowDown className="w-4 h-4 text-violet-600" />
    );
  };

  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-sm ${compact ? '' : 'shadow-lg'}`}>
      {/* Header */}
      <div className="p-4 border-b border-slate-200">
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search queries..."
              className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`inline-flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors ${
                showFilters || selectedTypes.size < ALL_TYPES.length
                  ? 'border-violet-300 bg-violet-50 text-violet-700'
                  : 'border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              Filters
              {selectedTypes.size < ALL_TYPES.length && (
                <span className="bg-violet-600 text-white text-xs px-1.5 py-0.5 rounded-full">
                  {selectedTypes.size}
                </span>
              )}
            </button>

            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>

        {/* Filter panel */}
        {showFilters && (
          <div className="mt-4 p-3 bg-slate-50 rounded-lg animate-fade-in">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-slate-700">Filter by type</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSelectAll}
                  className="text-xs text-violet-600 hover:underline"
                >
                  Select all
                </button>
                <button
                  onClick={handleClearFilters}
                  className="text-xs text-slate-500 hover:underline"
                >
                  Reset
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {ALL_TYPES.map((type) => (
                <button
                  key={type}
                  onClick={() => handleTypeToggle(type)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    selectedTypes.has(type)
                      ? ''
                      : 'opacity-50'
                  }`}
                  style={{
                    backgroundColor: selectedTypes.has(type)
                      ? `${TYPE_COLORS[type]}20`
                      : '#f1f5f9',
                    color: TYPE_COLORS[type],
                    boxShadow: selectedTypes.has(type)
                      ? `0 0 0 2px white, 0 0 0 4px ${TYPE_COLORS[type]}`
                      : 'none',
                  }}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: TYPE_COLORS[type] }}
                  />
                  {TYPE_LABELS[type]}
                  {selectedTypes.has(type) && (
                    <X className="w-3 h-3" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className={`overflow-auto ${compact ? 'max-h-96' : 'max-h-[600px]'}`}>
        <table className="w-full text-sm">
          <thead className="bg-slate-50 sticky top-0 z-10">
            <tr>
              <th className="text-left p-3 font-medium text-slate-600">
                <button
                  onClick={() => handleSort('query')}
                  className="inline-flex items-center gap-1 hover:text-slate-900"
                >
                  Query
                  <SortIcon field="query" />
                </button>
              </th>
              <th className="text-left p-3 font-medium text-slate-600 w-36">
                <button
                  onClick={() => handleSort('type')}
                  className="inline-flex items-center gap-1 hover:text-slate-900"
                >
                  Type
                  <SortIcon field="type" />
                </button>
              </th>
              {!compact && (
                <>
                  <th className="text-left p-3 font-medium text-slate-600">
                    <button
                      onClick={() => handleSort('user_intent')}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      User Intent
                      <SortIcon field="user_intent" />
                    </button>
                  </th>
                  <th className="text-left p-3 font-medium text-slate-600 w-32">
                    <button
                      onClick={() => handleSort('routing_format')}
                      className="inline-flex items-center gap-1 hover:text-slate-900"
                    >
                      Format
                      <SortIcon field="routing_format" />
                    </button>
                  </th>
                </>
              )}
              <th className="text-left p-3 font-medium text-slate-600 w-24">
                Validated
              </th>
              <th className="w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredData.map((exp, index) => {
              const validation = validationMap.get(exp.query);
              const id = `row-${index}`;
              
              return (
                <tr
                  key={id}
                  className="hover:bg-slate-50 transition-colors group"
                >
                  <td className="p-3">
                    <div className="max-w-md">
                      <span className="text-slate-900" title={exp.query}>
                        {exp.query.length > 80
                          ? exp.query.slice(0, 80) + '...'
                          : exp.query}
                      </span>
                    </div>
                  </td>
                  <td className="p-3">
                    <span className={`type-badge type-badge-${exp.type}`}>
                      {TYPE_LABELS[exp.type]}
                    </span>
                  </td>
                  {!compact && (
                    <>
                      <td className="p-3">
                        <span className="text-slate-600 line-clamp-2">
                          {exp.user_intent}
                        </span>
                      </td>
                      <td className="p-3">
                        <span className="inline-flex px-2 py-1 bg-slate-100 text-slate-700 text-xs rounded">
                          {exp.routing_format}
                        </span>
                      </td>
                    </>
                  )}
                  <td className="p-3">
                    {validation ? (
                      <div className="flex items-center gap-1">
                        <Check className="w-4 h-4 text-emerald-500" />
                        {validation.citations.length > 0 && (
                          <a
                            href={validation.citations[0]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-violet-600 hover:text-violet-800"
                            title="View source"
                          >
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="p-3">
                    <button
                      onClick={() => handleCopy(exp.query, id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-slate-200 rounded transition-all"
                      title="Copy query"
                    >
                      {copiedId === id ? (
                        <Check className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Copy className="w-4 h-4 text-slate-500" />
                      )}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredData.length === 0 && (
          <div className="p-8 text-center text-slate-500">
            No queries match your filters
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-slate-200 bg-slate-50 text-xs text-slate-500">
        Showing {filteredData.length} of {expansions.length} queries
      </div>
    </div>
  );
}

