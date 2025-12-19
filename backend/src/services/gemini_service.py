"""
Gemini Service for generating query expansions.
Uses Google's Gemini 2.0 Flash model for structured JSON output.
"""
import json
import logging
from datetime import datetime
from typing import Any

from google import genai
from google.genai import types

from config.settings import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()


class GeminiService:
    """Service for generating query expansions using Gemini."""
    
    def __init__(self):
        """Initialize the Gemini client."""
        self.client = genai.Client(api_key=settings.gemini_api_key)
        self.model = "gemini-2.0-flash-exp"
    
    def _build_expansion_prompt(self, user_query: str, max_queries: int) -> str:
        """Build the prompt for query expansion."""
        current_date = datetime.now().strftime("%B %d, %Y")
        
        return f"""You are an expert SEO and search query analyst. Your task is to generate query expansions based on the Query Fan-Out pattern.

Current Date: {current_date}

Given the user's original query, generate exactly {max_queries} expanded queries across 6 different types. Each type represents a different user intent or search behavior pattern.

Original Query: "{user_query}"

Generate queries for these 6 types (distribute them roughly evenly):

1. **reformulation**: Direct rephrasings of the original query using synonyms or different wording
2. **related**: Logically connected questions that someone searching the original query might also ask
3. **implicit**: Unstated but common intents (pricing, reviews, security, alternatives, comparisons)
4. **comparative**: Competitor or alternative comparisons
5. **entity_expansion**: Specific components, features, or sub-topics within the original query
6. **personalized**: Context-specific adaptations (for beginners, for enterprises, for specific industries, etc.)

For each query, provide:
- query: The expanded query text
- type: One of the 6 types above
- user_intent: What the user is trying to accomplish with this query
- reasoning: Why this expansion is valuable for SEO/content strategy
- routing_format: The expected content format (article, listicle, comparison, tutorial, FAQ, product page, etc.)

Return ONLY a valid JSON array with exactly {max_queries} objects. No markdown, no explanation, just the JSON array.

Example format:
[
  {{
    "query": "example expanded query",
    "type": "reformulation",
    "user_intent": "User wants to understand X",
    "reasoning": "This captures users who phrase the query differently",
    "routing_format": "article"
  }}
]"""

    async def generate_query_expansions(
        self,
        user_query: str,
        max_queries: int = 25
    ) -> list[dict[str, Any]]:
        """
        Generate query expansions using Gemini.
        
        Args:
            user_query: The original query to expand
            max_queries: Maximum number of expansions to generate
            
        Returns:
            List of query expansion dictionaries
        """
        try:
            prompt = self._build_expansion_prompt(user_query, max_queries)
            
            logger.info(f"Generating {max_queries} expansions for: {user_query}")
            
            # Configure for JSON output
            response = self.client.models.generate_content(
                model=self.model,
                contents=prompt,
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    temperature=0.7,
                    max_output_tokens=8192,
                )
            )
            
            # Parse the response
            response_text = response.text
            
            if not response_text:
                logger.error("Empty response from Gemini")
                return []
            
            # Parse JSON response
            try:
                expansions = json.loads(response_text)
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse Gemini response as JSON: {e}")
                logger.debug(f"Response text: {response_text[:500]}")
                return []
            
            # Validate and normalize the response
            validated_expansions = self._validate_expansions(expansions)
            
            logger.info(f"Successfully generated {len(validated_expansions)} valid expansions")
            return validated_expansions
            
        except Exception as e:
            logger.error(f"Error generating query expansions: {str(e)}")
            raise
    
    def _validate_expansions(
        self,
        expansions: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """
        Validate and normalize expansion responses.
        
        Args:
            expansions: Raw expansions from Gemini
            
        Returns:
            List of validated expansion dictionaries
        """
        valid_types = {
            "reformulation",
            "related", 
            "implicit",
            "comparative",
            "entity_expansion",
            "personalized"
        }
        
        required_fields = {"query", "type", "user_intent", "reasoning", "routing_format"}
        
        validated = []
        
        for i, exp in enumerate(expansions):
            if not isinstance(exp, dict):
                logger.warning(f"Expansion {i} is not a dictionary, skipping")
                continue
            
            # Check required fields
            missing_fields = required_fields - set(exp.keys())
            if missing_fields:
                logger.warning(f"Expansion {i} missing fields: {missing_fields}, skipping")
                continue
            
            # Normalize type
            exp_type = exp.get("type", "").lower().strip()
            if exp_type not in valid_types:
                logger.warning(f"Expansion {i} has invalid type '{exp_type}', defaulting to 'related'")
                exp_type = "related"
            
            validated.append({
                "query": str(exp.get("query", "")).strip(),
                "type": exp_type,
                "user_intent": str(exp.get("user_intent", "")).strip(),
                "reasoning": str(exp.get("reasoning", "")).strip(),
                "routing_format": str(exp.get("routing_format", "")).strip()
            })
        
        return validated

