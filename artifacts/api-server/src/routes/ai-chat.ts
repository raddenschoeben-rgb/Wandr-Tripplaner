import { Router, type IRouter } from "express";
import { GoogleGenAI } from "@google/genai";

const router: IRouter = Router();

function getAI(customKey?: string) {
  const apiKey = customKey || process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey });
}

const SYSTEM_PROMPT = `Bạn là Wandr AI — trợ lý du lịch thông minh được tích hợp trong ứng dụng lập kế hoạch du lịch Wandr.

Nhiệm vụ của bạn:
1. Đề xuất các địa điểm nên đến dựa trên điểm đến của chuyến đi
2. Đưa ra lời khuyên, mẹo và lưu ý khi đến các địa điểm
3. Gợi ý lịch trình, thứ tự tham quan hợp lý
4. Cung cấp thông tin về văn hóa, ẩm thực địa phương

Khi đề xuất địa điểm cụ thể, bắt buộc bao gồm một JSON block theo format sau (mỗi địa điểm một block):
<place>{"name":"Tên địa điểm bằng tiếng Anh hoặc tiếng địa phương","address":"Địa chỉ đầy đủ rõ ràng bằng tiếng Anh (tên đường, quận/huyện, thành phố, quốc gia)","description":"Mô tả ngắn 1-2 câu","tip":"Mẹo hoặc lưu ý khi đến","lat":VĨ_ĐỘ_SỐ,"lng":KINH_ĐỘ_SỐ}</place>

Quy tắc bắt buộc cho địa điểm:
- "lat" và "lng" PHẢI là tọa độ GPS chính xác dạng số thực (ví dụ: "lat":13.7500,"lng":100.4914)
- "address" PHẢI viết bằng tiếng Anh, bao gồm: tên đường + quận/huyện + thành phố + quốc gia
- Ví dụ đúng: "address":"Na Phra Lan Road, Phra Nakhon District, Bangkok 10200, Thailand"
- Ví dụ sai: "address":"Na Phra Lan Road, Phra Borom..." (thiếu thành phố và quốc gia)
- Chỉ đề xuất địa điểm có tọa độ chính xác, không bịa đặt tọa độ

Luôn trả lời bằng tiếng Việt. Thân thiện, ngắn gọn, thực tế.`;

router.post("/ai/chat", async (req, res): Promise<void> => {
  const { messages, tripContext, model, extraSystemPrompt } = req.body as {
    messages: { role: "user" | "model"; content: string }[];
    tripContext?: {
      tripName?: string;
      destination?: string;
      startDate?: string;
      endDate?: string;
      currentPlaces?: string[];
    };
    model?: string;
    extraSystemPrompt?: string;
  };

  if (!messages || !Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: "messages is required" });
    return;
  }

  const customGeminiKey = req.headers["x-gemini-api-key"] as string | undefined;

  let ai: GoogleGenAI;
  try {
    ai = getAI(customGeminiKey);
  } catch {
    res.status(500).json({ error: "GEMINI_API_KEY chưa được cấu hình. Vui lòng thêm key vào Cài đặt hoặc Secrets." });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");

  try {
    const contextParts: string[] = [];
    if (tripContext?.tripName) contextParts.push(`Chuyến đi: ${tripContext.tripName}`);
    if (tripContext?.destination) contextParts.push(`Điểm đến: ${tripContext.destination}`);
    if (tripContext?.startDate && tripContext?.endDate) {
      contextParts.push(`Thời gian: ${tripContext.startDate} → ${tripContext.endDate}`);
    }
    if (tripContext?.currentPlaces?.length) {
      contextParts.push(`Đã có trong lịch trình: ${tripContext.currentPlaces.join(", ")}`);
    }

    const ALLOWED_MODELS = ["gemini-2.5-flash", "gemini-2.0-flash"];
    const selectedModel = model && ALLOWED_MODELS.includes(model) ? model : "gemini-2.5-flash";

    let systemWithContext = contextParts.length > 0
      ? `${SYSTEM_PROMPT}\n\nContext chuyến đi hiện tại:\n${contextParts.join("\n")}`
      : SYSTEM_PROMPT;
    if (extraSystemPrompt?.trim()) {
      systemWithContext += `\n\nHướng dẫn bổ sung từ người dùng:\n${extraSystemPrompt.trim()}`;
    }

    const contents = messages.map((m) => ({
      role: m.role,
      parts: [{ text: m.content }],
    }));

    const stream = await ai.models.generateContentStream({
      model: selectedModel,
      config: {
        systemInstruction: systemWithContext,
        maxOutputTokens: 8192,
      },
      contents,
    });

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) {
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    res.write(`data: ${JSON.stringify({ error: message })}\n\n`);
    res.end();
  }
});

router.post("/ai/describe-place", async (req, res): Promise<void> => {
  const { name, englishDescription } = req.body as { name?: string; englishDescription?: string };
  if (!name) {
    res.status(400).json({ error: "name is required" });
    return;
  }
  const customGeminiKey = req.headers["x-gemini-api-key"] as string | undefined;
  let ai: GoogleGenAI;
  try {
    ai = getAI(customGeminiKey);
  } catch {
    res.status(500).json({ error: "GEMINI_API_KEY chưa được cấu hình" });
    return;
  }
  try {
    const prompt = englishDescription
      ? `Dịch và viết lại mô tả sau về địa điểm "${name}" thành 2-3 câu tiếng Việt tự nhiên, súc tích:\n\n"${englishDescription}"\n\nChỉ trả về đoạn mô tả tiếng Việt, không giải thích thêm.`
      : `Viết 2-3 câu mô tả ngắn gọn về địa điểm "${name}" bằng tiếng Việt. Chỉ trả về đoạn mô tả, không giải thích thêm.`;
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      config: { maxOutputTokens: 256 },
    });
    const description = response.text?.trim() ?? null;
    res.json({ description });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[describe-place] Gemini error:", message);
    res.status(500).json({ error: message });
  }
});

export default router;
