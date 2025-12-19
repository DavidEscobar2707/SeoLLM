"""
FastAPI Backend for Query Fan-Out Analysis Tool.
Similar to iPullRank's Qforia - generates query expansions and validates them.
"""
import logging
from contextlib import asynccontextmanager
from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID, uuid4

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from config.settings import get_settings
from src.services.database_service import DatabaseService
from src.services.gemini_service import GeminiService
from src.services.perplexity_service import PerplexityService

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Initialize services
settings = get_settings()
db_service = DatabaseService()
gemini_service = GeminiService()
perplexity_service = PerplexityService()


# Enums
class JobStatus(str, Enum):
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class QueryType(str, Enum):
    REFORMULATION = "reformulation"
    RELATED = "related"
    IMPLICIT = "implicit"
    COMPARATIVE = "comparative"
    ENTITY_EXPANSION = "entity_expansion"
    PERSONALIZED = "personalized"


# Pydantic Models
class QueryRequest(BaseModel):
    """Request model for query analysis."""
    query: str = Field(..., min_length=1, max_length=500, description="The query to analyze")
    max_queries: int = Field(
        default=25,
        ge=1,
        le=50,
        description="Maximum number of query expansions to generate"
    )


class QueryExpansion(BaseModel):
    """Model for a single query expansion."""
    query: str
    type: str
    user_intent: str
    reasoning: str
    routing_format: str


class ValidationResult(BaseModel):
    """Model for Perplexity validation result."""
    query: str
    answer: str
    citations: list[str] = Field(default_factory=list)


class JobResponse(BaseModel):
    """Response model for job creation."""
    job_id: UUID
    status: JobStatus


class QueryResult(BaseModel):
    """Full result model for a completed job."""
    job_id: UUID
    original_query: str
    status: JobStatus
    expansions: list[QueryExpansion] = Field(default_factory=list)
    validated_results: list[ValidationResult] = Field(default_factory=list)
    created_at: datetime | None = None
    error_message: str | None = None


class HealthResponse(BaseModel):
    """Health check response."""
    status: str
    timestamp: datetime
    environment: str


# Lifespan context manager
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    logger.info("Starting Query Fan-Out Analysis API...")
    logger.info(f"Environment: {settings.environment}")
    yield
    logger.info("Shutting down Query Fan-Out Analysis API...")


# Create FastAPI app
app = FastAPI(
    title="Query Fan-Out Analysis API",
    description="Generate and validate query expansions using AI",
    version="1.0.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Background task for processing queries
async def process_query(job_id: str, query: str, max_queries: int) -> None:
    """
    Background task to process query expansion and validation.
    
    Steps:
    1. Generate query expansions using Gemini
    2. Validate top N queries using Perplexity
    3. Save results to database
    """
    try:
        logger.info(f"Starting processing for job {job_id}")
        
        # Step 1: Generate expansions with Gemini
        logger.info(f"Generating expansions for query: {query}")
        expansions = await gemini_service.generate_query_expansions(query, max_queries)
        
        if not expansions:
            raise ValueError("No expansions generated from Gemini")
        
        logger.info(f"Generated {len(expansions)} expansions")
        
        # Step 2: Validate top N queries with Perplexity
        validation_limit = min(settings.validation_limit, len(expansions))
        queries_to_validate = [exp["query"] for exp in expansions[:validation_limit]]
        
        logger.info(f"Validating top {validation_limit} queries with Perplexity")
        validated_results = await perplexity_service.validate_queries(
            queries_to_validate,
            limit=validation_limit
        )
        
        logger.info(f"Validated {len(validated_results)} queries")
        
        # Step 3: Save completed results
        await db_service.save_query_result(
            job_id=job_id,
            original_query=query,
            expansions=expansions,
            validated_results=validated_results,
            status=JobStatus.COMPLETED.value
        )
        
        logger.info(f"Job {job_id} completed successfully")
        
    except Exception as e:
        logger.error(f"Error processing job {job_id}: {str(e)}")
        # Save failed status
        try:
            await db_service.save_query_result(
                job_id=job_id,
                original_query=query,
                expansions=[],
                validated_results=[],
                status=JobStatus.FAILED.value,
                error_message=str(e)
            )
        except Exception as save_error:
            logger.error(f"Failed to save error status for job {job_id}: {str(save_error)}")


# API Endpoints
@app.get("/health", response_model=HealthResponse)
async def health_check() -> HealthResponse:
    """Health check endpoint."""
    return HealthResponse(
        status="ok",
        timestamp=datetime.utcnow(),
        environment=settings.environment
    )


@app.post("/api/analyze", response_model=JobResponse)
async def analyze_query(
    request: QueryRequest,
    background_tasks: BackgroundTasks
) -> JobResponse:
    """
    Start a query analysis job.
    
    Creates a background task to:
    1. Generate query expansions using Gemini
    2. Validate top queries using Perplexity
    3. Store results in Supabase
    """
    job_id = uuid4()
    job_id_str = str(job_id)
    
    logger.info(f"Creating job {job_id_str} for query: {request.query}")
    
    # Initialize job in database with processing status
    try:
        await db_service.save_query_result(
            job_id=job_id_str,
            original_query=request.query,
            expansions=[],
            validated_results=[],
            status=JobStatus.PROCESSING.value
        )
    except Exception as e:
        logger.error(f"Failed to initialize job {job_id_str}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to create job. Please try again."
        )
    
    # Add background task
    background_tasks.add_task(
        process_query,
        job_id_str,
        request.query,
        request.max_queries
    )
    
    return JobResponse(
        job_id=job_id,
        status=JobStatus.PROCESSING
    )


@app.get("/api/results/{job_id}", response_model=QueryResult)
async def get_results(job_id: UUID) -> QueryResult:
    """
    Get results for a query analysis job.
    
    Poll this endpoint to check job status and retrieve results.
    """
    job_id_str = str(job_id)
    
    try:
        result = await db_service.get_query_result(job_id_str)
        
        if not result:
            raise HTTPException(
                status_code=404,
                detail=f"Job {job_id} not found"
            )
        
        return QueryResult(
            job_id=job_id,
            original_query=result.get("original_query", ""),
            status=JobStatus(result.get("status", "processing")),
            expansions=[
                QueryExpansion(**exp) for exp in result.get("expansions", [])
            ],
            validated_results=[
                ValidationResult(**val) for val in result.get("validated_results", [])
            ],
            created_at=result.get("created_at"),
            error_message=result.get("error_message")
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching results for job {job_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch results"
        )


@app.get("/api/recent", response_model=list[QueryResult])
async def get_recent_queries(limit: int = 20) -> list[QueryResult]:
    """Get recent query analysis jobs."""
    try:
        results = await db_service.list_recent_queries(limit=limit)
        
        return [
            QueryResult(
                job_id=UUID(r["job_id"]),
                original_query=r.get("original_query", ""),
                status=JobStatus(r.get("status", "processing")),
                expansions=[
                    QueryExpansion(**exp) for exp in r.get("expansions", [])
                ],
                validated_results=[
                    ValidationResult(**val) for val in r.get("validated_results", [])
                ],
                created_at=r.get("created_at"),
                error_message=r.get("error_message")
            )
            for r in results
        ]
        
    except Exception as e:
        logger.error(f"Error fetching recent queries: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Failed to fetch recent queries"
        )


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.environment == "development"
    )

