import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Khởi tạo Gemini API
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { query } = await req.json();

    if (!query || query.length < 2) {
      return NextResponse.json({ suggestion: null });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `Người dùng đã tìm kiếm từ khóa có thể bị sai chính tả do gõ vội: "${query}".
Hãy đoán tên tiếng Việt (tên người hoặc trang cộng đồng) đúng chính tả mà họ muốn tìm.
Ví dụ: "hoqab" -> "Hoàn", "phm hoang" -> "Phạm Hoàng", "nguyen vna a" -> "Nguyễn Văn A".
Chỉ trả về CHÍNH XÁC tên được sửa, không giải thích, không ngoặc kép, không in đậm. Nếu hoàn toàn vô nghĩa và không thể đoán, trả về chữ "null".`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text().trim();

    if (responseText.toLowerCase() === "null" || responseText === "") {
      return NextResponse.json({ suggestion: null });
    }

    return NextResponse.json({ suggestion: responseText });
  } catch (error) {
    console.error("Lỗi AI Suggestion:", error);
    return NextResponse.json({ suggestion: null }, { status: 500 });
  }
}
