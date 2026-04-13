-- ======================================================
-- 🛠️ KHỞI TẠO EXTENSIONS
-- ======================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ======================================================
-- 👤 BẢNG USERS (Người dùng)
-- ======================================================
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    email TEXT UNIQUE,
    avatar TEXT,
    avatar_url TEXT,
    google_id TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ======================================================
-- 📝 BẢNG POSTS (Bài viết)
-- ======================================================
CREATE TABLE public.posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT,
    image_url TEXT,
    image_path TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- ======================================================
-- 💬 BẢNG COMMENTS (Bình luận)
-- ======================================================
CREATE TABLE public.comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    content TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ======================================================
-- ❤️ BẢNG LIKES (Lượt thích)
-- ======================================================
CREATE TABLE public.likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (user_id, post_id)
);

-- ======================================================
-- 👥 BẢNG FOLLOWS (Theo dõi)
-- ======================================================
CREATE TABLE public.follows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (follower_id, following_id)
);

-- ======================================================
-- 💬 HỆ THỐNG TIN NHẮN (Conversations & Messages)
-- ======================================================
CREATE TABLE public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user1_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    last_message TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE public.conversation_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    UNIQUE (conversation_id, user_id)
);

CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ======================================================
-- 🔔 BẢNG NOTIFICATIONS (Thông báo)
-- ======================================================
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    type TEXT,
    reference_id UUID,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ======================================================
-- ⚡ INDEXES (Tối ưu hóa truy vấn)
-- ======================================================
CREATE INDEX idx_posts_user_id ON public.posts(user_id);
CREATE INDEX idx_comments_post_id ON public.comments(post_id);
CREATE INDEX idx_likes_post_id ON public.likes(post_id);
CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX idx_users_name_search ON public.users USING gin (to_tsvector('simple', name));

-- ======================================================
-- 🔄 FUNCTIONS & TRIGGERS (Tự động hóa)
-- ======================================================

-- 1. Cập nhật updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON public.posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 2. Tự động tạo profile khi có user mới trong Auth
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

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Thông báo Like (có chống spam 10s)
CREATE OR REPLACE FUNCTION notify_like()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM public.notifications
        WHERE user_id = (SELECT user_id FROM public.posts WHERE id = NEW.post_id)
        AND type = 'like' AND reference_id = NEW.post_id
        AND created_at > NOW() - INTERVAL '10 seconds'
    ) THEN RETURN NEW; END IF;

    INSERT INTO public.notifications (user_id, type, reference_id)
    SELECT user_id, 'like', NEW.post_id FROM public.posts WHERE id = NEW.post_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_like AFTER INSERT ON public.likes FOR EACH ROW EXECUTE FUNCTION notify_like();

-- 4. Thông báo Comment & Follow
CREATE OR REPLACE FUNCTION notify_comment()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.notifications (user_id, type, reference_id)
    SELECT user_id, 'comment', NEW.post_id FROM public.posts WHERE id = NEW.post_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_comment AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION notify_comment();

CREATE OR REPLACE FUNCTION notify_follow()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.notifications (user_id, type, reference_id)
    VALUES (NEW.following_id, 'follow', NEW.follower_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_follow AFTER INSERT ON public.follows FOR EACH ROW EXECUTE FUNCTION notify_follow();

-- ======================================================
-- 🔥 VIEWS & RPC FUNCTIONS
-- ======================================================

-- View Feed tổng quát
CREATE OR REPLACE VIEW feed_view AS
SELECT
    p.id, p.content, p.image_url, p.created_at, u.id AS user_id, u.name, u.avatar,
    (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count,
    (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comment_count
FROM posts p JOIN users u ON u.id = p.user_id;

-- Hàm lấy feed cá nhân hóa (theo follow)
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

-- Tìm kiếm User
CREATE OR REPLACE FUNCTION search_users(keyword TEXT)
RETURNS SETOF public.users LANGUAGE sql AS $$
    SELECT * FROM public.users
    WHERE to_tsvector('simple', name) @@ plainto_tsquery(keyword)
    OR name ILIKE '%' || keyword || '%';
$$;

-- ======================================================
-- 🔒 ROW LEVEL SECURITY (RLS)
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

-- Users
CREATE POLICY "Public profiles" ON users FOR SELECT USING (true);
CREATE POLICY "Update own profile" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "allow insert from trigger" ON users FOR INSERT WITH CHECK (true);

-- Posts
CREATE POLICY "View posts" ON posts FOR SELECT USING (true);
CREATE POLICY "Create post" ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Update own post" ON posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Delete own post" ON posts FOR DELETE USING (auth.uid() = user_id);

-- Comments & Likes & Follows
CREATE POLICY "View comments" ON comments FOR SELECT USING (true);
CREATE POLICY "Create comment" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Delete own comment" ON comments FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "View likes" ON likes FOR SELECT USING (true);
CREATE POLICY "Like post" ON likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Unlike" ON likes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "View follows" ON follows FOR SELECT USING (true);
CREATE POLICY "Follow" ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Unfollow" ON follows FOR DELETE USING (auth.uid() = follower_id);

-- Messaging
CREATE POLICY "View conversations" ON conversations FOR SELECT USING (auth.uid() IN (SELECT user_id FROM conversation_members WHERE conversation_id = id));
CREATE POLICY "Create conversation" ON conversations FOR INSERT WITH CHECK (true);

CREATE POLICY "View messages" ON messages FOR SELECT USING (auth.uid() IN (SELECT user_id FROM conversation_members WHERE conversation_id = messages.conversation_id));
CREATE POLICY "Send message" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "View conversation members" ON conversation_members FOR SELECT USING (true);
CREATE POLICY "Join conversation" ON conversation_members FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Notifications
CREATE POLICY "View own notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Update notification" ON notifications FOR UPDATE USING (auth.uid() = user_id);