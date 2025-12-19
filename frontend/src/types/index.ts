/**
 * Type definitions for the Query Fan-Out Analysis tool.
 */

export type QueryType = 
  | 'reformulation'
  | 'related'
  | 'implicit'
  | 'comparative'
  | 'entity_expansion'
  | 'personalized';

export type JobStatus = 'processing' | 'completed' | 'failed';

export interface QueryExpansion {
  query: string;
  type: QueryType;
  user_intent: string;
  reasoning: string;
  routing_format: string;
}

export interface ValidationResult {
  query: string;
  answer: string;
  citations: string[];
}

export interface QueryResult {
  job_id: string;
  original_query: string;
  status: JobStatus;
  expansions: QueryExpansion[];
  validated_results: ValidationResult[];
  created_at: string | null;
  error_message: string | null;
}

export interface JobResponse {
  job_id: string;
  status: JobStatus;
}

export interface AnalyzeRequest {
  query: string;
  max_queries: number;
}

// Graph node types for D3
export interface GraphNode {
  id: string;
  label: string;
  type: QueryType | 'center';
  data?: QueryExpansion;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface GraphLink {
  source: string | GraphNode;
  target: string | GraphNode;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

// Color mapping for query types
export const TYPE_COLORS: Record<QueryType | 'center', string> = {
  reformulation: '#3b82f6',
  related: '#10b981',
  implicit: '#f59e0b',
  comparative: '#ef4444',
  entity_expansion: '#8b5cf6',
  personalized: '#ec4899',
  center: '#1e293b',
};

export const TYPE_LABELS: Record<QueryType, string> = {
  reformulation: 'Reformulation',
  related: 'Related',
  implicit: 'Implicit',
  comparative: 'Comparative',
  entity_expansion: 'Entity Expansion',
  personalized: 'Personalized',
};

