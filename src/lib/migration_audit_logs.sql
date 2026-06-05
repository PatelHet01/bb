-- Migration: Audit Logs Table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id    TEXT,
  actor_id     UUID,
  actor_name   TEXT NOT NULL DEFAULT 'System',
  actor_role   TEXT,
  action       TEXT NOT NULL,
  entity_type  TEXT,
  entity_id    TEXT,
  entity_label TEXT,
  diff         JSONB,
  metadata     JSONB,
  created_at   TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Admins can read all audit logs
CREATE POLICY "Admins read audit logs" ON public.audit_logs
  FOR SELECT USING (true);

-- Anyone authenticated can insert (audit logger fires silently in background)
CREATE POLICY "Anyone can insert audit logs" ON public.audit_logs
  FOR INSERT WITH CHECK (true);

-- Index for fast queries
CREATE INDEX IF NOT EXISTS audit_logs_branch_idx    ON public.audit_logs (branch_id);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx   ON public.audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx     ON public.audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS audit_logs_action_idx    ON public.audit_logs (action);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx    ON public.audit_logs (entity_type);
