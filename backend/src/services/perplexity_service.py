"""
Perplexity Service for validating query expansions.
Uses Perplexity's Sonar Pro model for online search and validation.
"""
import asyncio
import logging
from typing import Any

from openai import AsyncOpenAI
from tenacity import (
    retry,
    stop_after_attempt,
    wait_exponential,
    retry_if_exception_type
)

from config.settings import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class PerplexityService:
    """Service for validating queries using Perplexity's online search."""
    
    def __init__(self):
        """Initialize the Perplexity client using OpenAI SDK."""
        self.client = AsyncOpenAI(
            api_key=settings.perplexity_api_key,
            base_url="https://api.perplexity.ai"
        )
        self.model = "sonar-pro"
        self.timeout = 30  # seconds per query
        self.batch_size = 3  # Process queries in batches to avoid rate limits
        self.batch_delay = 1.0  # Delay between batches in seconds
    
    async def validate_queries(
        self,
        queries: list[str],
        limit: int = 10
    ) -> list[dict[str, Any]]:
        """
        Validate a list of queries using Perplexity.
        
        Args:
            queries: List of queries to validate
            limit: Maximum number of queries to validate
            
        Returns:
            List of validation results with answers and citations
        """
        # Limit the number of queries
        queries_to_validate = queries[:limit]
        
        logger.info(f"Validating {len(queries_to_validate)} queries with Perplexity")
        
        results = []
        
        # Process in batches to avoid rate limits
        for i in range(0, len(queries_to_validate), self.batch_size):
            batch = queries_to_validate[i:i + self.batch_size]
            
            # Process batch concurrently
            batch_tasks = [
                self._validate_single_query(query)
                for query in batch
            ]
            
            batch_results = await asyncio.gather(*batch_tasks, return_exceptions=True)
            
            for query, result in zip(batch, batch_results):
                if isinstance(result, Exception):
                    logger.warning(f"Failed to validate query '{query}': {str(result)}")
                    results.append({
                        "query": query,
                        "answer": "Validation failed",
                        "citations": []
                    })
                else:
                    results.append(result)
            
            # Delay between batches to avoid rate limiting
            if i + self.batch_size < len(queries_to_validate):
                await asyncio.sleep(self.batch_delay)
        
        logger.info(f"Successfully validated {len(results)} queries")
        return results
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((Exception,)),
        reraise=True
    )
    async def _validate_single_query(self, query: str) -> dict[str, Any]:
        """
        Validate a single query with Perplexity.
        
        Uses exponential backoff retry logic for resilience.
        
        Args:
            query: The query to validate
            
        Returns:
            Dictionary with query, answer, and citations
        """
        try:
            response = await asyncio.wait_for(
                self._make_perplexity_request(query),
                timeout=self.timeout
            )
            
            # Extract answer
            answer = ""
            if response.choices and len(response.choices) > 0:
                answer = response.choices[0].message.content or ""
            
            # Extract citations if available
            citations = self._extract_citations(response)
            
            return {
                "query": query,
                "answer": answer.strip(),
                "citations": citations
            }
            
        except asyncio.TimeoutError:
            logger.warning(f"Timeout validating query: {query}")
            raise
        except Exception as e:
            logger.error(f"Error validating query '{query}': {str(e)}")
            raise
    
    async def _make_perplexity_request(self, query: str):
        """Make the actual API request to Perplexity."""
        return await self.client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a helpful search assistant. Provide a concise, "
                        "informative answer to the user's query based on current "
                        "web search results. Include relevant facts and data points."
                    )
                },
                {
                    "role": "user",
                    "content": query
                }
            ],
            max_tokens=500,
            temperature=0.2
        )
    
    def _extract_citations(self, response) -> list[str]:
        """
        Extract citations from Perplexity response.
        
        Perplexity includes citations in the response when available.
        
        Args:
            response: The API response object
            
        Returns:
            List of citation URLs
        """
        citations = []
        
        try:
            # Check for citations in the response metadata
            # Perplexity may include these in different locations depending on the API version
            if hasattr(response, 'citations'):
                citations = response.citations or []
            elif hasattr(response, 'choices') and response.choices:
                choice = response.choices[0]
                if hasattr(choice, 'message') and hasattr(choice.message, 'citations'):
                    citations = choice.message.citations or []
                    
            # Ensure all citations are strings
            citations = [str(c) for c in citations if c]
            
        except Exception as e:
            logger.debug(f"Could not extract citations: {str(e)}")
        
        return citations

