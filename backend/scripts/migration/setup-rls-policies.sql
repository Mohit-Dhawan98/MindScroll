-- Row Level Security (RLS) Policies for MindScroll Supabase Database
-- Run this script in Supabase SQL Editor after migration

-- Enable RLS on all tables
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "content" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "cards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "user_progress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "learning_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "content_uploads" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "processing_jobs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_conversations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chat_messages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chapters" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "chapter_progress" ENABLE ROW LEVEL SECURITY;

-- ========================================
-- USERS TABLE POLICIES
-- ========================================

-- Users can view and update their own profile
CREATE POLICY "Users can view own profile" ON "users"
FOR SELECT USING (auth.uid()::text = id);

CREATE POLICY "Users can update own profile" ON "users"
FOR UPDATE USING (auth.uid()::text = id);

-- Allow user creation during signup (handled by triggers)
CREATE POLICY "Allow user creation" ON "users"
FOR INSERT WITH CHECK (auth.uid()::text = id);

-- ========================================
-- CONTENT TABLE POLICIES
-- ========================================

-- Anyone can view active content (public library)
CREATE POLICY "Anyone can view active content" ON "content"
FOR SELECT USING ("isActive" = true);

-- Authenticated users can create content
CREATE POLICY "Authenticated users can create content" ON "content"
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Content creators and admins can update their content
CREATE POLICY "Users can update own content" ON "content"
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM "content_uploads" cu 
    WHERE cu."contentId" = id AND cu."userId" = auth.uid()::text
  ) OR
  EXISTS (
    SELECT 1 FROM "users" u 
    WHERE u.id = auth.uid()::text AND u.role IN ('ADMIN', 'SUPER_ADMIN')
  )
);

-- ========================================
-- CARDS TABLE POLICIES
-- ========================================

-- Anyone can view cards for active content
CREATE POLICY "Anyone can view cards for active content" ON "cards"
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM "content" c 
    WHERE c.id = "contentId" AND c."isActive" = true
  )
);

-- Content creators and admins can manage cards
CREATE POLICY "Content creators can manage cards" ON "cards"
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM "content" c
    JOIN "content_uploads" cu ON cu."contentId" = c.id
    WHERE c.id = "contentId" AND cu."userId" = auth.uid()::text
  ) OR
  EXISTS (
    SELECT 1 FROM "users" u 
    WHERE u.id = auth.uid()::text AND u.role IN ('ADMIN', 'SUPER_ADMIN')
  )
);

-- ========================================
-- USER PROGRESS TABLE POLICIES
-- ========================================

-- Users can only access their own progress
CREATE POLICY "Users can view own progress" ON "user_progress"
FOR SELECT USING (auth.uid()::text = "userId");

CREATE POLICY "Users can manage own progress" ON "user_progress"
FOR ALL USING (auth.uid()::text = "userId");

-- ========================================
-- LEARNING SESSIONS TABLE POLICIES
-- ========================================

-- Users can only access their own learning sessions
CREATE POLICY "Users can view own sessions" ON "learning_sessions"
FOR SELECT USING (auth.uid()::text = "userId");

CREATE POLICY "Users can manage own sessions" ON "learning_sessions"
FOR ALL USING (auth.uid()::text = "userId");

-- ========================================
-- CONTENT UPLOADS TABLE POLICIES
-- ========================================

-- Users can only access their own uploads
CREATE POLICY "Users can view own uploads" ON "content_uploads"
FOR SELECT USING (auth.uid()::text = "userId");

CREATE POLICY "Users can manage own uploads" ON "content_uploads"
FOR ALL USING (auth.uid()::text = "userId");

-- ========================================
-- PROCESSING JOBS TABLE POLICIES
-- ========================================

-- Users can view jobs for their uploads
CREATE POLICY "Users can view own processing jobs" ON "processing_jobs"
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM "content_uploads" cu
    WHERE cu.id = "uploadId" AND cu."userId" = auth.uid()::text
  )
);

-- System can manage all processing jobs (service role)
CREATE POLICY "Service role can manage processing jobs" ON "processing_jobs"
FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ========================================
-- CHAT CONVERSATIONS TABLE POLICIES
-- ========================================

-- Users can only access their own conversations
CREATE POLICY "Users can view own conversations" ON "chat_conversations"
FOR SELECT USING (auth.uid()::text = "userId");

CREATE POLICY "Users can manage own conversations" ON "chat_conversations"
FOR ALL USING (auth.uid()::text = "userId");

-- ========================================
-- CHAT MESSAGES TABLE POLICIES
-- ========================================

-- Users can view messages in their conversations
CREATE POLICY "Users can view messages in own conversations" ON "chat_messages"
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM "chat_conversations" cc
    WHERE cc.id = "conversationId" AND cc."userId" = auth.uid()::text
  )
);

-- Users can create messages in their conversations
CREATE POLICY "Users can create messages in own conversations" ON "chat_messages"
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM "chat_conversations" cc
    WHERE cc.id = "conversationId" AND cc."userId" = auth.uid()::text
  )
);

-- ========================================
-- CHAPTERS TABLE POLICIES
-- ========================================

-- Anyone can view chapters for active content
CREATE POLICY "Anyone can view chapters for active content" ON "chapters"
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM "content" c 
    WHERE c.id = "contentId" AND c."isActive" = true
  )
);

-- Content creators and admins can manage chapters
CREATE POLICY "Content creators can manage chapters" ON "chapters"
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM "content" c
    JOIN "content_uploads" cu ON cu."contentId" = c.id
    WHERE c.id = "contentId" AND cu."userId" = auth.uid()::text
  ) OR
  EXISTS (
    SELECT 1 FROM "users" u 
    WHERE u.id = auth.uid()::text AND u.role IN ('ADMIN', 'SUPER_ADMIN')
  )
);

-- ========================================
-- CHAPTER PROGRESS TABLE POLICIES
-- ========================================

-- Users can only access their own chapter progress
CREATE POLICY "Users can view own chapter progress" ON "chapter_progress"
FOR SELECT USING (auth.uid()::text = "userId");

CREATE POLICY "Users can manage own chapter progress" ON "chapter_progress"
FOR ALL USING (auth.uid()::text = "userId");

-- ========================================
-- ADDITIONAL SECURITY FUNCTIONS
-- ========================================

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM "users" 
    WHERE id = auth.uid()::text 
    AND role IN ('ADMIN', 'SUPER_ADMIN')
  );
$$;

-- Function to check if user owns content
CREATE OR REPLACE FUNCTION auth.user_owns_content(content_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM "content_uploads" cu
    WHERE cu."contentId" = content_id::text 
    AND cu."userId" = auth.uid()::text
  );
$$;

-- ========================================
-- ADMIN OVERRIDE POLICIES
-- ========================================

-- Allow admins to access all data for management purposes
CREATE POLICY "Admins can access all users" ON "users"
FOR ALL TO authenticated
USING (
  auth.uid()::text = id OR 
  EXISTS (
    SELECT 1 FROM "users" u 
    WHERE u.id = auth.uid()::text AND u.role IN ('ADMIN', 'SUPER_ADMIN')
  )
);

CREATE POLICY "Admins can access all content" ON "content"
FOR ALL TO authenticated
USING (
  "isActive" = true OR
  EXISTS (
    SELECT 1 FROM "users" u 
    WHERE u.id = auth.uid()::text AND u.role IN ('ADMIN', 'SUPER_ADMIN')
  )
);

-- ========================================
-- REALTIME SUBSCRIPTIONS
-- ========================================

-- Enable realtime for user progress updates
ALTER PUBLICATION supabase_realtime ADD TABLE "user_progress";
ALTER PUBLICATION supabase_realtime ADD TABLE "learning_sessions";
ALTER PUBLICATION supabase_realtime ADD TABLE "chat_messages";
ALTER PUBLICATION supabase_realtime ADD TABLE "processing_jobs";

-- Grant usage on schema to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO anon;

-- Grant select on all tables to authenticated users (RLS will filter)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- Grant insert/update/delete on specific tables to authenticated users
GRANT INSERT, UPDATE, DELETE ON "users" TO authenticated;
GRANT INSERT, UPDATE, DELETE ON "user_progress" TO authenticated;
GRANT INSERT, UPDATE, DELETE ON "learning_sessions" TO authenticated;
GRANT INSERT, UPDATE, DELETE ON "content_uploads" TO authenticated;
GRANT INSERT, UPDATE, DELETE ON "chat_conversations" TO authenticated;
GRANT INSERT, UPDATE, DELETE ON "chat_messages" TO authenticated;
GRANT INSERT, UPDATE, DELETE ON "chapter_progress" TO authenticated;

-- Grant content creation to authenticated users
GRANT INSERT ON "content" TO authenticated;
GRANT UPDATE ON "content" TO authenticated;

-- System operations for service role
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================

-- Create indexes on frequently queried columns
CREATE INDEX IF NOT EXISTS idx_user_progress_user_id ON "user_progress"("userId");
CREATE INDEX IF NOT EXISTS idx_user_progress_card_id ON "user_progress"("cardId");
CREATE INDEX IF NOT EXISTS idx_user_progress_next_review ON "user_progress"("nextReview");
CREATE INDEX IF NOT EXISTS idx_cards_content_id ON "cards"("contentId");
CREATE INDEX IF NOT EXISTS idx_chapters_content_id ON "chapters"("contentId");
CREATE INDEX IF NOT EXISTS idx_content_active ON "content"("isActive");
CREATE INDEX IF NOT EXISTS idx_content_type ON "content"("type");
CREATE INDEX IF NOT EXISTS idx_content_category ON "content"("category");

-- ========================================
-- TRIGGERS FOR USER MANAGEMENT
-- ========================================

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public."users" (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    'USER'
  );
  RETURN NEW;
END;
$$;

-- Trigger to create user profile when user signs up
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========================================
-- COMMENTS
-- ========================================

COMMENT ON POLICY "Users can view own profile" ON "users" IS 'Users can only view their own profile data';
COMMENT ON POLICY "Anyone can view active content" ON "content" IS 'Public content library - anyone can view active content';
COMMENT ON POLICY "Users can view own progress" ON "user_progress" IS 'Learning progress is private to each user';
COMMENT ON FUNCTION auth.is_admin() IS 'Check if current user has admin privileges';
COMMENT ON FUNCTION auth.user_owns_content(UUID) IS 'Check if current user owns specific content';

-- Success message
SELECT 'Row Level Security policies have been successfully applied to MindScroll database!' as status;