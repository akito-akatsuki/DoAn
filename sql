-- ======================================================
-- 🔥 1. EXTENSIONS & FUNCTIONS CƠ BẢN
-- ======================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Hàm tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ======================================================
-- 👤 2. TABLES (BẢNG DỮ LIỆU)
-- ======================================================

-- USERS
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    email TEXT UNIQUE,
    avatar TEXT,
    avatar_url TEXT,
    google_id TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- POSTS
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT,
    image_url TEXT,
    image_path TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- COMMENTS
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    content TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- LIKES
CREATE TABLE IF NOT EXISTS public.likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (user_id, post_id)
);

-- FOLLOWS
CREATE TABLE IF NOT EXISTS public.follows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (follower_id, following_id)
);

-- CONVERSATIONS
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user1_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    last_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- CONVERSATION MEMBERS
CREATE TABLE IF NOT EXISTS public.conversation_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    UNIQUE (conversation_id, user_id)
);

-- MESSAGES
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT,
    reference_id UUID,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- SAVED POSTS
CREATE TABLE IF NOT EXISTS public.saved_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- REPORTS
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    reason TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ======================================================
-- ⚡ 3. INDEXES (TỐI ƯU TRUY VẤN)
-- ======================================================
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_post_id ON likes(post_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_users_name_search ON users USING gin (to_tsvector('simple', COALESCE(name, '')));

-- ======================================================
-- 🔄 4. TRIGGERS & FUNCTIONS (TỰ ĐỘNG HÓA)
-- ======================================================

-- Trigger cập nhật thời gian
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auth: Đồng bộ user từ Supabase Auth sang public.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email, name, avatar_url, google_id)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
        NEW.raw_user_meta_data->>'avatar_url',
        NEW.id
    ) ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Notifications: Like (có chống spam 10s)
CREATE OR REPLACE FUNCTION notify_like()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM notifications
        WHERE user_id = (SELECT user_id FROM posts WHERE id = NEW.post_id)
        AND type = 'like' AND reference_id = NEW.post_id
        AND created_at > (now() - interval '10 seconds')
    ) THEN RETURN NEW; END IF;

    INSERT INTO notifications (user_id, type, reference_id)
    SELECT user_id, 'like', NEW.post_id FROM posts WHERE id = NEW.post_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_like AFTER INSERT ON likes FOR EACH ROW EXECUTE FUNCTION notify_like();

-- Notifications: Comment
CREATE OR REPLACE FUNCTION notify_comment()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notifications (user_id, type, reference_id)
    SELECT user_id, 'comment', NEW.post_id FROM posts WHERE id = NEW.post_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_comment AFTER INSERT ON comments FOR EACH ROW EXECUTE FUNCTION notify_comment();

-- Notifications: Follow
CREATE OR REPLACE FUNCTION notify_follow()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO notifications (user_id, type, reference_id)
    VALUES (NEW.following_id, 'follow', NEW.follower_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_follow AFTER INSERT ON follows FOR EACH ROW EXECUTE FUNCTION notify_follow();

-- ======================================================
-- 🔥 5. VIEWS & RPC (TRUY VẤN NÂNG CAO)
-- ======================================================

-- Feed tổng quát
CREATE OR REPLACE VIEW feed_view AS
SELECT
    p.id, p.content, p.image_url, p.created_at, u.id AS user_id, u.name, u.avatar,
    (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count,
    (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comment_count
FROM posts p JOIN users u ON u.id = p.user_id;

-- Feed theo Follow
CREATE OR REPLACE FUNCTION get_feed(p_user_id UUID)
RETURNS TABLE (post_id UUID, content TEXT, image_url TEXT, created_at TIMESTAMP, user_id UUID, name TEXT, avatar TEXT, like_count BIGINT, comment_count BIGINT)
LANGUAGE sql AS $$
    SELECT p.id, p.content, p.image_url, p.created_at, u.id, u.name, u.avatar,
        (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id),
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id)
    FROM posts p JOIN users u ON u.id = p.user_id
    WHERE p.user_id = p_user_id OR p.user_id IN (SELECT following_id FROM follows WHERE follower_id = p_user_id)
    ORDER BY p.created_at DESC;
$$;

-- Search User
CREATE OR REPLACE FUNCTION search_users(keyword TEXT)
RETURNS SETOF users LANGUAGE sql AS $$
    SELECT * FROM users
    WHERE name ILIKE '%' || keyword || '%'
    OR to_tsvector('simple', COALESCE(name, '')) @@ plainto_tsquery(keyword);
$$;

-- ======================================================
-- 🔒 6. RLS POLICIES (BẢO MẬT)
-- ======================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Policy: Users
CREATE POLICY "Public profiles" ON users FOR SELECT USING (true);
CREATE POLICY "Update own profile" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "allow insert from trigger" ON users FOR INSERT WITH CHECK (true);

-- Policy: Posts
CREATE POLICY "View posts" ON posts FOR SELECT USING (true);
CREATE POLICY "Create post" ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own post" ON posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Delete own post" ON posts FOR DELETE USING (auth.uid() = user_id);

-- Policy: Comments
CREATE POLICY "View comments" ON comments FOR SELECT USING (true);
CREATE POLICY "Create comment" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Delete own comment" ON comments FOR DELETE USING (auth.uid() = user_id);

-- Policy: Likes
CREATE POLICY "View likes" ON likes FOR SELECT USING (true);
CREATE POLICY "Like post" ON likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Unlike" ON likes FOR DELETE USING (auth.uid() = user_id);

-- Policy: Follows
CREATE POLICY "View follows" ON follows FOR SELECT USING (true);
CREATE POLICY "Follow" ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Unfollow" ON follows FOR DELETE USING (auth.uid() = follower_id);

-- Policy: Messaging
CREATE POLICY "View conversations" ON conversations FOR SELECT USING (id IN (SELECT conversation_id FROM conversation_members WHERE user_id = auth.uid()));
CREATE POLICY "Create conversation" ON conversations FOR INSERT WITH CHECK (true);
CREATE POLICY "View messages" ON messages FOR SELECT USING (auth.uid() IN (SELECT user_id FROM conversation_members WHERE conversation_id = messages.conversation_id));
CREATE POLICY "Send message" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "View members" ON conversation_members FOR SELECT USING (true);
CREATE POLICY "Join member" ON conversation_members FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Notifications
CREATE POLICY "View own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Update own notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "System insert notifications" ON notifications FOR INSERT WITH CHECK (true);

-- Policy: Saved Posts
CREATE POLICY "View own saved" ON saved_posts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Save post" ON saved_posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Unsave post" ON saved_posts FOR DELETE USING (auth.uid() = user_id);

-- Policy: Reports
CREATE POLICY "View own reports" ON reports FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Create report" ON reports FOR INSERT WITH CHECK (auth.uid() = user_id);

