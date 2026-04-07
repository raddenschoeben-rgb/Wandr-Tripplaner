import { useState, useMemo } from "react";
import { useParams, useLocation } from "wouter";
import {
  ArrowLeft, Plus, Trash2, DollarSign, X, MapPin, Tag,
  Calendar, Clock, ChevronDown, ChevronUp, TrendingUp, Info,
} from "lucide-react";
import { fmtCost } from "@/lib/utils";
import { useCurrency } from "@/context/CurrencyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CurrencyInput } from "@/components/ui/currency-input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useGetTrip,
  useGetTripBudget,
  useListBudgetItems,
  useCreateBudgetItem,
  useDeleteBudgetItem,
  getGetTripBudgetQueryKey,
  getListBudgetItemsQueryKey,
  getGetTripQueryKey,
} from "@workspace/api-client-react";
import type { SavedPlace } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";

type BudgetCategory = "transportation" | "accommodation" | "food" | "attractions" | "shopping" | "miscellaneous";
const CATEGORIES: BudgetCategory[] = ["transportation", "accommodation", "food", "attractions", "shopping", "miscellaneous"];

const categoryLabels: Record<BudgetCategory, string> = {
  transportation: "Di chuyển",
  accommodation: "Lưu trú",
  food: "Ăn uống",
  attractions: "Tham quan",
  shopping: "Mua sắm",
  miscellaneous: "Khác",
};

const categoryColors: Record<BudgetCategory, string> = {
  transportation: "bg-blue-100 text-blue-800",
  accommodation: "bg-purple-100 text-purple-800",
  food: "bg-orange-100 text-orange-800",
  attractions: "bg-green-100 text-green-800",
  shopping: "bg-pink-100 text-pink-800",
  miscellaneous: "bg-gray-100 text-gray-800",
};

const budgetSchema = z.object({
  category: z.enum(["transportation", "accommodation", "food", "attractions", "shopping", "miscellaneous"]),
  description: z.string().min(1, "Vui lòng nhập mô tả"),
  amount: z.coerce.number().positive("Số tiền phải lớn hơn 0"),
  dayNumber: z.string().optional(),
});

type BudgetFormData = z.infer<typeof budgetSchema>;

type TagInfo = { id: number; name: string; color: string };

function getItemCost(item: { estimatedCost?: number | null; place?: { estimatedCost?: number | null } | null }): number {
  return item.estimatedCost ?? item.place?.estimatedCost ?? 0;
}

function getItemDuration(item: { estimatedDuration?: number | null }): number {
  return item.estimatedDuration ?? 0;
}

function getItemPrimaryTag(item: { place?: (SavedPlace & { tags?: TagInfo[] }) | null }): TagInfo | null {
  const tags = item.place?.tags ?? [];
  return tags[0] ?? null;
}

const FIXED_TAG: TagInfo = { id: -2, name: "Chi cố định", color: "#64748b" };
const NO_TAG: TagInfo = { id: -1, name: "Chưa có nhãn", color: "#94a3b8" };

interface DaySegment {
  tag: TagInfo;
  amount: number;
  pct: number;
}

interface HoveredSeg {
  dayNumber: number;
  tagId: number;
}

export default function BudgetPage() {
  const { id } = useParams<{ id: string }>();
  const tripId = Number(id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { symbol } = useCurrency();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [showBudgetItems, setShowBudgetItems] = useState(false);
  const [hoveredSeg, setHoveredSeg] = useState<HoveredSeg | null>(null);

  const queryOptions = { staleTime: 0, refetchOnMount: true as const, refetchOnWindowFocus: true };

  const { data: trip } = useGetTrip(tripId, {
    query: { enabled: !!tripId, queryKey: getGetTripQueryKey(tripId), ...queryOptions },
  });
  const { data: budget } = useGetTripBudget(tripId, {
    query: { enabled: !!tripId, queryKey: getGetTripBudgetQueryKey(tripId), ...queryOptions },
  });
  const { data: budgetItems = [] } = useListBudgetItems(tripId, {
    query: { enabled: !!tripId, queryKey: getListBudgetItemsQueryKey(tripId), ...queryOptions },
  });

  const createMutation = useCreateBudgetItem();
  const deleteMutation = useDeleteBudgetItem();

  const form = useForm<BudgetFormData>({
    resolver: zodResolver(budgetSchema),
    defaultValues: { category: "transportation", description: "", amount: "" as unknown as number, dayNumber: "" },
  });

  function openForm() {
    form.reset({ category: "transportation", description: "", amount: "" as unknown as number, dayNumber: "" });
    setShowForm(true);
  }

  async function onSubmit(data: BudgetFormData) {
    await createMutation.mutateAsync({
      tripId,
      data: {
        category: data.category,
        description: data.description,
        amount: Number(data.amount),
        dayNumber: data.dayNumber && data.dayNumber !== "" && data.dayNumber !== "all" ? Number(data.dayNumber) : null,
      },
    });
    queryClient.invalidateQueries({ queryKey: getGetTripBudgetQueryKey(tripId) });
    queryClient.invalidateQueries({ queryKey: getListBudgetItemsQueryKey(tripId) });
    toast({ title: "Đã thêm khoản chi cố định" });
    setShowForm(false);
    form.reset({ category: "transportation", description: "", amount: "" as unknown as number, dayNumber: "" });
  }

  async function handleDeleteBudgetItem(itemId: number) {
    await deleteMutation.mutateAsync({ tripId, itemId });
    queryClient.invalidateQueries({ queryKey: getGetTripBudgetQueryKey(tripId) });
    queryClient.invalidateQueries({ queryKey: getListBudgetItemsQueryKey(tripId) });
    toast({ title: "Đã xóa khoản chi" });
  }

  const allItineraryItems = useMemo(() => {
    if (!trip?.days) return [];
    return trip.days.flatMap((day) =>
      day.items.map((item) => ({ ...item, dayNumber: day.dayNumber, date: day.date }))
    );
  }, [trip]);

  const itineraryCost = useMemo(
    () => allItineraryItems.reduce((sum, item) => sum + getItemCost(item), 0),
    [allItineraryItems]
  );
  const fixedCostTotal = budget?.totalBudget ?? 0;
  const grandTotal = itineraryCost + fixedCostTotal;
  const totalPlaces = allItineraryItems.length;
  const avgPerDay = trip?.totalDays ? Math.round(grandTotal / trip.totalDays) : 0;
  const totalDurationMins = allItineraryItems.reduce((sum, item) => sum + getItemDuration(item), 0);

  const placesWithCost = useMemo(
    () => allItineraryItems.filter((item) => getItemCost(item) > 0),
    [allItineraryItems]
  );

  const perDayData = useMemo(() => {
    if (!trip?.days) return [];
    const budgetDailyMap: Record<number, number> = {};
    (budget?.dailyTotals ?? []).forEach(({ dayNumber, total }) => {
      budgetDailyMap[dayNumber] = total;
    });

    return trip.days.map((day) => {
      const tagMap = new Map<number, { tag: TagInfo; amount: number }>();
      for (const item of day.items) {
        const cost = getItemCost(item);
        if (cost === 0) continue;
        const primaryTag = getItemPrimaryTag(item as Parameters<typeof getItemPrimaryTag>[0]);
        const tag = primaryTag ?? NO_TAG;
        const existing = tagMap.get(tag.id);
        if (existing) {
          existing.amount += cost;
        } else {
          tagMap.set(tag.id, { tag, amount: cost });
        }
      }
      const fixedCostDay = budgetDailyMap[day.dayNumber] ?? 0;
      if (fixedCostDay > 0) {
        tagMap.set(FIXED_TAG.id, { tag: FIXED_TAG, amount: fixedCostDay });
      }
      const dayTotal = Array.from(tagMap.values()).reduce((s, e) => s + e.amount, 0);
      const segments: DaySegment[] = Array.from(tagMap.values())
        .sort((a, b) => b.amount - a.amount)
        .map((e) => ({
          tag: e.tag,
          amount: e.amount,
          pct: dayTotal > 0 ? (e.amount / dayTotal) * 100 : 0,
        }));
      return { dayNumber: day.dayNumber, date: day.date, total: dayTotal, placesCount: day.items.length, segments };
    });
  }, [trip, budget]);

  const maxDayCost = Math.max(...perDayData.map((d) => d.total), 1);
  const peakDay = perDayData.reduce(
    (best, d) => (d.total > best.total ? d : best),
    perDayData[0] ?? { total: 0, dayNumber: 0 }
  );

  const perTagData = useMemo(() => {
    const tagMap = new Map<number, { id: number; name: string; color: string; total: number; count: number }>();
    let noTagTotal = 0;
    let noTagCount = 0;
    for (const item of allItineraryItems) {
      const cost = getItemCost(item);
      const tags = (item.place as SavedPlace & { tags?: TagInfo[] })?.tags ?? [];
      if (tags.length === 0) {
        noTagTotal += cost;
        noTagCount++;
      } else {
        for (const tag of tags) {
          const existing = tagMap.get(tag.id);
          if (existing) {
            existing.total += cost;
            existing.count++;
          } else {
            tagMap.set(tag.id, { id: tag.id, name: tag.name, color: tag.color, total: cost, count: 1 });
          }
        }
      }
    }
    const result = Array.from(tagMap.values()).sort((a, b) => b.total - a.total);
    if (noTagTotal > 0 || noTagCount > 0) {
      result.push({ id: -1, name: "Chưa có nhãn", color: "#94a3b8", total: noTagTotal, count: noTagCount });
    }
    return result;
  }, [allItineraryItems]);

  const maxTagCost = Math.max(...perTagData.map((t) => t.total), 1);

  const placesByDay = useMemo(() => {
    if (!trip?.days) return [];
    return trip.days
      .map((day) => ({ ...day, items: day.items.filter((item) => getItemCost(item) > 0) }))
      .filter((day) => day.items.length > 0);
  }, [trip]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div>
          <button
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3 transition-colors"
            onClick={() => setLocation(`/trips/${tripId}`)}
            data-testid="button-back-trip"
          >
            <ArrowLeft className="w-4 h-4" />
            Quay lại lịch trình
          </button>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                {trip?.name ?? "Chuyến đi"} — Tổng quan chi phí
              </h1>
              {trip && (
                <p className="text-muted-foreground text-sm mt-0.5">
                  {format(parseISO(trip.startDate), "dd/MM/yyyy")} — {format(parseISO(trip.endDate), "dd/MM/yyyy")} · {trip.totalDays} ngày
                </p>
              )}
            </div>
            <Button onClick={openForm} data-testid="button-add-budget-item">
              <Plus className="w-4 h-4 mr-2" />
              Khoản chi cố định
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-primary text-primary-foreground rounded-xl p-4 col-span-2 sm:col-span-1">
            <p className="text-primary-foreground/70 text-xs font-medium mb-1">Tổng dự kiến</p>
            <p className="text-lg font-bold leading-tight break-all">{fmtCost(grandTotal, symbol)}</p>
            <p className="text-primary-foreground/60 text-[11px] mt-1 leading-snug">cho cả chuyến đi</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              <p className="text-muted-foreground text-xs font-medium">Địa điểm</p>
            </div>
            <p className="text-2xl font-bold text-foreground">{totalPlaces}</p>
            <p className="text-muted-foreground text-xs mt-1">trong lịch trình</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-primary" />
              <p className="text-muted-foreground text-xs font-medium">Chi phí cố định</p>
            </div>
            <p className="text-lg font-bold text-foreground leading-tight break-all">{fmtCost(fixedCostTotal, symbol)}</p>
            <p className="text-muted-foreground text-xs mt-1">tổng chi phí cố định</p>
          </div>

          <div className="bg-card border border-border rounded-xl p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <p className="text-muted-foreground text-xs font-medium">Chi phí theo ngày</p>
            </div>
            <p className="text-lg font-bold text-foreground leading-tight break-all">{fmtCost(itineraryCost, symbol)}</p>
            <p className="text-muted-foreground text-xs mt-1">tổng chi phí địa điểm</p>
          </div>
        </div>

        {/* Per-day breakdown with tag-colored stacked bars */}
        {perDayData.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calendar className="w-4 h-4 text-primary" />
              </div>
              <h2 className="text-sm font-semibold text-foreground">Chi phí theo từng ngày</h2>
            </div>
            <div className="space-y-4">
              {perDayData.map((day) => {
                const isHoveringThisDay = hoveredSeg?.dayNumber === day.dayNumber;
                const hoveredSegData = isHoveringThisDay
                  ? day.segments.find((s) => s.tag.id === hoveredSeg?.tagId)
                  : null;
                const barWidthPct = maxDayCost > 0 ? (day.total / maxDayCost) * 100 : 0;

                return (
                  <div key={day.dayNumber}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">Ngày {day.dayNumber}</span>
                        <span className="text-xs text-muted-foreground">{format(parseISO(day.date), "dd/MM")}</span>
                        {day.placesCount > 0 && (
                          <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                            {day.placesCount} địa điểm
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-semibold text-foreground">{fmtCost(day.total, symbol)}</span>
                    </div>

                    <div
                      className="w-full h-4 bg-muted rounded-full overflow-hidden flex"
                      onMouseLeave={() => setHoveredSeg(null)}
                    >
                      <div
                        className="h-full flex shrink-0 rounded-full overflow-hidden"
                        style={{ width: `${barWidthPct}%` }}
                      >
                        {day.segments.map((seg, idx) => {
                          const isActive = isHoveringThisDay && hoveredSeg?.tagId === seg.tag.id;
                          const isOtherHovered = isHoveringThisDay && hoveredSeg !== null && !isActive;
                          return (
                            <div
                              key={seg.tag.id}
                              className="h-full cursor-pointer transition-all duration-150"
                              style={{
                                width: `${seg.pct}%`,
                                backgroundColor: isOtherHovered ? "#d1d5db" : seg.tag.color,
                                opacity: isOtherHovered ? 0.5 : 1,
                                borderRadius:
                                  idx === 0
                                    ? "9999px 0 0 9999px"
                                    : idx === day.segments.length - 1
                                    ? "0 9999px 9999px 0"
                                    : "0",
                              }}
                              onMouseEnter={() => setHoveredSeg({ dayNumber: day.dayNumber, tagId: seg.tag.id })}
                            />
                          );
                        })}
                      </div>
                    </div>

                    <div className="mt-1.5 min-h-[18px]">
                      {hoveredSegData ? (
                        <span className="flex items-center gap-1.5 text-xs font-medium">
                          <span
                            className="w-2 h-2 rounded-full inline-block shrink-0"
                            style={{ backgroundColor: hoveredSegData.tag.color }}
                          />
                          <span className="text-foreground">{hoveredSegData.tag.name}</span>
                          <span className="text-muted-foreground">·</span>
                          <span className="text-foreground">{fmtCost(hoveredSegData.amount, symbol)}</span>
                          <span className="text-muted-foreground">({hoveredSegData.pct.toFixed(0)}%)</span>
                        </span>
                      ) : day.total === 0 ? (
                        <span className="text-xs text-muted-foreground">Chưa có chi phí dự kiến</span>
                      ) : (
                        <div className="flex gap-2 flex-wrap">
                          {day.segments.map((seg) => (
                            <span key={seg.tag.id} className="flex items-center gap-1 text-xs text-muted-foreground">
                              <span
                                className="w-1.5 h-1.5 rounded-full inline-block"
                                style={{ backgroundColor: seg.tag.color }}
                              />
                              {seg.tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Per-tag breakdown */}
        {perTagData.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Tag className="w-4 h-4 text-primary" />
              </div>
              <h2 className="text-sm font-semibold text-foreground">Chi phí theo nhãn</h2>
              <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{perTagData.length}</span>
            </div>
            <div className="space-y-3">
              {perTagData.map((tag) => (
                <div key={tag.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                      <span className="text-sm text-foreground font-medium truncate">{tag.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{tag.count} địa điểm</span>
                    </div>
                    <span className="text-sm font-semibold text-foreground shrink-0 ml-3">{fmtCost(tag.total, symbol)}</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${(tag.total / maxTagCost) * 100}%`, backgroundColor: tag.color, opacity: 0.8 }}
                    />
                  </div>
                </div>
              ))}
            </div>
            {itineraryCost === 0 && (
              <p className="text-xs text-muted-foreground mt-3 text-center">
                Thêm chi phí cho địa điểm trong lịch trình để xem phân bổ theo nhãn
              </p>
            )}
          </div>
        )}

        {/* Places with prices */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 p-5 border-b border-border">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-sm font-semibold text-foreground">Địa điểm có chi phí</h2>
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{placesWithCost.length}</span>
            {placesWithCost.length > 0 && (
              <span className="ml-auto text-sm font-semibold text-primary">{fmtCost(itineraryCost, symbol)}</span>
            )}
          </div>

          {placesByDay.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <MapPin className="w-8 h-8 text-muted-foreground/30 mb-2" />
              <p className="text-sm font-medium text-foreground">Chưa có địa điểm nào có chi phí</p>
              <p className="text-xs text-muted-foreground mt-1">Vào lịch trình và nhập chi phí cho từng địa điểm</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {placesByDay.map((day) => (
                <div key={day.dayNumber}>
                  <div className="flex items-center justify-between px-5 py-2.5 bg-muted/40">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground">Ngày {day.dayNumber}</span>
                      <span className="text-xs text-muted-foreground">{format(parseISO(day.date), "dd/MM")}</span>
                    </div>
                    <span className="text-xs font-semibold text-foreground">
                      {fmtCost(day.items.reduce((s, i) => s + getItemCost(i), 0), symbol)}
                    </span>
                  </div>
                  {day.items.map((item) => {
                    const place = item.place as SavedPlace & { tags?: TagInfo[] };
                    const cost = getItemCost(item);
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between px-5 py-3 hover:bg-muted/20 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
                            {item.position}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">
                              {item.customName ?? place?.name ?? "Địa điểm"}
                            </p>
                            {place?.tags && place.tags.length > 0 && (
                              <div className="flex gap-1 mt-0.5 flex-wrap">
                                {place.tags.map((tag) => (
                                  <span
                                    key={tag.id}
                                    className="text-[10px] px-1.5 py-0.5 rounded-full font-medium text-white"
                                    style={{ backgroundColor: tag.color }}
                                  >
                                    {tag.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-foreground shrink-0 ml-3">{fmtCost(cost, symbol)}</span>
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Fixed cost items (collapsible) */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-5 hover:bg-muted/30 transition-colors"
            onClick={() => setShowBudgetItems(!showBudgetItems)}
          >
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="w-4 h-4 text-primary" />
              </div>
              <span className="text-sm font-semibold text-foreground">
                Khoản chi cố định ({budgetItems.length})
              </span>
              {budgetItems.length > 0 && (
                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
                  {fmtCost(fixedCostTotal, symbol)}
                </span>
              )}
            </div>
            {showBudgetItems ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>

          {showBudgetItems && (
            <div className="border-t border-border">
              <div className="flex items-start gap-2 px-5 py-3 bg-muted/30 border-b border-border">
                <Info className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground">
                  Dùng để thêm những khoản chi cố định như{" "}
                  <span className="font-medium text-foreground">vé máy bay, phí thuê xe, khách sạn</span>
                  ... không gắn với địa điểm cụ thể trong lịch trình.
                </p>
              </div>

              <div className="px-5 py-3 border-b border-border">
                <button
                  className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
                  onClick={openForm}
                >
                  <Plus className="w-4 h-4" />
                  Thêm khoản chi cố định
                </button>
              </div>

              {budgetItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <DollarSign className="w-7 h-7 text-muted-foreground/30 mb-2" />
                  <p className="text-sm text-muted-foreground">Chưa có khoản chi cố định nào</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {budgetItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between px-5 py-3 hover:bg-muted/20 transition-colors"
                      data-testid={`budget-item-${item.id}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                            categoryColors[item.category as BudgetCategory] ?? "bg-muted text-muted-foreground"
                          }`}
                        >
                          {categoryLabels[item.category as BudgetCategory] ?? item.category}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{item.description}</p>
                          {item.dayNumber && (
                            <p className="text-xs text-muted-foreground">Ngày {item.dayNumber}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-semibold text-foreground">{fmtCost(item.amount, symbol)}</span>
                        <button
                          className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          onClick={() => handleDeleteBudgetItem(item.id)}
                          data-testid={`button-delete-budget-item-${item.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      </div>

      {/* Add fixed cost — popup modal */}
      {showForm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.45)" }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}
        >
          <div className="bg-background rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <h2 className="text-base font-semibold text-foreground">Thêm khoản chi cố định</h2>
              <button
                onClick={() => setShowForm(false)}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="px-6 py-5">
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="category"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">Danh mục</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger data-testid="select-budget-category">
                                <SelectValue placeholder="Chọn danh mục" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {CATEGORIES.map((c) => (
                                <SelectItem key={c} value={c}>{categoryLabels[c]}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="amount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">Số tiền ({symbol})</FormLabel>
                          <FormControl>
                            <CurrencyInput
                              placeholder="0"
                              value={field.value}
                              onChange={field.onChange}
                              onBlur={field.onBlur}
                              name={field.name}
                              data-testid="input-budget-amount"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Tên khoản chi</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Vé máy bay, thuê xe, phí khách sạn..."
                            {...field}
                            data-testid="input-budget-description"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dayNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">Ngày chi (tuỳ chọn)</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || "all"}>
                          <FormControl>
                            <SelectTrigger data-testid="select-budget-day">
                              <SelectValue placeholder="Áp dụng cho cả chuyến đi" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="all">Áp dụng cho cả chuyến đi</SelectItem>
                            {trip?.days?.map((day) => (
                              <SelectItem key={day.dayNumber} value={String(day.dayNumber)}>
                                Ngày {day.dayNumber} — {format(parseISO(day.date), "dd/MM")}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex gap-3 pt-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="flex-1"
                      onClick={() => setShowForm(false)}
                    >
                      Huỷ
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1"
                      disabled={createMutation.isPending}
                      data-testid="button-submit-budget-item"
                    >
                      {createMutation.isPending ? "Đang thêm..." : "Thêm"}
                    </Button>
                  </div>
                </form>
              </Form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
