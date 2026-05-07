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
-- 👤 2. TABLES (BẢNG DỮ LIỆU CỐT LÕI)
-- ==========================================

-- USERS
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    email TEXT UNIQUE,
    avatar_url TEXT,
    cover_url TEXT,
    cover_position_y NUMERIC DEFAULT 50,
    bio TEXT,
    google_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- PAGES (FANPAGE)
CREATE TABLE IF NOT EXISTS public.pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    avatar_url TEXT,
    cover_url TEXT,
    cover_position_y NUMERIC DEFAULT 50,
    bio TEXT,
    post_permission TEXT DEFAULT 'anyone',
    created_by UUID REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- POSTS
CREATE TABLE IF NOT EXISTS public.posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    page_id UUID REFERENCES public.pages(id) ON DELETE CASCADE,
    content TEXT,
    image_url TEXT, -- Ảnh đơn (legacy)
    image_urls TEXT[], -- Đa ảnh
    image_path TEXT,
    is_flagged BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- COMMENTS
CREATE TABLE IF NOT EXISTS public.comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- LIKES
CREATE TABLE IF NOT EXISTS public.likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, post_id)
);

-- FOLLOWS (USER TO USER)
CREATE TABLE IF NOT EXISTS public.follows (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    follower_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (follower_id, following_id)
);

-- PAGE MEMBERS (FOLLOWERS & FAVORITES)
CREATE TABLE IF NOT EXISTS public.page_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    page_id UUID NOT NULL REFERENCES public.pages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    follow_type TEXT DEFAULT 'normal', -- 'normal' or 'favorites'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(page_id, user_id)
);

-- PAGE ADMINS
CREATE TABLE IF NOT EXISTS public.page_admins (
    page_id UUID REFERENCES public.pages(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'admin',
    PRIMARY KEY (page_id, user_id)
);

-- ==========================================
-- 💬 3. MESSAGING & CALLS (TIN NHẮN & CUỘC GỌI)
-- ==========================================

-- CONVERSATIONS
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user1_id UUID REFERENCES public.users(id) ON DELETE CASCADE, -- Có thể NULL nếu là Group
    user2_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    is_group BOOLEAN DEFAULT false,
    group_name TEXT,
    group_avatar TEXT,
    admin_id UUID REFERENCES public.users(id),
    last_message TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CONVERSATION PARTICIPANTS
CREATE TABLE IF NOT EXISTS public.conversation_participants (
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (conversation_id, user_id)
);

-- MESSAGES
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    image_url TEXT,
    image_urls TEXT[],
    file_url TEXT,
    file_name TEXT,
    file_type TEXT,
    file_size BIGINT,
    reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- NICKNAMES
CREATE TABLE IF NOT EXISTS public.nicknames (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    target_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    nickname TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(conversation_id, user_id, target_id)
);

-- BLOCKED USERS
CREATE TABLE IF NOT EXISTS public.blocked_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    blocker_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    blocked_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(blocker_id, blocked_id)
);

-- CALLS
CREATE TABLE IF NOT EXISTS public.calls (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    caller_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    receiver_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    room_id TEXT NOT NULL,
    status TEXT DEFAULT 'ringing' CHECK (status IN ('ringing', 'accepted', 'rejected', 'ended')),
    started_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 🔔 4. NOTIFICATIONS, SAVED & REPORTS
-- ==========================================

-- NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    page_id UUID REFERENCES public.pages(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'like', 'comment', 'follow'
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    reference_id UUID NOT NULL,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SAVED POSTS
CREATE TABLE IF NOT EXISTS public.saved_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, post_id)
);

-- REPORTS
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- ⚡ 5. INDEXES (TỐI ƯU HIỆU NĂNG)
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_posts_is_flagged ON public.posts(is_flagged);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_users_name_search ON public.users USING gin (to_tsvector('simple', COALESCE(name, '')));

-- ==========================================
-- 🔄 6. TRIGGERS & FUNCTIONS (LOGIC TỰ ĐỘNG)
-- ==========================================

-- Trigger cập nhật updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ĐỒNG BỘ USER TỪ AUTH.USERS SANG PUBLIC.USERS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://api.dicebear.com/7.x/identicon/svg?seed=' || NEW.id)
  ) ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- TỰ ĐỘNG TẠO THÔNG BÁO
CREATE OR REPLACE FUNCTION handle_notification_trigger()
RETURNS TRIGGER AS $$
DECLARE
    target_user_id UUID;
    p_id UUID;
BEGIN
    IF TG_TABLE_NAME = 'likes' OR TG_TABLE_NAME = 'comments' THEN
        SELECT user_id, page_id INTO target_user_id, p_id FROM public.posts WHERE id = NEW.post_id;
        IF NEW.user_id != target_user_id THEN
            INSERT INTO public.notifications (user_id, sender_id, type, post_id, reference_id, page_id)
            VALUES (target_user_id, NEW.user_id,
                   CASE WHEN TG_TABLE_NAME = 'likes' THEN 'like' ELSE 'comment' END,
                   NEW.post_id, NEW.id, p_id);
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
-- 🔥 7. THUẬT TOÁN (GET HOT FEED)
-- ==========================================

CREATE OR REPLACE FUNCTION get_hot_feed(current_user_id UUID)
RETURNS SETOF public.posts AS $$
BEGIN
  IF current_user_id IS NULL THEN
    RETURN QUERY SELECT p.* FROM posts p ORDER BY p.created_at DESC LIMIT 50;
  ELSE
    RETURN QUERY
    SELECT p.*
    FROM posts p
    LEFT JOIN page_members pm ON p.page_id = pm.page_id AND pm.user_id = current_user_id
    LEFT JOIN follows f ON p.user_id = f.following_id AND f.follower_id = current_user_id
    WHERE pm.page_id IS NOT NULL OR f.following_id IS NOT NULL OR p.user_id = current_user_id
    ORDER BY
      CASE WHEN pm.follow_type = 'favorites' THEN 1 ELSE 2 END ASC,
      p.created_at DESC
    LIMIT 50;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ==========================================
-- 🔒 8. ROW LEVEL SECURITY (RLS)
-- ==========================================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE pages ENABLE ROW LEVEL SECURITY;

-- Ví dụ một số Policy quan trọng
CREATE POLICY "Public: view profiles" ON users FOR SELECT USING (true);
CREATE POLICY "Owner: update profile" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Public: view posts" ON posts FOR SELECT USING (true);
CREATE POLICY "Chat: messages access" ON messages FOR ALL USING (
    EXISTS (SELECT 1 FROM conversation_participants WHERE conversation_id = messages.conversation_id AND user_id = auth.uid())
);
CREATE POLICY "Allow update read status" ON public.messages FOR UPDATE USING (
  conversation_id IN (SELECT conversation_id FROM conversation_participants WHERE user_id = auth.uid())
);

-- ==========================================
-- 📡 9. REALTIME & STORAGE BUCKETS
-- ==========================================
-- Đã thêm: conversations, posts, users vào publication
ALTER PUBLICATION supabase_realtime ADD TABLE calls, nicknames, blocked_users, messages, notifications, conversations, posts, users;

-- Lưu ý: Tạo tự động các bucket cần thiết cho hệ thống InstaMini
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('chat_files', 'chat_files', true),
  ('chat_images', 'chat_images', true),
  ('posts', 'posts', true),
  ('comment_images', 'comment_images', true)
ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
