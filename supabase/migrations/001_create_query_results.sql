-- Create the query_results table for storing job data
-- Run this in Supabase SQL Editor or via migrations

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

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS idx_query_results_status ON query_results(status);
CREATE INDEX IF NOT EXISTS idx_query_results_created_at ON query_results(created_at DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_query_results_updated_at ON query_results;
CREATE TRIGGER update_query_results_updated_at
    BEFORE UPDATE ON query_results
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (optional, for production with auth)
-- ALTER TABLE query_results ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations (for anonymous access)
-- CREATE POLICY "Allow all operations" ON query_results FOR ALL USING (true);

-- Grant permissions for anonymous access
GRANT ALL ON query_results TO anon;
GRANT ALL ON query_results TO authenticated;

