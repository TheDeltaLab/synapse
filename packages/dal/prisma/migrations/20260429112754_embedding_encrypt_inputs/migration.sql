-- Convert existing plaintext requestContent to BYTEA in place to preserve data.
-- Decoder treats rows without IV/tag as plaintext UTF-8 JSON for backward compatibility.

ALTER TABLE "embedding_logs"
    ADD COLUMN "requestContentIv" BYTEA,
    ADD COLUMN "requestContentTag" BYTEA,
    ALTER COLUMN "requestContent" TYPE BYTEA USING convert_to("requestContent", 'UTF8');
