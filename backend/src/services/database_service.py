"""
Database Service for Supabase operations.
Handles persistence of query results and job tracking.
"""
import logging
from datetime import datetime
from typing import Any

from supabase import create_client, Client

from config.settings import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class DatabaseService:
    """Service for Supabase database operations."""
    
    def __init__(self):
        """Initialize the Supabase client."""
        self.client: Client = create_client(
            settings.supabase_url,
            settings.supabase_key
        )
        self.table_name = "query_results"
    
    async def save_query_result(
        self,
        job_id: str,
        original_query: str,
        expansions: list[dict[str, Any]],
        validated_results: list[dict[str, Any]],
        status: str,
        error_message: str | None = None
    ) -> dict[str, Any]:
        """
        Save or update a query result in the database.
        
        Args:
            job_id: Unique job identifier
            original_query: The original query text
            expansions: List of query expansions
            validated_results: List of validation results
            status: Job status (processing, completed, failed)
            error_message: Optional error message for failed jobs
            
        Returns:
            The saved/updated record
        """
        try:
            data = {
                "job_id": job_id,
                "original_query": original_query,
                "expansions": expansions,
                "validated_results": validated_results,
                "status": status,
                "updated_at": datetime.utcnow().isoformat()
            }
            
            if error_message:
                data["error_message"] = error_message
            
            # Use upsert to handle both insert and update
            result = self.client.table(self.table_name).upsert(
                data,
                on_conflict="job_id"
            ).execute()
            
            if result.data:
                logger.info(f"Saved query result for job {job_id} with status {status}")
                return result.data[0]
            else:
                logger.warning(f"No data returned when saving job {job_id}")
                return data
                
        except Exception as e:
            logger.error(f"Error saving query result for job {job_id}: {str(e)}")
            raise
    
    async def get_query_result(self, job_id: str) -> dict[str, Any] | None:
        """
        Get a query result by job ID.
        
        Args:
            job_id: The job ID to look up
            
        Returns:
            The query result or None if not found
        """
        try:
            result = self.client.table(self.table_name).select("*").eq(
                "job_id", job_id
            ).execute()
            
            if result.data and len(result.data) > 0:
                return result.data[0]
            
            return None
            
        except Exception as e:
            logger.error(f"Error fetching query result for job {job_id}: {str(e)}")
            raise
    
    async def list_recent_queries(self, limit: int = 20) -> list[dict[str, Any]]:
        """
        List recent query results.
        
        Args:
            limit: Maximum number of results to return
            
        Returns:
            List of recent query results
        """
        try:
            result = self.client.table(self.table_name).select("*").order(
                "created_at", desc=True
            ).limit(limit).execute()
            
            return result.data or []
            
        except Exception as e:
            logger.error(f"Error listing recent queries: {str(e)}")
            raise
    
    async def delete_query_result(self, job_id: str) -> bool:
        """
        Delete a query result by job ID.
        
        Args:
            job_id: The job ID to delete
            
        Returns:
            True if deleted, False otherwise
        """
        try:
            result = self.client.table(self.table_name).delete().eq(
                "job_id", job_id
            ).execute()
            
            return len(result.data) > 0 if result.data else False
            
        except Exception as e:
            logger.error(f"Error deleting query result for job {job_id}: {str(e)}")
            raise


# SQL for creating the table in Supabase:
"""
-- Run this in Supabase SQL Editor to create the required table

CREATE TABLE IF NOT EXISTS query_results (
    job_id UUID PRIMARY KEY,
    original_query TEXT NOT NULL,
    expansions JSONB DEFAULT '[]'::jsonb,
    validated_results JSONB DEFAULT '[]'::jsonb,
    status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_query_results_status ON query_results(status);
CREATE INDEX IF NOT EXISTS idx_query_results_created_at ON query_results(created_at DESC);

-- Enable Row Level Security (optional, for production)
-- ALTER TABLE query_results ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (for anonymous access)
-- CREATE POLICY "Allow all operations" ON query_results FOR ALL USING (true);
"""

