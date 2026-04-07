import { useState, useCallback, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { Search, MapPin, Clock, Star, Trash2, Edit2, Plus, X, ChevronRight, Crosshair } from "lucide-react";
import { fmtCost } from "@/lib/utils";
import mapboxgl from "mapbox-gl";
import MapView from "@/components/MapView";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useListSavedPlaces, useDeleteSavedPlace, getListSavedPlacesQueryKey } from "@workspace/api-client-react";
import type { SavedPlace } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import SavePlaceModal from "@/components/SavePlaceModal";
import EditPlaceModal from "@/components/EditPlaceModal";
import { useCurrency } from "@/context/CurrencyContext";

function extractCountry(address: string): string {
  const parts = address.split(",");
  return parts[parts.length - 1].trim();
}

function getMostCommonCountry(places: SavedPlace[]): string {
  if (places.length === 0) return "";
  const counts: Record<string, number> = {};
  for (const p of places) {
    const c = extractCountry(p.address ?? "");
    if (c) counts[c] = (counts[c] ?? 0) + 1;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
}

interface GeocodingFeature {
  id: string;
  place_name: string;
  text: string;
  center: [number, number];
  place_type: string[];
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<"search" | "saved">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GeocodingFeature[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<GeocodingFeature | null>(null);
  const [selectedSavedPlace, setSelectedSavedPlace] = useState<SavedPlace | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [editingPlace, setEditingPlace] = useState<SavedPlace | null>(null);
  const [flyToPlace, setFlyToPlace] = useState<SavedPlace | null>(null);
  const [clickPinCoords, setClickPinCoords] = useState<{ lng: number; lat: number } | null>(null);
  const [isReverseGeocoding, setIsReverseGeocoding] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [autoFlyCountry, setAutoFlyCountry] = useState<string>("");
  const hasAutoFlownRef = useRef(false);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { symbol } = useCurrency();
  const [, setLocation] = useLocation();

  const { data: savedPlaces = [], isLoading: loadingSaved } = useListSavedPlaces();
  const deleteMutation = useDeleteSavedPlace();

  // Auto-fly to saved places country when map + data are both ready
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || loadingSaved || hasAutoFlownRef.current || savedPlaces.length === 0) return;
    hasAutoFlownRef.current = true;

    const country = getMostCommonCountry(savedPlaces);
    setAutoFlyCountry(country);

    if (savedPlaces.length === 1) {
      map.flyTo({ center: [savedPlaces[0].longitude, savedPlaces[0].latitude], zoom: 11, duration: 1400 });
    } else {
      const bounds = new mapboxgl.LngLatBounds();
      savedPlaces.forEach((p) => bounds.extend([p.longitude, p.latitude]));
      map.fitBounds(bounds, { padding: 120, maxZoom: 11, duration: 1400 });
    }
  }, [savedPlaces, loadingSaved, mapReady]);

  const handleSearch = useCallback((q: string) => {
    setSearchQuery(q);
    setClickPinCoords(null);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (!q.trim()) { setSearchResults([]); return; }
    searchTimerRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const token = import.meta.env.VITE_MAPBOX_TOKEN;
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${token}&limit=6`
        );
        const data = await res.json();
        setSearchResults(data.features ?? []);
      } catch {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 350);
  }, []);

  const handleSelectFeature = useCallback((feature: GeocodingFeature) => {
    setSelectedFeature(feature);
    setSearchResults([]);
    setSearchQuery(feature.text);
    if (mapRef.current) {
      mapRef.current.flyTo({ center: feature.center, zoom: 14, duration: 1000 });
      new mapboxgl.Marker({ color: "hsl(214, 80%, 32%)" })
        .setLngLat(feature.center)
        .addTo(mapRef.current);
    }
  }, []);

  const handleDeletePlace = useCallback(async (id: number) => {
    await deleteMutation.mutateAsync({ id });
    queryClient.invalidateQueries({ queryKey: getListSavedPlacesQueryKey() });
    toast({ title: "Place removed" });
  }, [deleteMutation, queryClient, toast]);

  const handleMapClick = useCallback(async ({ lng, lat }: { lng: number; lat: number }) => {
    setClickPinCoords({ lng, lat });
    setActiveTab("search");
    setSelectedFeature(null);
    setSearchResults([]);
    setIsReverseGeocoding(true);
    try {
      const token = import.meta.env.VITE_MAPBOX_TOKEN;
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?access_token=${token}&limit=1`
      );
      const data = await res.json();
      const feature = data.features?.[0];
      if (feature) {
        const synth: GeocodingFeature = {
          id: `click-${lng}-${lat}`,
          place_name: feature.place_name,
          text: feature.text ?? feature.place_name.split(",")[0],
          center: [lng, lat],
          place_type: feature.place_type ?? ["poi"],
        };
        setSelectedFeature(synth);
        setSearchQuery(synth.text);
      } else {
        const synth: GeocodingFeature = {
          id: `click-${lng}-${lat}`,
          place_name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          text: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          center: [lng, lat],
          place_type: ["coordinates"],
        };
        setSelectedFeature(synth);
        setSearchQuery(synth.text);
      }
    } catch {
      const synth: GeocodingFeature = {
        id: `click-${lng}-${lat}`,
        place_name: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        text: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        center: [lng, lat],
        place_type: ["coordinates"],
      };
      setSelectedFeature(synth);
    } finally {
      setIsReverseGeocoding(false);
    }
  }, []);

  const categoryColors: Record<string, string> = {
    restaurant: "bg-orange-100 text-orange-800",
    hotel: "bg-blue-100 text-blue-800",
    attraction: "bg-purple-100 text-purple-800",
    shopping: "bg-pink-100 text-pink-800",
    nature: "bg-green-100 text-green-800",
    transport: "bg-gray-100 text-gray-800",
  };

  return (
    <div className="flex h-full w-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-[380px] min-w-[380px] flex flex-col bg-sidebar border-r border-sidebar-border shadow-sm z-10">
        {/* Tab switcher */}
        <div className="flex border-b border-border">
          <button
            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === "search" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setActiveTab("search")}
            data-testid="tab-search"
          >
            Search
          </button>
          <button
            className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === "saved" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setActiveTab("saved")}
            data-testid="tab-saved"
          >
            Saved Places ({savedPlaces.length})
          </button>
        </div>

        {activeTab === "search" && (
          <div className="flex flex-col flex-1 overflow-hidden">
            <div className="p-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search places, cities, landmarks..."
                  className="pl-9"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  data-testid="search-input"
                />
              </div>
            </div>

            {/* Search results */}
            {(searchResults.length > 0 || isSearching) && (
              <div className="mx-4 mb-3 rounded-lg border border-border bg-card shadow-sm overflow-hidden">
                {isSearching ? (
                  <div className="p-4 text-sm text-muted-foreground text-center">Searching...</div>
                ) : (
                  searchResults.map((feature) => (
                    <button
                      key={feature.id}
                      className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-accent transition-colors border-b border-border last:border-0"
                      onClick={() => handleSelectFeature(feature)}
                      data-testid={`search-result-${feature.id}`}
                    >
                      <MapPin className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-foreground">{feature.text}</div>
                        <div className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{feature.place_name}</div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Selected feature panel */}
            {selectedFeature && (
              <div className="mx-4 mb-4 rounded-lg border border-border bg-card shadow-sm p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-foreground">{selectedFeature.text}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{selectedFeature.place_name}</p>
                  </div>
                  <button onClick={() => { setSelectedFeature(null); setClickPinCoords(null); setSearchQuery(""); }} className="text-muted-foreground hover:text-foreground p-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex gap-2 text-xs text-muted-foreground mb-4">
                  <span>{selectedFeature.center[1].toFixed(4)}, {selectedFeature.center[0].toFixed(4)}</span>
                </div>
                <Button
                  size="sm"
                  className="w-full"
                  onClick={() => setShowSaveModal(true)}
                  data-testid="button-save-place"
                >
                  <Plus className="w-4 h-4 mr-1.5" />
                  Save to Places
                </Button>
              </div>
            )}

            {!selectedFeature && searchResults.length === 0 && !isSearching && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                <Search className="w-10 h-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-foreground">Find any place in the world</p>
                <p className="text-xs text-muted-foreground mt-1">Search by city, landmark, or address</p>
              </div>
            )}
          </div>
        )}

        {activeTab === "saved" && (
          <div className="flex-1 overflow-y-auto">
            {loadingSaved ? (
              <div className="p-4 space-y-3">
                {[1,2,3].map(i => <div key={i} className="h-20 rounded-lg bg-muted animate-pulse" />)}
              </div>
            ) : savedPlaces.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-8 text-center h-full">
                <MapPin className="w-10 h-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-foreground">No saved places yet</p>
                <p className="text-xs text-muted-foreground mt-1">Search and save places to build your collection</p>
              </div>
            ) : (
              <div className="p-3 space-y-2">
                {savedPlaces.map((place) => (
                  <div
                    key={place.id}
                    className="rounded-lg border border-border bg-card p-3 hover:shadow-sm transition-shadow cursor-pointer"
                    onClick={() => {
                      setFlyToPlace(place);
                      setSelectedSavedPlace(place);
                    }}
                    data-testid={`saved-place-${place.id}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="text-sm font-medium text-foreground truncate">{place.name}</h4>
                          {place.category && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${categoryColors[place.category] ?? "bg-muted text-muted-foreground"}`}>
                              {place.category}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{place.address}</p>
                        <div className="flex items-center gap-3 mt-1.5">
                          {place.estimatedDuration && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="w-3 h-3" />
                              {place.estimatedDuration}min
                            </span>
                          )}
                          {place.estimatedCost && (
                            <span className="text-xs text-muted-foreground">
                              {fmtCost(place.estimatedCost, symbol)}
                            </span>
                          )}
                          {place.priority && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Star className="w-3 h-3" />{place.priority}/5
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                          onClick={(e) => { e.stopPropagation(); setEditingPlace(place); }}
                          data-testid={`button-edit-place-${place.id}`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                          onClick={(e) => { e.stopPropagation(); handleDeletePlace(place.id); }}
                          data-testid={`button-delete-place-${place.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    {selectedSavedPlace?.id === place.id && (
                      <div className="mt-2 pt-2 border-t border-border">
                        {place.note && <p className="text-xs text-muted-foreground mb-2">{place.note}</p>}
                        {place.openingHours && (
                          <p className="text-xs text-muted-foreground">Hours: {place.openingHours}</p>
                        )}
                        <button
                          className="flex items-center gap-1 text-xs text-primary hover:underline mt-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setLocation("/trips");
                          }}
                        >
                          Add to a trip <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <MapView
          onMapReady={(map) => { mapRef.current = map; setMapReady(true); }}
          savedPlaces={savedPlaces}
          selectedPlace={flyToPlace}
          onPlaceMarkerClick={(place) => {
            setFlyToPlace(place);
            setSelectedSavedPlace(place);
            setActiveTab("saved");
          }}
          onMapClick={handleMapClick}
          clickPinCoords={clickPinCoords}
        />
        {/* Country auto-fly banner */}
        {autoFlyCountry && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 pointer-events-none">
            <div className="bg-card/90 border border-border text-foreground text-sm px-4 py-2 rounded-full flex items-center gap-2 backdrop-blur-sm shadow-md">
              <MapPin className="w-3.5 h-3.5 text-primary" />
              <span>Địa điểm đã lưu tại <span className="font-semibold text-primary">{autoFlyCountry}</span></span>
            </div>
          </div>
        )}
        {/* Click-to-pin hint */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
          <div className="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full flex items-center gap-1.5 backdrop-blur-sm shadow">
            <Crosshair className="w-3 h-3" />
            Nhấp vào bản đồ để ghim địa điểm
          </div>
        </div>
        {/* Reverse geocoding loader */}
        {isReverseGeocoding && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-card border border-border rounded-full px-4 py-1.5 shadow-md text-sm text-foreground flex items-center gap-2">
            <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Đang tìm địa điểm...
          </div>
        )}
      </div>

      {/* Save place modal */}
      {showSaveModal && selectedFeature && (
        <SavePlaceModal
          feature={selectedFeature}
          onClose={() => {
            setShowSaveModal(false);
            setClickPinCoords(null);
            setSelectedFeature(null);
          }}
          onSaved={() => {
            setShowSaveModal(false);
            setClickPinCoords(null);
            setSelectedFeature(null);
            queryClient.invalidateQueries({ queryKey: getListSavedPlacesQueryKey() });
            setActiveTab("saved");
            toast({ title: "Đã lưu địa điểm!" });
          }}
        />
      )}

      {/* Edit place modal */}
      {editingPlace && (
        <EditPlaceModal
          place={editingPlace}
          onClose={() => setEditingPlace(null)}
          onSaved={() => {
            setEditingPlace(null);
            queryClient.invalidateQueries({ queryKey: getListSavedPlacesQueryKey() });
            toast({ title: "Place updated" });
          }}
        />
      )}
    </div>
  );
}
