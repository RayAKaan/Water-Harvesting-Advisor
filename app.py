from flask import Flask, render_template, request, jsonify
from concurrent.futures import ThreadPoolExecutor, as_completed
import json
import math
import os
from pathlib import Path
import statistics
import time
from datetime import datetime, timedelta

import requests

try:
    from dotenv import load_dotenv
except ImportError:
    load_dotenv = None

if load_dotenv:
    load_dotenv()

app = Flask(__name__)

GRID = 28
RADIUS_KM = 2.5
ELEV_CHUNK = 100
OSM_RADIUS = 3500
CACHE_DURATION = 86400
VISUAL_CROSSING_TIMEOUT = 15
HISTORICAL_RAIN_THRESHOLD_MM = 1.0
VISUAL_CROSSING_KEY = os.getenv("VISUAL_CROSSING_API_KEY", "").strip()
CACHE_DIR = Path("cache")
CACHE_DIR.mkdir(exist_ok=True)

CITIES = {
    "Mumbai": {"lat": 19.0760, "lon": 72.8777, "rain": 2400, "hum": 75, "alt": 14, "coast": True, "stress": "High", "mo": [1, 1, 0, 1, 20, 530, 840, 555, 340, 75, 15, 3]},
    "Delhi": {"lat": 28.7041, "lon": 77.1025, "rain": 797, "hum": 56, "alt": 216, "coast": False, "stress": "Very High", "mo": [19, 18, 13, 7, 26, 54, 210, 233, 127, 14, 4, 8]},
    "Bangalore": {"lat": 12.9716, "lon": 77.5946, "rain": 970, "hum": 65, "alt": 920, "coast": False, "stress": "High", "mo": [2, 7, 15, 47, 120, 80, 110, 140, 195, 155, 65, 15]},
    "Chennai": {"lat": 13.0827, "lon": 80.2707, "rain": 1400, "hum": 72, "alt": 6, "coast": True, "stress": "Very High", "mo": [25, 10, 5, 15, 35, 50, 90, 120, 120, 265, 360, 180]},
    "Hyderabad": {"lat": 17.3850, "lon": 78.4867, "rain": 820, "hum": 58, "alt": 542, "coast": False, "stress": "High", "mo": [5, 10, 15, 25, 45, 105, 165, 175, 155, 85, 25, 5]},
    "Kolkata": {"lat": 22.5726, "lon": 88.3639, "rain": 1650, "hum": 73, "alt": 9, "coast": True, "stress": "Moderate", "mo": [10, 22, 32, 50, 135, 260, 330, 335, 255, 135, 20, 5]},
    "Pune": {"lat": 18.5204, "lon": 73.8567, "rain": 722, "hum": 55, "alt": 560, "coast": False, "stress": "High", "mo": [1, 1, 3, 12, 35, 120, 195, 145, 130, 65, 25, 5]},
    "Ahmedabad": {"lat": 23.0225, "lon": 72.5714, "rain": 782, "hum": 52, "alt": 53, "coast": False, "stress": "Very High", "mo": [1, 1, 1, 1, 5, 100, 290, 215, 115, 15, 5, 2]},
    "Jaipur": {"lat": 26.9124, "lon": 75.7873, "rain": 600, "hum": 45, "alt": 431, "coast": False, "stress": "Very High", "mo": [5, 5, 3, 3, 12, 55, 195, 180, 75, 12, 3, 3]},
    "Lucknow": {"lat": 26.8467, "lon": 80.9462, "rain": 900, "hum": 62, "alt": 123, "coast": False, "stress": "High", "mo": [18, 15, 10, 5, 15, 90, 265, 260, 155, 30, 5, 8]},
    "Shimla": {"lat": 31.1048, "lon": 77.1734, "rain": 1580, "hum": 68, "alt": 2276, "coast": False, "stress": "Moderate", "mo": [60, 65, 70, 45, 55, 150, 390, 350, 160, 40, 15, 25]},
    "Guwahati": {"lat": 26.1445, "lon": 91.7362, "rain": 1722, "hum": 78, "alt": 55, "coast": False, "stress": "Low", "mo": [8, 16, 45, 130, 280, 310, 330, 250, 185, 95, 15, 5]},
    "Thiruvananthapuram": {"lat": 8.5241, "lon": 76.9366, "rain": 1835, "hum": 80, "alt": 10, "coast": True, "stress": "Moderate", "mo": [20, 20, 40, 110, 230, 330, 210, 165, 175, 270, 170, 60]},
    "Dehradun": {"lat": 30.3165, "lon": 78.0322, "rain": 2073, "hum": 70, "alt": 640, "coast": False, "stress": "Low", "mo": [40, 45, 40, 25, 55, 280, 580, 540, 230, 40, 8, 15]},
    "Nagpur": {"lat": 21.1458, "lon": 79.0882, "rain": 1100, "hum": 52, "alt": 310, "coast": False, "stress": "High", "mo": [10, 10, 15, 10, 15, 165, 310, 280, 165, 55, 20, 10]},
    "Coimbatore": {"lat": 11.0168, "lon": 76.9558, "rain": 640, "hum": 65, "alt": 411, "coast": False, "stress": "High", "mo": [5, 5, 15, 50, 80, 30, 25, 30, 45, 130, 120, 65]},
    "Jodhpur": {"lat": 26.2389, "lon": 73.0243, "rain": 360, "hum": 42, "alt": 231, "coast": False, "stress": "Very High", "mo": [2, 2, 2, 2, 8, 35, 105, 115, 50, 10, 3, 2]},
    "Patna": {"lat": 25.6093, "lon": 85.1376, "rain": 1100, "hum": 65, "alt": 53, "coast": False, "stress": "Moderate", "mo": [15, 12, 8, 10, 40, 150, 300, 280, 175, 55, 5, 5]},
    "Chandigarh": {"lat": 30.7333, "lon": 76.7794, "rain": 1100, "hum": 58, "alt": 321, "coast": False, "stress": "Moderate", "mo": [25, 30, 25, 10, 25, 150, 280, 270, 120, 15, 5, 15]},
    "Bhopal": {"lat": 23.2599, "lon": 77.4126, "rain": 1146, "hum": 55, "alt": 527, "coast": False, "stress": "Moderate", "mo": [10, 8, 5, 3, 10, 130, 380, 330, 185, 40, 10, 5]},
    "Ranchi": {"lat": 23.3441, "lon": 85.3096, "rain": 1430, "hum": 62, "alt": 651, "coast": False, "stress": "Moderate", "mo": [15, 20, 20, 30, 50, 200, 340, 330, 240, 90, 15, 5]},
    "Visakhapatnam": {"lat": 17.6868, "lon": 83.2185, "rain": 1118, "hum": 72, "alt": 3, "coast": True, "stress": "Moderate", "mo": [10, 10, 10, 20, 55, 95, 145, 155, 175, 230, 125, 35]},
    "Indore": {"lat": 22.7196, "lon": 75.8577, "rain": 960, "hum": 50, "alt": 553, "coast": False, "stress": "High", "mo": [5, 5, 3, 3, 10, 130, 300, 280, 155, 30, 10, 5]},
}

ROOF_C = {"metal": 0.95, "concrete": 0.90, "tile": 0.85, "asphalt": 0.85, "gravel": 0.70, "soil": 0.50, "grass": 0.35}
LAND_C = {"paved": 0.85, "driveway": 0.80, "compacted": 0.60, "open": 0.40, "garden": 0.25, "sandy": 0.15}
SOIL_INF = {"sandy": 50, "loamy": 25, "laterite": 15, "clay_loam": 10, "clay": 5, "rocky": 2}
TANKS = [500, 1000, 2000, 5000, 10000, 15000, 20000, 25000]

def _safe_float(v, default=0.0):
    try:
        return float(v)
    except Exception:
        return default

def _safe_int(v, default=0):
    try:
        return int(v)
    except Exception:
        return default

def _coerce_float_or_none(value):
    try:
        number = float(value)
        if math.isfinite(number):
            return number
    except Exception:
        pass
    return None

def _round_or_none(value, digits=2):
    number = _coerce_float_or_none(value)
    return round(number, digits) if number is not None else None

def _normalize_precip_type(value):
    if value in (None, "", []):
        return None
    if isinstance(value, list):
        items = [str(item).strip().lower() for item in value if str(item).strip()]
        return items or None
    parts = [part.strip().lower() for part in str(value).replace(";", ",").split(",") if part.strip()]
    return parts or None

def _weather_code_to_precip_type(code):
    rain_codes = {51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82}
    snow_codes = {71, 73, 75, 77, 85, 86}
    precip_type = []
    if code in rain_codes:
        precip_type.append("rain")
    if code in snow_codes:
        precip_type.append("snow")
    return precip_type or None

def get_cache_path(cache_key):
    return CACHE_DIR / f"{cache_key}.json"

def is_cache_valid(cache_path):
    if not cache_path.exists():
        return False
    return (time.time() - cache_path.stat().st_mtime) < CACHE_DURATION

def get_cached_historical(cache_key):
    cache_path = get_cache_path(cache_key)
    if not is_cache_valid(cache_path):
        return None
    try:
        with cache_path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, json.JSONDecodeError):
        return None

def save_cached_historical(cache_key, data):
    cache_path = get_cache_path(cache_key)
    try:
        with cache_path.open("w", encoding="utf-8") as handle:
            json.dump(data, handle, ensure_ascii=False)
    except OSError as exc:
        app.logger.warning("Failed to save historical cache %s: %s", cache_key, exc)

def _build_historical_record(date_value, precipitation_mm, precip_type=None, humidity=None, temp_max_c=None, temp_min_c=None, wind_speed_kmh=None):
    return {
        "date": str(date_value),
        "precipitation_mm": round(max(_coerce_float_or_none(precipitation_mm) or 0.0, 0.0), 2),
        "precip_type": _normalize_precip_type(precip_type),
        "humidity": _round_or_none(humidity, 2),
        "temp_max_c": _round_or_none(temp_max_c, 2),
        "temp_min_c": _round_or_none(temp_min_c, 2),
        "wind_speed_kmh": _round_or_none(wind_speed_kmh, 2),
    }

def calculate_rainfall_statistics(daily_data):
    total_days = len(daily_data)
    rainy_days = 0
    total_precipitation = 0.0
    max_daily_rainfall = 0.0
    dry_spell = 0
    dry_spell_max = 0

    for entry in daily_data:
        rainfall = max(_coerce_float_or_none(entry.get("precipitation_mm")) or 0.0, 0.0)
        total_precipitation += rainfall
        max_daily_rainfall = max(max_daily_rainfall, rainfall)
        if rainfall > HISTORICAL_RAIN_THRESHOLD_MM:
            rainy_days += 1
            dry_spell = 0
        else:
            dry_spell += 1
            dry_spell_max = max(dry_spell_max, dry_spell)

    years_covered = max(total_days / 365.25, 1 / 365.25) if total_days else 1
    avg_annual_rainfall = total_precipitation / years_covered if total_days else 0.0

    return {
        "total_days": total_days,
        "rainy_days": rainy_days,
        "total_precipitation_mm": round(total_precipitation, 2),
        "avg_annual_rainfall_mm": round(avg_annual_rainfall, 2),
        "max_daily_rainfall_mm": round(max_daily_rainfall, 2),
        "dry_spell_max_days": dry_spell_max,
    }

def fetch_visual_crossing_historical(lat, lon, start_date, end_date):
    """
    Fetch from Visual Crossing API.
    Returns: (success: bool, data: list | None, error: str | None)
    """
    if not VISUAL_CROSSING_KEY or VISUAL_CROSSING_KEY == "YOUR_KEY_HERE":
        return False, None, "Visual Crossing API key is not configured."

    location = f"{lat:.6f},{lon:.6f}"
    url = f"https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/{location}/{start_date}/{end_date}"
    params = {
        "key": VISUAL_CROSSING_KEY,
        "include": "days",
        "elements": "datetime,precip,preciptype,humidity,tempmax,tempmin,windspeed",
        "unitGroup": "metric",
        "contentType": "json",
    }

    try:
        response = requests.get(url, params=params, timeout=VISUAL_CROSSING_TIMEOUT)
        if response.status_code == 429:
            return False, None, "Visual Crossing quota or rate limit exceeded."
        if response.status_code in {401, 403}:
            return False, None, "Visual Crossing rejected the configured API key."
        response.raise_for_status()
        payload = response.json()
        days = payload.get("days") or []
        if not days:
            return False, None, "Visual Crossing returned no daily records."
        daily_data = [
            _build_historical_record(
                day.get("datetime"),
                day.get("precip"),
                day.get("preciptype"),
                day.get("humidity"),
                day.get("tempmax"),
                day.get("tempmin"),
                day.get("windspeed"),
            )
            for day in days
        ]
        return True, daily_data, None
    except requests.Timeout:
        return False, None, "Visual Crossing request timed out."
    except requests.RequestException as exc:
        return False, None, f"Visual Crossing request failed: {exc}"
    except (TypeError, ValueError, KeyError) as exc:
        return False, None, f"Visual Crossing parsing failed: {exc}"

def fetch_open_meteo_historical_fallback(lat, lon, start_date, end_date):
    """
    Fallback to Open-Meteo archive API when Visual Crossing is unavailable.
    """
    archive_url = "https://archive-api.open-meteo.com/v1/archive"
    base_params = {
        "latitude": lat,
        "longitude": lon,
        "start_date": start_date,
        "end_date": end_date,
        "timezone": "GMT",
    }

    try:
        daily_response = requests.get(
            archive_url,
            params={
                **base_params,
                "daily": "precipitation_sum,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,weather_code",
            },
            timeout=VISUAL_CROSSING_TIMEOUT,
        )
        daily_response.raise_for_status()
        daily_payload = daily_response.json().get("daily", {})

        humidity_response = requests.get(
            archive_url,
            params={**base_params, "hourly": "relative_humidity_2m"},
            timeout=VISUAL_CROSSING_TIMEOUT,
        )
        humidity_response.raise_for_status()
        humidity_payload = humidity_response.json().get("hourly", {})

        humidity_buckets = {}
        humidity_times = humidity_payload.get("time") or []
        humidity_values = humidity_payload.get("relative_humidity_2m") or []
        for index, stamp in enumerate(humidity_times):
            humidity = _coerce_float_or_none(humidity_values[index] if index < len(humidity_values) else None)
            if humidity is None:
                continue
            day_key = str(stamp).split("T")[0]
            humidity_buckets.setdefault(day_key, []).append(humidity)
        humidity_by_day = {
            day_key: sum(values) / len(values)
            for day_key, values in humidity_buckets.items()
            if values
        }

        times = daily_payload.get("time") or []
        precipitation = daily_payload.get("precipitation_sum") or []
        temp_max = daily_payload.get("temperature_2m_max") or []
        temp_min = daily_payload.get("temperature_2m_min") or []
        wind_speed = daily_payload.get("wind_speed_10m_max") or []
        weather_codes = daily_payload.get("weather_code") or []

        daily_data = []
        for index, day_value in enumerate(times):
            code = _safe_int(weather_codes[index], -1) if index < len(weather_codes) else -1
            daily_data.append(
                _build_historical_record(
                    day_value,
                    precipitation[index] if index < len(precipitation) else 0.0,
                    _weather_code_to_precip_type(code),
                    humidity_by_day.get(day_value),
                    temp_max[index] if index < len(temp_max) else None,
                    temp_min[index] if index < len(temp_min) else None,
                    wind_speed[index] if index < len(wind_speed) else None,
                )
            )

        if not daily_data:
            return False, None, "Open-Meteo fallback returned no daily records."
        return True, daily_data, None
    except requests.Timeout:
        return False, None, "Open-Meteo fallback timed out."
    except requests.RequestException as exc:
        return False, None, f"Open-Meteo fallback request failed: {exc}"
    except (TypeError, ValueError, KeyError) as exc:
        return False, None, f"Open-Meteo fallback parsing failed: {exc}"

def _find_city(lat, lon, city_name=None):
    if city_name and city_name in CITIES:
        return city_name, CITIES[city_name]
    best_name, best_city, best_d = None, None, float("inf")
    for name, city in CITIES.items():
        d = math.hypot(lat - city["lat"], lon - city["lon"])
        if d < best_d:
            best_name, best_city, best_d = name, city, d
    return (best_name, best_city) if best_d <= 5 else (None, None)

def fetch_elevation_grid(lat, lon):
    lat_d = RADIUS_KM / 110.574
    cos_lat = max(math.cos(math.radians(lat)), 0.1)
    lon_d = RADIUS_KM / (111.320 * cos_lat)
    lat_min, lat_max = lat - lat_d, lat + lat_d
    lon_min, lon_max = lon - lon_d, lon + lon_d

    points = []
    for r in range(GRID):
        la = lat_min + (lat_max - lat_min) * (r / (GRID - 1))
        for c in range(GRID):
            lo = lon_min + (lon_max - lon_min) * (c / (GRID - 1))
            points.append((la, lo))

    flat = [0.0] * len(points)
    chunks = [(s, min(s + ELEV_CHUNK, len(points)), points[s:min(s + ELEV_CHUNK, len(points))]) for s in range(0, len(points), ELEV_CHUNK)]

    def _chunk_fetch(chunk):
        s, _, pts = chunk
        try:
            res = requests.get(
                "https://api.open-meteo.com/v1/elevation",
                params={
                    "latitude": ",".join(f"{p[0]:.6f}" for p in pts),
                    "longitude": ",".join(f"{p[1]:.6f}" for p in pts),
                },
                timeout=12,
            )
            res.raise_for_status()
            vals = res.json().get("elevation", [])
            return s, [float(vals[i]) if i < len(vals) and vals[i] is not None else 0.0 for i in range(len(pts))]
        except Exception:
            return s, [0.0] * len(pts)

    with ThreadPoolExecutor(max_workers=6) as ex:
        for fut in as_completed([ex.submit(_chunk_fetch, ch) for ch in chunks]):
            s, vals = fut.result()
            flat[s:s + len(vals)] = vals

    grid = [flat[r * GRID:(r + 1) * GRID] for r in range(GRID)]
    nz = [v for v in flat if v != 0.0]
    min_elev, max_elev = (min(nz), max(nz)) if nz else (0.0, 0.0)
    lat_extent_m = abs(lat_max - lat_min) * 110540
    lon_extent_m = abs(lon_max - lon_min) * 111320 * cos_lat
    cell_m = ((lat_extent_m / (GRID - 1)) + (lon_extent_m / (GRID - 1))) / 2

    return {
        "grid_size": GRID,
        "center": {"lat": lat, "lon": lon},
        "lat_min": lat_min,
        "lat_max": lat_max,
        "lon_min": lon_min,
        "lon_max": lon_max,
        "elevations": grid,
        "min_elev": min_elev,
        "max_elev": max_elev,
        "cell_m": cell_m,
    }

def fetch_water_features(lat, lon):
    query = f'''[out:json][timeout:25];
(
  way["waterway"~"river|stream|canal|drain"](around:{OSM_RADIUS},{lat},{lon});
  way["natural"="water"](around:{OSM_RADIUS},{lat},{lon});
  relation["natural"="water"](around:{OSM_RADIUS},{lat},{lon});
  way["water"](around:{OSM_RADIUS},{lat},{lon});
  way["landuse"="reservoir"](around:{OSM_RADIUS},{lat},{lon});
);
(._;>;);
out body;'''
    try:
        res = requests.post("https://overpass-api.de/api/interpreter", data={"data": query}, timeout=30)
        res.raise_for_status()
        elems = res.json().get("elements", [])
        nodes = {el["id"]: [el["lat"], el["lon"]] for el in elems if el.get("type") == "node" and "lat" in el and "lon" in el}
        rivers, lakes = [], []
        for el in elems:
            if el.get("type") != "way":
                continue
            tags = el.get("tags", {})
            node_ids = el.get("nodes", [])
            pts = [nodes[nid] for nid in node_ids if nid in nodes]
            if len(pts) < 2:
                continue
            name = tags.get("name") or "Unnamed"
            if "waterway" in tags:
                rivers.append({"name": name, "type": tags.get("waterway", "waterway"), "points": pts})
            elif node_ids and node_ids[0] == node_ids[-1]:
                lakes.append({"name": name, "points": pts})
            else:
                rivers.append({"name": name, "type": "water", "points": pts})
        return {"rivers": rivers, "lakes": lakes}
    except Exception:
        return {"rivers": [], "lakes": []}

def fetch_weather(lat, lon, city_name=None):
    current = {"temp": 0.0, "hum": 60.0, "precip": 0.0, "cloud": 30.0, "wind_spd": 2.0, "wind_dir": 0.0, "raining": False}
    forecast, annual_rain, monthly = [], 0.0, [0.0] * 12
    altitude, coastal, stress, confidence, source = 0, False, "Moderate", "LOW", "Fallback"

    try:
        fres = requests.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude": lat,
                "longitude": lon,
                "current": "temperature_2m,relative_humidity_2m,precipitation,rain,cloud_cover,wind_speed_10m,wind_direction_10m",
                "daily": "precipitation_sum,precipitation_probability_max",
                "timezone": "auto",
                "forecast_days": 7,
            },
            timeout=10,
        )
        fres.raise_for_status()
        fbody = fres.json()
        c = fbody.get("current", {})
        current = {
            "temp": _safe_float(c.get("temperature_2m")),
            "hum": _safe_float(c.get("relative_humidity_2m"), 60.0),
            "precip": _safe_float(c.get("precipitation")),
            "cloud": _safe_float(c.get("cloud_cover"), 30.0),
            "wind_spd": _safe_float(c.get("wind_speed_10m"), 2.0),
            "wind_dir": _safe_float(c.get("wind_direction_10m")),
            "raining": _safe_float(c.get("precipitation")) > 0,
        }
        d = fbody.get("daily", {})
        dates, rains, probs = d.get("time", []), d.get("precipitation_sum", []), d.get("precipitation_probability_max", [])
        for i in range(min(7, len(dates))):
            forecast.append({"date": dates[i], "rain": _safe_float(rains[i] if i < len(rains) else 0), "prob": _safe_float(probs[i] if i < len(probs) else 0)})
    except Exception:
        pass

    try:
        last_year = datetime.now().year - 1
        # Keep /api/geodata lightweight for annual and monthly summaries.
        # /api/historical-deep is the detailed multi-year endpoint for ML workflows.
        ares = requests.get(
            "https://archive-api.open-meteo.com/v1/archive",
            params={"latitude": lat, "longitude": lon, "start_date": f"{last_year}-01-01", "end_date": f"{last_year}-12-31", "daily": "precipitation_sum", "timezone": "auto"},
            timeout=10,
        )
        ares.raise_for_status()
        daily = ares.json().get("daily", {})
        vals, days = daily.get("precipitation_sum", []), daily.get("time", [])
        for i, v in enumerate(vals):
            p = _safe_float(v)
            annual_rain += p
            if i < len(days):
                m = _safe_int(days[i].split("-")[1], 1) - 1
                if 0 <= m < 12:
                    monthly[m] += p
        if annual_rain > 10:
            confidence, source = "HIGH", "Satellite (Open-Meteo)"
    except Exception:
        pass

    cname, city = _find_city(lat, lon, city_name)
    if city:
        coastal, stress = bool(city["coast"]), city["stress"]
        if current["hum"] <= 0:
            current["hum"] = _safe_float(city["hum"], 60.0)
        if confidence == "LOW":
            annual_rain, monthly = float(city["rain"]), [float(x) for x in city["mo"]]
            confidence, source = "MEDIUM", f"City Climatology ({cname})"

    try:
        eres = requests.get("https://api.open-meteo.com/v1/elevation", params={"latitude": lat, "longitude": lon}, timeout=5)
        eres.raise_for_status()
        elev = eres.json().get("elevation", [0])
        altitude = _safe_int(elev[0] if isinstance(elev, list) and elev else elev, 0)
    except Exception:
        if city:
            altitude = city["alt"]

    total = sum(monthly)
    mean_m = statistics.mean(monthly) if monthly else 0.0
    cv = round((statistics.stdev(monthly) / mean_m), 3) if mean_m > 0 and len(monthly) > 1 else 0.0
    monsoon_dep = round((sum(sorted(monthly, reverse=True)[:4]) / total) * 100, 2) if total > 0 else 0.0

    return {
        "current": current,
        "forecast": forecast,
        "annual_rain": round(annual_rain, 2),
        "monthly": [round(v, 2) for v in monthly],
        "altitude": int(altitude),
        "coastal": bool(coastal),
        "stress": stress,
        "confidence": confidence,
        "source": source,
        "cv": cv,
        "monsoon_dep": monsoon_dep,
    }

def calc_rainwater(R, area, surf):
    c = ROOF_C.get(surf, ROOF_C["concrete"])
    annual = max(0.0, R * area * c)
    peak_month = annual * 0.70 / 4
    tank = next((t for t in TANKS if t >= peak_month), TANKS[-1])
    overflow = max(0.0, (peak_month - tank) * 4)
    pit_volume = max(area / 50.0, 0.5)
    r = (pit_volume / (4 * math.pi)) ** (1 / 3)
    placement = "Compact" if area < 100 else ("Single tank" if area < 200 else ("Dual inlet" if area < 400 else "Multi-tank"))
    return {
        "id": "rainwater", "name": "Rooftop Rainwater", "icon": "🏠", "ok": annual > 0, "annual": round(annual, 2),
        "peak_month": round(peak_month, 2), "tank": tank, "overflow": round(overflow, 2), "coeff": c,
        "recharge_pit": {"volume_m3": round(pit_volume, 3), "diameter_m": round(2 * r, 3), "depth_m": round(4 * r, 3)},
        "placement": placement, "cost": "INR 5,000 - 35,000",
    }

def calc_storm(R, area, lt):
    c = LAND_C.get(lt, LAND_C["open"])
    annual = max(0.0, R * area * c)
    return {
        "id": "stormwater", "name": "Stormwater Harvesting", "icon": "🌧️", "ok": area > 0, "annual": round(annual, 2), "coeff": c,
        "pit_volume": round(max(area / 40.0, 0.0), 2), "swale": {"len": round(area / 20.0, 2), "w": 0.75, "d": 0.3} if area > 200 else None,
        "cost": "INR 3,000 - 20,000",
    }

def calc_grey(ppl, kitchen=True):
    src = {"Bathing": (55, 0.85), "Laundry": (25, 0.70), "Kitchen": (20, 0.50), "Handwash": (10, 0.80)}
    if not kitchen:
        src.pop("Kitchen", None)
    per_person, detail = 0.0, {}
    for name, (lpd, usable) in src.items():
        val = lpd * usable
        detail[name] = round(val, 2)
        per_person += val
    daily = max(0.0, ppl * per_person)
    annual = daily * 365
    return {
        "id": "greywater", "name": "Greywater Recycling", "icon": "🚿", "ok": ppl > 0, "annual": round(annual, 2), "daily": round(daily, 2),
        "sources": detail, "treatment": "Secondary filtration + biological treatment" if kitchen else "Basic filtration + disinfection",
        "kitchen_included": bool(kitchen), "cost": "INR 8,000 - 60,000",
    }

def calc_ac(units, hrs, mos, hum):
    rate = 3.5 if hum > 85 else (2.5 if hum > 70 else (1.5 if hum > 40 else 0.5))
    daily = max(0.0, units * hrs * rate)
    annual = daily * mos * 30
    return {
        "id": "ac", "name": "AC Condensate", "icon": "❄️", "ok": units > 0 and hrs > 0 and mos > 0, "annual": round(annual, 2), "daily": round(daily, 2),
        "rate": rate, "quality": "Near distilled (TDS 10-50ppm)", "safe_uses": ["Plants", "Iron", "Battery", "Cleaning"], "cost": "Low (piping + storage only)",
    }

def calc_fog(hum, alt, coastal, area=10):
    eligible = hum > 60 or alt > 500 or coastal
    if alt > 1000:
        fog_days, fog_rate = 140, 1.5
    elif alt > 500:
        fog_days, fog_rate = 100, 1.1
    elif coastal:
        fog_days, fog_rate = 80, 0.9
    elif hum > 75:
        fog_days, fog_rate = 60, 0.7
    else:
        fog_days, fog_rate = (30, 0.4) if eligible else (0, 0.0)
    if hum > 80:
        dew_nights, dew_rate = 220, 0.12
    elif hum > 65:
        dew_nights, dew_rate = 170, 0.09
    elif coastal:
        dew_nights, dew_rate = 150, 0.08
    else:
        dew_nights, dew_rate = 90, 0.05
    annual = (fog_days * fog_rate + dew_nights * dew_rate) * max(area, 1)
    return {
        "id": "fog", "name": "Fog + Dew Collection", "icon": "🌫️", "ok": eligible, "annual": round(annual if eligible else 0.0, 2),
        "eligible": eligible, "fog_days": fog_days if eligible else 0, "fog_rate": fog_rate if eligible else 0.0,
        "dew_nights": dew_nights, "dew_rate": dew_rate, "area": area, "cost": "INR 6,000 - 40,000",
    }

def calc_recharge(R, total_area, soil):
    inf = SOIL_INF.get(soil, SOIL_INF["loamy"])
    runoff = max(0.0, R * total_area * 0.5)
    rechargeable = runoff * 0.3
    structures = ["Recharge Pit"]
    if total_area > 150:
        structures.append("Percolation Trench")
    if total_area > 300:
        structures.append("Recharge Well")
    if inf < 10:
        structures.append("Soakaway Pit")
    return {
        "id": "recharge", "name": "Groundwater Recharge", "icon": "🕳️", "ok": total_area > 0, "annual": round(rechargeable, 2),
        "infiltration_rate": inf, "runoff": round(runoff, 2), "rechargeable": round(rechargeable, 2), "structures": structures,
        "cost": "INR 7,000 - 80,000",
    }

COST_RANGES = {
    "rainwater": (5000, 35000),
    "stormwater": (3000, 20000),
    "greywater": (8000, 60000),
    "ac": (500, 3000),
    "fog": (6000, 40000),
    "recharge": (7000, 80000),
}

def _parse_cost(cost_str):
    import re
    nums = re.findall(r"[\d,]+", cost_str.replace("INR", ""))
    if len(nums) >= 2:
        return (int(nums[0].replace(",", "")), int(nums[1].replace(",", "")))
    return (0, 0)

def _estimate_cost(system_id, scale=1.0):
    lo, hi = COST_RANGES.get(system_id, (1000, 10000))
    return lo * scale, hi * scale

def generate_candidates(weather, inp):
    annual_rain = _safe_float(weather.get("annual_rain", 0.0))
    hum = _safe_float(weather.get("current", {}).get("hum", 60))
    alt = _safe_float(weather.get("altitude", 0))
    coastal = bool(weather.get("coastal", False))
    roof_area = max(0.1, inp["roof_area"])
    land_area = max(0.1, inp["land_area"])
    people = max(0, inp["people"])
    soil = inp.get("soil", "loamy")

    base_results = {
        "rainwater": calc_rainwater(annual_rain, roof_area, inp.get("surface", "concrete")),
        "stormwater": calc_storm(annual_rain, land_area, inp.get("land_type", "open")),
        "greywater": calc_grey(people, inp.get("kitchen", True)),
        "ac": calc_ac(inp.get("ac_units", 0), inp.get("ac_hrs", 0), inp.get("ac_mos", 0), hum),
        "fog": calc_fog(hum, alt, coastal, area=max(10, roof_area * 0.1)),
        "recharge": calc_recharge(annual_rain, roof_area + land_area, soil),
    }

    candidates = []
    system_ids = ["rainwater", "stormwater", "greywater", "ac", "fog", "recharge"]

    for sid in system_ids:
        if base_results[sid].get("ok"):
            cost_lo, cost_hi = _estimate_cost(sid)
            candidates.append({
                "id": f"plan_{sid}",
                "systems": [sid],
                "description": f"Single system: {base_results[sid]['name']}",
                "water_annual": base_results[sid].get("annual", 0),
                "cost_lo": cost_lo,
                "cost_hi": cost_hi,
            })

    combo_configs = [
        (["rainwater", "greywater"], "Basic Combo"),
        (["rainwater", "recharge"], "Rainwater + Recharge"),
        (["rainwater", "stormwater"], "Rain + Storm"),
        (["rainwater", "greywater", "recharge"], "Full House"),
        (["rainwater", "fog", "recharge"], "Rain + Fog + Recharge"),
        (["rainwater", "greywater", "ac"], "With AC Recovery"),
        (["rainwater", "stormwater", "recharge"], "Comprehensive"),
        (["rainwater", "greywater", "fog", "recharge"], "Max Coverage"),
    ]

    for sys_list, label in combo_configs:
        water_total = sum(base_results[sid].get("annual", 0) for sid in sys_list if base_results[sid].get("ok"))
        if water_total > 0:
            cost_total_lo, cost_total_hi = 0, 0
            for sid in sys_list:
                lo, hi = _estimate_cost(sid)
                cost_total_lo += lo
                cost_total_hi += hi
            names = [base_results[sid]["name"] for sid in sys_list if base_results[sid].get("ok")]
            candidates.append({
                "id": f"plan_{len(candidates)}",
                "systems": sys_list,
                "description": f"{label}: {', '.join(names)}",
                "water_annual": round(water_total, 2),
                "cost_lo": cost_total_lo,
                "cost_hi": cost_total_hi,
            })

    tank_sizes = [1000, 5000, 10000, 20000]
    for tank in tank_sizes:
        if base_results["rainwater"].get("ok") and tank >= base_results["rainwater"].get("tank", 0):
            scale = tank / base_results["rainwater"].get("tank", 1000)
            water_scaled = base_results["rainwater"].get("annual", 0) * min(scale, 1.5)
            cost_lo, cost_hi = _estimate_cost("rainwater", scale)
            candidates.append({
                "id": f"plan_tank_{tank}",
                "systems": ["rainwater"],
                "description": f"Rooftop with {tank}L tank",
                "water_annual": round(water_scaled, 2),
                "cost_lo": cost_lo,
                "cost_hi": cost_hi,
            })

    return candidates[:20]

def evaluate_metrics(candidate, weather, inp):
    water = candidate["water_annual"]
    cost_lo, cost_hi = candidate["cost_lo"], candidate["cost_hi"]
    avg_cost = (cost_lo + cost_hi) / 2

    annual_rain = _safe_float(weather.get("annual_rain", 0.0))
    hum = _safe_float(weather.get("current", {}).get("hum", 60))
    alt = _safe_float(weather.get("altitude", 0))
    coastal = bool(weather.get("coastal", False))

    max_water = annual_rain * max(inp["roof_area"], inp["land_area"]) * 0.9
    water_eff = (water / max_water) if max_water > 0 else 0

    cost_per_liter = avg_cost / water if water > 0 else 999
    max_reasonable = 50
    cost_eff = max(0, 1 - (cost_per_liter / max_reasonable))

    cv = _safe_float(weather.get("cv", 0))
    monsoon_dep = _safe_float(weather.get("monsoon_dep", 0))
    risk_score = 0
    if cv > 0.5:
        risk_score += 0.3
    if monsoon_dep > 80:
        risk_score += 0.2
    if not coastal and annual_rain < 800:
        risk_score += 0.3
    if alt > 1500:
        risk_score += 0.15
    risk_reduction = min(1.0, risk_score)

    sust_factors = []
    if "recharge" in candidate["systems"]:
        sust_factors.append(0.25)
    if "greywater" in candidate["systems"]:
        sust_factors.append(0.25)
    if "fog" in candidate["systems"] and (hum > 60 or alt > 500 or coastal):
        sust_factors.append(0.2)
    if "rainwater" in candidate["systems"]:
        sust_factors.append(0.15)
    sustainability = min(1.0, sum(sust_factors))

    return {
        "water_efficiency": round(min(1.0, water_eff), 3),
        "cost_efficiency": round(min(1.0, cost_eff), 3),
        "risk_reduction": round(min(1.0, risk_reduction), 3),
        "sustainability": round(sustainability, 3),
    }

def calculate_scores(metrics, weights={"water": 0.35, "cost": 0.25, "risk": 0.20, "sust": 0.20}):
    return (
        weights["water"] * metrics["water_efficiency"] +
        weights["cost"] * metrics["cost_efficiency"] +
        weights["risk"] * metrics["risk_reduction"] +
        weights["sust"] * metrics["sustainability"]
    )

def generate_explanation(candidate, metrics, weather):
    reasons = []
    if metrics["water_efficiency"] > 0.5:
        reasons.append("High water yield potential")
    elif metrics["water_efficiency"] > 0.2:
        reasons.append("Moderate water recovery")
    else:
        reasons.append("Limited water capture")

    if metrics["cost_efficiency"] > 0.7:
        reasons.append("Low cost per liter")
    elif metrics["cost_efficiency"] > 0.4:
        reasons.append("Moderate investment")
    else:
        reasons.append("Higher upfront cost")

    if metrics["risk_reduction"] > 0.5:
        reasons.append("Reduces climate risk")
    if metrics["sustainability"] > 0.5:
        reasons.append("Environmentally sustainable")

    annual_rain = _safe_float(weather.get("annual_rain", 0.0))
    if annual_rain > 1500:
        reasons.append(f"High rainfall area ({int(annual_rain)}mm/year)")
    elif annual_rain < 600:
        reasons.append(f"Low rainfall region - consider recharge")

    return reasons

def calculate_confidence(weather, inp):
    confidence_factors = []

    source = weather.get("source", "")
    if source in ["Satellite (Open-Meteo)", "City Climatology"]:
        confidence_factors.append(0.35)
    elif source == "Fallback":
        confidence_factors.append(0.15)

    conf = weather.get("confidence", "LOW")
    if conf == "HIGH":
        confidence_factors.append(0.35)
    elif conf == "MEDIUM":
        confidence_factors.append(0.2)

    if inp.get("roof_area", 0) > 50:
        confidence_factors.append(0.15)

    cv = _safe_float(weather.get("cv", 0))
    if cv < 0.3:
        confidence_factors.append(0.15)
    elif cv > 0.7:
        confidence_factors.append(-0.1)

    return min(1.0, max(0.1, sum(confidence_factors)))

def run_analysis(weather, inp):
    annual_rain = _safe_float(weather.get("annual_rain", 0.0))
    hum = _safe_float(weather.get("current", {}).get("hum", 60))
    alt = _safe_float(weather.get("altitude", 0))
    coastal = bool(weather.get("coastal", False))

    candidates = generate_candidates(weather, inp)

    for cand in candidates:
        cand["metrics"] = evaluate_metrics(cand, weather, inp)
        cand["score"] = calculate_scores(cand["metrics"])
        cand["explanation"] = generate_explanation(cand, cand["metrics"], weather)

    candidates.sort(key=lambda x: x["score"], reverse=True)

    confidence = calculate_confidence(weather, inp)

    for i, c in enumerate(candidates[:10]):
        c["rank"] = i + 1

    top_plan = candidates[0] if candidates else None
    total = top_plan["water_annual"] if top_plan else 0

    avg_cost_lo = sum(c["cost_lo"] for c in candidates[:3]) / min(3, len(candidates)) if candidates else 0
    avg_cost_hi = sum(c["cost_hi"] for c in candidates[:3]) / min(3, len(candidates)) if candidates else 0
    annual_savings = total * 0.05
    co2 = total * 0.0003 * 0.82

    if total >= 300000:
        stars, label = "⭐⭐⭐⭐⭐", "Advanced"
    elif total >= 180000:
        stars, label = "⭐⭐⭐⭐", "Strong"
    elif total >= 90000:
        stars, label = "⭐⭐⭐", "Growing"
    elif total >= 30000:
        stars, label = "⭐⭐", "Starter"
    else:
        stars, label = "⭐", "Basic"

    roof_coeff = ROOF_C.get(inp.get("surface", "concrete"), 0.9)
    mlist = weather.get("monthly", [0.0] * 12)
    monthly = [{"month": i + 1, "rainfall_mm": round(_safe_float(mlist[i] if i < len(mlist) else 0), 2), "harvested_l": round(_safe_float(mlist[i] if i < len(mlist) else 0) * inp.get("roof_area", 100) * roof_coeff, 2)} for i in range(12)]

    fsum = sum(_safe_float(d.get("rain", 0.0)) for d in weather.get("forecast", []))
    if fsum >= 120:
        alert = {"level": "URGENT", "message": "High rainfall week. Ensure overflow and diversion paths are open.", "total_7d": round(fsum, 2)}
    elif fsum >= 60:
        alert = {"level": "ACTION", "message": "Strong rain expected. Clean filters and maximize storage readiness.", "total_7d": round(fsum, 2)}
    elif fsum >= 20:
        alert = {"level": "PREPARE", "message": "Light to moderate rain expected. Inspect rooftop inlets and first flush.", "total_7d": round(fsum, 2)}
    else:
        alert = {"level": "DRY", "message": "Low rain expected. Prioritize reuse and recharge conservation.", "total_7d": round(fsum, 2)}

    proj, cum_l, cum_inr = [], 0.0, 0.0
    for y in range(1, 6):
        cum_l += total
        cum_inr += annual_savings
        proj.append({"year": y, "year_l": round(total, 2), "year_inr": round(annual_savings, 2), "cum_l": round(cum_l, 2), "cum_inr": round(cum_inr, 2)})

    methods = [
        calc_rainwater(annual_rain, inp.get("roof_area", 100), inp.get("surface", "concrete")),
        calc_storm(annual_rain, inp.get("land_area", 100), inp.get("land_type", "open")),
        calc_grey(inp.get("people", 4), inp.get("kitchen", True)),
        calc_ac(inp.get("ac_units", 0), inp.get("ac_hrs", 0), inp.get("ac_mos", 0), hum),
        calc_fog(hum, alt, coastal, area=max(10, inp.get("roof_area", 100) * 0.1)),
        calc_recharge(annual_rain, inp.get("roof_area", 100) + inp.get("land_area", 100), inp.get("soil", "loamy")),
    ]

    actions = [
        f"Implement {top_plan['description']} as primary plan." if top_plan else "Start with rooftop rainwater harvesting.",
        "Install first-flush diverter and mesh filter before monsoon.",
        "Schedule quarterly cleaning of gutters, tanks, and recharge inlets.",
        "Track monthly harvested volume and compare with expected chart.",
        "Keep overflow directed to recharge pits, not storm drains.",
    ]

    return {
        "candidates": candidates[:10],
        "optimization": {
            "weights": {"water": 0.35, "cost": 0.25, "risk": 0.20, "sust": 0.20},
            "confidence": round(confidence, 2),
            "num_generated": len(candidates),
        },
        "top_plan": {
            "description": top_plan["description"] if top_plan else None,
            "systems": top_plan["systems"] if top_plan else [],
            "score": round(top_plan["score"], 3) if top_plan else 0,
            "metrics": top_plan["metrics"] if top_plan else {},
        },
        "methods": methods,
        "ranked": candidates[:10],
        "total": round(total, 2),
        "financial": {
            "annual_savings": round(annual_savings, 2),
            "cost_range": f"INR {int(avg_cost_lo):,} - {int(avg_cost_hi):,}",
        },
        "env": {"co2": round(co2, 3)},
        "maturity": {"stars": stars, "label": label},
        "monthly": monthly,
        "alert": alert,
        "climate": {
            "annual_rain": weather.get("annual_rain", 0.0),
            "source": weather.get("source", "Unknown"),
            "hum": weather.get("current", {}).get("hum", 0),
            "altitude": weather.get("altitude", 0),
            "coastal": weather.get("coastal", False),
            "stress": weather.get("stress", "Moderate"),
            "monsoon_dep": weather.get("monsoon_dep", 0),
            "cv": weather.get("cv", 0),
            "confidence": weather.get("confidence", "LOW"),
        },
        "forecast": weather.get("forecast", []),
        "proj": proj,
        "actions": actions,
    }

@app.get("/")
def home():
    return render_template("index.html", cities=sorted(CITIES.keys()))

@app.post("/api/geodata")
def api_geodata():
    try:
        body = request.get_json(silent=True) or {}
        city = body.get("city")
        lat = _safe_float(body.get("lat"), 0.0)
        lon = _safe_float(body.get("lon"), 0.0)
        if city in CITIES:
            lat, lon = CITIES[city]["lat"], CITIES[city]["lon"]
        if lat == 0 and lon == 0:
            return jsonify({"ok": False, "error": "Provide city or valid lat/lon"}), 400
        with ThreadPoolExecutor(max_workers=3) as ex:
            f1 = ex.submit(fetch_elevation_grid, lat, lon)
            f2 = ex.submit(fetch_water_features, lat, lon)
            f3 = ex.submit(fetch_weather, lat, lon, city)
            terrain, water, weather = f1.result(), f2.result(), f3.result()
        return jsonify({"ok": True, "terrain": terrain, "water": water, "weather": weather, "location": {"lat": lat, "lon": lon, "city": city or "Custom"}})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

@app.post("/api/analyze")
def api_analyze():
    try:
        body = request.get_json(silent=True) or {}
        inp = {
            "roof_area": max(0.0, _safe_float(body.get("roof_area"), 0.0)),
            "surface": body.get("surface", "concrete"),
            "land_area": max(0.0, _safe_float(body.get("land_area"), 0.0)),
            "land_type": body.get("land_type", "open"),
            "people": max(0, _safe_int(body.get("people"), 0)),
            "kitchen": bool(body.get("kitchen", True)),
            "ac_units": max(0, _safe_int(body.get("ac_units"), 0)),
            "ac_hrs": max(0.0, _safe_float(body.get("ac_hrs"), 0.0)),
            "ac_mos": max(0, _safe_int(body.get("ac_mos"), 0)),
            "soil": body.get("soil", "loamy"),
        }
        if inp["roof_area"] <= 0 and inp["land_area"] <= 0:
            return jsonify({"ok": False, "error": "Roof area or land area must be greater than zero"}), 400
        if inp["surface"] not in ROOF_C:
            inp["surface"] = "concrete"
        if inp["land_type"] not in LAND_C:
            inp["land_type"] = "open"
        if inp["soil"] not in SOIL_INF:
            inp["soil"] = "loamy"
        result = run_analysis(body.get("weather") or {}, inp)
        return jsonify({"ok": True, "data": result})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500

# ============================================
# VISUAL CROSSING INTEGRATION
# Purpose: Fetch 5+ years historical weather
# Used by: ML rainfall pattern classifier
# Rate limit: 1000/day, fallback to Open-Meteo
# ============================================
@app.post("/api/historical-deep")
def api_historical_deep():
    try:
        body = request.get_json(silent=True) or {}
        if body.get("latitude") is None or body.get("longitude") is None:
            return jsonify({"ok": False, "error": "Latitude and longitude are required."}), 400

        lat = _coerce_float_or_none(body.get("latitude"))
        lon = _coerce_float_or_none(body.get("longitude"))
        years = _safe_int(body.get("years"), 5)

        if lat is None or lon is None:
            return jsonify({"ok": False, "error": "Latitude and longitude must be valid numbers."}), 400
        if not (-90 <= lat <= 90):
            return jsonify({"ok": False, "error": "Latitude must be between -90 and 90."}), 400
        if not (-180 <= lon <= 180):
            return jsonify({"ok": False, "error": "Longitude must be between -180 and 180."}), 400
        if not (1 <= years <= 10):
            return jsonify({"ok": False, "error": "Years must be between 1 and 10."}), 400

        end_date_obj = datetime.utcnow().date()
        start_date_obj = end_date_obj - timedelta(days=years * 365)
        start_date = start_date_obj.isoformat()
        end_date = end_date_obj.isoformat()

        cache_key = f"{lat:.4f}_{lon:.4f}_{years}"
        cached = get_cached_historical(cache_key)
        if cached:
            cached["cached"] = True
            return jsonify(cached)

        errors = []
        source = "fallback"
        daily_data = []

        success, deep_data, error = fetch_visual_crossing_historical(lat, lon, start_date, end_date)
        if success and deep_data:
            source = "visual_crossing"
            daily_data = deep_data
        else:
            if error:
                errors.append(error)
            success, fallback_data, fallback_error = fetch_open_meteo_historical_fallback(lat, lon, start_date, end_date)
            if success and fallback_data:
                source = "open_meteo"
                daily_data = fallback_data
            elif fallback_error:
                errors.append(fallback_error)

        response = {
            "ok": bool(daily_data),
            "source": source,
            "location": {"lat": round(lat, 6), "lon": round(lon, 6)},
            "date_range": {"start": start_date, "end": end_date},
            "daily_data": daily_data,
            "summary_stats": calculate_rainfall_statistics(daily_data),
            "cached": False,
        }
        if errors:
            response["error"] = " ".join(errors)

        if daily_data:
            save_cached_historical(cache_key, response)

        return jsonify(response)
    except Exception as exc:
        app.logger.exception("Historical deep endpoint failed")
        return jsonify({"ok": False, "error": str(exc)}), 500

if __name__ == "__main__":
    app.run(debug=True)
