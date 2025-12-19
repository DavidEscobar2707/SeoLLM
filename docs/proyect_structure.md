Fase 1: Backend con FastAPI
Prompt 1 para Composer (Backend Base)
Abre Composer (Cmd+Shift+I) y usa este prompt:

text
Create a FastAPI backend in backend/main.py with this structure:

Requirements:
- FastAPI with CORS middleware
- Pydantic models for QueryRequest and QueryResponse
- Background task processing for long-running jobs
- UUID-based job tracking
- Health check endpoint at /health

File: backend/main.py
Include:
- CORS config allowing all origins
- POST /api/analyze endpoint that accepts {query: string, max_queries: int}
- GET /api/results/{job_id} endpoint
- Background task placeholder for process_query()
- Pydantic models with validation

Use modern FastAPI patterns with async/await.
Prompt 2 (Gemini Service)
text
Create backend/src/services/gemini_service.py with:

Function: generate_query_expansions(user_query: str, max_queries: int = 25)

Requirements:
- Use google-genai library (latest SDK)
- Model: gemini-2.0-flash-exp
- Structured JSON output with this schema:
  [{
    "query": str,
    "type": "reformulation|related|implicit|comparative|entity_expansion|personalized",
    "user_intent": str,
    "reasoning": str,
    "routing_format": str
  }]

The prompt should generate 6 query types based on the query fan-out pattern:
1. reformulation: Direct rephrasings
2. related: Logically connected questions  
3. implicit: Unstated intents (pricing, reviews, security)
4. comparative: Competitor comparisons
5. entity_expansion: Specific components
6. personalized: Context-specific adaptations

Include current date context in the prompt.
Use generation_config with response_mime_type="application/json"
Handle API errors with try/except and return structured error responses.
Prompt 3 (Perplexity Service)
text
Create backend/src/services/perplexity_service.py with:

Function: validate_queries(queries: list[str], limit: int = 10)

Requirements:
- Use OpenAI SDK with Perplexity base_url: https://api.perplexity.ai
- Model: sonar-pro (online search model)
- Process queries in batches to avoid rate limits
- Return structure: [{query, answer, citations}]
- Add exponential backoff retry logic
- Extract citations from response if available
- Timeout after 30 seconds per query

Environment variable: PERPLEXITY_API_KEY
Prompt 4 (Supabase Integration)
text
Create backend/src/services/database_service.py with:

Functions:
- save_query_result(job_id, original_query, expansions, validated_results)
- get_query_result(job_id)
- list_recent_queries(limit=20)

Requirements:
- Use supabase-py client
- Table schema: query_results
  - job_id (uuid, primary key)
  - original_query (text)
  - expansions (jsonb)
  - validated_results (jsonb)
  - created_at (timestamp)
  - status (enum: processing, completed, failed)

Environment variables: SUPABASE_URL, SUPABASE_KEY
Include connection pooling and error handling.
Prompt 5 (Wire Everything Together)
text
Update backend/main.py to integrate all services:

@app.post("/api/analyze")
- Create job_id with uuid4()
- Add background task: process_query()
- Return {job_id, status: "processing"}

Background task process_query():
1. Update status to "processing" in database
2. Call gemini_service.generate_query_expansions()
3. Call perplexity_service.validate_queries() on top 10
4. Save results to database with status "completed"
5. Handle errors and update status to "failed"

@app.get("/api/results/{job_id}")
- Query database by job_id
- Return full result with expansions and validations

Add proper error handling and logging throughout.
Fase 2: Frontend con React + D3.js
Prompt 6 (Frontend Setup)
text
Update frontend/src/App.tsx to create a query analysis interface:

Components structure:
- QueryInput: Text input + submit button
- LoadingSpinner: Shows during processing
- ResultsView: Displays query expansions
- NetworkGraph: D3.js visualization

State management:
- jobId (string | null)
- status (idle | loading | success | error)
- results (QueryResult | null)

API integration:
- POST to http://localhost:8000/api/analyze
- Poll GET /api/results/{jobId} every 2 seconds until completed

Use Tailwind CSS for styling.
Create a clean, modern UI with gradient backgrounds.
Prompt 7 (D3.js Network Graph)
text
Create frontend/src/components/NetworkGraph.tsx:

Requirements:
- Force-directed graph using d3.forceSimulation
- Center node: original query (black, size 20)
- Child nodes: expanded queries colored by type
- Color scale:
  - reformulation: #3b82f6 (blue)
  - related: #10b981 (green)
  - implicit: #f59e0b (amber)
  - comparative: #ef4444 (red)
  - entity_expansion: #8b5cf6 (purple)
  - personalized: #ec4899 (pink)

Features:
- Draggable nodes
- Zoom/pan controls
- Hover tooltip showing full query + metadata
- Click node to show detailed info in sidebar
- Smooth animations
- Responsive SVG sizing

Props: {data: {originalQuery: string, queries: QueryExpansion[]}}
Use TypeScript with proper D3 types.
Use useRef for SVG container and useEffect for rendering.
Clean up simulation on unmount.
Prompt 8 (Results Table)
text
Create frontend/src/components/ResultsTable.tsx:

Display query expansions in a sortable, filterable table:

Columns:
- Query (truncate at 80 chars, show full on hover)
- Type (colored badge matching graph colors)
- User Intent
- Routing Format (badge style)
- Validation Status (if Perplexity data available)

Features:
- Filter by type (multi-select dropdown)
- Sort by any column
- Search filter across all text
- Export to CSV button
- Copy individual query button

Use shadcn/ui table component if available, or build with Tailwind.
Props: {expansions: QueryExpansion[], validations?: ValidationResult[]}
Fase 3: Configuración y Deploy
Prompt 9 (Environment Setup)
text
Create configuration files:

backend/.env:
GEMINI_API_KEY=your_key_here
PERPLEXITY_API_KEY=your_key_here
SUPABASE_URL=your_url_here
SUPABASE_KEY=your_key_here
ENVIRONMENT=development

backend/requirements.txt:
fastapi==0.115.0
uvicorn[standard]==0.32.0
google-genai==1.0.0
openai==1.58.0
supabase==2.10.0
python-dotenv==1.0.0
pydantic==2.10.0
python-multipart==0.0.20

frontend/.env:
VITE_API_URL=http://localhost:8000

Create backend/config/settings.py to load and validate all environment variables using pydantic-settings.
Prompt 10 (Docker Setup)
text
Create production-ready Docker setup:

Files needed:
- backend/Dockerfile (Python 3.12 slim, multi-stage build)
- frontend/Dockerfile (Node 20 alpine, nginx serve)
- docker-compose.yml (backend, frontend, network config)

Backend Dockerfile:
- Use poetry or pip with requirements.txt
- Run uvicorn with 4 workers
- Health check on /health endpoint

Frontend Dockerfile:
- Build optimized production bundle
- Serve with nginx
- Copy custom nginx.conf for SPA routing

docker-compose.yml:
- Backend on port 8000
- Frontend on port 3000
- Shared network
- Volume mounts for development
Orden de Ejecución en Cursor
Backend primero: Usa Composer en modo "Normal" para crear todos los archivos del backend (Prompts 1-5)

Test individual: Corre uvicorn main:app --reload y prueba con Postman

Frontend después: Usa Composer para crear UI (Prompts 6-8)

Integración: Usa Cmd+K en archivos específicos para ajustes finos

Deploy: Prompt 9-10 para configuración final

Comandos Útiles
bash
# Backend
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000

# Frontend
cd frontend
npm install
npm run dev

# Test Gemini API
python -c "from google import genai; client = genai.Client(api_key='YOUR_KEY'); print(client.models.generate_content(model='gemini-2.0-flash-exp', contents='test'))"