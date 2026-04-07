import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Send, Plus, MapPin, Loader2, ThumbsUp, ThumbsDown,
  MoreHorizontal, History, Settings, ChevronLeft,
  Trash2, Check, X,
} from "lucide-react";

/* ─────────── Types ─────────── */

interface PlaceSuggestion {
  name: string;
  address: string;
  description: string;
  tip?: string;
  lat?: number;
  lng?: number;
}

interface ChatMessage {
  role: "user" | "model";
  content: string;
  places?: PlaceSuggestion[];
}

interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  model: string;
  extraSystemPrompt: string;
  messages: ChatMessage[];
}

interface TripContext {
  tripName?: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  currentPlaces?: string[];
}

interface AIChatBoxProps {
  tripId?: string | number;
  tripContext?: TripContext;
  onAddPlace?: (place: PlaceSuggestion) => void;
  onViewOnMap?: (place: PlaceSuggestion) => void;
}

/* ─────────── Constants ─────────── */

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const MODELS = [
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash", desc: "Nhanh & thông minh" },
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash", desc: "Cân bằng tốc độ & chất lượng" },
];

const THINKING_PHRASES = [
  "Đang tìm kiếm thông tin...",
  "Đang phân tích địa điểm...",
  "Đang tổng hợp kết quả...",
  "Đang chuẩn bị gợi ý...",
  "Đang nghiên cứu lộ trình...",
];

/* ─────────── Helpers ─────────── */

function parsePlaces(text: string): { cleanText: string; places: PlaceSuggestion[] } {
  const places: PlaceSuggestion[] = [];
  const cleanText = text
    .replace(/<place>([\s\S]*?)<\/place>/g, (_, json) => {
      try {
        const p = JSON.parse(json.trim());
        if (p.name) places.push(p);
      } catch { /* skip */ }
      return "";
    })
    .trim();
  return { cleanText, places };
}

function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function makeSession(overrides?: Partial<ChatSession>): ChatSession {
  return {
    id: genId(),
    title: "Cuộc trò chuyện mới",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    model: "gemini-2.5-flash",
    extraSystemPrompt: "",
    messages: [],
    ...overrides,
  };
}

function fmtDate(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

/* ─────────── Sub-components ─────────── */

function GeminiDiamond({ size = 16, spinning = false }: { size?: number; spinning?: boolean }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      style={spinning ? { animation: "geminiSpin 2s linear infinite" } : undefined}
    >
      <path
        d="M12 2L14.5 9.5L22 12L14.5 14.5L12 22L9.5 14.5L2 12L9.5 9.5L12 2Z"
        fill="url(#gemini-grad-a)"
      />
      <defs>
        <linearGradient id="gemini-grad-a" x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#4285F4" />
          <stop offset="0.5" stopColor="#9B59B6" />
          <stop offset="1" stopColor="#1A73E8" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function ThinkingIndicator() {
  const [phraseIdx, setPhraseIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setPhraseIdx((i) => (i + 1) % THINKING_PHRASES.length), 1800);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-start gap-2.5 py-2">
      <div className="shrink-0 mt-0.5">
        <GeminiDiamond size={18} spinning />
      </div>
      <div className="flex flex-col gap-1.5 pt-0.5">
        <p key={phraseIdx} className="text-sm text-muted-foreground" style={{ animation: "fadeInUp 0.4s ease-out" }}>
          {THINKING_PHRASES[phraseIdx]}
        </p>
        <div className="flex gap-1">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className="h-1 rounded-full bg-gradient-to-r from-blue-500 to-violet-500"
              style={{ width: 20 + i * 8, opacity: 0.3 + i * 0.15, animation: `shimmerBar 1.4s ease-in-out ${i * 0.18}s infinite alternate` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function PlaceCard({ place, onView }: { place: PlaceSuggestion; onAdd: () => void; onView: () => void }) {
  return (
    <div
      onClick={onView}
      className="mt-2 rounded-xl border border-border bg-card shadow-sm overflow-hidden hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group"
      title="Click để xem trên bản đồ"
    >
      <div className="flex items-start gap-2.5 p-3">
        <div className="shrink-0 w-8 h-8 rounded-lg bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
          <MapPin className="w-4 h-4 text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-tight group-hover:text-blue-700 transition-colors">{place.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{place.address}</p>
          {place.description && <p className="text-xs text-foreground/70 mt-1 line-clamp-2">{place.description}</p>}
          {place.tip && <p className="text-xs text-amber-600 mt-1">💡 {place.tip}</p>}
        </div>
      </div>
    </div>
  );
}

function AIMessage({ msg, onAddPlace, onViewOnMap }: {
  msg: ChatMessage;
  onAddPlace: (p: PlaceSuggestion) => void;
  onViewOnMap?: (p: PlaceSuggestion) => void;
}) {
  return (
    <div className="flex flex-col gap-1 py-2">
      <div className="flex items-start gap-2.5">
        <div className="shrink-0 mt-0.5"><GeminiDiamond size={18} /></div>
        <div className="flex-1 min-w-0">
          {msg.content && <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{msg.content}</p>}
          {msg.places && msg.places.length > 0 && (
            <div className="mt-1 flex flex-col gap-2">
              {msg.places.map((p, i) => (
                <PlaceCard key={i} place={p} onAdd={() => onAddPlace(p)} onView={() => onViewOnMap?.(p)} />
              ))}
            </div>
          )}
        </div>
      </div>
      {(msg.content || (msg.places?.length ?? 0) > 0) && (
        <div className="flex items-center gap-0.5 pl-8 mt-0.5">
          <button className="p-1.5 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"><ThumbsUp className="w-3.5 h-3.5" /></button>
          <button className="p-1.5 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"><ThumbsDown className="w-3.5 h-3.5" /></button>
          <button className="p-1.5 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"><MoreHorizontal className="w-3.5 h-3.5" /></button>
        </div>
      )}
    </div>
  );
}

function UserMessage({ content }: { content: string }) {
  return (
    <div className="flex justify-end py-2">
      <div className="max-w-[80%] px-4 py-2.5 rounded-2xl bg-muted text-sm text-foreground leading-relaxed whitespace-pre-wrap">
        {content}
      </div>
    </div>
  );
}

/* ─────────── Main component ─────────── */

export default function AIChatBox({ tripId, tripContext, onAddPlace, onViewOnMap }: AIChatBoxProps) {
  const storageKey = tripId ? `wandr_ai_sessions_v2_${tripId}` : null;

  /* ── Session state ── */
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    if (!storageKey) return [makeSession()];
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const loaded = JSON.parse(raw) as ChatSession[];
        if (Array.isArray(loaded) && loaded.length > 0) return loaded;
      }
    } catch { /* ignore */ }
    return [makeSession()];
  });

  const [currentId, setCurrentId] = useState<string>(() => sessions[sessions.length - 1]?.id ?? "");
  const [view, setView] = useState<"chat" | "history" | "settings">("chat");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  /* ── Model / prompt settings (per session) ── */
  const [draftModel, setDraftModel] = useState("");
  const [draftPrompt, setDraftPrompt] = useState("");

  const currentSession = useMemo(
    () => sessions.find((s) => s.id === currentId) ?? sessions[sessions.length - 1],
    [sessions, currentId]
  );

  /* ── Chat state ── */
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  /* ── Persistence ── */
  useEffect(() => {
    if (!storageKey) return;
    try { localStorage.setItem(storageKey, JSON.stringify(sessions)); } catch { /* quota */ }
  }, [sessions, storageKey]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [currentSession?.messages]);

  /* ── Session helpers ── */
  function updateSession(id: string, patch: Partial<ChatSession>) {
    setSessions((prev) => prev.map((s) => s.id === id ? { ...s, ...patch, updatedAt: Date.now() } : s));
  }

  function autoTitle(msgs: ChatMessage[]) {
    const first = msgs.find((m) => m.role === "user");
    if (!first) return "Cuộc trò chuyện mới";
    return first.content.slice(0, 45) + (first.content.length > 45 ? "..." : "");
  }

  function createNewSession() {
    const newSession = makeSession();
    setSessions((prev) => [...prev, newSession]);
    setCurrentId(newSession.id);
    setView("chat");
    setInput("");
    setTimeout(() => inputRef.current?.focus(), 100);
  }

  function switchSession(id: string) {
    abortRef.current?.abort();
    setIsStreaming(false);
    setCurrentId(id);
    setView("chat");
    setInput("");
  }

  function deleteSession(id: string) {
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== id);
      if (filtered.length === 0) {
        const fresh = makeSession();
        if (currentId === id) setCurrentId(fresh.id);
        return [fresh];
      }
      if (currentId === id) {
        setCurrentId(filtered[filtered.length - 1].id);
      }
      return filtered;
    });
    setDeletingId(null);
  }

  function openSettings() {
    setDraftModel(currentSession.model);
    setDraftPrompt(currentSession.extraSystemPrompt);
    setView("settings");
  }

  function saveSettings() {
    updateSession(currentId, { model: draftModel, extraSystemPrompt: draftPrompt });
    setView("chat");
  }

  /* ── Send message ── */
  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming || !currentSession) return;

    const userMsg: ChatMessage = { role: "user", content: text };
    const prevMessages = currentSession.messages;
    const allMessages = [...prevMessages, userMsg];

    setInput("");
    setIsStreaming(true);

    const newTitle = prevMessages.length === 0 ? autoTitle(allMessages) : currentSession.title;
    updateSession(currentId, { messages: allMessages, title: newTitle });

    abortRef.current = new AbortController();

    const geminiKey = localStorage.getItem("user_gemini_api_key");
    try {
      const response = await fetch(`${BASE}/api/ai/chat`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(geminiKey ? { "x-gemini-api-key": geminiKey } : {}),
        },
        body: JSON.stringify({
          messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
          tripContext,
          model: currentSession.model,
          extraSystemPrompt: currentSession.extraSystemPrompt || undefined,
        }),
        signal: abortRef.current.signal,
      });

      if (!response.ok || !response.body) throw new Error("Kết nối thất bại");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulated = "";

      const modelMsgIdx = allMessages.length;
      updateSession(currentId, { messages: [...allMessages, { role: "model", content: "" }] });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const data = JSON.parse(line.slice(6));
            if (data.error) accumulated += `\n⚠️ ${data.error}`;
            else if (data.content) accumulated += data.content;
            const { cleanText, places } = parsePlaces(accumulated);
            setSessions((prev) => prev.map((s) => {
              if (s.id !== currentId) return s;
              const msgs = [...s.messages];
              msgs[modelMsgIdx] = { role: "model", content: cleanText, places };
              return { ...s, messages: msgs, updatedAt: Date.now() };
            }));
          } catch { /* skip */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        updateSession(currentId, {
          messages: [...allMessages, { role: "model", content: "⚠️ Không thể kết nối đến AI. Vui lòng thử lại." }],
        });
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [input, isStreaming, currentSession, currentId, tripContext]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const messages = currentSession?.messages ?? [];
  const lastMsg = messages[messages.length - 1];

  /* ─────────── Render ─────────── */

  return (
    <div className="flex flex-col h-full bg-background">

      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border shrink-0">
        {view !== "chat" ? (
          <button
            onClick={() => setView("chat")}
            className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => setView("history")}
            className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title="Lịch sử chat"
          >
            <History className="w-4 h-4" />
          </button>
        )}

        <div className="flex-1 flex items-center gap-2 min-w-0">
          <GeminiDiamond size={18} />
          <span className="text-sm font-medium text-foreground truncate">
            {view === "history" ? "Lịch sử chat" : view === "settings" ? "Cài đặt" : "Wandr AI"}
          </span>
        </div>

        {view === "chat" && (
          <>
            <button
              onClick={createNewSession}
              className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Cuộc trò chuyện mới"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={openSettings}
              className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Cài đặt"
            >
              <Settings className="w-4 h-4" />
            </button>
          </>
        )}

        {view === "settings" && (
          <button onClick={saveSettings} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium px-2 py-1 rounded-lg hover:bg-blue-50 transition-colors">
            <Check className="w-3.5 h-3.5" /> Lưu
          </button>
        )}
      </div>

      {/* ── History view ── */}
      {view === "history" && (
        <div className="flex-1 overflow-y-auto flex flex-col">
          {sessions.length > 1 && (
            <div className="px-4 py-2 border-b border-border/50 flex justify-end">
              <button
                onClick={() => {
                  const fresh = makeSession();
                  setSessions([fresh]);
                  setCurrentId(fresh.id);
                  setView("chat");
                }}
                className="text-xs text-red-500 hover:text-red-600 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-red-50 transition-colors"
              >
                <Trash2 className="w-3 h-3" /> Xóa tất cả
              </button>
            </div>
          )}
          {sessions.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">Chưa có cuộc trò chuyện nào</p>
          )}
          {[...sessions].reverse().map((s) => (
            <div
              key={s.id}
              onClick={() => switchSession(s.id)}
              className={`flex items-start gap-2.5 px-4 py-3 cursor-pointer hover:bg-muted/60 transition-colors border-b border-border/50 ${s.id === currentId ? "bg-blue-50/60" : ""}`}
            >
              <div className="mt-0.5"><GeminiDiamond size={14} /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate leading-tight">{s.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {s.messages.length} tin • {fmtDate(s.updatedAt)} • {MODELS.find((m) => m.id === s.model)?.label ?? s.model}
                </p>
              </div>
              {deletingId === s.id ? (
                <div className="flex gap-1 shrink-0">
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteSession(s.id); }}
                    className="p-1.5 rounded-lg bg-red-500 text-white hover:bg-red-600 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); setDeletingId(null); }}
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={(e) => { e.stopPropagation(); setDeletingId(s.id); }}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Settings view ── */}
      {view === "settings" && (
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
          <div>
            <label className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2 block">Mô hình AI</label>
            <div className="space-y-2">
              {MODELS.map((m) => (
                <button
                  key={m.id}
                  onClick={() => setDraftModel(m.id)}
                  className={`w-full flex items-start gap-3 p-3 rounded-xl border transition-all text-left ${
                    draftModel === m.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-border hover:border-blue-200 hover:bg-muted/50"
                  }`}
                >
                  <div className={`mt-0.5 w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${draftModel === m.id ? "border-blue-500" : "border-muted-foreground"}`}>
                    {draftModel === m.id && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{m.label}</p>
                    <p className="text-xs text-muted-foreground">{m.desc}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-foreground uppercase tracking-wide mb-2 block">
              Prompt tùy chỉnh
            </label>
            <textarea
              value={draftPrompt}
              onChange={(e) => setDraftPrompt(e.target.value)}
              placeholder="Thêm hướng dẫn riêng cho AI trong đoạn chat này... Ví dụ: 'Chỉ đề xuất địa điểm miễn phí' hoặc 'Tập trung vào ẩm thực đường phố'"
              rows={5}
              className="w-full text-sm border border-border rounded-xl px-3 py-2.5 bg-muted/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-blue-400 resize-none"
            />
          </div>

          <div className="rounded-xl bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">
              Các cài đặt này áp dụng cho cuộc trò chuyện hiện tại. Khi tạo chat mới, model mặc định sẽ được dùng.
            </p>
          </div>
        </div>
      )}

      {/* ── Chat view ── */}
      {view === "chat" && (
        <>
          <div className="flex-1 overflow-y-auto px-4 py-2 min-h-0">
            {messages.length === 0 && (
              <div className="py-8 text-center">
                <GeminiDiamond size={32} />
                <p className="mt-3 text-sm text-muted-foreground">
                  {tripContext?.tripName
                    ? `Tôi có thể giúp bạn lên kế hoạch cho chuyến đi **${tripContext.tripName}** 🌏`
                    : "Hỏi tôi về địa điểm, lịch trình, ẩm thực..."}
                </p>
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  {["Địa điểm nổi tiếng", "Ẩm thực đường phố", "Lịch trình 3 ngày"].map((q) => (
                    <button
                      key={q}
                      onClick={() => { setInput(q); setTimeout(() => inputRef.current?.focus(), 50); }}
                      className="text-xs px-3 py-1.5 rounded-full border border-border hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div key={i}>
                {msg.role === "user" ? (
                  <UserMessage content={msg.content} />
                ) : (msg.content || (msg.places?.length ?? 0) > 0) ? (
                  <AIMessage msg={msg} onAddPlace={(p) => onAddPlace?.(p)} onViewOnMap={onViewOnMap} />
                ) : null}
              </div>
            ))}

            {isStreaming && (lastMsg?.content === "" && (lastMsg?.places?.length ?? 0) === 0) && (
              <ThinkingIndicator />
            )}
            {isStreaming && lastMsg?.role === "user" && (
              <ThinkingIndicator />
            )}

            <div ref={messagesEndRef} />
          </div>

          <div className="shrink-0 px-4 pb-4 pt-2">
            <div className="rounded-2xl border border-border bg-muted/50 focus-within:border-blue-400/60 focus-within:bg-background transition-colors shadow-sm">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
                }}
                onKeyDown={handleKeyDown}
                placeholder="Hỏi Wandr AI..."
                rows={1}
                disabled={isStreaming}
                className="w-full resize-none bg-transparent text-sm text-foreground placeholder:text-muted-foreground px-4 pt-3 pb-1 focus:outline-none min-h-[42px] max-h-[120px]"
                style={{ scrollbarWidth: "none" }}
              />
              <div className="flex items-center justify-between px-3 pb-2 pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-medium text-muted-foreground border border-border rounded px-1.5 py-0.5">
                    {MODELS.find((m) => m.id === currentSession.model)?.label?.split(" ").slice(0, 2).join(" ") ?? "Beta"}
                  </span>
                </div>
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || isStreaming}
                  className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              Wandr AI có thể mắc lỗi. Hãy kiểm tra thông tin quan trọng.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
