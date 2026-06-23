-- Create linking requests table for players to request account linking
CREATE TABLE IF NOT EXISTS public.linking_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamp WITH TIME ZONE DEFAULT now(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    player_id uuid REFERENCES public.players(id) ON DELETE SET NULL,
    request_type TEXT NOT NULL CHECK (request_type IN ('link_existing', 'create_new')),
    player_name TEXT,
    community_id uuid REFERENCES public.communities(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by uuid REFERENCES public.players(id) ON DELETE SET NULL,
    reviewed_at timestamp WITH TIME ZONE,
    rejection_reason TEXT
);

-- Index for queries
CREATE INDEX idx_linking_requests_user_id ON public.linking_requests(user_id);
CREATE INDEX idx_linking_requests_community_id ON public.linking_requests(community_id);
CREATE INDEX idx_linking_requests_status ON public.linking_requests(status);

-- Enable RLS
ALTER TABLE public.linking_requests ENABLE ROW LEVEL SECURITY;

-- RLS: Users can see their own requests
CREATE POLICY "users_can_view_own_requests" ON public.linking_requests
    FOR SELECT USING (auth.uid() = user_id);

-- RLS: Admins can view all requests for their communities
CREATE POLICY "admins_can_view_community_requests" ON public.linking_requests
    FOR SELECT USING (
        public.is_admin() AND community_id IN (
            SELECT id FROM public.communities
            WHERE created_by = auth.uid() OR id IN (
                SELECT community_id FROM public.community_members
                WHERE player_id = public.current_player_id() AND role = 'admin'
            )
        )
    );

-- RLS: Users can create their own requests
CREATE POLICY "users_can_create_requests" ON public.linking_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS: Admins can update requests for their communities
CREATE POLICY "admins_can_update_requests" ON public.linking_requests
    FOR UPDATE USING (
        public.is_admin() AND community_id IN (
            SELECT id FROM public.communities
            WHERE created_by = auth.uid() OR id IN (
                SELECT community_id FROM public.community_members
                WHERE player_id = public.current_player_id() AND role = 'admin'
            )
        )
    );
