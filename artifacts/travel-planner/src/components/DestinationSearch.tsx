import { useState, useRef, useEffect, useCallback } from "react";
import { Search, MapPin, Globe, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface GeoFeature {
  id: string;
  place_name: string;
  text: string;
  place_type: string[];
  center: [number, number];
  context?: { id: string; text: string }[];
}

interface DestinationSearchProps {
  value: string;
  onChange: (value: string) => void;
  onSelectCoords?: (center: [number, number], placeType: string[]) => void;
  error?: string;
  autoFocus?: boolean;
}

const MAPBOX_TOKEN = (localStorage.getItem("user_mapbox_token") || import.meta.env.VITE_MAPBOX_TOKEN) as string;

function countryName(feature: GeoFeature): string {
  if (feature.place_type.includes("country")) return "";
  const ctx = feature.context ?? [];
  const country = ctx.find((c) => c.id.startsWith("country."));
  return country?.text ?? "";
}

function placeTypeIcon(feature: GeoFeature) {
  if (feature.place_type.includes("country")) return Globe;
  return MapPin;
}

export function DestinationSearch({
  value,
  onChange,
  onSelectCoords,
  error,
  autoFocus,
}: DestinationSearchProps) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<GeoFeature[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(!!value);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Sync external value
  useEffect(() => {
    if (value !== query) {
      setQuery(value);
      setSelected(!!value);
    }
  }, [value]);

  const search = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    if (!MAPBOX_TOKEN) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?types=country,place&language=vi&limit=6&access_token=${MAPBOX_TOKEN}`;
      const res = await fetch(url);
      const data = await res.json();
      setResults(data.features ?? []);
      setOpen(true);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setQuery(q);
    setSelected(false);
    onChange(""); // clear form value until user picks

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 300);
  }

  function handleSelect(feature: GeoFeature) {
    const name = feature.text;
    setQuery(feature.place_name);
    onChange(name);
    onSelectCoords?.(feature.center, feature.place_type);
    setSelected(true);
    setOpen(false);
    setResults([]);
  }

  function handleClear() {
    setQuery("");
    onChange("");
    setSelected(false);
    setResults([]);
    setOpen(false);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">Điểm đến</label>
        <div
          className={cn(
            "flex items-center gap-2 rounded-xl border bg-background px-3 py-2 transition-all",
            open
              ? "border-primary ring-2 ring-primary/20 shadow-sm"
              : error
                ? "border-destructive"
                : "border-border hover:border-primary/50",
          )}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 text-muted-foreground shrink-0 animate-spin" />
          ) : (
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
          )}
          <input
            ref={inputRef}
            autoFocus={autoFocus}
            value={query}
            onChange={handleInputChange}
            onFocus={() => {
              if (results.length > 0) setOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Tìm thành phố hoặc quốc gia..."
            className="flex-1 bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground"
          />
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <div className="absolute left-0 right-0 z-50 mt-1.5 bg-card border border-border rounded-xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-100">
          <ul className="py-1">
            {results.map((feature) => {
              const Icon = placeTypeIcon(feature);
              const country = countryName(feature);
              const isCountry = feature.place_type.includes("country");
              return (
                <li key={feature.id}>
                  <button
                    type="button"
                    onClick={() => handleSelect(feature)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent transition-colors text-left"
                  >
                    <div
                      className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                        isCountry ? "bg-blue-100 text-blue-600" : "bg-primary/10 text-primary",
                      )}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {feature.text}
                      </p>
                      {country && (
                        <p className="text-xs text-muted-foreground truncate">{country}</p>
                      )}
                      {isCountry && (
                        <p className="text-xs text-muted-foreground">Quốc gia</p>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* No results hint */}
      {open && !loading && query.length >= 2 && results.length === 0 && (
        <div className="absolute left-0 right-0 z-50 mt-1.5 bg-card border border-border rounded-xl shadow-xl p-4 text-center animate-in fade-in duration-100">
          <p className="text-sm text-muted-foreground">Không tìm thấy địa điểm</p>
        </div>
      )}
    </div>
  );
}
