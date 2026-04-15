-- ==========================================
-- 🛠️ 1. KHỞI TẠO EXTENSIONS & CẤU TRÚC CƠ BẢN
-- ==========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Hàm dùng chung để cập nhật thời gian sửa đổi
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 👤 2. TABLES (BẢNG DỮ LIỆU CHÍNH)
-- ==========================================

-- Bảng người dùng
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    email TEXT UNIQUE,
    avatar TEXT,
    avatar_url TEXT,
    bio TEXT,
    google_id TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Bảng bài viết
CREATE TABLE public.posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT,
    image_url TEXT,
    image_path TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Bảng bình luận
CREATE TABLE public.comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Bảng lượt thích
CREATE TABLE public.likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (user_id, post_id)
);

-- Bảng theo dõi
CREATE TABLE public.follows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE (follower_id, following_id)
);

-- Bảng lưu trữ & Báo cáo
CREATE TABLE public.saved_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE public.reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    reason TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ==========================================
-- 💬 3. HỆ THỐNG TIN NHẮN & THÔNG BÁO
-- ==========================================

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
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,      -- Người nhận
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE DEFAULT auth.uid(), -- Người gây ra hành động
    type TEXT NOT NULL, -- 'like', 'comment', 'follow'
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    reference_id UUID NOT NULL,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- ==========================================
-- ⚡ 4. TỐI ƯU HÓA (INDEXES)
-- ==========================================
CREATE INDEX idx_posts_user_id ON public.posts(user_id);
CREATE INDEX idx_comments_post_id ON public.comments(post_id);
CREATE INDEX idx_likes_post_id ON public.likes(post_id);
CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX idx_notifications_user_is_read ON public.notifications(user_id, is_read);
CREATE INDEX idx_users_name_search ON public.users USING gin (to_tsvector('simple', COALESCE(name, '')));

-- ==========================================
-- 🔄 5. TRIGGERS & FUNCTIONS
-- ==========================================

-- A. Đồng bộ User từ Auth sang Public Profile
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

-- B. Cập nhật thời gian Updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- C. Logic Thông báo Tự động (Likes & Comments & Follows)
CREATE OR REPLACE FUNCTION handle_notification_trigger()
RETURNS TRIGGER AS $$
DECLARE
    target_user_id UUID;
BEGIN
    IF TG_TABLE_NAME = 'likes' THEN
        SELECT user_id INTO target_user_id FROM public.posts WHERE id = NEW.post_id;
        IF NEW.user_id != target_user_id THEN
            INSERT INTO public.notifications (user_id, sender_id, type, post_id, reference_id)
            VALUES (target_user_id, NEW.user_id, 'like', NEW.post_id, NEW.post_id);
        END IF;
    ELSIF TG_TABLE_NAME = 'comments' THEN
        SELECT user_id INTO target_user_id FROM public.posts WHERE id = NEW.post_id;
        IF NEW.user_id != target_user_id THEN
            INSERT INTO public.notifications (user_id, sender_id, type, post_id, reference_id)
            VALUES (target_user_id, NEW.user_id, 'comment', NEW.post_id, NEW.post_id);
        END IF;
    ELSIF TG_TABLE_NAME = 'follows' THEN
        INSERT INTO public.notifications (user_id, sender_id, type, reference_id)
        VALUES (NEW.following_id, NEW.follower_id, 'follow', NEW.follower_id);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_like_created AFTER INSERT ON likes FOR EACH ROW EXECUTE FUNCTION handle_notification_trigger();
CREATE TRIGGER on_comment_created AFTER INSERT ON comments FOR EACH ROW EXECUTE FUNCTION handle_notification_trigger();
CREATE TRIGGER on_follow_created AFTER INSERT ON follows FOR EACH ROW EXECUTE FUNCTION handle_notification_trigger();

-- ==========================================
-- 🔥 6. VIEWS & SEARCH FUNCTIONS
-- ==========================================

-- View Feed (Sử dụng để lấy dữ liệu trang chủ kèm đếm Like/Comment)
CREATE OR REPLACE VIEW feed_view AS
SELECT
    p.id, p.content, p.image_url, p.created_at, u.id AS user_id, u.name, u.avatar,
    (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS like_count,
    (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS comment_count
FROM posts p JOIN users u ON u.id = p.user_id
ORDER BY p.created_at DESC;

-- Tìm kiếm người dùng bằng Full Text Search
CREATE OR REPLACE FUNCTION search_users(keyword TEXT)
RETURNS SETOF public.users LANGUAGE sql AS $$
    SELECT * FROM public.users
    WHERE to_tsvector('simple', COALESCE(name, '')) @@ plainto_tsquery(keyword)
    OR name ILIKE '%' || keyword || '%';
$$;

-- ==========================================
-- 🔒 7. ROW LEVEL SECURITY (RLS) POLICIES
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

-- Users: Ai cũng thấy profile, chỉ chủ nhân mới được sửa
CREATE POLICY "Users: view all" ON users FOR SELECT USING (true);
CREATE POLICY "Users: update own" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users: insert trigger" ON users FOR INSERT WITH CHECK (true);

-- Posts: View công khai, hành động cá nhân
CREATE POLICY "Posts: view all" ON posts FOR SELECT USING (true);
CREATE POLICY "Posts: create" ON posts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Posts: update own" ON posts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Posts: delete own" ON posts FOR DELETE USING (auth.uid() = user_id);

-- Likes & Comments
CREATE POLICY "Likes: view all" ON likes FOR SELECT USING (true);
CREATE POLICY "Likes: act" ON likes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Likes: delete" ON likes FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Comments: view all" ON comments FOR SELECT USING (true);
CREATE POLICY "Comments: create" ON comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Comments: owner actions" ON comments FOR ALL USING (auth.uid() = user_id);

-- Messaging: Chỉ thành viên trong hội thoại mới được xem/gửi
CREATE POLICY "Chat: view conversations" ON conversations FOR SELECT USING (auth.uid() IN (SELECT user_id FROM conversation_members WHERE conversation_id = id));
CREATE POLICY "Chat: insert conversation" ON conversations FOR INSERT WITH CHECK (true);
CREATE POLICY "Chat: view messages" ON messages FOR SELECT USING (auth.uid() IN (SELECT user_id FROM conversation_members WHERE conversation_id = messages.conversation_id));
CREATE POLICY "Chat: send message" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- Notifications
CREATE POLICY "Noti: view own" ON notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Noti: update own" ON notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Noti: system insert" ON notifications FOR INSERT WITH CHECK (true);

-- Saved & Reports
CREATE POLICY "Saved: own" ON saved_posts FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Reports: create" ON reports FOR INSERT WITH CHECK (auth.uid() = user_id);