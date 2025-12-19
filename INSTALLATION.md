# Installation Guide

## Python Version Issue

The project requires Python 3.12 or 3.13. You currently have Python 3.14 installed, which doesn't have pre-built wheels for all dependencies yet.

### Solution: Use a Virtual Environment with Python 3.12/3.13

#### Option 1: Create a virtual environment (Recommended)

If you have Python 3.12 or 3.13 installed separately:

```bash
# Create virtual environment
python3.12 -m venv venv
# or
python3.13 -m venv venv

# Activate virtual environment
# On Windows
venv\Scripts\activate

# Then install dependencies
pip install -r requirements.txt
```

#### Option 2: Install Python 3.12/3.13

1. Download Python 3.12 or 3.13 from [python.org](https://www.python.org/downloads/)
2. During installation, check **"Add Python to PATH"**
3. Create and activate a virtual environment as shown in Option 1

#### Option 3: Use a Workaround (Install Rust)

If you prefer to use Python 3.14, you need to install Rust:

1. Download and install Rust from https://rustup.rs/
2. Follow the installer instructions
3. Restart your terminal
4. Try installing again: `pip install -r requirements.txt`

### Verify Installation

After installation, verify everything works:

```bash
# Test FastAPI/Uvicorn
python -c "import fastapi; print('FastAPI:', fastapi.__version__)"

# Test Pydantic
python -c "import pydantic; print('Pydantic:', pydantic.__version__)"

# Test Gemini SDK
python -c "import google.genai; print('Google GenAI installed')"
```

## Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

## Backend Setup (after Python dependency issues are resolved)

```bash
cd backend
# Activate virtual environment first if you created one
# venv\Scripts\activate

pip install -r requirements.txt

# Run development server
uvicorn main:app --reload --port 8000
```

## Docker Alternative

If you have Docker installed, you can skip all the above:

```bash
docker-compose build
docker-compose up
```

The Docker image uses Python 3.12, so all dependencies will install correctly.

