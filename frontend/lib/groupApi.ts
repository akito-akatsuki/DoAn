import { supabase } from "./supabaseClient";

// Lấy danh sách nhóm mà người dùng đã tham gia
export const getMyGroups = async (userId: string) => {
  const { data, error } = await supabase
    .from("group_members")
    .select(
      `
      group_id,
      role,
      status,
      groups (*)
    `,
    )
    .eq("user_id", userId)
    .eq("status", "approved");

  if (error) throw error;
  return data.map((item: any) => item.groups); // Chỉ lấy object group
};

// Lấy danh sách tất cả các nhóm để Khám phá
export const getExploreGroups = async () => {
  const { data, error } = await supabase
    .from("groups")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
};

// Tạo nhóm mới
export const createGroup = async (
  name: string,
  description: string,
  privacy: string,
  userId: string,
) => {
  // 1. Insert vào bảng groups
  const { data: newGroup, error: groupError } = await supabase
    .from("groups")
    .insert([{ name, description, privacy, creator_id: userId }])
    .select()
    .single();

  if (groupError) throw groupError;

  // 2. Thêm người tạo làm Admin trong bảng group_members
  const { error: memberError } = await supabase
    .from("group_members")
    .insert([
      {
        group_id: newGroup.id,
        user_id: userId,
        role: "admin",
        status: "approved",
      },
    ]);

  if (memberError) throw memberError;

  return newGroup;
};
