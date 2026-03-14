
-- ==============================================
-- Phase 1: Multi-Tenant Data Model
-- ==============================================

-- 1. Enum for org member roles
CREATE TYPE public.org_role AS ENUM ('owner', 'admin', 'member');

-- 2. Enum for provider types
CREATE TYPE public.provider_type AS ENUM (
  'meta_ads',
  'apple_search_ads',
  'moloco',
  'appsflyer',
  'mixpanel',
  'google_play',
  'app_store',
  'trustpilot',
  'google_search_console',
  'typeform'
);

-- 3. Enum for auth methods
CREATE TYPE public.auth_method AS ENUM ('oauth', 'api_key');

-- 4. Enum for connection status
CREATE TYPE public.connection_status AS ENUM ('connected', 'disconnected', 'error');

-- ==============================================
-- Organizations table
-- ==============================================
CREATE TABLE public.organizations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- Organization members table
-- ==============================================
CREATE TABLE public.organization_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role org_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(org_id, user_id)
);

ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- Security definer function: check org membership
-- ==============================================
CREATE OR REPLACE FUNCTION public.is_org_member(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id
      AND org_id = _org_id
  )
$$;

-- Security definer: check org admin/owner
CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id UUID, _org_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.organization_members
    WHERE user_id = _user_id
      AND org_id = _org_id
      AND role IN ('owner', 'admin')
  )
$$;

-- Security definer: get user's org ids
CREATE OR REPLACE FUNCTION public.get_user_org_ids(_user_id UUID)
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(org_id), '{}')
  FROM public.organization_members
  WHERE user_id = _user_id
$$;

-- ==============================================
-- Provider connections table
-- ==============================================
CREATE TABLE public.provider_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider provider_type NOT NULL,
  auth_method auth_method NOT NULL,
  credentials JSONB NOT NULL DEFAULT '{}'::jsonb,
  status connection_status NOT NULL DEFAULT 'disconnected',
  display_name TEXT,
  connected_at TIMESTAMP WITH TIME ZONE,
  last_synced_at TIMESTAMP WITH TIME ZONE,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(org_id, provider)
);

ALTER TABLE public.provider_connections ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- Conversion events table
-- ==============================================
CREATE TABLE public.conversion_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  event_name TEXT NOT NULL,
  event_label TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  source_provider provider_type,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.conversion_events ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- Tracker metric config table
-- ==============================================
CREATE TABLE public.tracker_metric_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  metric_key TEXT NOT NULL,
  metric_label TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_visible BOOLEAN NOT NULL DEFAULT true,
  data_source TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(org_id, metric_key)
);

ALTER TABLE public.tracker_metric_config ENABLE ROW LEVEL SECURITY;

-- ==============================================
-- RLS Policies
-- ==============================================

-- Organizations: members can view their orgs
CREATE POLICY "Members can view their organizations"
  ON public.organizations FOR SELECT
  TO authenticated
  USING (id = ANY(public.get_user_org_ids(auth.uid())));

-- Organizations: any authenticated user can create
CREATE POLICY "Authenticated users can create organizations"
  ON public.organizations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Organizations: org admins/owners can update
CREATE POLICY "Org admins can update organizations"
  ON public.organizations FOR UPDATE
  TO authenticated
  USING (public.is_org_admin(auth.uid(), id));

-- Organizations: only owners can delete
CREATE POLICY "Org owners can delete organizations"
  ON public.organizations FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE org_id = id AND user_id = auth.uid() AND role = 'owner'
    )
  );

-- Organization members: members can view other members in their org
CREATE POLICY "Members can view org members"
  ON public.organization_members FOR SELECT
  TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));

-- Organization members: org admins can insert
CREATE POLICY "Org admins can add members"
  ON public.organization_members FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_org_admin(auth.uid(), org_id)
    OR (auth.uid() = user_id AND NOT EXISTS (
      SELECT 1 FROM public.organization_members WHERE org_id = organization_members.org_id
    ))
  );

-- Organization members: org admins can update
CREATE POLICY "Org admins can update members"
  ON public.organization_members FOR UPDATE
  TO authenticated
  USING (public.is_org_admin(auth.uid(), org_id));

-- Organization members: org admins can remove members
CREATE POLICY "Org admins can remove members"
  ON public.organization_members FOR DELETE
  TO authenticated
  USING (public.is_org_admin(auth.uid(), org_id) OR auth.uid() = user_id);

-- Provider connections: org members can view
CREATE POLICY "Org members can view connections"
  ON public.provider_connections FOR SELECT
  TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));

-- Provider connections: org admins can manage
CREATE POLICY "Org admins can insert connections"
  ON public.provider_connections FOR INSERT
  TO authenticated
  WITH CHECK (public.is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can update connections"
  ON public.provider_connections FOR UPDATE
  TO authenticated
  USING (public.is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can delete connections"
  ON public.provider_connections FOR DELETE
  TO authenticated
  USING (public.is_org_admin(auth.uid(), org_id));

-- Conversion events: org members can view
CREATE POLICY "Org members can view conversion events"
  ON public.conversion_events FOR SELECT
  TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));

-- Conversion events: org admins can manage
CREATE POLICY "Org admins can insert conversion events"
  ON public.conversion_events FOR INSERT
  TO authenticated
  WITH CHECK (public.is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can update conversion events"
  ON public.conversion_events FOR UPDATE
  TO authenticated
  USING (public.is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can delete conversion events"
  ON public.conversion_events FOR DELETE
  TO authenticated
  USING (public.is_org_admin(auth.uid(), org_id));

-- Tracker metric config: org members can view
CREATE POLICY "Org members can view tracker config"
  ON public.tracker_metric_config FOR SELECT
  TO authenticated
  USING (public.is_org_member(auth.uid(), org_id));

-- Tracker metric config: org admins can manage
CREATE POLICY "Org admins can insert tracker config"
  ON public.tracker_metric_config FOR INSERT
  TO authenticated
  WITH CHECK (public.is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can update tracker config"
  ON public.tracker_metric_config FOR UPDATE
  TO authenticated
  USING (public.is_org_admin(auth.uid(), org_id));

CREATE POLICY "Org admins can delete tracker config"
  ON public.tracker_metric_config FOR DELETE
  TO authenticated
  USING (public.is_org_admin(auth.uid(), org_id));

-- ==============================================
-- Add onboarding_completed to profiles
-- ==============================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;
