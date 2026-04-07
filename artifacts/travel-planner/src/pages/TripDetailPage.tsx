import React, { useState, useRef, useCallback, useEffect } from "react";
import mapboxgl from "mapbox-gl";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, Plus, Trash2, DollarSign, Clock, MapPin, Info, Tag as TagIcon, PanelLeftClose, PanelLeftOpen, Share2, Link2, ChevronLeft, ChevronRight, Search, X, Loader2, Sparkles, ExternalLink, ChevronDown, Check } from "lucide-react";
import AIChatBox from "@/components/AIChatBox";
import { fmtCost } from "@/lib/utils";
import { getTagIcon } from "@/lib/tag-icons";
import { Button } from "@/components/ui/button";
import MapView from "@/components/MapView";
import DayTimeline from "@/components/DayTimeline";
import ShareModal from "@/components/ShareModal";
import {
  useGetTrip,
  useListSavedPlaces,
  useCreateItineraryItem,
  useDeleteItineraryItem,
  useReorderItineraryItems,
  useUpdateItineraryItem,
  useCreateSavedPlace,
  getGetTripQueryKey,
  getListSavedPlacesQueryKey,
  useListTags,
  useSetPlaceTags,
  useUpdateSavedPlace,
  getListTagsQueryKey,
  useListTransportModes,
} from "@workspace/api-client-react";
import type { ItineraryItem, SavedPlace, Tag } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { useCurrency } from "@/context/CurrencyContext";


type UndoAction =
  | { type: "add_item"; itemId: number; dayNumber: number }
  | { type: "remove_item"; savedPlaceId: number | null; startMinutes: number | null; estimatedDuration: number | null; dayNumber: number };

interface GeocodingFeature {
  id: string;
  place_name: string;
  text: string;
  center: [number, number];
  properties?: { category?: string; [key: string]: unknown };
}

const CATEGORY_MAP: Record<string, { icon: string; label: string; color: string }> = {
  restaurant: { icon: "🍽️", label: "Nhà hàng", color: "#f59e0b" },
  food: { icon: "🍜", label: "Ẩm thực", color: "#f59e0b" },
  cafe: { icon: "☕", label: "Cà phê", color: "#a78bfa" },
  coffee: { icon: "☕", label: "Cà phê", color: "#a78bfa" },
  hotel: { icon: "🏨", label: "Khách sạn", color: "#3b82f6" },
  lodging: { icon: "🏨", label: "Lưu trú", color: "#3b82f6" },
  museum: { icon: "🏛️", label: "Bảo tàng", color: "#6366f1" },
  park: { icon: "🌿", label: "Công viên", color: "#22c55e" },
  attraction: { icon: "🎡", label: "Điểm tham quan", color: "#ec4899" },
  shopping: { icon: "🛍️", label: "Mua sắm", color: "#8b5cf6" },
  transport: { icon: "🚌", label: "Giao thông", color: "#14b8a6" },
  hospital: { icon: "🏥", label: "Bệnh viện", color: "#ef4444" },
  school: { icon: "🏫", label: "Trường học", color: "#0ea5e9" },
  education: { icon: "🎓", label: "Giáo dục", color: "#0ea5e9" },
  airport: { icon: "✈️", label: "Sân bay", color: "#6366f1" },
  bank: { icon: "🏦", label: "Ngân hàng", color: "#64748b" },
  pharmacy: { icon: "💊", label: "Nhà thuốc", color: "#ef4444" },
  supermarket: { icon: "🛒", label: "Siêu thị", color: "#10b981" },
};

interface PlaceInfo { photo: string | null; description: string | null; wikiUrl: string | null; wikiTitle: string | null; enWikiTitle: string | null }

const WIKI_QUERY_PARAMS = "pithumbsize=600&exintro=1&exsentences=3&explaintext=1";

async function wikiQuery(base: string, title: string): Promise<{ photo: string | null; extract: string | null } | null> {
  try {
    const url = `${base}?action=query&titles=${encodeURIComponent(title)}&prop=pageimages|extracts&${WIKI_QUERY_PARAMS}&format=json&origin=*`;
    const data = await (await fetch(url)).json();
    const page = Object.values(data?.query?.pages ?? {})[0] as { missing?: string; thumbnail?: { source: string }; extract?: string } | undefined;
    if (!page || "missing" in page) return null;
    return { photo: page.thumbnail?.source ?? null, extract: page.extract?.trim() || null };
  } catch { return null; }
}

async function wikiGeoSearch(base: string, lat: number, lng: number): Promise<string | null> {
  try {
    const url = `${base}?action=query&list=geosearch&gscoord=${lat}|${lng}&gsradius=500&gslimit=1&format=json&origin=*`;
    const data = await (await fetch(url)).json();
    return data?.query?.geosearch?.[0]?.title ?? null;
  } catch { return null; }
}

async function aiDescribePlace(name: string, englishDescription?: string): Promise<string | null> {
  try {
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const geminiKey = localStorage.getItem("user_gemini_api_key");
    const res = await fetch(`${base}/api/ai/describe-place`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(geminiKey ? { "x-gemini-api-key": geminiKey } : {}),
      },
      body: JSON.stringify({ name, englishDescription }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.description ?? null;
  } catch { return null; }
}

async function fetchPlaceInfo(name: string, lat: number, lng: number): Promise<PlaceInfo> {
  const VI = "https://vi.wikipedia.org/w/api.php";
  const EN = "https://en.wikipedia.org/w/api.php";

  const [viTitle, enTitle] = await Promise.all([
    wikiGeoSearch(VI, lat, lng),
    wikiGeoSearch(EN, lat, lng),
  ]);

  if (viTitle) {
    const result = await wikiQuery(VI, viTitle);
    if (result && (result.photo || result.extract)) {
      let photo = result.photo;
      if (!photo && enTitle) {
        const enResult = await wikiQuery(EN, enTitle);
        photo = enResult?.photo ?? null;
      }
      return {
        photo,
        description: result.extract,
        wikiUrl: `https://vi.wikipedia.org/wiki/${encodeURIComponent(viTitle)}`,
        wikiTitle: viTitle,
        enWikiTitle: enTitle,
      };
    }
  }

  if (enTitle) {
    const enResult = await wikiQuery(EN, enTitle);
    if (enResult) {
      const viDesc = await aiDescribePlace(enTitle, enResult.extract ?? undefined);
      return {
        photo: enResult.photo,
        description: viDesc ?? enResult.extract,
        wikiUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(enTitle)}`,
        wikiTitle: enTitle,
        enWikiTitle: enTitle,
      };
    }
  }

  const viByName = name ? await wikiQuery(VI, name) : null;
  if (viByName && (viByName.photo || viByName.extract)) {
    return { photo: viByName.photo, description: viByName.extract, wikiUrl: `https://vi.wikipedia.org/wiki/${encodeURIComponent(name)}`, wikiTitle: name, enWikiTitle: null };
  }

  const viDesc = await aiDescribePlace(name);
  return { photo: null, description: viDesc, wikiUrl: null, wikiTitle: null, enWikiTitle: null };
}

type RouteMode = "driving" | "walking" | "cycling" | "transit";

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const tripId = Number(id);
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeDay, setActiveDay] = useState(1);
  const [routeMode, setRouteMode] = useState<RouteMode>("driving");
  const [showAddPlace, setShowAddPlace] = useState(false);
  const [draggedItem, setDraggedItem] = useState<number | null>(null);
  const [dragOverItem, setDragOverItem] = useState<number | null>(null);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [clickPinCoords, setClickPinCoords] = useState<{ lng: number; lat: number } | null>(null);
  const [previewFeature, setPreviewFeature] = useState<GeocodingFeature | null>(null);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [placePhoto, setPlacePhoto] = useState<string | null>(null);
  const [placeCategory, setPlaceCategory] = useState<string | null>(null);
  const [placeDescription, setPlaceDescription] = useState<string | null>(null);
  const [placeWikiUrl, setPlaceWikiUrl] = useState<string | null>(null);
  const [placeWikiTitle, setPlaceWikiTitle] = useState<string | null>(null);
  const [placeEnWikiTitle, setPlaceEnWikiTitle] = useState<string | null>(null);
  const photoRequestIdRef = useRef(0);
  const undoStackRef = useRef<UndoAction[]>([]);
  const [formName, setFormName] = useState("");
  const [formCost, setFormCost] = useState("");
  const [formTagIds, setFormTagIds] = useState<number[]>([]);
  const [filterTagIds, setFilterTagIds] = useState<Set<number>>(new Set());
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const [editingPlace, setEditingPlace] = useState<SavedPlace | null>(null);
  const [editFormName, setEditFormName] = useState("");
  const [editFormTagIds, setEditFormTagIds] = useState<number[]>([]);
  const [editFormCost, setEditFormCost] = useState("");
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [isQuickAdding, setIsQuickAdding] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [hintHovered, setHintHovered] = useState(false);
  const [hintAutoOpen, setHintAutoOpen] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showImportInput, setShowImportInput] = useState(false);
  const [importUrl, setImportUrl] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [searchResults, setSearchResults] = useState<GeocodingFeature[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const { symbol } = useCurrency();
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const itemRefsMap = useRef<Map<number, HTMLDivElement>>(new Map());
  const hasAutoFlownRef = useRef(false);
  const dayScrollRef = useRef<HTMLDivElement>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleItemClick = useCallback((item: ItineraryItem) => {
    if (!item.place?.longitude || !item.place?.latitude) return;
    setSelectedItemId(item.id);
    mapRef.current?.flyTo({
      center: [item.place.longitude, item.place.latitude],
      zoom: 15,
      duration: 900,
    });
    const place = item.place as SavedPlace;
    setEditingPlace(place);
    setEditFormName(place.name ?? "");
    setEditFormTagIds(place.tags?.map((t) => t.id) ?? []);
    setEditFormCost(place.estimatedCost != null ? String(place.estimatedCost) : "");
    // Dismiss any active map-click preview
    setClickPinCoords(null);
    setPreviewFeature(null);
    setShowSaveForm(false);
  }, []);

  const handleMarkerClick = useCallback((item: ItineraryItem) => {
    setSelectedItemId(item.id);
    // Scroll into view in sidebar (if visible)
    const el = itemRefsMap.current.get(item.id);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
    // Open edit card
    const place = item.place as SavedPlace;
    if (place) {
      setEditingPlace(place);
      setEditFormName(place.name ?? "");
      setEditFormTagIds(place.tags?.map((t) => t.id) ?? []);
      setEditFormCost(place.estimatedCost != null ? String(place.estimatedCost) : "");
      setClickPinCoords(null);
      setPreviewFeature(null);
      setShowSaveForm(false);
    }
  }, []);

  const handleMapClick = useCallback(async ({ lng, lat }: { lng: number; lat: number }) => {
    setClickPinCoords({ lng, lat });
    setPreviewFeature(null);
    setPlacePhoto(null);
    setPlaceCategory(null);
    setPlaceDescription(null);
    setPlaceWikiUrl(null);
    setPlaceWikiTitle(null);
    setPlaceEnWikiTitle(null);
    setIsReverseGeocoding(true);
    setEditingPlace(null);
    setEditFormTagIds([]);
    setEditFormCost("");
    try {
      const token = import.meta.env.VITE_MAPBOX_TOKEN;
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&limit=1`
      );
      const data = await res.json();
      const feature: GeocodingFeature = data.features?.[0] ?? {
        id: `pin-${lng}-${lat}`,
        place_name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        text: "Vị trí đã chọn",
        center: [lng, lat] as [number, number],
      };
      setPreviewFeature(feature);
      const cat = feature.properties?.category ?? null;
      setPlaceCategory(cat ? String(cat) : null);
      setIsReverseGeocoding(false);
      const requestId = ++photoRequestIdRef.current;
      fetchPlaceInfo(feature.text, lat, lng).then(({ photo, description, wikiUrl, wikiTitle, enWikiTitle }) => {
        if (photoRequestIdRef.current === requestId) {
          setPlacePhoto(photo);
          setPlaceDescription(description);
          setPlaceWikiUrl(wikiUrl);
          setPlaceWikiTitle(wikiTitle);
          setPlaceEnWikiTitle(enWikiTitle);
        }
      }).catch(() => {});
    } catch {
      toast({ title: "Không thể tải thông tin địa điểm", variant: "destructive" });
      setClickPinCoords(null);
      setIsReverseGeocoding(false);
    }
  }, [toast]);

  const handlePOIClick = useCallback(async ({ name, lng, lat, category }: { name: string; lng: number; lat: number; category?: string }) => {
    setClickPinCoords({ lng, lat });
    setPreviewFeature(null);
    setPlacePhoto(null);
    setPlaceCategory(category ?? null);
    setPlaceDescription(null);
    setPlaceWikiUrl(null);
    setPlaceWikiTitle(null);
    setPlaceEnWikiTitle(null);
    setIsReverseGeocoding(true);
    setEditingPlace(null);
    setEditFormTagIds([]);
    setEditFormCost("");
    const requestId = ++photoRequestIdRef.current;
    try {
      const token = import.meta.env.VITE_MAPBOX_TOKEN;
      const [geoRes, placeInfo] = await Promise.all([
        fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&limit=1`),
        fetchPlaceInfo(name, lat, lng),
      ]);
      const data = await geoRes.json();
      const feature: GeocodingFeature = data.features?.[0] ?? {
        id: `poi-${lng}-${lat}`,
        place_name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        text: name,
        center: [lng, lat] as [number, number],
      };
      setPreviewFeature({ ...feature, text: feature.text || name });
      if (!category && feature.properties?.category) {
        setPlaceCategory(String(feature.properties.category));
      }
      if (photoRequestIdRef.current === requestId) {
        setPlacePhoto(placeInfo.photo);
        setPlaceDescription(placeInfo.description);
        setPlaceWikiUrl(placeInfo.wikiUrl);
        setPlaceWikiTitle(placeInfo.wikiTitle);
        setPlaceEnWikiTitle(placeInfo.enWikiTitle);
      }
    } catch {
      toast({ title: "Không thể tải thông tin địa điểm", variant: "destructive" });
      setClickPinCoords(null);
    } finally {
      setIsReverseGeocoding(false);
    }
  }, [toast]);

  const dismissPin = useCallback(() => {
    setClickPinCoords(null);
    setPreviewFeature(null);
    setShowSaveForm(false);
    setFormName("");
    setFormCost("");
    setFormTagIds([]);
    setPlacePhoto(null);
    setPlaceCategory(null);
    setPlaceDescription(null);
    setPlaceWikiUrl(null);
    setPlaceWikiTitle(null);
    setPlaceEnWikiTitle(null);
  }, []);

  const { data: trip, isLoading } = useGetTrip(tripId, {
    query: { enabled: !!tripId, queryKey: getGetTripQueryKey(tripId) },
  });
  const { data: savedPlaces = [] } = useListSavedPlaces();
  const createItemMutation = useCreateItineraryItem();
  const deleteItemMutation = useDeleteItineraryItem();
  const reorderMutation = useReorderItineraryItems();
  const updateItemMutation = useUpdateItineraryItem();
  const createPlaceMutation = useCreateSavedPlace();
  const { data: allTags = [] } = useListTags();
  const setPlaceTagsMutation = useSetPlaceTags();
  const updatePlaceMutation = useUpdateSavedPlace();
  const { data: allTransportModes = [] } = useListTransportModes();
  // Ref so callbacks always see the latest items without ordering constraints
  const allCurrentItemsRef = useRef<ItineraryItem[]>([]);

  const handleMapDoubleClick = useCallback(async ({ lng, lat }: { lng: number; lat: number }) => {
    if (isQuickAdding) return;
    setIsQuickAdding(true);
    setClickPinCoords(null);
    setPreviewFeature(null);
    try {
      const token = import.meta.env.VITE_MAPBOX_TOKEN;
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&limit=1`
      );
      const data = await res.json();
      const feature = data.features?.[0];
      const name: string = feature?.text ?? `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
      const address: string = feature?.place_name ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      const place = await createPlaceMutation.mutateAsync({
        data: { name, address, latitude: lat, longitude: lng, estimatedCost: null, note: null, estimatedDuration: null, priority: null, openingHours: null },
      });
      if (place?.id) {
        const nextStart = computeNextStart(allCurrentItemsRef.current);
        await createItemMutation.mutateAsync({ tripId, dayNumber: activeDay, data: { savedPlaceId: place.id, startMinutes: nextStart, estimatedDuration: 60 } });
        queryClient.invalidateQueries({ queryKey: getGetTripQueryKey(tripId) });
        queryClient.invalidateQueries({ queryKey: getListSavedPlacesQueryKey() });
        toast({ title: `Đã thêm "${name}" vào Day ${activeDay}` });
      }
    } catch {
      toast({ title: "Không thể thêm địa điểm", variant: "destructive" });
    } finally {
      setIsQuickAdding(false);
    }
  }, [isQuickAdding, createPlaceMutation, createItemMutation, tripId, activeDay, queryClient, toast]);

  const handleMarkerDoubleClick = useCallback(async (item: ItineraryItem) => {
    try {
      undoStackRef.current.push({
        type: "remove_item",
        savedPlaceId: item.savedPlaceId ?? null,
        startMinutes: item.startMinutes ?? null,
        estimatedDuration: item.estimatedDuration ?? null,
        dayNumber: activeDay,
      });
      if (undoStackRef.current.length > 20) undoStackRef.current.shift();
      await deleteItemMutation.mutateAsync({ tripId, itemId: item.id });
      queryClient.invalidateQueries({ queryKey: getGetTripQueryKey(tripId) });
      if (selectedItemId === item.id) setSelectedItemId(null);
      setEditingPlace(null);
      setEditFormTagIds([]);
      setEditFormCost("");
      toast({ title: `Đã xóa "${item.place?.name ?? "địa điểm"}"`, description: "Ctrl+Z để hoàn tác" });
    } catch {
      undoStackRef.current.pop();
      toast({ title: "Không thể xóa địa điểm", variant: "destructive" });
    }
  }, [deleteItemMutation, tripId, activeDay, queryClient, selectedItemId, toast]);

  const handleSaveFromMap = useCallback(async () => {
    if (!previewFeature) return;
    try {
      const place = await createPlaceMutation.mutateAsync({
        data: {
          name: formName || previewFeature.text,
          address: previewFeature.place_name,
          latitude: previewFeature.center[1],
          longitude: previewFeature.center[0],
          estimatedCost: formCost !== "" ? Number(formCost) : null,
          note: null,
          estimatedDuration: null,
          priority: null,
          openingHours: null,
        },
      });
      if (place?.id) {
        if (formTagIds.length > 0) {
          await setPlaceTagsMutation.mutateAsync({ placeId: place.id, tagIds: formTagIds });
        }
        const nextStart = computeNextStart(allCurrentItemsRef.current);
        const created = await createItemMutation.mutateAsync({
          tripId,
          dayNumber: activeDay,
          data: { savedPlaceId: place.id, startMinutes: nextStart, estimatedDuration: 60 },
        });
        if (created?.id) {
          undoStackRef.current.push({ type: "add_item", itemId: created.id, dayNumber: activeDay });
          if (undoStackRef.current.length > 20) undoStackRef.current.shift();
        }
        queryClient.invalidateQueries({ queryKey: getGetTripQueryKey(tripId) });
        queryClient.invalidateQueries({ queryKey: getListSavedPlacesQueryKey() });
      }
      dismissPin();
      toast({ title: "Đã lưu và thêm vào lịch trình!", description: "Ctrl+Z để hoàn tác" });
    } catch {
      toast({ title: "Lỗi khi lưu địa điểm", variant: "destructive" });
    }
  }, [previewFeature, formName, formCost, formTagIds, createPlaceMutation, setPlaceTagsMutation, createItemMutation, tripId, activeDay, queryClient, dismissPin, toast]);

  const dismissEdit = useCallback(() => {
    setEditingPlace(null);
    setEditFormName("");
    setEditFormTagIds([]);
    setEditFormCost("");
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingPlace) return;
    try {
      await updatePlaceMutation.mutateAsync({
        id: editingPlace.id,
        data: {
          name: editFormName.trim() || editingPlace.name,
          estimatedCost: editFormCost !== "" ? Number(editFormCost) : null,
        },
      });
      await setPlaceTagsMutation.mutateAsync({ placeId: editingPlace.id, tagIds: editFormTagIds });
      queryClient.invalidateQueries({ queryKey: getGetTripQueryKey(tripId) });
      queryClient.invalidateQueries({ queryKey: getListSavedPlacesQueryKey() });
      dismissEdit();
      toast({ title: "Đã cập nhật địa điểm!" });
    } catch {
      toast({ title: "Lỗi khi cập nhật", variant: "destructive" });
    }
  }, [editingPlace, editFormName, editFormCost, editFormTagIds, updatePlaceMutation, setPlaceTagsMutation, queryClient, tripId, dismissEdit, toast]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const timer = setTimeout(() => { map.resize(); }, 310);
    return () => clearTimeout(timer);
  }, [sidebarOpen]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const timer = setTimeout(() => { map.resize(); }, 310);
    return () => clearTimeout(timer);
  }, [showAI]);

  useEffect(() => {
    if (!mapReady || !trip || hasAutoFlownRef.current) return;
    const map = mapRef.current;
    if (!map) return;
    const allItems = (trip.days ?? []).flatMap((d) => d.items ?? []);
    const coords = allItems
      .filter((i) => i.place?.latitude && i.place?.longitude)
      .map((i) => [i.place!.longitude!, i.place!.latitude!] as [number, number]);

    if (coords.length > 0) {
      hasAutoFlownRef.current = true;
      if (coords.length === 1) {
        map.flyTo({ center: coords[0], zoom: 13, duration: 1200 });
      } else {
        const bounds = coords.reduce(
          (b, c) => b.extend(c),
          new mapboxgl.LngLatBounds(coords[0], coords[0])
        );
        map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 1200 });
      }
      return;
    }

    // No itinerary items yet — try to fly to destination selected at trip creation
    const stored = localStorage.getItem(`wandr_flyto_${tripId}`);
    if (stored) {
      try {
        const { center, zoom } = JSON.parse(stored) as { center: [number, number]; zoom: number };
        hasAutoFlownRef.current = true;
        map.flyTo({ center, zoom, duration: 1400 });
      } catch {
        localStorage.removeItem(`wandr_flyto_${tripId}`);
      }
    }
  }, [mapReady, trip, tripId]);

  // Auto-show map hint on first trip creation
  useEffect(() => {
    if (!mapReady) return;
    const seen = localStorage.getItem("wandr_map_hint_seen");
    if (seen) return;
    let hideTimer: ReturnType<typeof setTimeout>;
    const showTimer = setTimeout(() => {
      setHintAutoOpen(true);
      hideTimer = setTimeout(() => {
        setHintAutoOpen(false);
        localStorage.setItem("wandr_map_hint_seen", "1");
      }, 5000);
    }, 800);
    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
    };
  }, [mapReady]);

  useEffect(() => {
    if (!filterDropdownOpen) return;
    function handleOutsideClick(e: MouseEvent) {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
        setFilterDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [filterDropdownOpen]);

  // Ctrl+Z / Cmd+Z undo
  useEffect(() => {
    async function handleKeyDown(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.key !== "z" || e.shiftKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      const action = undoStackRef.current.pop();
      if (!action) return;
      try {
        if (action.type === "add_item") {
          await deleteItemMutation.mutateAsync({ tripId, itemId: action.itemId });
          queryClient.invalidateQueries({ queryKey: getGetTripQueryKey(tripId) });
          toast({ title: "Đã hoàn tác ✓", description: "Đã xóa địa điểm vừa thêm" });
        } else {
          if (action.savedPlaceId == null) return;
          await createItemMutation.mutateAsync({
            tripId,
            dayNumber: action.dayNumber,
            data: { savedPlaceId: action.savedPlaceId, startMinutes: action.startMinutes, estimatedDuration: action.estimatedDuration ?? 60 },
          });
          queryClient.invalidateQueries({ queryKey: getGetTripQueryKey(tripId) });
          toast({ title: "Đã hoàn tác ✓", description: "Đã khôi phục địa điểm" });
        }
      } catch {
        toast({ title: "Không thể hoàn tác", variant: "destructive" });
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [deleteItemMutation, createItemMutation, tripId, queryClient, toast]);

  async function handleImportGoogleMaps(e: React.FormEvent) {
    e.preventDefault();
    const url = importUrl.trim();
    if (!url) return;
    setIsImporting(true);
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/resolve-maps-link`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast({ title: data.error ?? "Không thể xử lý link", variant: "destructive" });
        return;
      }
      const { lat, lng, name } = data as { lat: number; lng: number; name: string | null };
      setEditingPlace(null);
      setShowSaveForm(false);
      setClickPinCoords({ lng, lat });
      setPreviewFeature({
        id: `gmaps-${lng}-${lat}`,
        text: name ?? "Địa điểm Google Maps",
        place_name: name ? `${name} (Google Maps)` : `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        center: [lng, lat] as [number, number],
      } as GeocodingFeature);
      setIsReverseGeocoding(false);
      mapRef.current?.flyTo({ center: [lng, lat], zoom: 15, duration: 1000 });
      setImportUrl("");
      setShowImportInput(false);
    } catch {
      toast({ title: "Lỗi kết nối, vui lòng thử lại", variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  }

  function handleUnifiedSearchInput(value: string) {
    setSearchInput(value);
    setShowSearchResults(false);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!value.trim()) { setSearchResults([]); setIsSearching(false); return; }
    if (/^https?:\/\//i.test(value.trim())) { setIsSearching(false); return; }
    setIsSearching(true);
    searchTimerRef.current = setTimeout(async () => {
      try {
        const token = import.meta.env.VITE_MAPBOX_TOKEN;
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(value.trim())}.json?access_token=${token}&limit=5`
        );
        const data = await res.json();
        setSearchResults(data.features ?? []);
        setShowSearchResults(true);
      } catch { setSearchResults([]); }
      finally { setIsSearching(false); }
    }, 400);
  }

  function handleSearchResultClick(feature: GeocodingFeature) {
    setShowSearchResults(false);
    setSearchInput("");
    setSearchResults([]);
    const [lng, lat] = feature.center;
    setClickPinCoords({ lng, lat });
    setPreviewFeature(feature);
    setEditingPlace(null);
    setEditFormTagIds([]);
    setEditFormCost("");
    setShowSaveForm(false);
    mapRef.current?.flyTo({ center: [lng, lat], zoom: 15, duration: 900 });
  }

  async function handleImportFromSearchInput() {
    const url = searchInput.trim();
    if (!url) return;
    setIsImporting(true);
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/resolve-maps-link`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) { toast({ title: data.error ?? "Không thể xử lý link", variant: "destructive" }); return; }
      const { lat, lng, name } = data as { lat: number; lng: number; name: string | null };
      setEditingPlace(null);
      setShowSaveForm(false);
      setClickPinCoords({ lng, lat });
      setPreviewFeature({
        id: `gmaps-${lng}-${lat}`,
        text: name ?? "Địa điểm Google Maps",
        place_name: name ? `${name} (Google Maps)` : `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        center: [lng, lat] as [number, number],
      } as GeocodingFeature);
      setIsReverseGeocoding(false);
      mapRef.current?.flyTo({ center: [lng, lat], zoom: 15, duration: 1000 });
      setSearchInput("");
      setShowSearchResults(false);
    } catch {
      toast({ title: "Lỗi kết nối, vui lòng thử lại", variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  }

  const currentDay = trip?.days?.find((d) => d.dayNumber === activeDay);
  const allCurrentItems: ItineraryItem[] = currentDay?.items ?? [];
  allCurrentItemsRef.current = allCurrentItems;
  const currentItems: ItineraryItem[] = filterTagIds.size === 0
    ? allCurrentItems
    : allCurrentItems.filter((item) => {
        const placeTags = item.place?.tags ?? [];
        return placeTags.some((t) => filterTagIds.has(t.id));
      });

  const aiTripContext = React.useMemo(() => ({
    tripName: trip?.name,
    destination: trip?.name,
    startDate: trip?.startDate,
    endDate: trip?.endDate,
    currentPlaces: allCurrentItems
      .map((i) => i.place?.name)
      .filter((n): n is string => Boolean(n))
      .slice(0, 15),
  }), [trip, allCurrentItems]);

  const handleAIAddPlace = useCallback((place: { name: string; address: string; description: string }) => {
    setSearchInput(place.name);
    setShowAI(false);
  }, []);

  const handleViewOnMap = useCallback(async (place: { name: string; address: string; lat?: number; lng?: number }) => {
    if (!mapRef.current) return;

    const resolvedLat = place.lat;
    const resolvedLng = place.lng;

    const showPreview = async (lng: number, lat: number) => {
      if (mapRef.current) {
        mapRef.current.flyTo({ center: [lng, lat], zoom: 15, duration: 1200 });
      }
      setClickPinCoords({ lng, lat });
      setPreviewFeature(null);
      setPlacePhoto(null);
      setPlaceCategory(null);
      setPlaceDescription(null);
      setPlaceWikiUrl(null);
      setPlaceWikiTitle(null);
      setPlaceEnWikiTitle(null);
      setIsReverseGeocoding(true);
      setEditingPlace(null);
      setEditFormTagIds([]);
      setEditFormCost("");
      const requestId = ++photoRequestIdRef.current;
      try {
        const token = (localStorage.getItem("user_mapbox_token") || import.meta.env.VITE_MAPBOX_TOKEN) as string;
        const [geoRes, placeInfo] = await Promise.all([
          fetch(`https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&limit=1`),
          fetchPlaceInfo(place.name, lat, lng),
        ]);
        const data = await geoRes.json();
        const feature: GeocodingFeature = data.features?.[0] ?? {
          id: `ai-${lng}-${lat}`,
          place_name: place.address,
          text: place.name,
          center: [lng, lat] as [number, number],
        };
        setPreviewFeature({ ...feature, text: feature.text || place.name });
        if (photoRequestIdRef.current === requestId) {
          setPlacePhoto(placeInfo.photo);
          setPlaceDescription(placeInfo.description);
          setPlaceWikiUrl(placeInfo.wikiUrl);
          setPlaceWikiTitle(placeInfo.wikiTitle);
          setPlaceEnWikiTitle(placeInfo.enWikiTitle);
        }
      } catch { /* silently fail */ } finally {
        setIsReverseGeocoding(false);
      }
    };

    if (resolvedLat && resolvedLng) {
      showPreview(resolvedLng, resolvedLat);
      return;
    }

    const token = (localStorage.getItem("user_mapbox_token") || import.meta.env.VITE_MAPBOX_TOKEN) as string;
    if (!token) return;
    const query = encodeURIComponent(`${place.name} ${place.address}`);
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${token}&limit=1`
      );
      const data = await res.json();
      const coords = data?.features?.[0]?.center as [number, number] | undefined;
      if (coords) {
        showPreview(coords[0], coords[1]);
      }
    } catch { /* silently fail */ }
  }, []);

  const editingItem = editingPlace ? (allCurrentItems.find(i => i.savedPlaceId === editingPlace.id) ?? null) : null;

  const totalDuration = allCurrentItems.reduce((sum, item) => sum + (item.estimatedDuration ?? item.place?.estimatedDuration ?? 0), 0);
  const totalCost = allCurrentItems.reduce((sum, item) => sum + (item.estimatedCost ?? item.place?.estimatedCost ?? 0), 0);

  function toggleFilterTag(tagId: number) {
    setFilterTagIds((prev) => {
      const next = new Set(prev);
      if (next.has(tagId)) next.delete(tagId); else next.add(tagId);
      return next;
    });
  }

  function computeNextStart(items: typeof allCurrentItems): number {
    let cur = 8 * 60;
    for (const item of items) {
      const start = item.startMinutes ?? cur;
      const dur = item.estimatedDuration ?? item.place?.estimatedDuration ?? 60;
      cur = start + dur;
    }
    return cur;
  }

  async function handleAddPlace(place: SavedPlace) {
    const nextStart = computeNextStart(allCurrentItems);
    const created = await createItemMutation.mutateAsync({
      tripId,
      dayNumber: activeDay,
      data: { savedPlaceId: place.id, startMinutes: nextStart, estimatedDuration: 60 },
    });
    if (created?.id) {
      undoStackRef.current.push({ type: "add_item", itemId: created.id, dayNumber: activeDay });
      if (undoStackRef.current.length > 20) undoStackRef.current.shift();
    }
    queryClient.invalidateQueries({ queryKey: getGetTripQueryKey(tripId) });
    setShowAddPlace(false);
    toast({ title: `Đã thêm "${place.name}" vào Day ${activeDay}`, description: "Ctrl+Z để hoàn tác" });
  }

  async function handleRemoveItem(itemId: number) {
    const item = allCurrentItems.find((i) => i.id === itemId);
    if (item) {
      undoStackRef.current.push({
        type: "remove_item",
        savedPlaceId: item.savedPlaceId ?? null,
        startMinutes: item.startMinutes ?? null,
        estimatedDuration: item.estimatedDuration ?? null,
        dayNumber: activeDay,
      });
      if (undoStackRef.current.length > 20) undoStackRef.current.shift();
    }
    await deleteItemMutation.mutateAsync({ tripId, itemId });
    queryClient.invalidateQueries({ queryKey: getGetTripQueryKey(tripId) });
    if (selectedItemId === itemId) {
      dismissEdit();
      setSelectedItemId(null);
    }
    toast({ title: `Đã xóa "${item?.place?.name ?? "địa điểm"}"`, description: "Ctrl+Z để hoàn tác" });
  }

  async function handleDurationChange(itemId: number, newDuration: number) {
    await updateItemMutation.mutateAsync({ tripId, itemId, data: { estimatedDuration: newDuration } });
    queryClient.invalidateQueries({ queryKey: getGetTripQueryKey(tripId) });
  }

  async function handleMove(itemId: number, newStartMinutes: number) {
    // Save the new start time
    await updateItemMutation.mutateAsync({ tripId, itemId, data: { startMinutes: newStartMinutes } });
    // Re-sort all items in this day by their effective startMinutes
    const getStart = (item: typeof allCurrentItems[0]) =>
      item.id === itemId ? newStartMinutes : item.startMinutes ?? null;
    let cursor = 8 * 60;
    const itemsWithStart = allCurrentItems.map((item) => {
      const s = getStart(item) ?? cursor;
      cursor = s + (item.estimatedDuration ?? item.place?.estimatedDuration ?? 60);
      return { id: item.id, s };
    });
    itemsWithStart.sort((a, b) => a.s - b.s);
    const newOrder = itemsWithStart.map((x) => x.id);
    await reorderMutation.mutateAsync({ tripId, dayNumber: activeDay, data: { itemIds: newOrder } });
    queryClient.invalidateQueries({ queryKey: getGetTripQueryKey(tripId) });
  }

  function handleDragStart(itemId: number) {
    setDraggedItem(itemId);
  }

  function handleDragOver(e: React.DragEvent, itemId: number) {
    e.preventDefault();
    setDragOverItem(itemId);
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    if (draggedItem == null || dragOverItem == null || draggedItem === dragOverItem) {
      setDraggedItem(null);
      setDragOverItem(null);
      return;
    }
    const ids = currentItems.map((i) => i.id);
    const fromIdx = ids.indexOf(draggedItem);
    const toIdx = ids.indexOf(dragOverItem);
    const newIds = [...ids];
    newIds.splice(fromIdx, 1);
    newIds.splice(toIdx, 0, draggedItem);

    setDraggedItem(null);
    setDragOverItem(null);

    await reorderMutation.mutateAsync({ tripId, dayNumber: activeDay, data: { itemIds: newIds } });
    queryClient.invalidateQueries({ queryKey: getGetTripQueryKey(tripId) });
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading trip...</p>
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Trip not found</p>
          <Button variant="outline" className="mt-4" onClick={() => setLocation("/trips")}>
            Back to Trips
          </Button>
        </div>
      </div>
    );
  }

  const days = trip.days ?? [];

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Left panel */}
      <div className={`flex flex-col bg-sidebar border-r border-sidebar-border shadow-sm z-10 overflow-hidden transition-all duration-300 ease-in-out ${sidebarOpen ? "w-[400px] min-w-[400px]" : "w-0 min-w-0"}`}>
        {/* Header */}
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between gap-2 mb-3">
            <button
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setLocation("/trips")}
              data-testid="button-back-trips"
            >
              <ArrowLeft className="w-4 h-4" />
              My Trips
            </button>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setLocation(`/trips/${tripId}/budget`)}
                className="px-2 py-1 rounded text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center gap-1"
                data-testid="button-view-budget"
                title="Tổng quan"
              >
                <DollarSign className="w-3.5 h-3.5" />
                Tổng quan
              </button>
              <button
                onClick={() => setShowAI((v) => !v)}
                className={`p-1 rounded transition-colors ${showAI ? "text-violet-600 bg-violet-50 hover:bg-violet-100" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
                title="Wandr AI"
              >
                <Sparkles className="w-4 h-4" />
              </button>
              <button
                onClick={() => setShowShareModal(true)}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                title="Chia sẻ"
              >
                <Share2 className="w-4 h-4" />
              </button>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                title="Thu gọn"
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
            </div>
          </div>
          <h1 className="text-lg font-bold text-foreground">{trip.name}</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {format(parseISO(trip.startDate), "MMM d")} — {format(parseISO(trip.endDate), "MMM d, yyyy")} · {trip.totalDays} days
          </p>

          {/* Unified search bar */}
          <div className="relative mt-3">
            <div className="flex items-center gap-2 border border-border rounded-lg px-3 py-2 bg-background focus-within:ring-1 focus-within:ring-primary focus-within:border-primary transition-all">
              {isSearching ? (
                <Loader2 className="w-3.5 h-3.5 text-muted-foreground animate-spin shrink-0" />
              ) : /^https?:\/\//i.test(searchInput.trim()) ? (
                <Link2 className="w-3.5 h-3.5 text-[#4285f4] shrink-0" />
              ) : (
                <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              )}
              <input
                type="text"
                value={searchInput}
                onChange={(e) => handleUnifiedSearchInput(e.target.value)}
                onFocus={() => { if (searchResults.length > 0) setShowSearchResults(true); }}
                onBlur={() => setTimeout(() => setShowSearchResults(false), 150)}
                placeholder="Tìm địa điểm hoặc dán link Google Maps..."
                className="flex-1 text-xs bg-transparent outline-none text-foreground placeholder:text-muted-foreground/60"
              />
              {searchInput && (
                <button onClick={() => { setSearchInput(""); setSearchResults([]); setShowSearchResults(false); }} className="text-muted-foreground hover:text-foreground transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* URL import action */}
            {/^https?:\/\//i.test(searchInput.trim()) && (
              <div className="mt-1.5 flex gap-1.5">
                <button
                  onClick={handleImportFromSearchInput}
                  disabled={isImporting}
                  className="flex-1 bg-[#4285f4] text-white text-xs font-medium py-2 rounded-lg hover:bg-[#3367d6] transition-colors disabled:opacity-60 flex items-center justify-center gap-1.5"
                >
                  {isImporting ? <><Loader2 className="w-3 h-3 animate-spin" />Đang tải...</> : <><Link2 className="w-3 h-3" />Nhập từ Google Maps</>}
                </button>
              </div>
            )}

            {/* Search results dropdown */}
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-20 overflow-hidden">
                {searchResults.map((feature) => (
                  <button
                    key={feature.id}
                    onMouseDown={() => handleSearchResultClick(feature)}
                    className="w-full text-left flex items-start gap-2.5 px-3 py-2.5 hover:bg-muted/70 transition-colors border-b border-border/50 last:border-0"
                  >
                    <MapPin className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{feature.text}</p>
                      <p className="text-[10px] text-muted-foreground truncate mt-0.5">{feature.place_name}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Day blocks */}
        <div className="flex items-center gap-1 px-2 py-2 border-b border-border">
          <button
            onClick={() => dayScrollRef.current?.scrollBy({ left: -120, behavior: "smooth" })}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div ref={dayScrollRef} className="flex gap-1.5 overflow-x-auto scrollbar-hide flex-1">
            {days.map((day) => (
              <button
                key={day.dayNumber}
                onClick={() => { setActiveDay(day.dayNumber); setSelectedItemId(null); }}
                data-testid={`tab-day-${day.dayNumber}`}
                className={`flex flex-col items-center px-3 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                  activeDay === day.dayNumber
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span className="font-semibold">Day {day.dayNumber}</span>
                <span className={`text-[10px] mt-0.5 ${activeDay === day.dayNumber ? "opacity-80" : "opacity-60"}`}>
                  {format(parseISO(day.date), "dd/MM")}
                </span>
              </button>
            ))}
          </div>
          <button
            onClick={() => dayScrollRef.current?.scrollBy({ left: 120, behavior: "smooth" })}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Day summary */}
        {currentItems.length > 0 && (
          <div className="flex gap-4 px-4 py-2.5 border-b border-border bg-muted/40">
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              {currentItems.length} place{currentItems.length !== 1 ? "s" : ""}
            </span>
            {totalDuration > 0 && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                {Math.floor(totalDuration / 60)}h {totalDuration % 60}m
              </span>
            )}
            {totalCost > 0 && (
              <span className="text-xs text-muted-foreground">
                {fmtCost(totalCost, symbol)}
              </span>
            )}
          </div>
        )}

        {/* Tag filter dropdown — only shown if tags exist */}
        {allTags.length > 0 && (
          <div className="px-3 py-2 border-b border-border bg-background/50 flex items-center gap-2" ref={filterDropdownRef}>
            <div className="relative">
              <button
                onClick={() => setFilterDropdownOpen((v) => !v)}
                className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-lg border transition-all ${filterTagIds.size > 0 ? "border-primary/60 bg-primary/10 text-primary" : "border-border bg-background text-muted-foreground hover:text-foreground hover:border-border/80"}`}
              >
                <TagIcon className="w-3 h-3" />
                {filterTagIds.size > 0 ? `Tag (${filterTagIds.size})` : "Tất cả"}
                <ChevronDown className={`w-3 h-3 transition-transform ${filterDropdownOpen ? "rotate-180" : ""}`} />
              </button>
              {filterDropdownOpen && (
                <div className="absolute left-0 top-full mt-1 z-50 min-w-[180px] bg-popover border border-border rounded-xl shadow-lg py-1 overflow-hidden">
                  {allTags.map((tag) => {
                    const checked = filterTagIds.has(tag.id);
                    return (
                      <button
                        key={tag.id}
                        onClick={() => toggleFilterTag(tag.id)}
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-muted transition-colors text-left"
                      >
                        <span
                          className="w-4 h-4 rounded flex items-center justify-center border shrink-0 transition-all"
                          style={checked ? { background: tag.color, borderColor: tag.color } : { borderColor: tag.color + "80", background: tag.color + "18" }}
                        >
                          {checked && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
                        </span>
                        <span className="text-xs font-medium" style={{ color: tag.color }}>{tag.name}</span>
                      </button>
                    );
                  })}
                  {filterTagIds.size > 0 && (
                    <>
                      <div className="border-t border-border my-1" />
                      <button
                        onClick={() => { setFilterTagIds(new Set()); setFilterDropdownOpen(false); }}
                        className="w-full text-left px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        Xóa lựa chọn
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            {filterTagIds.size > 0 && (
              <div className="flex flex-wrap gap-1">
                {allTags.filter((t) => filterTagIds.has(t.id)).map((tag) => (
                  <span
                    key={tag.id}
                    className="text-[10px] font-medium px-2 py-0.5 rounded-full border"
                    style={{ background: tag.color + "22", color: tag.color, borderColor: tag.color + "60" }}
                  >
                    {tag.name}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Day timeline */}
        <DayTimeline
          items={currentItems}
          selectedItemId={selectedItemId}
          symbol={symbol}
          onItemClick={handleItemClick}
          onItemRemove={handleRemoveItem}
          onDurationChange={handleDurationChange}
          onMove={handleMove}
        />

        {/* Add place button */}
        <div className="px-3 pb-3 pt-1 shrink-0">
          <Button
            variant="outline"
            size="sm"
            className="w-full border-dashed"
            onClick={() => setShowAddPlace(true)}
            data-testid="button-add-place"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Thêm địa điểm
          </Button>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {/* Open sidebar button — only shown when collapsed */}
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="absolute top-3 left-3 z-20 bg-card border border-border shadow-md rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
            title="Mở rộng"
          >
            <PanelLeftOpen className="w-4 h-4" />
          </button>
        )}

        <MapView
          onMapReady={(map) => { mapRef.current = map; setMapReady(true); }}
          itineraryItems={currentItems}
          routeMode={routeMode}
          showRoute={currentItems.length >= 2}
          onItineraryMarkerClick={handleMarkerClick}
          onItineraryMarkerDoubleClick={handleMarkerDoubleClick}
          onMapClick={handleMapClick}
          onMapDoubleClick={handleMapDoubleClick}
          onPOIClick={handlePOIClick}
          clickPinCoords={clickPinCoords}
        />

        {/* Quick-adding loading overlay */}
        {isQuickAdding && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-card border border-border shadow-lg text-sm px-4 py-2 rounded-full flex items-center gap-2 z-10">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Đang thêm địa điểm...
          </div>
        )}

        {/* Map hint info icon — top-left of map */}
        <div className={`absolute top-3 z-20 ${sidebarOpen ? "left-3" : "left-12"}`}>
          <button
            className="w-7 h-7 bg-white/90 backdrop-blur-sm border border-black/10 rounded-md flex items-center justify-center text-muted-foreground hover:text-foreground shadow-sm transition-colors"
            onMouseEnter={() => setHintHovered(true)}
            onMouseLeave={() => setHintHovered(false)}
            title="Hướng dẫn sử dụng bản đồ"
          >
            <Info className="w-3.5 h-3.5" />
          </button>
          {(hintHovered || hintAutoOpen) && (
            <div className="absolute top-0 left-9 bg-gray-900/90 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-lg shadow-lg pointer-events-none z-30"
              style={{ animation: "slideInFromLeft 0.3s ease-out forwards", whiteSpace: "nowrap" }}
            >
              <p className="mb-0.5">🖱️ <span className="font-medium">Click</span> để ghim địa điểm</p>
              <p className="mb-0.5">⚡ <span className="font-medium">Double-click</span> để thêm nhanh</p>
              <p>🗑️ <span className="font-medium">Double-click marker</span> để xóa</p>
            </div>
          )}
        </div>

        {/* Reverse geocoding loading */}
        {isReverseGeocoding && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-card border border-border shadow-lg text-sm px-4 py-2 rounded-full flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Đang tải thông tin...
          </div>
        )}

        {/* Edit panel for existing itinerary place — bottom-right of map */}
        {editingPlace && !previewFeature && !isReverseGeocoding && (
          <div className="absolute bottom-4 right-4 bg-card border border-border rounded-xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-2 duration-200" style={{ width: "300px" }}>
            <div className="flex items-start justify-between gap-2 px-3.5 pt-3.5 pb-1">
              <div className="flex-1 min-w-0">
                <input
                  className="w-full text-sm font-semibold text-foreground leading-snug bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none transition-colors truncate"
                  value={editFormName}
                  onChange={(e) => setEditFormName(e.target.value)}
                  placeholder="Tên địa điểm"
                />
                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{editingPlace.address}</p>
              </div>
              <button
                onClick={dismissEdit}
                className="shrink-0 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors mt-0.5"
              >
                <Plus className="w-3.5 h-3.5 rotate-45" />
              </button>
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleSaveEdit(); }} className="px-3.5 pb-3.5 pt-2 space-y-2.5 border-t border-border mt-1">
              {/* Transport mode */}
              {allTransportModes.length > 0 && editingItem && (
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Phương tiện đến đây</label>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    <button
                      type="button"
                      onClick={async () => {
                        if (!editingItem) return;
                        await updateItemMutation.mutateAsync({ tripId, itemId: editingItem.id, data: { transportModeId: null } });
                        queryClient.invalidateQueries({ queryKey: getGetTripQueryKey(tripId) });
                      }}
                      className={`text-[11px] px-2 py-1 rounded-full border transition-all ${!editingItem.transportModeId ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground border-border hover:border-foreground/50"}`}
                    >
                      Không
                    </button>
                    {allTransportModes.map((mode) => {
                      const selected = editingItem.transportModeId === mode.id;
                      return (
                        <button
                          key={mode.id}
                          type="button"
                          onClick={async () => {
                            if (!editingItem) return;
                            await updateItemMutation.mutateAsync({ tripId, itemId: editingItem.id, data: { transportModeId: mode.id } });
                            queryClient.invalidateQueries({ queryKey: getGetTripQueryKey(tripId) });
                          }}
                          className={`text-[11px] px-2 py-1 rounded-full border transition-all flex items-center gap-1 ${selected ? "bg-primary text-primary-foreground border-primary" : "text-muted-foreground border-border hover:border-foreground/50"}`}
                        >
                          <span>{mode.icon}</span>
                          <span>{mode.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* Tags */}
              {allTags.length > 0 && (
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Tag</label>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {allTags.map((tag) => {
                      const selected = editFormTagIds.includes(tag.id);
                      return (
                        <button
                          key={tag.id}
                          type="button"
                          onClick={() => setEditFormTagIds((prev) =>
                            selected ? prev.filter((id) => id !== tag.id) : [...prev, tag.id]
                          )}
                          style={selected
                            ? { background: tag.color, color: "#fff", borderColor: tag.color }
                            : { background: tag.color + "20", color: tag.color, borderColor: tag.color + "50" }
                          }
                          className="text-[11px] font-medium px-2 py-0.5 rounded-full border transition-all"
                        >
                          {tag.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              {/* Estimated cost */}
              <div>
                <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Chi phí dự kiến ({symbol})</label>
                <div className="relative mt-1">
                  <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{symbol}</span>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={editFormCost}
                    onChange={(e) => setEditFormCost(e.target.value)}
                    className="w-full text-sm border border-border rounded-md pl-7 pr-2.5 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
              {/* Buttons */}
              <div className="flex gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={dismissEdit}
                  className="flex-1 text-sm border border-border rounded-lg py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  Quay lại
                </button>
                <button
                  type="submit"
                  disabled={updatePlaceMutation.isPending || setPlaceTagsMutation.isPending}
                  className="flex-1 bg-primary text-primary-foreground text-sm font-medium py-1.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-1"
                >
                  {(updatePlaceMutation.isPending || setPlaceTagsMutation.isPending) ? (
                    <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Đang lưu...</>
                  ) : "Lưu ngay"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Place preview card — bottom-right of map */}
        {previewFeature && !isReverseGeocoding && (
          <div className="absolute bottom-4 right-4 bg-card border border-border rounded-2xl shadow-xl overflow-hidden animate-in slide-in-from-bottom-2 duration-200" style={{ width: "320px" }}>
            {/* Photo */}
            {placePhoto && (
              <div className="relative w-full h-36 bg-muted overflow-hidden">
                <img
                  src={placePhoto}
                  alt={previewFeature.text}
                  className="w-full h-full object-cover"
                  onError={() => setPlacePhoto(null)}
                />
                <button
                  onClick={dismissPin}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors backdrop-blur-sm"
                >
                  <Plus className="w-3.5 h-3.5 rotate-45" />
                </button>
              </div>
            )}

            {/* Header */}
            <div className="flex items-start justify-between gap-2 px-3.5 pt-3 pb-1">
              <div className="flex-1 min-w-0">
                {placeCategory && (() => {
                  const catKey = Object.keys(CATEGORY_MAP).find((k) => placeCategory.toLowerCase().includes(k));
                  const catInfo = catKey ? CATEGORY_MAP[catKey] : null;
                  return catInfo ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded-full mb-1" style={{ background: catInfo.color + "20", color: catInfo.color }}>
                      {catInfo.icon} {catInfo.label}
                    </span>
                  ) : null;
                })()}
                <p className="text-sm font-semibold text-foreground leading-snug line-clamp-1">
                  {placeEnWikiTitle ?? previewFeature.text}
                </p>
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                  {previewFeature.place_name}
                </p>
                {placeDescription && (
                  <p className="text-xs text-foreground/70 leading-relaxed line-clamp-3 mt-1.5 border-t border-border pt-1.5">
                    {placeDescription}
                  </p>
                )}
                {placeWikiUrl && (
                  <a
                    href={placeWikiUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] text-primary hover:text-primary/80 mt-1.5 transition-colors max-w-full"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                    <span className="underline underline-offset-2 truncate">{placeWikiTitle}</span>
                  </a>
                )}
              </div>
              {!placePhoto && (
                <button
                  onClick={dismissPin}
                  className="shrink-0 p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors mt-0.5"
                >
                  <Plus className="w-3.5 h-3.5 rotate-45" />
                </button>
              )}
            </div>

            {!showSaveForm ? (
              /* Preview mode */
              <div className="px-3.5 pb-3.5 pt-2">
                <button
                  onClick={() => {
                    setFormName(placeEnWikiTitle ?? previewFeature.text);
                    setFormCost("");
                    // Auto-select tag matching the place's Mapbox category
                    const autoTagIds: number[] = [];
                    if (placeCategory) {
                      const catKey = Object.keys(CATEGORY_MAP).find((k) => placeCategory.toLowerCase().includes(k));
                      if (catKey) {
                        const catLabel = CATEGORY_MAP[catKey].label.toLowerCase();
                        const matchingTag = allTags.find((t) => t.name.toLowerCase() === catLabel);
                        if (matchingTag) autoTagIds.push(matchingTag.id);
                      }
                    }
                    setFormTagIds(autoTagIds);
                    setShowSaveForm(true);
                  }}
                  className="w-full bg-primary text-primary-foreground text-sm font-medium py-2 rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-1.5"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  Lưu địa điểm
                </button>
              </div>
            ) : (
              /* Inline save form */
              <form onSubmit={(e) => { e.preventDefault(); handleSaveFromMap(); }} className="px-3.5 pb-3.5 pt-2 space-y-2.5 border-t border-border mt-1">
                {/* Name */}
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Tên</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="mt-1 w-full text-sm border border-border rounded-md px-2.5 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                </div>
                {/* Tags */}
                {allTags.length > 0 && (
                  <div>
                    <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Tag</label>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {allTags.map((tag) => {
                        const selected = formTagIds.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => setFormTagIds((prev) =>
                              selected ? prev.filter((id) => id !== tag.id) : [...prev, tag.id]
                            )}
                            style={selected
                              ? { background: tag.color, color: "#fff", borderColor: tag.color }
                              : { background: tag.color + "20", color: tag.color, borderColor: tag.color + "50" }
                            }
                            className="text-[11px] font-medium px-2 py-0.5 rounded-full border transition-all"
                          >
                            {tag.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
                {allTags.length === 0 && (
                  <p className="text-[11px] text-muted-foreground italic">Chưa có tag nào. Tạo tag trong Cài đặt.</p>
                )}
                {/* Estimated cost */}
                <div>
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Chi phí dự kiến ({symbol})</label>
                  <div className="relative mt-1">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">{symbol}</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0"
                      value={formCost ? Number(formCost).toLocaleString("en-US") : ""}
                      onChange={(e) => setFormCost(e.target.value.replace(/[^0-9]/g, ""))}
                      className="w-full text-sm border border-border rounded-md pl-7 pr-2.5 py-1.5 bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
                {/* Buttons */}
                <div className="flex gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setShowSaveForm(false)}
                    className="flex-1 text-sm border border-border rounded-lg py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    Quay lại
                  </button>
                  <button
                    type="submit"
                    disabled={createPlaceMutation.isPending || createItemMutation.isPending || setPlaceTagsMutation.isPending}
                    className="flex-1 bg-primary text-primary-foreground text-sm font-medium py-1.5 rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60 flex items-center justify-center gap-1"
                  >
                    {(createPlaceMutation.isPending || createItemMutation.isPending) ? (
                      <><div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />Đang lưu...</>
                    ) : "Lưu ngay"}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* AI tab — vertical button on right edge of map */}
        <button
          onClick={() => setShowAI((v) => !v)}
          className={`absolute right-0 top-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-1.5 py-3 px-2 rounded-l-xl shadow-lg border border-r-0 transition-all duration-200 ${
            showAI
              ? "bg-blue-600 border-blue-600 text-white"
              : "bg-card border-border text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
          title="Wandr AI"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span
            className="text-[10px] font-semibold tracking-wide"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            AI
          </span>
        </button>
      </div>

      {/* Right AI panel */}
      <div
        className={`flex flex-col border-l border-border bg-background z-10 overflow-hidden transition-all duration-300 ease-in-out ${
          showAI ? "w-[380px] min-w-[380px]" : "w-0 min-w-0"
        }`}
      >
        {showAI && (
          <AIChatBox
            tripId={tripId}
            tripContext={aiTripContext}
            onAddPlace={handleAIAddPlace}
            onViewOnMap={handleViewOnMap}
          />
        )}
      </div>

      {/* Add place modal */}
      {showAddPlace && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-border">
              <h2 className="text-base font-semibold">Add to Day {activeDay}</h2>
              <button onClick={() => setShowAddPlace(false)} className="text-muted-foreground hover:text-foreground p-1">
                <Plus className="w-4 h-4 rotate-45" />
              </button>
            </div>
            <div className="overflow-y-auto p-3 space-y-2 flex-1">
              {savedPlaces.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">
                  No saved places. Search and save places on the Explore page first.
                </div>
              ) : (
                savedPlaces.map((place) => {
                  const addedCount = currentItems.filter((i) => i.savedPlaceId === place.id).length;
                  return (
                    <button
                      key={place.id}
                      className="w-full text-left flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 cursor-pointer transition-all"
                      onClick={() => handleAddPlace(place)}
                      data-testid={`button-add-place-${place.id}`}
                    >
                      <MapPin className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">{place.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{place.address}</p>
                        {addedCount > 0 && (
                          <p className="text-[10px] text-primary/70 mt-0.5">
                            Đã thêm {addedCount} lần hôm nay
                          </p>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Share modal */}
      {showShareModal && (
        <ShareModal
          tripId={tripId}
          tripName={trip.name}
          onClose={() => setShowShareModal(false)}
        />
      )}

    </div>
  );
}
