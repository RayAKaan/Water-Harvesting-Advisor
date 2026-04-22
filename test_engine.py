import sys
sys.path.insert(0, '.')
from app import generate_candidates, evaluate_metrics, calculate_scores, calculate_confidence

w = {'annual_rain': 1200, 'current': {'hum': 70}, 'altitude': 100, 'coastal': False, 
     'cv': 0.4, 'monsoon_dep': 75, 'confidence': 'MEDIUM', 'source': 'City'}
inp = {'roof_area': 150, 'land_area': 100, 'surface': 'concrete', 'land_type': 'open', 
       'people': 4, 'kitchen': True, 'ac_units': 2, 'ac_hrs': 8, 'ac_mos': 6, 'soil': 'loamy'}

cands = generate_candidates(w, inp)
print(f'Generated {len(cands)} candidates')

c = cands[0]
m = evaluate_metrics(c, w, inp)
s = calculate_scores(m)
conf = calculate_confidence(w, inp)

print(f'Top: {c["description"]}')
print(f'Metrics: {m}')
print(f'Score: {s:.3f}')
print(f'Confidence: {conf:.2f}')
