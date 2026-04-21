import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { content } = await req.json();

    // Nếu không có nội dung chữ, cho qua (an toàn)
    if (!content) {
      return NextResponse.json({ flagged: false });
    }

    const GEMINI_API_KEY = "AIzaSyAWByUdiz4D7Amqq0dy5hBKT-q-4lCNwgw";

    // Gọi API của Google Gemini 2.5 Flash (Phiên bản mới nhất)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Bạn là một AI kiểm duyệt nội dung. Hãy kiểm tra đoạn văn bản sau xem có chứa ngôn từ kích động thù địch, quấy rối, nội dung nhạy cảm, spam hoặc bạo lực không. CHỈ TRẢ VỀ một object JSON hợp lệ với định dạng {"flagged": true} nếu vi phạm, hoặc {"flagged": false} nếu an toàn. Không trả về bất kỳ giải thích hay text nào khác.\n\nVăn bản cần kiểm tra: "${content}"`,
                },
              ],
            },
          ],
          // Ép Gemini bắt buộc phải trả về JSON
          generationConfig: {
            responseMimeType: "application/json",
          },
        }),
      },
    );

    const data = await response.json();

    // Bắt lỗi nếu API Key sai, hết hạn hoặc bị Google từ chối
    if (!response.ok) {
      console.error("❌ LỖI TỪ GEMINI API:", JSON.stringify(data, null, 2));
      return NextResponse.json({ flagged: false });
    }

    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    console.log("✅ GEMINI TRẢ VỀ:", responseText); // In ra Terminal để kiểm tra

    let flagged = false;
    try {
      // Lọc bỏ markdown code blocks (```json ... ```) nếu AI có lỡ trả về kèm theo
      const cleanText = responseText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      flagged = JSON.parse(cleanText).flagged === true;
    } catch (e) {
      console.error("Lỗi parse kết quả từ Gemini:", responseText);
    }

    return NextResponse.json({ flagged });
  } catch (error) {
    console.error("Moderation check failed:", error);
    return NextResponse.json({ flagged: false });
  }
}
