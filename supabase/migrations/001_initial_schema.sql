CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL CHECK (file_type IN ('docx', 'pdf')),
  file_size INTEGER NOT NULL,
  original_storage_path TEXT NOT NULL,
  revised_storage_path TEXT,
  extracted_text TEXT DEFAULT '',
  word_count INTEGER DEFAULT 0,
  char_count INTEGER DEFAULT 0,
  paragraph_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'uploaded' CHECK (status IN ('uploaded','parsing','parsed','analyzing','analyzed','correcting','corrected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID UNIQUE REFERENCES documents(id) ON DELETE CASCADE,
  total_issues INTEGER DEFAULT 0,
  grammar_issues INTEGER DEFAULT 0,
  spelling_issues INTEGER DEFAULT 0,
  style_issues INTEGER DEFAULT 0,
  punctuation_issues INTEGER DEFAULT 0,
  plagiarism_status TEXT DEFAULT 'pending',
  plagiarism_score FLOAT,
  ai_detection_status TEXT DEFAULT 'pending',
  ai_detection_score FLOAT,
  issues JSONB DEFAULT '[]',
  corrections_applied JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  analysis_id UUID REFERENCES analyses(id) ON DELETE CASCADE,
  pdf_storage_path TEXT,
  generated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Policies (allow all for MVP - add auth later)
CREATE POLICY "Allow all on documents" ON documents FOR ALL USING (true);
CREATE POLICY "Allow all on analyses" ON analyses FOR ALL USING (true);
CREATE POLICY "Allow all on reports" ON reports FOR ALL USING (true);

-- Storage buckets (idempotent)
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('reports', 'reports', false)
ON CONFLICT (id) DO NOTHING;
