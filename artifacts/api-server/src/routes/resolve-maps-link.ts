import { Router } from "express";

const router = Router();

async function resolveRedirects(url: string, maxHops = 8): Promise<string> {
  let current = url;
  for (let i = 0; i < maxHops; i++) {
    const res = await fetch(current, {
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Wandr/1.0)" },
    });
    const status = res.status;
    if (status >= 300 && status < 400) {
      const location = res.headers.get("location");
      if (!location) break;
      current = location.startsWith("http") ? location : new URL(location, current).href;
    } else {
      break;
    }
  }
  return current;
}

function extractCoords(url: string): { lat: number; lng: number } | null {
  // @lat,lng,zoom format (most common)
  const atMatch = url.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };

  // !3dLAT!4dLNG format (place URLs)
  const d3Match = url.match(/!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/);
  if (d3Match) return { lat: parseFloat(d3Match[1]), lng: parseFloat(d3Match[2]) };

  // query param: q=lat,lng
  try {
    const u = new URL(url);
    const q = u.searchParams.get("q") || u.searchParams.get("ll");
    if (q) {
      const parts = q.split(",");
      if (parts.length >= 2) {
        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);
        if (!isNaN(lat) && !isNaN(lng)) return { lat, lng };
      }
    }
  } catch { /* ignore */ }

  return null;
}

function extractPlaceName(url: string): string | null {
  try {
    const u = new URL(url);
    const segments = u.pathname.split("/").filter(Boolean);

    for (const keyword of ["place", "search"]) {
      const idx = segments.indexOf(keyword);
      if (idx >= 0 && segments[idx + 1]) {
        const raw = segments[idx + 1];
        // Google encodes + as space and %2B as +
        return decodeURIComponent(raw.replace(/\+/g, " ")).replace(/\s+/g, " ").trim();
      }
    }

    // query param fallback
    const q = u.searchParams.get("q");
    if (q && !q.match(/^-?\d+\.\d+,-?\d+\.\d+$/)) return q;
  } catch { /* ignore */ }
  return null;
}

router.post("/resolve-maps-link", async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "url required" });
  }

  // Accept only google maps domains
  if (!url.match(/maps\.app\.goo\.gl|google\.com\/maps|goo\.gl\/maps/i)) {
    return res.status(400).json({ error: "Chỉ chấp nhận link Google Maps" });
  }

  try {
    const resolved = await resolveRedirects(url);
    const coords = extractCoords(resolved);

    if (!coords) {
      return res.status(422).json({ error: "Không tìm thấy tọa độ trong link này. Hãy thử mở link trên máy tính và copy URL đầy đủ." });
    }

    const name = extractPlaceName(resolved);
    res.json({ lat: coords.lat, lng: coords.lng, name: name ?? null, resolvedUrl: resolved });
  } catch {
    res.status(500).json({ error: "Không thể xử lý link. Vui lòng thử lại." });
  }
});

export default router;
