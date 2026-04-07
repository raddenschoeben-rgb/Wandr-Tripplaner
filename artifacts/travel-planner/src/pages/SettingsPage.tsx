import { useState } from "react";
import { useUser, useClerk } from "@clerk/react";
import { useLocation } from "wouter";
import { Settings, LogOut, User, DollarSign, ChevronLeft, Check, Tag, Plus, Pencil, Trash2, X, Car, Key, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCurrency, CURRENCIES, type Currency } from "@/context/CurrencyContext";
import {
  useListTags,
  useCreateTag,
  useUpdateTag,
  useDeleteTag,
  useListTransportModes,
  useCreateTransportMode,
  useUpdateTransportMode,
  useDeleteTransportMode,
} from "@workspace/api-client-react";
import { SUGGESTED_ICONS, getTagIcon } from "@/lib/tag-icons";

const TAG_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308",
  "#22c55e", "#14b8a6", "#3b82f6", "#6366f1",
  "#a855f7", "#ec4899", "#64748b", "#0ea5e9",
];

const TRANSPORT_ICONS = ["🚶", "🏍️", "🚗", "🚕", "🚌", "🚂", "🚢", "✈️", "🛺", "🚁", "🚲", "🛵", "⛵", "🚤", "🚃", "🚞"];

export default function SettingsPage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  const { currency, setCurrency } = useCurrency();

  const { data: tags = [] } = useListTags();
  const createTagMutation = useCreateTag();
  const updateTagMutation = useUpdateTag();
  const deleteTagMutation = useDeleteTag();

  const [newTagName, setNewTagName] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[6]);
  const [newTagIcon, setNewTagIcon] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [editColor, setEditColor] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [showNewIconPicker, setShowNewIconPicker] = useState(false);
  const [showEditIconPicker, setShowEditIconPicker] = useState(false);

  const { data: transportModes = [] } = useListTransportModes();
  const createTransportModeMutation = useCreateTransportMode();
  const updateTransportModeMutation = useUpdateTransportMode();
  const deleteTransportModeMutation = useDeleteTransportMode();

  const [newModeName, setNewModeName] = useState("");
  const [newModeIcon, setNewModeIcon] = useState("🚗");
  const [showNewModeIconPicker, setShowNewModeIconPicker] = useState(false);
  const [editingModeId, setEditingModeId] = useState<number | null>(null);
  const [editModeName, setEditModeName] = useState("");
  const [editModeIcon, setEditModeIcon] = useState("");
  const [showEditModeIconPicker, setShowEditModeIconPicker] = useState(false);

  const [mapboxToken, setMapboxToken] = useState(localStorage.getItem("user_mapbox_token") ?? "");
  const [geminiKey, setGeminiKey] = useState(localStorage.getItem("user_gemini_api_key") ?? "");
  const [showMapboxToken, setShowMapboxToken] = useState(false);
  const [showGeminiKey, setShowGeminiKey] = useState(false);
  const [savedMapbox, setSavedMapbox] = useState(!!localStorage.getItem("user_mapbox_token"));
  const [savedGemini, setSavedGemini] = useState(!!localStorage.getItem("user_gemini_api_key"));

  function saveMapboxToken() {
    if (mapboxToken.trim()) {
      localStorage.setItem("user_mapbox_token", mapboxToken.trim());
    } else {
      localStorage.removeItem("user_mapbox_token");
    }
    setSavedMapbox(!!mapboxToken.trim());
  }

  function saveGeminiKey() {
    if (geminiKey.trim()) {
      localStorage.setItem("user_gemini_api_key", geminiKey.trim());
    } else {
      localStorage.removeItem("user_gemini_api_key");
    }
    setSavedGemini(!!geminiKey.trim());
  }

  function clearMapboxToken() {
    localStorage.removeItem("user_mapbox_token");
    setMapboxToken("");
    setSavedMapbox(false);
  }

  function clearGeminiKey() {
    localStorage.removeItem("user_gemini_api_key");
    setGeminiKey("");
    setSavedGemini(false);
  }

  async function handleCreateTransportMode() {
    if (!newModeName.trim()) return;
    await createTransportModeMutation.mutateAsync({ name: newModeName.trim(), icon: newModeIcon, color: "#6366f1" });
    setNewModeName("");
    setNewModeIcon("🚗");
    setShowNewModeIconPicker(false);
  }

  function startEditMode(mode: { id: number; name: string; icon: string }) {
    setEditingModeId(mode.id);
    setEditModeName(mode.name);
    setEditModeIcon(mode.icon);
    setShowEditModeIconPicker(false);
  }

  async function handleUpdateTransportMode() {
    if (!editingModeId || !editModeName.trim()) return;
    await updateTransportModeMutation.mutateAsync({ id: editingModeId, body: { name: editModeName.trim(), icon: editModeIcon } });
    setEditingModeId(null);
  }

  async function handleDeleteTransportMode(id: number) {
    await deleteTransportModeMutation.mutateAsync(id);
    if (editingModeId === id) setEditingModeId(null);
  }

  async function handleLogout() {
    await signOut();
    setLocation("/");
  }

  async function handleCreateTag() {
    if (!newTagName.trim()) return;
    await createTagMutation.mutateAsync({
      name: newTagName.trim(),
      color: newTagColor,
      icon: newTagIcon || undefined,
    });
    setNewTagName("");
    setNewTagColor(TAG_COLORS[6]);
    setNewTagIcon("");
    setShowNewIconPicker(false);
  }

  function startEdit(tag: { id: number; name: string; color: string; icon?: string | null }) {
    setEditingId(tag.id);
    setEditName(tag.name);
    setEditColor(tag.color);
    setEditIcon(tag.icon ?? "");
    setShowEditIconPicker(false);
  }

  async function handleUpdateTag() {
    if (!editingId || !editName.trim()) return;
    await updateTagMutation.mutateAsync({
      id: editingId,
      body: { name: editName.trim(), color: editColor, icon: editIcon || undefined },
    });
    setEditingId(null);
  }

  async function handleDeleteTag(id: number) {
    await deleteTagMutation.mutateAsync(id);
    if (editingId === id) setEditingId(null);
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <button
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setLocation("/trips")}
          >
            <ChevronLeft className="w-4 h-4" />
            Quay lại
          </button>
        </div>

        <div className="flex items-center gap-2 mb-8">
          <Settings className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Cài đặt</h1>
        </div>

        {/* Account Info */}
        <section className="mb-6">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
            Tài khoản
          </h2>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {isLoaded && user ? (
              <div className="p-5 flex items-center gap-4">
                {user.imageUrl ? (
                  <img
                    src={user.imageUrl}
                    alt={user.fullName ?? "Avatar"}
                    className="w-14 h-14 rounded-full object-cover border-2 border-primary/20"
                  />
                ) : (
                  <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <User className="w-7 h-7 text-primary" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-base">
                    {user.fullName ?? user.username ?? "Người dùng"}
                  </p>
                  <p className="text-sm text-muted-foreground mt-0.5 truncate">
                    {user.primaryEmailAddress?.emailAddress}
                  </p>
                  <div className="flex items-center gap-1.5 mt-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                    <span className="text-xs text-muted-foreground">Đã đăng nhập qua Google</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-5 flex items-center gap-3">
                <div className="w-14 h-14 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded animate-pulse w-32" />
                  <div className="h-3 bg-muted rounded animate-pulse w-48" />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Tags management */}
        <section className="mb-6">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5" />
            Quản lý tag
          </h2>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {/* Existing tags */}
            {tags.length > 0 && (
              <div className="divide-y divide-border">
                {tags.map((tag) => (
                  <div key={tag.id} className="px-4 py-3">
                    {editingId === tag.id ? (
                      /* Edit mode */
                      <div className="space-y-2.5">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleUpdateTag()}
                          className="w-full text-sm border border-border rounded-md px-3 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          autoFocus
                        />
                        <div className="flex flex-wrap gap-1.5">
                          {TAG_COLORS.map((color) => (
                            <button
                              key={color}
                              onClick={() => setEditColor(color)}
                              style={{ background: color }}
                              className="w-6 h-6 rounded-full transition-transform hover:scale-110 flex items-center justify-center"
                            >
                              {editColor === color && (
                                <Check className="w-3.5 h-3.5 text-white drop-shadow" />
                              )}
                            </button>
                          ))}
                        </div>
                        {/* Icon picker */}
                        <div>
                          <button
                            onClick={() => setShowEditIconPicker((v) => !v)}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <span className="text-base">{editIcon || getTagIcon({ name: editName, icon: null })}</span>
                            <span>Chọn icon {showEditIconPicker ? "▲" : "▼"}</span>
                          </button>
                          {showEditIconPicker && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {SUGGESTED_ICONS.map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => { setEditIcon(emoji); setShowEditIconPicker(false); }}
                                  className={`text-lg w-8 h-8 flex items-center justify-center rounded hover:bg-muted transition-colors ${editIcon === emoji ? "bg-primary/10 ring-1 ring-primary" : ""}`}
                                >
                                  {emoji}
                                </button>
                              ))}
                              {editIcon && (
                                <button
                                  onClick={() => setEditIcon("")}
                                  className="text-xs px-2 h-8 rounded hover:bg-muted text-muted-foreground transition-colors"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleUpdateTag} disabled={updateTagMutation.isPending} className="text-xs h-7 px-3">
                            Lưu
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="text-xs h-7 px-3">
                            Huỷ
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* Display mode */
                      <div className="flex items-center gap-3">
                        <span className="text-xl shrink-0">{getTagIcon(tag)}</span>
                        <span
                          style={{ background: tag.color + "22", color: tag.color, borderColor: tag.color + "55" }}
                          className="text-xs font-medium px-2.5 py-1 rounded-full border flex-1 max-w-fit"
                        >
                          {tag.name}
                        </span>
                        <div className="w-3.5 h-3.5 rounded-full shrink-0" style={{ background: tag.color }} />
                        <div className="ml-auto flex items-center gap-1">
                          <button
                            onClick={() => startEdit(tag)}
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTag(tag.id)}
                            disabled={deleteTagMutation.isPending}
                            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Create new tag */}
            <div className="px-4 py-3 border-t border-border bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground mb-2">Tạo tag mới</p>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  placeholder="Tên tag..."
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateTag()}
                  className="flex-1 text-sm border border-border rounded-md px-3 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={handleCreateTag}
                  disabled={!newTagName.trim() || createTagMutation.isPending}
                  className="px-3 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Thêm
                </button>
              </div>
              {/* Color picker */}
              <div className="flex flex-wrap gap-1.5 items-center mb-2">
                {TAG_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewTagColor(color)}
                    style={{ background: color }}
                    className="w-6 h-6 rounded-full transition-transform hover:scale-110 flex items-center justify-center"
                  >
                    {newTagColor === color && (
                      <Check className="w-3.5 h-3.5 text-white drop-shadow" />
                    )}
                  </button>
                ))}
              </div>
              {/* Icon picker */}
              <div className="mb-2">
                <button
                  onClick={() => setShowNewIconPicker((v) => !v)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span className="text-base">
                    {newTagIcon || (newTagName ? getTagIcon({ name: newTagName, icon: null }) : "📍")}
                  </span>
                  <span>Chọn icon {showNewIconPicker ? "▲" : "▼"}</span>
                </button>
                {showNewIconPicker && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {SUGGESTED_ICONS.map((emoji) => (
                      <button
                        key={emoji}
                        onClick={() => { setNewTagIcon(emoji); setShowNewIconPicker(false); }}
                        className={`text-lg w-8 h-8 flex items-center justify-center rounded hover:bg-muted transition-colors ${newTagIcon === emoji ? "bg-primary/10 ring-1 ring-primary" : ""}`}
                      >
                        {emoji}
                      </button>
                    ))}
                    {newTagIcon && (
                      <button
                        onClick={() => setNewTagIcon("")}
                        className="text-xs px-2 h-8 rounded hover:bg-muted text-muted-foreground transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
              {/* Preview */}
              {newTagName.trim() && (
                <div className="mt-2">
                  <span
                    style={{ background: newTagColor + "22", color: newTagColor, borderColor: newTagColor + "55" }}
                    className="text-xs font-medium px-2.5 py-1 rounded-full border inline-flex items-center gap-1"
                  >
                    <span>{newTagIcon || getTagIcon({ name: newTagName, icon: null })}</span>
                    {newTagName.trim()}
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Transport Modes management */}
        <section className="mb-6">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1 flex items-center gap-1.5">
            <Car className="w-3.5 h-3.5" />
            Phương tiện di chuyển
          </h2>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {transportModes.length > 0 && (
              <div className="divide-y divide-border">
                {transportModes.map((mode) => (
                  <div key={mode.id} className="px-4 py-3">
                    {editingModeId === mode.id ? (
                      <div className="space-y-2.5">
                        <div className="flex gap-2">
                          <span className="text-xl w-9 h-9 flex items-center justify-center bg-muted rounded-md shrink-0">{editModeIcon}</span>
                          <input
                            type="text"
                            value={editModeName}
                            onChange={(e) => setEditModeName(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleUpdateTransportMode()}
                            className="flex-1 text-sm border border-border rounded-md px-3 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                            autoFocus
                          />
                        </div>
                        <div>
                          <button
                            onClick={() => setShowEditModeIconPicker((v) => !v)}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <span>Chọn icon {showEditModeIconPicker ? "▲" : "▼"}</span>
                          </button>
                          {showEditModeIconPicker && (
                            <div className="mt-1.5 flex flex-wrap gap-1">
                              {TRANSPORT_ICONS.map((emoji) => (
                                <button
                                  key={emoji}
                                  onClick={() => { setEditModeIcon(emoji); setShowEditModeIconPicker(false); }}
                                  className={`text-lg w-8 h-8 flex items-center justify-center rounded hover:bg-muted transition-colors ${editModeIcon === emoji ? "bg-primary/10 ring-1 ring-primary" : ""}`}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={handleUpdateTransportMode} disabled={updateTransportModeMutation.isPending} className="text-xs h-7 px-3">
                            Lưu
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingModeId(null)} className="text-xs h-7 px-3">
                            Huỷ
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3">
                        <span className="text-xl shrink-0">{mode.icon}</span>
                        <span className="text-sm text-foreground flex-1">{mode.name}</span>
                        <div className="ml-auto flex items-center gap-1">
                          <button
                            onClick={() => startEditMode(mode)}
                            className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteTransportMode(mode.id)}
                            disabled={deleteTransportModeMutation.isPending}
                            className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="px-4 py-3 border-t border-border bg-muted/30">
              <p className="text-xs font-medium text-muted-foreground mb-2">Thêm phương tiện mới</p>
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => setShowNewModeIconPicker((v) => !v)}
                  className="w-9 h-9 text-xl flex items-center justify-center bg-background border border-border rounded-md hover:bg-muted transition-colors shrink-0"
                >
                  {newModeIcon}
                </button>
                <input
                  type="text"
                  placeholder="Tên phương tiện..."
                  value={newModeName}
                  onChange={(e) => setNewModeName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleCreateTransportMode()}
                  className="flex-1 text-sm border border-border rounded-md px-3 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <button
                  onClick={handleCreateTransportMode}
                  disabled={!newModeName.trim() || createTransportModeMutation.isPending}
                  className="px-3 py-1.5 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-1.5 shrink-0"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Thêm
                </button>
              </div>
              {showNewModeIconPicker && (
                <div className="flex flex-wrap gap-1">
                  {TRANSPORT_ICONS.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => { setNewModeIcon(emoji); setShowNewModeIconPicker(false); }}
                      className={`text-lg w-8 h-8 flex items-center justify-center rounded hover:bg-muted transition-colors ${newModeIcon === emoji ? "bg-primary/10 ring-1 ring-primary" : ""}`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {/* API Keys */}
        <section className="mb-6">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1 flex items-center gap-1.5">
            <Key className="w-3.5 h-3.5" />
            Cài đặt API Key
          </h2>
          <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
            {/* Mapbox Token */}
            <div className="px-4 py-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-foreground">Mapbox Token</p>
                {savedMapbox && (
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Đã lưu
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-2.5">
                Dùng để hiển thị bản đồ. Lấy tại{" "}
                <a href="https://account.mapbox.com" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
                  mapbox.com
                </a>
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showMapboxToken ? "text" : "password"}
                    placeholder="pk.eyJ1..."
                    value={mapboxToken}
                    onChange={(e) => setMapboxToken(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveMapboxToken()}
                    className="w-full text-sm border border-border rounded-md px-3 py-1.5 pr-9 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowMapboxToken((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showMapboxToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <Button size="sm" onClick={saveMapboxToken} className="text-xs h-8 px-3 shrink-0">
                  Lưu
                </Button>
                {savedMapbox && (
                  <button
                    onClick={clearMapboxToken}
                    className="p-2 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Gemini API Key */}
            <div className="px-4 py-4">
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-foreground">Gemini API Key</p>
                {savedGemini && (
                  <span className="text-xs text-green-600 flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    Đã lưu
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mb-2.5">
                Dùng cho tính năng AI chat. Lấy tại{" "}
                <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="text-primary underline underline-offset-2">
                  Google AI Studio
                </a>
              </p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showGeminiKey ? "text" : "password"}
                    placeholder="AIza..."
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && saveGeminiKey()}
                    className="w-full text-sm border border-border rounded-md px-3 py-1.5 pr-9 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowGeminiKey((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showGeminiKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <Button size="sm" onClick={saveGeminiKey} className="text-xs h-8 px-3 shrink-0">
                  Lưu
                </Button>
                {savedGemini && (
                  <button
                    onClick={clearGeminiKey}
                    className="p-2 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2 px-1">
            Key được lưu trên trình duyệt của bạn và không gửi lên server.
          </p>
        </section>

        {/* Currency */}
        <section className="mb-6">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1 flex items-center gap-1.5">
            <DollarSign className="w-3.5 h-3.5" />
            Đơn vị tiền tệ
          </h2>
          <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
            {CURRENCIES.map((c) => (
              <button
                key={c.code}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-accent transition-colors text-left"
                onClick={() => setCurrency(c.code as Currency)}
              >
                <div className="flex items-center gap-3">
                  <span className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-sm font-bold text-foreground">
                    {c.symbol}
                  </span>
                  <span className="text-sm text-foreground">{c.label}</span>
                </div>
                {currency === c.code && (
                  <Check className="w-4 h-4 text-primary" />
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Logout */}
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
            Khác
          </h2>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 px-5 py-4 h-auto text-destructive hover:text-destructive hover:bg-destructive/5 rounded-none"
              onClick={handleLogout}
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium">Đăng xuất</span>
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
