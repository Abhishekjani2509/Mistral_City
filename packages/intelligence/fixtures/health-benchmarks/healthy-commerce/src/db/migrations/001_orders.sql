CREATE TABLE orders (id uuid PRIMARY KEY, user_id uuid NOT NULL, created_at timestamptz NOT NULL);
CREATE INDEX orders_user_created_idx ON orders (user_id, created_at DESC);
-- rollback: DROP TABLE orders;
