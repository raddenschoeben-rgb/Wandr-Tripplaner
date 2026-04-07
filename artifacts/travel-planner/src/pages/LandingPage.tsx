import { useLocation } from "wouter";

export default function LandingPage() {
  const [, setLocation] = useLocation();

  const goSignUp = () => setLocation("/sign-up");
  const goSignIn = () => setLocation("/sign-in");

  return (
    <div className="min-h-screen bg-background text-foreground overflow-y-auto">
      {/* Landing Navbar */}
      <header className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="w-6 h-6 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
              <path d="M2 12h20"/>
            </svg>
            <span className="font-semibold text-base tracking-tight text-foreground">Wandr</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={goSignIn}
              className="px-4 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Đăng nhập
            </button>
            <button
              onClick={goSignUp}
              className="px-4 py-1.5 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Bắt đầu miễn phí
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative max-w-6xl mx-auto px-5 pt-20 pb-20 flex flex-col lg:flex-row items-center gap-12">
        {/* Background decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full opacity-[0.07]" style={{ background: "hsl(214 80% 32%)" }} />
          <div className="absolute top-1/2 -left-16 w-64 h-64 rounded-full opacity-[0.05]" style={{ background: "hsl(33 60% 60%)" }} />
        </div>

        {/* Left: Text */}
        <div className="flex-1 text-center lg:text-left z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border border-border bg-card text-muted-foreground mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block animate-pulse" />
            Miễn phí hoàn toàn · Không cần thẻ tín dụng
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight mb-5">
            Lên kế hoạch<br />
            <span style={{ color: "hsl(214 80% 32%)" }}>chuyến đi</span> của bạn<br />
            thông minh hơn
          </h1>
          <p className="text-lg text-muted-foreground max-w-md mx-auto lg:mx-0 mb-8 leading-relaxed">
            Wandr giúp bạn tổ chức lịch trình theo từng ngày, quản lý ngân sách, khám phá địa điểm và nhận gợi ý từ AI — tất cả trong một nơi.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
            <button
              onClick={goSignUp}
              className="px-7 py-3 rounded-xl font-semibold text-base text-primary-foreground transition-all hover:opacity-90 hover:shadow-lg shadow-md"
              style={{ background: "hsl(214 80% 32%)" }}
            >
              Bắt đầu miễn phí →
            </button>
            <button
              onClick={goSignIn}
              className="px-7 py-3 rounded-xl font-medium text-base border border-border bg-card text-foreground hover:bg-accent transition-colors"
            >
              Đã có tài khoản? Đăng nhập
            </button>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Đăng ký trong 10 giây với tài khoản Google</p>
        </div>

        {/* Right: UI Mockup */}
        <div className="flex-1 w-full max-w-lg z-10">
          <AppMockup />
        </div>
      </section>

      {/* Features Section */}
      <section className="bg-card border-y border-border py-20">
        <div className="max-w-6xl mx-auto px-5">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Mọi thứ bạn cần cho chuyến đi</h2>
            <p className="text-muted-foreground text-base max-w-xl mx-auto">Từ ý tưởng đến thực hiện — Wandr đồng hành cùng bạn ở mỗi bước.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <FeatureCard
              icon={<CalendarIcon />}
              color="hsl(214 80% 32%)"
              bgColor="hsl(214 80% 32% / 0.08)"
              title="Lịch trình theo ngày"
              description="Sắp xếp từng hoạt động theo giờ, kéo thả để sắp xếp lại. Hiển thị lộ trình trên bản đồ tương tác."
            />
            <FeatureCard
              icon={<AIIcon />}
              color="hsl(280 60% 55%)"
              bgColor="hsl(280 60% 55% / 0.08)"
              title="Wandr AI"
              description="Trò chuyện với AI được hỗ trợ bởi Google Gemini. Nhận gợi ý địa điểm, nhà hàng, hoạt động phù hợp."
            />
            <FeatureCard
              icon={<WalletIcon />}
              color="hsl(33 80% 45%)"
              bgColor="hsl(33 80% 45% / 0.08)"
              title="Quản lý ngân sách"
              description="Theo dõi chi phí theo danh mục, xem biểu đồ phân tích, tính toán trung bình mỗi ngày tự động."
            />
            <FeatureCard
              icon={<MapPinIcon />}
              color="hsl(160 60% 38%)"
              bgColor="hsl(160 60% 38% / 0.08)"
              title="Khám phá địa điểm"
              description="Tìm kiếm địa điểm toàn cầu, xem thông tin từ Wikipedia, lưu địa điểm yêu thích của bạn."
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 max-w-6xl mx-auto px-5">
        <div className="text-center mb-14">
          <h2 className="text-3xl font-bold mb-3">Chỉ 3 bước đơn giản</h2>
          <p className="text-muted-foreground">Từ ý tưởng đến hành lý — nhanh hơn bạn nghĩ.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
          {/* Connector line */}
          <div className="hidden md:block absolute top-10 left-1/3 right-1/3 h-px" style={{ background: "hsl(214 80% 32% / 0.2)" }} />
          <StepCard
            step="01"
            title="Tạo chuyến đi"
            description="Đặt tên, chọn điểm đến, ngày đi và ngân sách dự kiến. Xong trong 30 giây."
          />
          <StepCard
            step="02"
            title="Lên kế hoạch cùng AI"
            description="Chat với Wandr AI để nhận gợi ý địa điểm, xây dựng lịch trình chi tiết từng ngày."
          />
          <StepCard
            step="03"
            title="Xuất phát thôi!"
            description="Lịch trình trong tay, bản đồ luôn sẵn sàng. Tận hưởng chuyến đi không lo lắng."
          />
        </div>
      </section>

      {/* AI Spotlight */}
      <section className="py-20 border-y border-border" style={{ background: "linear-gradient(135deg, hsl(214 80% 32% / 0.04) 0%, hsl(280 60% 55% / 0.04) 100%)" }}>
        <div className="max-w-6xl mx-auto px-5 flex flex-col lg:flex-row items-center gap-12">
          <div className="flex-1 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium border mb-5" style={{ borderColor: "hsl(280 60% 55% / 0.3)", color: "hsl(280 60% 45%)", background: "hsl(280 60% 55% / 0.06)" }}>
              <GeminiIcon className="w-3.5 h-3.5" />
              Powered by Google Gemini
            </div>
            <h2 className="text-3xl font-bold mb-4">
              Trợ lý AI hiểu<br />
              <span style={{ color: "hsl(280 60% 50%)" }}>đam mê du lịch</span> của bạn
            </h2>
            <p className="text-muted-foreground leading-relaxed mb-6 max-w-md mx-auto lg:mx-0">
              Wandr AI không chỉ đưa ra danh sách — nó hiểu sở thích của bạn, gợi ý địa điểm phù hợp và thậm chí tạo thẻ địa điểm ngay trong chat để bạn thêm vào lịch trình một cú click.
            </p>
            <ul className="space-y-3 text-sm text-muted-foreground max-w-md mx-auto lg:mx-0">
              {[
                "Gợi ý nhà hàng, khách sạn, điểm tham quan",
                "Tạo lịch trình chi tiết theo ngày",
                "Trả lời câu hỏi về địa điểm, văn hóa, thời tiết",
                "Thêm địa điểm vào chuyến đi ngay trong chat",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2.5">
                  <svg className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "hsl(280 60% 50%)" }} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* AI Chat Mockup */}
          <div className="flex-1 w-full max-w-md">
            <AIChatMockup />
          </div>
        </div>
      </section>

      {/* Social Proof / Stats */}
      <section className="py-16 max-w-6xl mx-auto px-5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { num: "Miễn phí", label: "Mãi mãi" },
            { num: "AI", label: "Google Gemini" },
            { num: "Maps", label: "Mapbox" },
            { num: "∞", label: "Chuyến đi" },
          ].map(({ num, label }) => (
            <div key={label} className="py-6 px-4 rounded-xl bg-card border border-border">
              <div className="text-2xl font-bold text-foreground mb-1">{num}</div>
              <div className="text-sm text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-5">
        <div className="max-w-2xl mx-auto text-center rounded-2xl p-12 shadow-xl" style={{ background: "linear-gradient(135deg, hsl(214 80% 32%) 0%, hsl(214 80% 24%) 100%)" }}>
          <div className="text-4xl mb-4">✈️</div>
          <h2 className="text-3xl font-bold text-white mb-3">Sẵn sàng cho chuyến đi tiếp theo?</h2>
          <p className="text-white/70 mb-8 text-base">
            Tham gia ngay hôm nay — hoàn toàn miễn phí. Không cần thẻ tín dụng.
          </p>
          <button
            onClick={goSignUp}
            className="px-8 py-3.5 rounded-xl font-semibold text-base bg-white hover:bg-white/90 transition-colors shadow-md"
            style={{ color: "hsl(214 80% 28%)" }}
          >
            Bắt đầu lên kế hoạch →
          </button>
          <p className="mt-4 text-white/50 text-xs">Đăng ký với Google trong 10 giây</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-8 px-5">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/>
              <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
              <path d="M2 12h20"/>
            </svg>
            <span className="font-medium text-foreground">Wandr</span>
            <span>— Ứng dụng lên kế hoạch du lịch thông minh</span>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={goSignIn} className="hover:text-foreground transition-colors">Đăng nhập</button>
            <button onClick={goSignUp} className="hover:text-foreground transition-colors">Đăng ký</button>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  color,
  bgColor,
  title,
  description,
}: {
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl p-6 border border-border bg-background hover:shadow-md transition-shadow">
      <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4" style={{ background: bgColor }}>
        <div style={{ color }}>{icon}</div>
      </div>
      <h3 className="font-semibold text-base mb-2 text-foreground">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
    </div>
  );
}

function StepCard({ step, title, description }: { step: string; title: string; description: string }) {
  return (
    <div className="text-center relative">
      <div className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-md" style={{ background: "hsl(214 80% 32%)" }}>
        <span className="text-3xl font-bold text-white/30">{step}</span>
      </div>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">{description}</p>
    </div>
  );
}

function AppMockup() {
  return (
    <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-border bg-card" style={{ aspectRatio: "4/3" }}>
      {/* Mock header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card">
        <div className="flex gap-1.5">
          <div className="w-3 h-3 rounded-full bg-red-400/70" />
          <div className="w-3 h-3 rounded-full bg-yellow-400/70" />
          <div className="w-3 h-3 rounded-full bg-green-400/70" />
        </div>
        <div className="flex-1 h-5 rounded-md bg-muted/60 mx-2" />
        <div className="w-6 h-6 rounded-full bg-primary/20" />
      </div>
      {/* Mock content */}
      <div className="flex h-full">
        {/* Sidebar */}
        <div className="w-2/5 border-r border-border p-3 flex flex-col gap-2 bg-card">
          <div className="text-xs font-medium text-muted-foreground mb-1 px-1">My Trips</div>
          {["Tokyo 2025", "Đà Lạt tháng 3", "Singapore 5N"].map((t, i) => (
            <div
              key={t}
              className="rounded-lg p-2.5 flex items-center gap-2"
              style={{ background: i === 0 ? "hsl(214 80% 32% / 0.1)" : "hsl(214 20% 96%)" }}
            >
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm" style={{ background: i === 0 ? "hsl(214 80% 32% / 0.15)" : "hsl(214 20% 92%)" }}>
                {["🗼", "🌸", "🦁"][i]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium truncate text-foreground">{t}</div>
                <div className="text-[10px] text-muted-foreground">{["7 ngày", "4 ngày", "5 ngày"][i]}</div>
              </div>
            </div>
          ))}
          <div className="mt-auto rounded-lg p-2.5 border border-dashed border-border flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <span className="text-base leading-none">+</span> Thêm chuyến đi
          </div>
        </div>
        {/* Map area */}
        <div className="flex-1 relative overflow-hidden" style={{ background: "linear-gradient(135deg, hsl(210 30% 88%) 0%, hsl(214 40% 80%) 100%)" }}>
          {/* Fake map grid */}
          <svg className="absolute inset-0 w-full h-full opacity-20" viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice">
            {[20, 40, 60, 80, 100, 120, 140].map(y => <line key={`h${y}`} x1="0" y1={y} x2="200" y2={y} stroke="hsl(214 80% 32%)" strokeWidth="0.5" />)}
            {[25, 50, 75, 100, 125, 150, 175].map(x => <line key={`v${x}`} x1={x} y1="0" x2={x} y2="150" stroke="hsl(214 80% 32%)" strokeWidth="0.5" />)}
          </svg>
          {/* Fake route */}
          <svg className="absolute inset-0 w-full h-full" viewBox="0 0 200 150" preserveAspectRatio="xMidYMid slice">
            <path d="M 60 90 Q 80 60 110 70 Q 130 75 150 55" stroke="hsl(214 80% 32%)" strokeWidth="2" fill="none" strokeDasharray="4 2" strokeLinecap="round" />
            <circle cx="60" cy="90" r="5" fill="hsl(214 80% 32%)" />
            <circle cx="110" cy="70" r="5" fill="hsl(33 70% 55%)" />
            <circle cx="150" cy="55" r="5" fill="hsl(160 60% 40%)" />
          </svg>
          {/* Mock location card */}
          <div className="absolute bottom-3 right-3 bg-white rounded-xl shadow-lg p-2.5 w-28 text-[10px]">
            <div className="font-semibold text-foreground mb-0.5">Sensoji Temple</div>
            <div className="text-muted-foreground">Tokyo, Japan</div>
            <div className="mt-1.5 flex gap-1">
              <div className="flex-1 rounded py-0.5 text-center font-medium text-white" style={{ background: "hsl(214 80% 32%)", fontSize: "9px" }}>Lưu</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AIChatMockup() {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <div className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, hsl(280 60% 55%) 0%, hsl(214 80% 50%) 100%)" }}>
          <GeminiIcon className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="text-sm font-semibold">Wandr AI</div>
          <div className="text-[10px] text-muted-foreground">Powered by Gemini</div>
        </div>
        <div className="ml-auto w-2 h-2 rounded-full bg-green-500" />
      </div>
      <div className="p-4 space-y-3 text-sm">
        <ChatBubble role="user" text="Gợi ý cho mình vài địa điểm không nên bỏ qua ở Tokyo?" />
        <ChatBubble
          role="ai"
          text="Tất nhiên! Đây là 3 địa điểm bạn không nên bỏ lỡ ở Tokyo:"
        />
        {/* Place cards */}
        <div className="space-y-2 pl-9">
          {[
            { name: "Sensoji Temple", area: "Asakusa", emoji: "⛩️" },
            { name: "Shibuya Crossing", area: "Shibuya", emoji: "🚦" },
          ].map(({ name, area, emoji }) => (
            <div key={name} className="rounded-lg p-2.5 border border-border bg-background flex items-center gap-2.5 cursor-pointer hover:border-primary/40 transition-colors">
              <span className="text-lg">{emoji}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-xs text-foreground truncate">{name}</div>
                <div className="text-[10px] text-muted-foreground">{area}</div>
              </div>
              <div className="text-[10px] px-2 py-0.5 rounded-md text-primary-foreground font-medium" style={{ background: "hsl(214 80% 32%)" }}>Xem</div>
            </div>
          ))}
        </div>
        {/* Typing indicator */}
        <div className="flex items-end gap-2">
          <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center" style={{ background: "linear-gradient(135deg, hsl(280 60% 55%) 0%, hsl(214 80% 50%) 100%)" }}>
            <GeminiIcon className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="bg-muted rounded-2xl rounded-bl-sm px-3 py-2 flex gap-1 items-center">
            {[0, 150, 300].map(delay => (
              <div key={delay} className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: `${delay}ms` }} />
            ))}
          </div>
        </div>
      </div>
      {/* Input */}
      <div className="px-4 py-3 border-t border-border flex gap-2 items-center">
        <div className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
          Hỏi Wandr AI bất cứ điều gì...
        </div>
        <div className="w-8 h-8 rounded-lg flex items-center justify-center text-primary-foreground" style={{ background: "hsl(214 80% 32%)" }}>
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2L11 13" /><path d="M22 2L15 22 11 13 2 9l20-7z" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function ChatBubble({ role, text }: { role: "user" | "ai"; text: string }) {
  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="rounded-2xl rounded-br-sm px-3 py-2 text-xs max-w-[80%] text-primary-foreground" style={{ background: "hsl(214 80% 32%)" }}>
          {text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-end gap-2">
      <div className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center" style={{ background: "linear-gradient(135deg, hsl(280 60% 55%) 0%, hsl(214 80% 50%) 100%)" }}>
        <GeminiIcon className="w-3.5 h-3.5 text-white" />
      </div>
      <div className="rounded-2xl rounded-bl-sm px-3 py-2 text-xs bg-muted max-w-[80%] text-foreground">
        {text}
      </div>
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="14" x2="8" y2="14" strokeWidth="3" strokeLinecap="round" />
      <line x1="12" y1="14" x2="12" y2="14" strokeWidth="3" strokeLinecap="round" />
      <line x1="16" y1="14" x2="16" y2="14" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function AIIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a5 5 0 0 1 5 5v3a5 5 0 0 1-10 0V7a5 5 0 0 1 5-5z" />
      <path d="M12 14v2" /><path d="M8 18h8" />
      <circle cx="9" cy="7" r="1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="7" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function WalletIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 12V8a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4" />
      <path d="M20 12a2 2 0 0 1 2 2v0a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v0a2 2 0 0 1 2-2h2z" />
      <path d="M2 10V6a2 2 0 0 1 2-2h16" />
    </svg>
  );
}

function MapPinIcon() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function GeminiIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" opacity="0" />
      <path d="M12 3.5c-.8 2.5-2.5 4.5-5 5.5 2.5 1 4.2 3 5 5.5.8-2.5 2.5-4.5 5-5.5-2.5-1-4.2-3-5-5.5z" />
    </svg>
  );
}
