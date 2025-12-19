/**
 * API client for the Query Fan-Out Analysis backend.
 */
import type { AnalyzeRequest, JobResponse, QueryResult } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || '';

/**
 * Custom error class for API errors.
 */
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * Make an API request with error handling.
 */
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    let errorData;
    try {
      errorData = await response.json();
    } catch {
      errorData = { detail: response.statusText };
    }
    
    throw new ApiError(
      errorData.detail || 'An error occurred',
      response.status,
      errorData
    );
  }

  return response.json();
}

/**
 * Start a query analysis job.
 * 
 * @param query - The query to analyze
 * @param maxQueries - Maximum number of expansions to generate
 * @returns Job response with job_id and status
 */
export async function analyzeQuery(
  query: string,
  maxQueries: number = 25
): Promise<JobResponse> {
  const request: AnalyzeRequest = {
    query,
    max_queries: maxQueries,
  };

  return apiRequest<JobResponse>('/api/analyze', {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/**
 * Get results for a query analysis job.
 * 
 * @param jobId - The job ID to fetch results for
 * @returns Query result with expansions and validations
 */
export async function getResults(jobId: string): Promise<QueryResult> {
  return apiRequest<QueryResult>(`/api/results/${jobId}`);
}

/**
 * Get recent query analysis jobs.
 * 
 * @param limit - Maximum number of results to return
 * @returns List of recent query results
 */
export async function getRecentQueries(limit: number = 20): Promise<QueryResult[]> {
  return apiRequest<QueryResult[]>(`/api/recent?limit=${limit}`);
}

/**
 * Check API health.
 * 
 * @returns Health status
 */
export async function checkHealth(): Promise<{ status: string }> {
  return apiRequest<{ status: string }>('/health');
}

/**
 * Poll for job completion.
 * 
 * @param jobId - The job ID to poll
 * @param intervalMs - Polling interval in milliseconds
 * @param maxAttempts - Maximum polling attempts
 * @param onProgress - Callback for progress updates
 * @returns Completed query result
 */
export async function pollForResults(
  jobId: string,
  intervalMs: number = 2000,
  maxAttempts: number = 60,
  onProgress?: (result: QueryResult) => void
): Promise<QueryResult> {
  let attempts = 0;

  while (attempts < maxAttempts) {
    const result = await getResults(jobId);
    
    if (onProgress) {
      onProgress(result);
    }

    if (result.status === 'completed' || result.status === 'failed') {
      return result;
    }

    attempts++;
    await new Promise(resolve => setTimeout(resolve, intervalMs));
  }

  throw new ApiError('Polling timeout exceeded', 408);
}

