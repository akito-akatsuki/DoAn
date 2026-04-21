-- ==========================================
-- 🛠️ 1. KHỞI TẠO EXTENSIONS & FUNCTIONS GỐC
-- ==========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Hàm tự động cập nhật updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 👤 2. TABLES (BẢNG DỮ LIỆU)
-- ==========================================

-- USERS
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    email TEXT UNIQUE,
    avatar_url TEXT,
    bio TEXT,
    google_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- POSTS (Thêm is_flagged cho kiểm duyệt AI)
CREATE TABLE public.posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT,
    image_url TEXT,
    image_path TEXT,
    is_flagged BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- COMMENTS
CREATE TABLE public.comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- LIKES
CREATE TABLE public.likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, post_id)
);

-- FOLLOWS
CREATE TABLE public.follows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (follower_id, following_id)
);

-- CONVERSATIONS & MESSAGES
CREATE TABLE public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user1_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    user2_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    last_message TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE public.conversation_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    UNIQUE (conversation_id, user_id)
);

CREATE TABLE public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NOTIFICATIONS (Cấu trúc chuẩn hóa cho Social)
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,      -- Người nhận
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE DEFAULT auth.uid(), -- Người gửi
    type TEXT NOT NULL, -- 'like', 'comment', 'follow'
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,               -- Bài viết liên quan (nếu có)
    reference_id UUID NOT NULL,                                               -- ID của like/comment để trace
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SAVED & REPORTS
CREATE TABLE public.saved_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, post_id)
);

CREATE TABLE public.reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- ⚡ 3. INDEXES (TỐI ƯU HIỆU NĂNG)
-- ==========================================
CREATE INDEX idx_posts_is_flagged ON public.posts(is_flagged);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id) WHERE is_read = false;
CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX idx_users_name_search ON public.users USING gin (to_tsvector('simple', COALESCE(name, '')));

-- ==========================================
-- 🔄 4. TRIGGERS & FUNCTIONS (LOGIC TỰ ĐỘNG)
-- ==========================================

-- Tự động cập nhật thời gian
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ĐỒNG BỘ USER TỪ AUTH SANG PUBLIC
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

-- TỰ ĐỘNG TẠO THÔNG BÁO (LIKE & COMMENT)
-- Sử dụng logic NEW.id làm reference_id để trace chính xác hành động
CREATE OR REPLACE FUNCTION handle_notification_trigger()
RETURNS TRIGGER AS $$
DECLARE
    target_user_id UUID;
BEGIN
    IF TG_TABLE_NAME = 'likes' THEN
        SELECT user_id INTO target_user_id FROM public.posts WHERE id = NEW.post_id;
        IF NEW.user_id != target_user_id THEN
            INSERT INTO public.notifications (user_id, sender_id, type, post_id, reference_id)
            VALUES (target_user_id, NEW.user_id, 'like', NEW.post_id, NEW.id);
        END IF;
    ELSIF TG_TABLE_NAME = 'comments' THEN
        SELECT user_id INTO target_user_id FROM public.posts WHERE id = NEW.post_id;
        IF NEW.user_id != target_user_id THEN
            INSERT INTO public.notifications (user_id, sender_id, type, post_id, reference_id)
            VALUES (target_user_id, NEW.user_id, 'comment', NEW.post_id, NEW.id);
        END IF;
    ELSIF TG_TABLE_NAME = 'follows' THEN
        INSERT INTO public.notifications (user_id, sender_id, type, reference_id)
        VALUES (NEW.following_id, NEW.follower_id, 'follow', NEW.follower_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_like_created AFTER INSERT ON public.likes FOR EACH ROW EXECUTE FUNCTION handle_notification_trigger();
CREATE TRIGGER on_comment_created AFTER INSERT ON public.comments FOR EACH ROW EXECUTE FUNCTION handle_notification_trigger();
CREATE TRIGGER on_follow_created AFTER INSERT ON public.follows FOR EACH ROW EXECUTE FUNCTION handle_notification_trigger();

-- ==========================================
-- 🔥 5. THUẬT TOÁN & TRUY VẤN (KLTN LEVEL)
-- ==========================================

-- Thuật toán tính điểm HOT bài viết (Gravity Algorithm)
-- Điểm số giảm dần theo thời gian, tăng theo tương tác
CREATE OR REPLACE FUNCTION get_hot_feed(current_user_id UUID)
RETURNS TABLE (
  id UUID, content TEXT, image_url TEXT, created_at TIMESTAMPTZ, user_id UUID,
  likes_count BIGINT, comments_count BIGINT, is_liked BOOLEAN, is_saved BOOLEAN,
  score FLOAT, is_flagged BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id, p.content, p.image_url, p.created_at, p.user_id,
    COALESCE(l.like_count, 0)::BIGINT,
    COALESCE(c.comment_count, 0)::BIGINT,
    EXISTS(SELECT 1 FROM likes ul WHERE ul.post_id = p.id AND ul.user_id = current_user_id),
    EXISTS(SELECT 1 FROM saved_posts sp WHERE sp.post_id = p.id AND sp.user_id = current_user_id),
    ((COALESCE(l.like_count, 0) + COALESCE(c.comment_count, 0) * 2) /
    POWER((EXTRACT(EPOCH FROM (NOW() - p.created_at))/3600) + 2, 1.5))::FLOAT AS score,
    p.is_flagged
  FROM posts p
  LEFT JOIN (SELECT post_id, COUNT(*) AS like_count FROM likes GROUP BY post_id) l ON l.post_id = p.id
  LEFT JOIN (SELECT post_id, COUNT(*) AS comment_count FROM comments GROUP BY post_id) c ON c.post_id = p.id
  ORDER BY score DESC, p.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- Hàm tìm kiếm User
CREATE OR REPLACE FUNCTION search_users(keyword TEXT)
RETURNS SETOF public.users LANGUAGE sql AS $$
    SELECT * FROM public.users
    WHERE to_tsvector('simple', COALESCE(name, '')) @@ plainto_tsquery(keyword)
    OR name ILIKE '%' || keyword || '%';
$$;

-- ==========================================
-- 🔒 6. ROW LEVEL SECURITY (RLS)
-- ==========================================
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

-- CẤP QUYỀN CƠ BẢN
CREATE POLICY "Public: view profiles" ON users FOR SELECT USING (true);
CREATE POLICY "Owner: update profile" ON users FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Public: view posts" ON posts FOR SELECT USING (true);
CREATE POLICY "Owner: post actions" ON posts FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Public: view comments" ON comments FOR SELECT USING (true);
CREATE POLICY "User: insert comments" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner: delete comments" ON comments FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Public: view likes" ON likes FOR SELECT USING (true);
CREATE POLICY "User: like actions" ON likes FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "User: follow actions" ON follows FOR ALL USING (auth.uid() = follower_id);
CREATE POLICY "Public: view follows" ON follows FOR SELECT USING (true);

-- MESSAGING SECURITY (Quan trọng)
CREATE POLICY "Chat: view conversations" ON conversations FOR SELECT USING (auth.uid() = user1_id OR auth.uid() = user2_id);
CREATE POLICY "Chat: insert conversation" ON conversations FOR INSERT WITH CHECK (auth.uid() = user1_id OR auth.uid() = user2_id);

CREATE POLICY "Chat: messages" ON messages FOR ALL USING (
    EXISTS (
        SELECT 1 FROM conversation_members
        WHERE conversation_id = messages.conversation_id AND user_id = auth.uid()
    )
);

-- NOTIFICATIONS SECURITY
CREATE POLICY "User: view notifications" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "User: update notifications" ON notifications FOR UPDATE USING (auth.uid() = user_id);

-- SAVED & REPORTS
CREATE POLICY "User: saved posts" ON saved_posts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "User: insert report" ON reports FOR INSERT WITH CHECK (auth.uid() = user_id);