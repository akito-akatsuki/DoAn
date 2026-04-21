"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Camera, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import { createPage } from "@/lib/api";
import { supabase } from "@/lib/supabaseClient";

export default function CreatePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Vui lòng nhập tên Trang!");
      return;
    }

    setLoading(true);
    try {
      let avatarUrl = null;

      if (avatarFile) {
        const cleanName = avatarFile.name.replace(/[^a-zA-Z0-9.]/g, "_");
        const fileName = `page_avatar_${Date.now()}_${cleanName}`;
        const { error } = await supabase.storage
          .from("posts")
          .upload(fileName, avatarFile);
        if (!error) {
          const { data } = supabase.storage
            .from("posts")
            .getPublicUrl(fileName);
          avatarUrl = data.publicUrl;
        }
      }

      await createPage({
        name: name.trim(),
        bio: bio.trim(),
        avatar_url: avatarUrl,
      });

      toast.success("Tạo trang thành công!");
      router.push("/");
    } catch (err) {
      console.error(err);
      toast.error("Đã xảy ra lỗi khi tạo Trang");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-gray-900 dark:text-gray-100 transition-colors duration-500 bg-gray-50 dark:bg-neutral-900">
      <main className="max-w-[600px] mx-auto pt-24 px-4 pb-28 md:pb-20">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-200 dark:hover:bg-neutral-800 rounded-full transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-2xl font-bold">Tạo Trang cộng đồng</h1>
        </div>

        <div className="bg-white dark:bg-[#262626] border border-gray-200 dark:border-neutral-800 rounded-2xl shadow-sm dark:shadow-black/30 overflow-hidden p-6 space-y-6">
          <div className="space-y-4">
            <div className="flex flex-col items-center gap-2">
              <div className="relative w-24 h-24 rounded-full border-2 border-gray-200 dark:border-neutral-700 bg-gray-100 dark:bg-[#333333] flex items-center justify-center overflow-hidden">
                {avatarFile ? (
                  <img
                    src={URL.createObjectURL(avatarFile)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Camera className="w-8 h-8 text-gray-400" />
                )}
                <label className="absolute inset-0 cursor-pointer bg-black/0 hover:bg-black/10 transition-colors">
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                  />
                </label>
              </div>
              <span className="text-sm font-semibold text-blue-500">
                Tải ảnh đại diện
              </span>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">
                Tên Trang
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nhập tên trang..."
                className="w-full border border-gray-200 dark:border-neutral-700 shadow-inner rounded-lg px-4 py-3 outline-none transition-colors bg-gray-50 dark:bg-[#333333] focus:bg-white dark:focus:bg-[#262626]"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">
                Mô tả (Bio)
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Trang này nói về..."
                className="w-full border border-gray-200 dark:border-neutral-700 shadow-inner rounded-lg px-4 py-3 outline-none transition-colors resize-none bg-gray-50 dark:bg-[#333333] focus:bg-white dark:focus:bg-[#262626]"
                rows={4}
              />
            </div>

            <button
              onClick={handleCreate}
              disabled={loading || !name.trim()}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="w-5 h-5 animate-spin" />}
              {loading ? "Đang tạo..." : "Tạo Trang"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
