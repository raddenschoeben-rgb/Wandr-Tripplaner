import { useEffect, useState } from "react";
import { Plus, Trash2, UserPlus, Mail, Shield, Eye, Pencil, Link, Check, Copy } from "lucide-react";
import { useShares, type Permission } from "@/hooks/useShares";
import { useToast } from "@/hooks/use-toast";

interface ShareModalProps {
  tripId: number;
  tripName: string;
  onClose: () => void;
}

export default function ShareModal({ tripId, tripName, onClose }: ShareModalProps) {
  const { shares, loading, fetchShares, addShare, updateShare, removeShare } = useShares(tripId);
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [permission, setPermission] = useState<Permission>("view");
  const [adding, setAdding] = useState(false);
  const [copied, setCopied] = useState(false);

  const shareUrl = window.location.href.split("?")[0];

  useEffect(() => {
    fetchShares();
  }, [fetchShares]);

  function handleCopyLink() {
    navigator.clipboard.writeText(shareUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast({ title: "Email không hợp lệ", variant: "destructive" });
      return;
    }
    setAdding(true);
    try {
      await addShare(trimmed, permission);
      toast({ title: `Đã chia sẻ với ${trimmed}` });
      setEmail("");
    } catch {
      toast({ title: "Lỗi khi chia sẻ", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  }

  async function handleRemove(shareId: number, sharedEmail: string) {
    await removeShare(shareId);
    toast({ title: `Đã xóa quyền truy cập của ${sharedEmail}` });
  }

  async function handlePermissionChange(shareId: number, newPerm: Permission) {
    try {
      await updateShare(shareId, newPerm);
    } catch {
      toast({ title: "Lỗi khi cập nhật quyền", variant: "destructive" });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md mx-4 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-foreground">Chia sẻ kế hoạch</h2>
              <p className="text-xs text-muted-foreground">{tripName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <Plus className="w-4 h-4 rotate-45" />
          </button>
        </div>

        {/* Copy link section */}
        <div className="px-5 py-4 border-b border-border bg-muted/30">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Link className="w-3 h-3" />
            Chia sẻ qua link
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-background border border-border rounded-lg px-3 py-2 text-xs text-muted-foreground truncate select-all cursor-text">
              {shareUrl}
            </div>
            <button
              onClick={handleCopyLink}
              className={`shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border transition-all ${
                copied
                  ? "bg-green-50 border-green-200 text-green-700 dark:bg-green-950 dark:border-green-800 dark:text-green-400"
                  : "bg-background border-border text-foreground hover:bg-muted"
              }`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Đã sao chép" : "Sao chép"}
            </button>
          </div>
        </div>

        {/* Add email form */}
        <div className="p-5 border-b border-border">
          <form onSubmit={handleAdd} className="space-y-3">
            <div>
              <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Email người dùng
              </label>
              <div className="flex gap-2 mt-1.5">
                <div className="relative flex-1">
                  <Mail className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full text-sm border border-border rounded-lg pl-8 pr-3 py-2 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                <select
                  value={permission}
                  onChange={(e) => setPermission(e.target.value as Permission)}
                  className="text-sm border border-border rounded-lg px-2.5 py-2 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="view">Xem</option>
                  <option value="edit">Chỉnh sửa</option>
                </select>
              </div>
            </div>
            <button
              type="submit"
              disabled={adding || !email.trim()}
              className="w-full bg-primary text-primary-foreground text-sm font-medium py-2 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
            >
              {adding ? (
                <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Đang thêm...</>
              ) : (
                <><UserPlus className="w-3.5 h-3.5" />Thêm người dùng</>
              )}
            </button>
          </form>
        </div>

        {/* Shares list */}
        <div className="flex-1 overflow-y-auto max-h-72">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : shares.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center px-4">
              <Shield className="w-8 h-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">Chưa chia sẻ với ai</p>
              <p className="text-xs text-muted-foreground/60 mt-0.5">Thêm email ở trên để bắt đầu</p>
            </div>
          ) : (
            <ul className="p-3 space-y-1.5">
              {shares.map((share) => (
                <li
                  key={share.id}
                  className="flex items-center gap-3 bg-muted/40 rounded-lg px-3 py-2.5"
                >
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary uppercase">
                      {share.sharedWithEmail[0]}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{share.sharedWithEmail}</p>
                  </div>
                  <select
                    value={share.permission}
                    onChange={(e) => handlePermissionChange(share.id, e.target.value as Permission)}
                    className="text-xs border border-border rounded-md px-1.5 py-1 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value="view">👁 Xem</option>
                    <option value="edit">✏️ Sửa</option>
                  </select>
                  <button
                    onClick={() => handleRemove(share.id, share.sharedWithEmail)}
                    className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border bg-muted/30">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Eye className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span><strong className="text-foreground">Xem</strong> — có thể xem lịch trình, không thể chỉnh sửa</span>
          </div>
          <div className="flex items-start gap-2 text-xs text-muted-foreground mt-1">
            <Pencil className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <span><strong className="text-foreground">Chỉnh sửa</strong> — có thể thêm, xóa, sắp xếp địa điểm</span>
          </div>
        </div>
      </div>
    </div>
  );
}
