import { useState, useRef } from "react";
import { useLocation } from "wouter";
import { Plus, Briefcase, Calendar, Trash2, ChevronRight, X, MapPin, Plane } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useListTrips, useCreateTrip, useDeleteTrip, getListTripsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays, parseISO, isPast, isFuture, isToday } from "date-fns";
import { DateRangePicker } from "@/components/DateRangePicker";
import { DestinationSearch } from "@/components/DestinationSearch";

const tripSchema = z.object({
  name: z.string().min(1, "Trip name is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  description: z.string().optional(),
}).refine((d) => new Date(d.endDate) >= new Date(d.startDate), {
  message: "End date must be after start date",
  path: ["endDate"],
});

type TripFormData = z.infer<typeof tripSchema>;

function getTripStatus(startDate: string, endDate: string) {
  try {
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    if (isPast(end)) return "past";
    if (isFuture(start)) return "upcoming";
    if (isToday(start) || isToday(end) || (isPast(start) && isFuture(end))) return "active";
    return "upcoming";
  } catch {
    return "upcoming";
  }
}

function getDayCount(startDate: string, endDate: string) {
  try {
    return differenceInDays(parseISO(endDate), parseISO(startDate)) + 1;
  } catch {
    return 0;
  }
}

function CreateTripModal({ onClose, onCreated }: { onClose: () => void; onCreated: (id: number) => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createMutation = useCreateTrip();
  const pendingCoordsRef = useRef<{ center: [number, number]; placeType: string[] } | null>(null);

  const form = useForm<TripFormData>({
    resolver: zodResolver(tripSchema),
    defaultValues: { name: "", startDate: "", endDate: "", description: "" },
  });

  async function onSubmit(data: TripFormData) {
    const result = await createMutation.mutateAsync({
      data: {
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate,
        description: data.description || null,
      },
    });
    queryClient.invalidateQueries({ queryKey: getListTripsQueryKey() });
    if (pendingCoordsRef.current) {
      const { center, placeType } = pendingCoordsRef.current;
      const zoom = placeType.includes("country") ? 5 : 11;
      localStorage.setItem(`wandr_flyto_${result.id}`, JSON.stringify({ center, zoom }));
    }
    toast({ title: `"${data.name}" đã được tạo!` });
    onCreated(result.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-lg font-bold text-foreground">Tạo chuyến đi mới</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Điền thông tin để bắt đầu lập kế hoạch</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-accent transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-4">
            <FormField control={form.control} name="name" render={({ field }) => (
              <FormItem>
                <DestinationSearch
                  value={field.value}
                  onChange={(v) => form.setValue("name", v, { shouldValidate: true })}
                  onSelectCoords={(center, placeType) => { pendingCoordsRef.current = { center, placeType }; }}
                  autoFocus
                />
              </FormItem>
            )} />
            <DateRangePicker
              startDate={form.watch("startDate")}
              endDate={form.watch("endDate")}
              onStartChange={(v) => form.setValue("startDate", v, { shouldValidate: true })}
              onEndChange={(v) => form.setValue("endDate", v, { shouldValidate: true })}
              startError={form.formState.errors.startDate?.message}
              endError={form.formState.errors.endDate?.message}
            />
            <FormField control={form.control} name="description" render={({ field }) => (
              <FormItem>
                <FormLabel>Ghi chú (tuỳ chọn)</FormLabel>
                <FormControl>
                  <Input placeholder="Mô tả ngắn về chuyến đi..." {...field} data-testid="input-trip-description" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <div className="flex gap-3 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Huỷ</Button>
              <Button type="submit" className="flex-1" disabled={createMutation.isPending} data-testid="button-submit-trip">
                {createMutation.isPending ? "Đang tạo..." : "Tạo & Lập kế hoạch →"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}

export default function TripsPage() {
  const [showForm, setShowForm] = useState(false);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: trips = [], isLoading } = useListTrips();
  const deleteMutation = useDeleteTrip();

  async function handleDelete(id: number, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Xoá chuyến đi này?")) return;
    await deleteMutation.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListTripsQueryKey() });
    toast({ title: "Đã xoá chuyến đi" });
  }

  const statusLabel: Record<string, { label: string; className: string }> = {
    active:   { label: "Đang đi",  className: "bg-green-100 text-green-700" },
    upcoming: { label: "Sắp tới",  className: "bg-blue-100 text-blue-700" },
    past:     { label: "Đã qua",   className: "bg-muted text-muted-foreground" },
  };

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      {trips.length === 0 ? (
        /* ── Empty state hero ── */
        <div className="flex flex-col items-center justify-center min-h-full px-6 py-16 text-center">
          <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
            <Plane className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-3">Bắt đầu chuyến đi đầu tiên</h1>
          <p className="text-muted-foreground max-w-sm mb-2">
            Lập kế hoạch hành trình, sắp xếp lịch trình theo từng ngày và theo dõi ngân sách — tất cả trong một nơi.
          </p>
          <div className="flex items-center gap-6 my-8 text-sm text-muted-foreground">
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                <MapPin className="w-5 h-5 text-primary" />
              </div>
              <span>Lưu địa điểm</span>
            </div>
            <div className="w-8 h-px bg-border" />
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <span>Lập lịch từng ngày</span>
            </div>
            <div className="w-8 h-px bg-border" />
            <div className="flex flex-col items-center gap-1.5">
              <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-primary" />
              </div>
              <span>Quản lý ngân sách</span>
            </div>
          </div>
          <Button size="lg" className="px-8 text-base" onClick={() => setShowForm(true)} data-testid="button-create-first-trip">
            <Plus className="w-5 h-5 mr-2" />
            Tạo chuyến đi đầu tiên
          </Button>
        </div>
      ) : (
        /* ── Trips list ── */
        <div className="max-w-3xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Chuyến đi của tôi</h1>
              <p className="text-muted-foreground text-sm mt-0.5">
                {trips.length} chuyến đi · Nhấn để lập kế hoạch
              </p>
            </div>
            <Button onClick={() => setShowForm(true)} data-testid="button-new-trip">
              <Plus className="w-4 h-4 mr-2" />
              Chuyến mới
            </Button>
          </div>

          <div className="space-y-3">
            {trips.map((trip) => {
              const days = getDayCount(trip.startDate, trip.endDate);
              const status = getTripStatus(trip.startDate, trip.endDate);
              const { label, className: badgeCls } = statusLabel[status];
              return (
                <div
                  key={trip.id}
                  className="group bg-card border border-border rounded-xl p-5 hover:shadow-md hover:border-primary/30 transition-all cursor-pointer flex items-center justify-between gap-4"
                  onClick={() => setLocation(`/trips/${trip.id}`)}
                  data-testid={`trip-card-${trip.id}`}
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${status === "active" ? "bg-green-100" : "bg-primary/10"}`}>
                      <Plane className={`w-6 h-6 ${status === "active" ? "text-green-600" : "text-primary"}`} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground">{trip.name}</h3>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badgeCls}`}>{label}</span>
                      </div>
                      {trip.description && (
                        <p className="text-sm text-muted-foreground mt-0.5 truncate">{trip.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-1.5">
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="w-3.5 h-3.5" />
                          {format(parseISO(trip.startDate), "dd/MM/yyyy")} — {format(parseISO(trip.endDate), "dd/MM/yyyy")}
                        </span>
                        <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                          {days} ngày
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      className="p-2 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-all"
                      onClick={(e) => handleDelete(trip.id, e)}
                      data-testid={`button-delete-trip-${trip.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Tip */}
          <div className="mt-8 p-4 rounded-xl bg-primary/5 border border-primary/15 flex items-start gap-3">
            <MapPin className="w-5 h-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-foreground">Mẹo: Lưu địa điểm trước khi lập kế hoạch</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Vào <span className="font-medium text-foreground">Explore</span> để tìm kiếm và lưu địa điểm yêu thích, sau đó thêm vào lịch trình từng ngày.
              </p>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <CreateTripModal
          onClose={() => setShowForm(false)}
          onCreated={(id) => {
            setShowForm(false);
            setLocation(`/trips/${id}`);
          }}
        />
      )}
    </div>
  );
}
