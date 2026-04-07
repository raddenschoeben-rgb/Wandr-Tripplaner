import { useEffect, useRef, useCallback, useState } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import { Map as MapIcon } from "lucide-react";
import type { SavedPlace, ItineraryItem } from "@workspace/api-client-react";
import { getTagIcon } from "@/lib/tag-icons";

mapboxgl.accessToken = localStorage.getItem("user_mapbox_token") || import.meta.env.VITE_MAPBOX_TOKEN;

const ANIM_SOURCE = "route-anim";
const ANIM_LAYER = "route-anim-line";

interface MapViewProps {
  onMapReady?: (map: mapboxgl.Map) => void;
  savedPlaces?: SavedPlace[];
  itineraryItems?: ItineraryItem[];
  selectedPlace?: SavedPlace | null;
  onPlaceMarkerClick?: (place: SavedPlace) => void;
  onItineraryMarkerClick?: (item: ItineraryItem) => void;
  onItineraryMarkerDoubleClick?: (item: ItineraryItem) => void;
  routeMode?: "driving" | "walking" | "cycling" | "transit";
  showRoute?: boolean;
  onMapClick?: (coords: { lng: number; lat: number }) => void;
  onMapDoubleClick?: (coords: { lng: number; lat: number }) => void;
  onPOIClick?: (poi: { name: string; lng: number; lat: number; category?: string }) => void;
  clickPinCoords?: { lng: number; lat: number } | null;
}

function bezierLine(
  a: [number, number],
  b: [number, number],
  curvature = 0.18,
  steps = 60,
): [number, number][] {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const cx = mx - dy * curvature;
  const cy = my + dx * curvature;
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    pts.push([u * u * a[0] + 2 * u * t * cx + t * t * b[0], u * u * a[1] + 2 * u * t * cy + t * t * b[1]]);
  }
  return pts;
}

function makeLineFeature(coords: [number, number][]): GeoJSON.Feature {
  return {
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: coords },
  };
}

function cleanupAnim(map: mapboxgl.Map) {
  try { if (map.getLayer(ANIM_LAYER)) map.removeLayer(ANIM_LAYER); } catch { /* */ }
  try { if (map.getSource(ANIM_SOURCE)) map.removeSource(ANIM_SOURCE); } catch { /* */ }
}

function animateSegment(
  map: mapboxgl.Map,
  from: { longitude: number; latitude: number },
  to: { longitude: number; latitude: number },
  duration: number,
  rafRef: { current: number | null },
) {
  cleanupAnim(map);

  const pts = bezierLine([from.longitude, from.latitude], [to.longitude, to.latitude]);

  map.addSource(ANIM_SOURCE, {
    type: "geojson",
    data: makeLineFeature([pts[0], pts[1]]),
  });
  map.addLayer({
    id: ANIM_LAYER,
    type: "line",
    source: ANIM_SOURCE,
    layout: { "line-join": "round", "line-cap": "round" },
    paint: {
      "line-color": "hsl(214, 80%, 42%)",
      "line-width": 2,
      "line-opacity": 1,
      "line-dasharray": [4, 3],
    },
  });

  const total = pts.length;
  const startTime = performance.now();

  function frame(now: number) {
    const raw = (now - startTime) / duration;
    const t = Math.min(raw, 1);
    // ease-out quad
    const eased = 1 - (1 - t) * (1 - t);
    const count = Math.max(2, Math.ceil(eased * total));
    const src = map.getSource(ANIM_SOURCE) as mapboxgl.GeoJSONSource | undefined;
    if (src) src.setData(makeLineFeature(pts.slice(0, count)));
    if (t < 1) {
      rafRef.current = requestAnimationFrame(frame);
    } else {
      rafRef.current = null;
    }
  }

  rafRef.current = requestAnimationFrame(frame);
}

export default function MapView({
  onMapReady,
  savedPlaces = [],
  itineraryItems = [],
  selectedPlace,
  onPlaceMarkerClick,
  onItineraryMarkerClick,
  onItineraryMarkerDoubleClick,
  showRoute = false,
  onMapClick,
  onMapDoubleClick,
  onPOIClick,
  clickPinCoords,
}: MapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const routeMarkersRef = useRef<mapboxgl.Marker[]>([]);
  const clickPinRef = useRef<mapboxgl.Marker | null>(null);
  const onItineraryMarkerClickRef = useRef(onItineraryMarkerClick);
  const onItineraryMarkerDoubleClickRef = useRef(onItineraryMarkerDoubleClick);
  const onMapClickRef = useRef(onMapClick);
  const onMapDoubleClickRef = useRef(onMapDoubleClick);
  const onPOIClickRef = useRef(onPOIClick);
  const clickTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevItemsRef = useRef<ItineraryItem[]>([]);
  const animRafRef = useRef<number | null>(null);
  const [webGLError, setWebGLError] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);

  useEffect(() => { onItineraryMarkerClickRef.current = onItineraryMarkerClick; }, [onItineraryMarkerClick]);
  useEffect(() => { onItineraryMarkerDoubleClickRef.current = onItineraryMarkerDoubleClick; }, [onItineraryMarkerDoubleClick]);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);
  useEffect(() => { onMapDoubleClickRef.current = onMapDoubleClick; }, [onMapDoubleClick]);
  useEffect(() => { onPOIClickRef.current = onPOIClick; }, [onPOIClick]);

  const clearMarkers = useCallback(() => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
  }, []);

  const clearRouteMarkers = useCallback(() => {
    routeMarkersRef.current.forEach((m) => m.remove());
    routeMarkersRef.current = [];
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    if (!mapboxgl.supported()) {
      setWebGLError(true);
      return;
    }

    let map: mapboxgl.Map;
    try {
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/streets-v12",
        center: [0, 20],
        zoom: 1.8,
        attributionControl: false,
        failIfMajorPerformanceCaveat: false,
      });
    } catch {
      setWebGLError(true);
      return;
    }

    map.addControl(new mapboxgl.NavigationControl(), "top-right");

    map.on("load", () => {
      mapRef.current = map;
      setMapLoaded(true);
      onMapReady?.(map);
    });

    map.on("click", (e) => {
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      const coords = { lng: e.lngLat.lng, lat: e.lngLat.lat };
      const point = e.point;
      clickTimerRef.current = setTimeout(() => {
        clickTimerRef.current = null;
        const poiLayers = ["poi-label", "transit-label", "airport-label", "place-label"];
        const existingLayers = poiLayers.filter((l) => { try { return !!map.getLayer(l); } catch { return false; } });
        if (existingLayers.length > 0 && onPOIClickRef.current) {
          const features = map.queryRenderedFeatures(point, { layers: existingLayers });
          if (features.length > 0) {
            const f = features[0];
            const name = (f.properties?.name_en ?? f.properties?.name ?? "") as string;
            const category = (f.properties?.category ?? f.properties?.type ?? undefined) as string | undefined;
            if (name) {
              onPOIClickRef.current({ name, lng: coords.lng, lat: coords.lat, category });
              return;
            }
          }
        }
        onMapClickRef.current?.(coords);
      }, 260);
    });

    map.on("dblclick", (e) => {
      if (clickTimerRef.current) { clearTimeout(clickTimerRef.current); clickTimerRef.current = null; }
      e.preventDefault();
      onMapDoubleClickRef.current?.({ lng: e.lngLat.lng, lat: e.lngLat.lat });
    });

    map.on("error", () => {});

    return () => {
      clearMarkers();
      clearRouteMarkers();
      if (clickTimerRef.current) clearTimeout(clickTimerRef.current);
      if (animRafRef.current) cancelAnimationFrame(animRafRef.current);
      map.remove();
      mapRef.current = null;
      setMapLoaded(false);
    };
  }, []);

  // Saved place markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    clearMarkers();

    savedPlaces.forEach((place) => {
      const el = document.createElement("div");
      el.className = "place-marker primary";
      const marker = new mapboxgl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([place.longitude, place.latitude])
        .addTo(map);
      el.addEventListener("click", () => onPlaceMarkerClick?.(place));
      markersRef.current.push(marker);
    });
  }, [mapLoaded, savedPlaces, clearMarkers, onPlaceMarkerClick]);

  // Fly to selected place
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedPlace) return;
    map.flyTo({
      center: [selectedPlace.longitude, selectedPlace.latitude],
      zoom: 14,
      duration: 1200,
    });
  }, [selectedPlace]);

  // Click-to-pin: show/move/remove a drop pin
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!clickPinCoords) {
      clickPinRef.current?.remove();
      clickPinRef.current = null;
      return;
    }
    if (clickPinRef.current) {
      clickPinRef.current.setLngLat([clickPinCoords.lng, clickPinCoords.lat]);
    } else {
      const el = document.createElement("div");
      el.className = "click-pin-marker";
      clickPinRef.current = new mapboxgl.Marker({ element: el, anchor: "bottom" })
        .setLngLat([clickPinCoords.lng, clickPinCoords.lat])
        .addTo(map);
    }
    map.flyTo({ center: [clickPinCoords.lng, clickPinCoords.lat], zoom: Math.max(map.getZoom(), 12), duration: 600 });
  }, [clickPinCoords]);

  // Curved route lines + emoji markers for itinerary
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    // --- Detect new single item ---
    const prev = prevItemsRef.current;
    const prevIds = new Set(prev.map((i) => i.id));
    const newItems = itineraryItems.filter((i) => !prevIds.has(i.id));
    const isOneNewItem = newItems.length === 1 && itineraryItems.length > 1;
    prevItemsRef.current = itineraryItems;

    // Cancel any in-progress animation
    if (animRafRef.current) {
      cancelAnimationFrame(animRafRef.current);
      animRafRef.current = null;
    }

    clearRouteMarkers();

    // Remove old route layers/sources
    cleanupAnim(map);
    if (map.getLayer("route-line")) map.removeLayer("route-line");
    if (map.getSource("route")) map.removeSource("route");

    const placesWithCoords = itineraryItems
      .filter((item) => item.place?.latitude && item.place?.longitude)
      .sort((a, b) => a.position - b.position);

    if (placesWithCoords.length === 0) return;

    // Add emoji/numbered markers
    placesWithCoords.forEach((item, idx) => {
      if (!item.place) return;
      const firstTag = item.place.tags?.[0];
      const icon = firstTag ? getTagIcon(firstTag) : null;
      const isNew = isOneNewItem && item.id === newItems[0].id;

      const el = document.createElement("div");
      if (icon) {
        el.className = "emoji-marker" + (isNew ? " marker-pop" : "");
        el.textContent = icon;
      } else {
        el.className = "numbered-marker" + (isNew ? " marker-pop" : "");
        el.textContent = String(idx + 1);
      }
      // Start flag badge for first place
      if (idx === 0) {
        el.style.position = "relative";
        el.style.overflow = "visible";
        const flag = document.createElement("div");
        flag.className = "start-flag";
        flag.innerHTML = `<svg viewBox="0 0 14 22" width="14" height="22" xmlns="http://www.w3.org/2000/svg">
          <line x1="2" y1="0" x2="2" y2="22" stroke="#16a34a" stroke-width="2.5" stroke-linecap="round"/>
          <polygon points="2,1 14,5 2,10" fill="#16a34a"/>
        </svg>`;
        el.appendChild(flag);
      }

      el.title = item.place.name ?? "";
      el.style.cursor = "pointer";
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        onItineraryMarkerClickRef.current?.(item);
      });
      el.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        e.preventDefault();
        onItineraryMarkerDoubleClickRef.current?.(item);
      });
      const marker = new mapboxgl.Marker({ element: el })
        .setLngLat([item.place.longitude, item.place.latitude])
        .addTo(map);
      routeMarkersRef.current.push(marker);
    });

    // Fit bounds only when NOT adding a single new item (avoid jarring re-fit)
    if (!isOneNewItem) {
      if (placesWithCoords.length >= 2) {
        const bounds = new mapboxgl.LngLatBounds();
        placesWithCoords.forEach((item) => {
          if (item.place) bounds.extend([item.place.longitude, item.place.latitude]);
        });
        map.fitBounds(bounds, { padding: 80, duration: 800 });
      } else if (placesWithCoords[0]?.place) {
        map.flyTo({
          center: [placesWithCoords[0].place.longitude, placesWithCoords[0].place.latitude],
          zoom: 13,
        });
      }
    }

    // Draw static route for all segments
    if (!showRoute || placesWithCoords.length < 2) return;

    // When a new single item is added, find which segment is new
    let newSegmentIdx = -1;
    if (isOneNewItem) {
      const newId = newItems[0].id;
      newSegmentIdx = placesWithCoords.findIndex((i) => i.id === newId);
    }

    // Build static segments (skip the new segment — it will be animated)
    const staticSegments: [number, number][][] = [];
    for (let i = 0; i < placesWithCoords.length - 1; i++) {
      if (isOneNewItem && i === newSegmentIdx - 1) continue; // will animate this one
      const a = placesWithCoords[i].place!;
      const b = placesWithCoords[i + 1].place!;
      staticSegments.push(bezierLine([a.longitude, a.latitude], [b.longitude, b.latitude]));

      const transportIcon = placesWithCoords[i + 1].transportMode?.icon;
      if (transportIcon) {
        const pts = bezierLine([a.longitude, a.latitude], [b.longitude, b.latitude]);
        const midPt = pts[Math.floor(pts.length / 2)];
        const el = document.createElement("div");
        el.className = "transport-midpoint-marker";
        el.textContent = transportIcon;
        const marker = new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat(midPt)
          .addTo(map);
        routeMarkersRef.current.push(marker);
      }
    }

    if (staticSegments.length > 0) {
      map.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: { type: "MultiLineString", coordinates: staticSegments },
        } as GeoJSON.Feature,
      });
      map.addLayer({
        id: "route-line",
        type: "line",
        source: "route",
        layout: { "line-join": "round", "line-cap": "round" },
        paint: {
          "line-color": "hsl(214, 80%, 32%)",
          "line-width": 1.5,
          "line-opacity": 0.7,
          "line-dasharray": [4, 3],
        },
      });
    }

    // Animate the new segment
    if (isOneNewItem && newSegmentIdx > 0) {
      const fromPlace = placesWithCoords[newSegmentIdx - 1].place!;
      const toPlace = placesWithCoords[newSegmentIdx].place!;
      animateSegment(map, fromPlace, toPlace, 500, animRafRef);
    } else if (isOneNewItem && newSegmentIdx === 0 && placesWithCoords.length >= 2) {
      // New item inserted at start — animate from new[0] to new[1]
      const fromPlace = placesWithCoords[0].place!;
      const toPlace = placesWithCoords[1].place!;
      animateSegment(map, fromPlace, toPlace, 500, animRafRef);
    }
  }, [mapLoaded, itineraryItems, showRoute, clearRouteMarkers]);

  if (webGLError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-muted/20" data-testid="map-container">
        <MapIcon className="w-12 h-12 text-muted-foreground/40 mb-4" />
        <p className="text-sm font-medium text-foreground mb-1">Map unavailable</p>
        <p className="text-xs text-muted-foreground text-center max-w-xs">
          WebGL is required for map rendering. Enable hardware acceleration in your browser settings.
        </p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`w-full h-full${onMapClick ? " cursor-crosshair" : ""}`}
      data-testid="map-container"
    />
  );
}
