# API Integrations

## Setup

1. Install dependencies:
   `pip install -r requirements.txt`
2. Add your Visual Crossing key to `.env`:
   `VISUAL_CROSSING_API_KEY=your_actual_key_here`
3. Start the Flask app:
   `python app.py`
4. Open `http://localhost:5000`

## Visual Crossing

- Purpose: deep historical daily weather data for future ML workflows.
- App endpoint: `POST /api/historical-deep`
- Primary source: Visual Crossing Timeline API
- Fallback source: Open-Meteo archive API
- Cache duration: 24 hours per `lat/lon/years` combination

### Get an API key

1. Create an account at `https://www.visualcrossing.com/weather-api`
2. Copy the free-tier API key
3. Paste it into `.env` as `VISUAL_CROSSING_API_KEY`

### Example request

```bash
curl -X POST http://localhost:5000/api/historical-deep \
  -H "Content-Type: application/json" \
  -d "{\"latitude\":28.6139,\"longitude\":77.2090,\"years\":5}"
```

## RainViewer

- Purpose: live radar overlay inside the Three.js terrain view
- Source: `https://api.rainviewer.com/public/weather-maps.json`
- API key: not required
- Refresh cadence: automatic every 10 minutes, plus manual refresh button

## Testing

- Backend smoke test:
  `python test_apis.py`
- Frontend flow:
  load a city or coordinates, click `Load Terrain + Weather`, then confirm the radar overlay, play/pause, toggle, and refresh controls respond.

## Troubleshooting

- `Visual Crossing API key is not configured.`
  Add a valid `VISUAL_CROSSING_API_KEY` to `.env` and restart Flask.
- `/api/historical-deep` returns `source: open_meteo`
  Visual Crossing likely failed, timed out, or hit quota, and the fallback path was used.
- Radar panel says frames are unavailable
  RainViewer may be temporarily unreachable or blocked by the browser/network. The rest of the app should still work.
- Cached deep-history response looks stale
  Delete the matching file in [`cache`](/d:/Water-Harvesting-Advisor/cache) or wait 24 hours for expiry.
