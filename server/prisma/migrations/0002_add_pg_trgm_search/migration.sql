-- Add PostgreSQL trigram extension + GIN indexes to power fuzzy search
-- (search module uses ILIKE '%term%' + similarity() ranking via pg_trgm).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Trigram indexes for product search (title / description) and query log.
CREATE INDEX "product_title_trgm_idx" ON "Product" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "product_description_trgm_idx" ON "Product" USING GIN ("description" gin_trgm_ops);
CREATE INDEX "product_subtitle_trgm_idx" ON "Product" USING GIN ("subtitle" gin_trgm_ops);
CREATE INDEX "search_query_normalized_trgm_idx" ON "SearchQuery" USING GIN ("normalized" gin_trgm_ops);
