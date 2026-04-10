import requests


def test_historical_deep():
    response = requests.post(
        "http://localhost:5000/api/historical-deep",
        json={
            "latitude": 28.6139,
            "longitude": 77.2090,
            "years": 5,
        },
        timeout=30,
    )
    payload = response.json()
    print("Status:", response.status_code)
    print("Source:", payload.get("source"))
    print("Days:", len(payload.get("daily_data", [])))
    print("Annual rainfall:", payload.get("summary_stats", {}).get("avg_annual_rainfall_mm"))
    if payload.get("error"):
        print("Error:", payload.get("error"))


if __name__ == "__main__":
    test_historical_deep()
