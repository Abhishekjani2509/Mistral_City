CREATE TABLE orders (id uuid PRIMARY KEY, user_id uuid NOT NULL, created_at timestamptz NOT NULL);
CREATE TABLE audit_events (id uuid PRIMARY KEY, user_id uuid NOT NULL, payload jsonb NOT NULL);
