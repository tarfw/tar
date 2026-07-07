-- Add Turso connection columns and vertical field to workspaces
ALTER TABLE workspaces ADD COLUMN turso_url TEXT;
ALTER TABLE workspaces ADD COLUMN turso_auth_token TEXT;
ALTER TABLE workspaces ADD COLUMN vertical TEXT;
