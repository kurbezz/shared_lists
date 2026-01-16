-- Add public_slug column to pages table for public sharing
ALTER TABLE pages ADD COLUMN public_slug TEXT;

CREATE UNIQUE INDEX idx_pages_public_slug ON pages(public_slug);
