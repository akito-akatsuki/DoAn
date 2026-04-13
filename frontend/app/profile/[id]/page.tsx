"use client";

import { use, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Navbar from "@/components/navbar";

type UserProfile = {
  id: string;
  name: string;
  avatar_url?: string | null;
  bio?: string | null;
};

export default function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  // ✅ Next 16 fix params
  const { id } = use(params);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  // ================= LOAD CURRENT USER =================
  useEffect(() => {
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      setCurrentUser(data.user);
    };

    loadUser();
  }, []);

  // ================= LOAD PROFILE + POSTS =================
  useEffect(() => {
    if (!id) return;

    const load = async () => {
      setLoading(true);

      const { data: user } = await supabase
        .from("users")
        .select("*")
        .eq("id", id)
        .single();

      setProfile(user);

      const { data: postsData } = await supabase
        .from("posts")
        .select("id, content, image_url, created_at")
        .eq("user_id", id)
        .order("created_at", { ascending: false });

      setPosts(postsData || []);

      setLoading(false);
    };

    load();
  }, [id]);

  // ================= CHECK FOLLOW =================
  useEffect(() => {
    const checkFollow = async () => {
      if (!currentUser || !id) return;

      const { data } = await supabase
        .from("follows")
        .select("*")
        .eq("follower_id", currentUser.id)
        .eq("following_id", id)
        .maybeSingle();

      setIsFollowing(!!data);
    };

    checkFollow();
  }, [currentUser, id]);

  // ================= TOGGLE FOLLOW =================
  const toggleFollow = async () => {
    if (!currentUser || currentUser.id === id) return;

    if (isFollowing) {
      await supabase
        .from("follows")
        .delete()
        .eq("follower_id", currentUser.id)
        .eq("following_id", id);

      setIsFollowing(false);
    } else {
      await supabase.from("follows").insert({
        follower_id: currentUser.id,
        following_id: id,
      });

      setIsFollowing(true);
    }
  };

  // ================= UI =================
  if (loading) {
    return <div className="mt-20 text-center">Loading...</div>;
  }

  if (!profile) {
    return <div className="mt-20 text-center">User not found</div>;
  }

  return (
    <>
      {/* 🔥 NAVBAR ADDED */}
      <Navbar user={currentUser} />

      <div className="max-w-[935px] mx-auto mt-24 px-4">
        {/* ================= HEADER ================= */}
        <div className="flex items-center gap-8 border-b pb-8">
          <img
            src={
              profile.avatar_url ||
              `https://api.dicebear.com/7.x/identicon/svg?seed=${profile.id}`
            }
            className="w-28 h-28 rounded-full"
          />

          <div className="flex-1">
            <div className="flex items-center gap-4">
              <h1 className="text-xl font-semibold">{profile.name}</h1>

              {currentUser?.id !== id && (
                <button
                  onClick={toggleFollow}
                  className={`px-4 py-1 rounded text-sm transition ${
                    isFollowing
                      ? "bg-gray-200 text-black"
                      : "bg-blue-500 text-white"
                  }`}
                >
                  {isFollowing ? "Unfollow" : "Follow"}
                </button>
              )}
            </div>

            <div className="flex gap-6 mt-4 text-sm">
              <span>
                <b>{posts.length}</b> posts
              </span>
              <span>
                <b>0</b> followers
              </span>
              <span>
                <b>0</b> following
              </span>
            </div>

            <p className="mt-3 text-sm text-gray-600">
              {profile.bio || "No bio yet"}
            </p>
          </div>
        </div>

        {/* ================= POSTS GRID ================= */}
        <div className="grid grid-cols-3 gap-1 mt-4">
          {posts.map((post) => (
            <div
              key={post.id}
              className="aspect-square bg-gray-100 overflow-hidden"
            >
              {post.image_url ? (
                <img
                  src={post.image_url}
                  className="w-full h-full object-cover hover:scale-105 transition"
                />
              ) : (
                <div className="p-2 text-xs">{post.content}</div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
