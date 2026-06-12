"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import toast from "react-hot-toast";
import { Camera } from "lucide-react";

const PROVINCES = [
  "An Giang",
  "Bà Rịa - Vũng Tàu",
  "Bắc Giang",
  "Bắc Kạn",
  "Bạc Liêu",
  "Bắc Ninh",
  "Bến Tre",
  "Bình Định",
  "Bình Dương",
  "Bình Phước",
  "Bình Thuận",
  "Cà Mau",
  "Cần Thơ",
  "Cao Bằng",
  "Đà Nẵng",
  "Đắk Lắk",
  "Đắk Nông",
  "Điện Biên",
  "Đồng Nai",
  "Đồng Tháp",
  "Gia Lai",
  "Hà Giang",
  "Hà Nam",
  "Hà Nội",
  "Hà Tĩnh",
  "Hải Dương",
  "Hải Phòng",
  "Hậu Giang",
  "Hòa Bình",
  "Hưng Yên",
  "Khánh Hòa",
  "Kiên Giang",
  "Kon Tum",
  "Lai Châu",
  "Lâm Đồng",
  "Lạng Sơn",
  "Lào Cai",
  "Long An",
  "Nam Định",
  "Nghệ An",
  "Ninh Bình",
  "Ninh Thuận",
  "Phú Thọ",
  "Phú Yên",
  "Quảng Bình",
  "Quảng Nam",
  "Quảng Ngãi",
  "Quảng Ninh",
  "Quảng Trị",
  "Sóc Trăng",
  "Sơn La",
  "Tây Ninh",
  "Thái Bình",
  "Thái Nguyên",
  "Thanh Hóa",
  "Thừa Thiên Huế",
  "Tiền Giang",
  "TP. Hồ Chí Minh",
  "Trà Vinh",
  "Tuyên Quang",
  "Vĩnh Long",
  "Vĩnh Phúc",
  "Yên Bái",
];

export default function SetupProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [user, setUser] = useState<any>(null);

  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [maritalStatus, setMaritalStatus] = useState("");
  const [address, setAddress] = useState("");
  const [work, setWork] = useState("");
  const [hobbies, setHobbies] = useState("");
  const [phone, setPhone] = useState("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const addressRef = useRef<HTMLDivElement | null>(null);
  const [showAddressDropdown, setShowAddressDropdown] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        if (error?.message?.includes("Refresh Token Not Found")) {
          await supabase.auth.signOut();
        }
        window.location.href = "/login";
        return;
      }

      const { data: dbUser } = await supabase
        .from("users")
        .select("*")
        .eq("id", data.user.id)
        .single();

      // Nếu đã có tên (tức là đã setup hoặc đăng nhập Google mà Trigger tự điền) thì cho qua
      if (dbUser?.name) {
        window.location.href = "/";
        return;
      }

      setUser(data.user);
      setLoading(false);
    };

    loadUser();
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        addressRef.current &&
        !addressRef.current.contains(e.target as Node)
      ) {
        setShowAddressDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Vui lòng nhập tên hiển thị.");
      return;
    }

    setSaving(true);
    try {
      let uploadedAvatarUrl = null;
      if (avatarFile) {
        const cleanName = avatarFile.name.replace(/[^a-zA-Z0-9.]/g, "_");
        const fileName = `avatar_${Date.now()}_${cleanName}`;
        const { error: uploadError } = await supabase.storage
          .from("posts")
          .upload(fileName, avatarFile);

        if (!uploadError) {
          const { data } = supabase.storage
            .from("posts")
            .getPublicUrl(fileName);
          uploadedAvatarUrl = data.publicUrl;
        }
      }

      const updateData: any = {
        name: name.trim(),
        dob: dob || null,
        gender: gender,
        marital_status: maritalStatus,
        address: address.trim(),
        work: work.trim(),
        hobbies: hobbies.trim(),
        phone: phone.trim(),
      };
      if (uploadedAvatarUrl) updateData.avatar_url = uploadedAvatarUrl;

      const { error } = await supabase
        .from("users")
        .update(updateData)
        .eq("id", user.id);

      if (error) throw error;

      toast.success("Cập nhật thông tin thành công!");
      window.location.href = "/"; // Quay về bảng tin
    } catch (err: any) {
      console.error(err);
      toast.error("Lỗi khi lưu thông tin.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-900 transition-colors duration-500 text-gray-900 dark:text-gray-100">
        Đang tải...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-neutral-900 flex items-center justify-center p-4 transition-colors duration-500">
      <div className="w-full max-w-lg bg-white dark:bg-[#262626] border border-gray-200 dark:border-neutral-800 shadow-xl rounded-xl p-8">
        <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-gray-100 mb-2">
          Hoàn tất hồ sơ
        </h2>
        <p className="text-center text-sm text-gray-500 dark:text-gray-400 mb-6">
          Vui lòng cung cấp thêm một số thông tin cá nhân để bắt đầu sử dụng
          Apex.
        </p>

        <form
          onSubmit={handleSave}
          className="space-y-4 text-gray-900 dark:text-gray-100"
        >
          <div className="flex flex-col items-center mb-6">
            <div className="relative w-24 h-24 rounded-full border-2 border-gray-200 dark:border-neutral-700 bg-gray-100 dark:bg-[#333333] flex items-center justify-center overflow-hidden shadow-sm">
              {avatarFile ? (
                <img
                  src={URL.createObjectURL(avatarFile)}
                  className="w-full h-full object-cover"
                  alt="Avatar"
                />
              ) : (
                <Camera className="w-8 h-8 text-gray-400" />
              )}
              <label className="absolute inset-0 cursor-pointer bg-black/0 hover:bg-black/20 transition-colors flex items-center justify-center text-white opacity-0 hover:opacity-100">
                <Camera size={20} />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>
            <span className="text-xs font-semibold text-blue-500 mt-2 cursor-pointer pointer-events-none">
              Chọn ảnh đại diện
            </span>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              Tên hiển thị <span className="text-red-500">*</span>
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="w-full border border-gray-200 dark:border-neutral-700 shadow-inner rounded-lg px-3 py-2 outline-none transition-colors bg-gray-50 dark:bg-[#333333] focus:bg-white dark:focus:bg-[#262626]"
              placeholder="VD: Nguyễn Văn A"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold mb-1">
                Ngày sinh
              </label>
              <input
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className="w-full border border-gray-200 dark:border-neutral-700 shadow-inner rounded-lg px-3 py-2 outline-none transition-colors bg-gray-50 dark:bg-[#333333] focus:bg-white dark:focus:bg-[#262626]"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">
                Giới tính
              </label>
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value)}
                className="w-full border border-gray-200 dark:border-neutral-700 shadow-inner rounded-lg px-3 py-2 outline-none transition-colors bg-gray-50 dark:bg-[#333333] focus:bg-white dark:focus:bg-[#262626]"
              >
                <option value="">Không muốn tiết lộ</option>
                <option value="Nam">Nam</option>
                <option value="Nữ">Nữ</option>
                <option value="Khác">Khác</option>
              </select>
            </div>
          </div>

          <div ref={addressRef} className="relative">
            <label className="block text-sm font-semibold mb-1">Địa chỉ</label>
            <input
              value={address}
              onChange={(e) => {
                setAddress(e.target.value);
                setShowAddressDropdown(true);
              }}
              onFocus={() => setShowAddressDropdown(true)}
              className="w-full border border-gray-200 dark:border-neutral-700 shadow-inner rounded-lg px-3 py-2 outline-none transition-colors bg-gray-50 dark:bg-[#333333] focus:bg-white dark:focus:bg-[#262626]"
              placeholder="VD: Đông Hưng, Thái Bình"
            />
            {showAddressDropdown && (
              <div className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-white dark:bg-[#333333] border border-gray-200 dark:border-neutral-700 rounded-lg shadow-lg">
                {(() => {
                  const parts = address.split(",");
                  const lastPart = parts[parts.length - 1].trim().toLowerCase();
                  const filtered = PROVINCES.filter((p) =>
                    p.toLowerCase().includes(lastPart),
                  );
                  if (filtered.length > 0) {
                    return filtered.map((province) => (
                      <div
                        key={province}
                        className="px-3 py-2 cursor-pointer hover:bg-secondary text-sm"
                        onClick={() => {
                          const newParts = [...parts];
                          newParts[newParts.length - 1] =
                            parts.length === 1 ? province : " " + province;
                          setAddress(newParts.join(",").trim());
                          setShowAddressDropdown(false);
                        }}
                      >
                        {province}
                      </div>
                    ));
                  }
                  return (
                    <div className="px-3 py-2 text-sm text-muted-foreground italic">
                      Không tìm thấy tỉnh thành
                    </div>
                  );
                })()}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              Tình trạng hôn nhân
            </label>
            <select
              value={maritalStatus}
              onChange={(e) => setMaritalStatus(e.target.value)}
              className="w-full border border-gray-200 dark:border-neutral-700 shadow-inner rounded-lg px-3 py-2 outline-none transition-colors bg-gray-50 dark:bg-[#333333] focus:bg-white dark:focus:bg-[#262626]"
            >
              <option value="">Không muốn tiết lộ</option>
              <option value="Độc thân">Độc thân</option>
              <option value="Hẹn hò">Hẹn hò</option>
              <option value="Đã kết hôn">Đã kết hôn</option>
              <option value="Phức tạp">Phức tạp</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              Công việc
            </label>
            <input
              value={work}
              onChange={(e) => setWork(e.target.value)}
              className="w-full border border-gray-200 dark:border-neutral-700 shadow-inner rounded-lg px-3 py-2 outline-none transition-colors bg-gray-50 dark:bg-[#333333] focus:bg-white dark:focus:bg-[#262626]"
              placeholder="VD: Kỹ sư phần mềm"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">Sở thích</label>
            <input
              value={hobbies}
              onChange={(e) => setHobbies(e.target.value)}
              className="w-full border border-gray-200 dark:border-neutral-700 shadow-inner rounded-lg px-3 py-2 outline-none transition-colors bg-gray-50 dark:bg-[#333333] focus:bg-white dark:focus:bg-[#262626]"
              placeholder="VD: Đọc sách, bơi lội, du lịch"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1">
              Số điện thoại liên hệ
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full border border-gray-200 dark:border-neutral-700 shadow-inner rounded-lg px-3 py-2 outline-none transition-colors bg-gray-50 dark:bg-[#333333] focus:bg-white dark:focus:bg-[#262626]"
              placeholder="Số điện thoại công khai (tùy chọn)"
            />
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-blue-500 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-600 transition disabled:opacity-50 mt-4"
          >
            {saving ? "Đang lưu..." : "Bắt đầu sử dụng"}
          </button>
        </form>
      </div>
    </div>
  );
}
