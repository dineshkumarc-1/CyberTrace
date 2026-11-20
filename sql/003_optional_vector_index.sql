-- Optional at larger scale; exact search is preferable for the 50-incident demo.
CREATE INDEX IF NOT EXISTS embedding_cosine_hnsw ON incident_embeddings USING hnsw (embedding vector_cosine_ops);
-- Application applies authorization during candidate ranking. With approximate indexes,
-- selective filtering can reduce recall; evaluate before enabling this optional index.
