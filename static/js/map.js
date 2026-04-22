// START - Map Engine (v2.2)
console.log('map.js: Loading...');
const MAP_ENGINE = {
  map: null,
  layers: {},
  currentLocation: null,
  currentMapMode: 'smart',
  mapStyleCache: 'topo',
  focusModeEnabled: false,
  lastZoom: 13,
  locationMarker: null,
  terrainData: null,
  weatherData: null,
  waterData: null,
  osmData: null,
  flowData: null,
  optimizedSetup: null,
  groundwaterProjection: null,
  groundwaterCanvas: null,
  rainfallCanvas: null,
  gpiCache: new Map(),
  rechargeZones: [],
  recommendations: [],
  bestPlan: null,
  recCache: new Map(),

  USAGE_PROFILES: {
    residential: {
      name: "Residential Home",
      dailyUsage: 600,
      waterPrice: 0.05,
      estimatedRoofArea: 120,
      priority: ['storage', 'recharge'],
      riskTolerance: 'medium'
    },
    apartment: {
      name: "Apartment Complex",
      dailyUsage: 5000,
      waterPrice: 0.04,
      estimatedRoofArea: 800,
      priority: ['recharge', 'storage', 'greywater'],
      riskTolerance: 'low'
    },
    hotel: {
      name: "Hotel/Resort",
      dailyUsage: 15000,
      waterPrice: 0.06,
      estimatedRoofArea: 2000,
      priority: ['greywater', 'storage', 'recharge'],
      riskTolerance: 'low'
    },
    industry: {
      name: "Industrial Facility",
      dailyUsage: 50000,
      waterPrice: 0.08,
      estimatedRoofArea: 5000,
      priority: ['recharge', 'greywater', 'storage'],
      riskTolerance: 'very_low'
    }
  },

  generateOptimalPlan(profileName = 'residential', budget = 150000) {
    const profile = this.USAGE_PROFILES[profileName] || this.USAGE_PROFILES.residential;
    if (!this.terrainData || !this.weatherData) {
      return this._generateFallbackPlan(profile, budget);
    }

    const plans = [];
    const roofArea = profile.estimatedRoofArea;
    const rainfall = this.weatherData.annual_rain;
    const gpi = this._getAverageGPI();

    plans.push(this._createConservativePlan(profile, roofArea, rainfall));
    plans.push(this._createBalancedPlan(profile, roofArea, rainfall));
    plans.push(this._createComprehensivePlan(profile, roofArea, rainfall));
    plans.push(this._createAlgorithmicPlan(profile, roofArea, rainfall, gpi));

    const enrichedPlans = plans.map(p => this._enrichPlan(p, profile, budget));
    const scoredPlans = enrichedPlans.map(p => ({
      ...p,
      score: this._scorePlan(p, profile)
    }));

    scoredPlans.sort((a, b) => b.score - a.score);
    const bestPlan = scoredPlans[0];

    if (this.bestPlan) {
      this.bestPlan.components = bestPlan.components;
      this.bestPlan.totalCost = bestPlan.totalCost;
      this.bestPlan.waterSaved = bestPlan.waterSaved;
      this.bestPlan.roi = bestPlan.roi;
      this.bestPlan.confidence = bestPlan.confidence;
      this.bestPlan.profile = profileName;
      this.bestPlan.name = bestPlan.name;
    }

    return this.bestPlan;
  },

  _getAverageGPI() {
    let sum = 0;
    let count = 0;
    for (const [key, value] of this.gpiCache) {
      sum += value;
      count++;
    }
    return count > 0 ? sum / count : 0.5;
  },

  _generateFallbackPlan(profile, budget) {
    return {
      name: "Standard Setup",
      profile: profile.name,
      components: [
        { type: 'storage_tank', capacity: 5000, qty: 1 },
        { type: 'recharge_pit', qty: 1 }
      ],
      totalCost: 50000,
      waterSaved: 30000,
      roi: 1.67,
      confidence: 50,
      score: 0
    };
  },

  _createConservativePlan(profile, roofArea, rainfall) {
    return {
      name: "Conservative",
      components: [
        { type: 'storage_tank', capacity: 5000, qty: 1 },
        { type: 'recharge_pit', qty: 1 }
      ]
    };
  },

  _createBalancedPlan(profile, roofArea, rainfall) {
    return {
      name: "Balanced",
      components: [
        { type: 'storage_tank', capacity: 10000, qty: 1 },
        { type: 'recharge_pit', qty: 2 },
        { type: 'percolation_trench', length: 20, qty: 1 }
      ]
    };
  },

  _createComprehensivePlan(profile, roofArea, rainfall) {
    return {
      name: "Comprehensive",
      components: [
        { type: 'storage_tank', capacity: 20000, qty: 1 },
        { type: 'recharge_pit', qty: 3 },
        { type: 'percolation_trench', length: 40, qty: 1 },
        { type: 'greywater_system', qty: 1 }
      ]
    };
  },

  _createAlgorithmicPlan(profile, roofArea, rainfall, gpi) {
    const harvestPotential = rainfall * roofArea * 0.8;
    const dailyUsage = profile.dailyUsage;
    const tankSize = Math.min(harvestPotential * 0.3, dailyUsage * 15);

    const components = [];
    if (tankSize > 2000) {
      components.push({
        type: 'storage_tank',
        capacity: Math.ceil(tankSize / 5000) * 5000,
        qty: 1
      });
    }

    const excellentZones = this.rechargeZones.filter(z => z.score > 0.6).length;
    if (excellentZones > 0 && gpi < 0.5) {
      components.push({
        type: 'recharge_pit',
        qty: Math.min(excellentZones, 4)
      });
    }

    const slopedZones = this.rechargeZones.filter(z => z.slope > 0.2 && z.score > 0.4);
    if (slopedZones.length > 0) {
      components.push({
        type: 'percolation_trench',
        length: 10 * slopedZones.length,
        qty: 1
      });
    }

    if (profile.dailyUsage > 500) {
      components.push({
        type: 'greywater_system',
        capacity: profile.dailyUsage * 0.4,
        qty: 1
      });
    }

    return { name: "AI-Optimized", components };
  },

  _enrichPlan(plan, profile, budget) {
    const cost = this._calculateCost(plan);
    const waterSaved = this._calculateWaterSavings(plan, profile);

    return {
      ...plan,
      totalCost: Math.min(cost, budget),
      waterSaved,
      roi: cost > 0 ? cost / (waterSaved * profile.waterPrice) : 0,
      confidence: this._calculateConfidence(plan)
    };
  },

  _scorePlan(plan, profile) {
    if (!plan.waterSaved) return 0;
    const costEfficiency = plan.waterSaved / (plan.totalCost || 1);
    const normalizedCost = 1 / (1 + (plan.totalCost || 0) / 100000);
    return ((plan.waterSaved || 0) / 100000) * 0.5 + costEfficiency * 0.3 + normalizedCost * 0.2;
  },

  _calculateCost(plan) {
    const costs = {
      storage_tank: (c) => 50 * (c || 5000) + 10000,
      recharge_pit: 25000,
      percolation_trench: (l) => 800 * (l || 10),
      greywater_system: 60000
    };

    return plan.components.reduce((total, comp) => {
      const unitCost = typeof costs[comp.type] === 'function'
        ? costs[comp.type](comp.capacity || comp.length)
        : costs[comp.type];
      return total + (unitCost * (comp.qty || 1));
    }, 0);
  },

  _calculateWaterSavings(plan, profile) {
    let savings = 0;
    const rainfall = this.weatherData?.annual_rain || 1000;
    const roofArea = profile?.estimatedRoofArea || 100;

    plan.components.forEach(comp => {
      switch (comp.type) {
        case 'storage_tank':
          savings += Math.min(rainfall * roofArea * 0.8, (comp.capacity || 5000) * 365 / 15);
          break;
        case 'recharge_pit':
          savings += 50000 * (comp.qty || 1);
          break;
        case 'percolation_trench':
          savings += (comp.length || 10) * 1500;
          break;
        case 'greywater_system':
          savings += (profile?.dailyUsage || 600) * 0.4 * 365;
          break;
      }
    });

    return savings;
  },

  _calculateConfidence(plan) {
    let quality = 0.8;
    if (!this.terrainData) quality -= 0.2;
    if (!this.weatherData) quality -= 0.2;
    if (!this.rechargeZones.length) quality -= 0.1;
    return Math.max(quality - (plan.components.length / 10) * 0.1, 0.3) * 100;
  },

  calculateFinancials(profileName = 'residential') {
    const profile = this.USAGE_PROFILES[profileName] || this.USAGE_PROFILES.residential;
    const plan = this.bestPlan || this._generateFallbackPlan(profile, 150000);

    const capitalCost = plan.totalCost || 0;
    const annualSavings = (plan.waterSaved || 0) * profile.waterPrice;
    const maintenanceCost = capitalCost * 0.05;
    const netAnnualSavings = annualSavings - maintenanceCost;
    const payback = netAnnualSavings > 0 ? capitalCost / netAnnualSavings : Infinity;

    return {
      capitalCost,
      annualSavings,
      maintenanceCost,
      netAnnualSavings,
      paybackYears: payback,
      waterSaved: plan.waterSaved,
      confidence: plan.confidence || 50
    };
  },

  updateInsightPanel() {
    const gpi = this._getAverageGPI();
    const rainfall = this.weatherData?.annual_rain || 0;

    const gwCard = document.getElementById('groundwater-insight');
    if (gwCard) {
      let status, label, desc;
      if (gpi > 0.6) { status = 'good'; label = 'EXCELLENT'; desc = 'High availability'; }
      else if (gpi > 0.3) { status = 'ok'; label = 'GOOD'; desc = 'Adequate supply'; }
      else if (gpi > 0.15) { status = 'warning'; label = 'FAIR'; desc = 'Limited availability'; }
      else { status = 'critical'; label = 'POOR'; desc = 'Critical shortage'; }

      gwCard.querySelector('.insight-value').textContent = label;
      gwCard.querySelector('.insight-trend').textContent = desc;
      gwCard.className = `insight-card status-${status}`;
    }

    const rainCard = document.getElementById('rainfall-insight');
    if (rainCard) {
      let label, status;
      if (rainfall > 2000) { label = 'Very High'; status = 'good'; }
      else if (rainfall > 1000) { label = 'High'; status = 'good'; }
      else if (rainfall > 600) { label = 'Moderate'; status = 'ok'; }
      else { label = 'Low'; status = 'warning'; }

      rainCard.querySelector('.insight-value').textContent = rainfall + 'mm';
      rainCard.querySelector('.insight-trend').textContent = label;
      rainCard.className = `insight-card status-${status}`;
    }

    const riskCard = document.getElementById('risk-insight');
    if (riskCard) {
      const risk = this._calculateRisk();
      let label, desc, status;
      if (risk < 0.3) { status = 'good'; label = 'LOW'; desc = 'Good water security'; }
      else if (risk < 0.6) { status = 'warning'; label = 'MODERATE'; desc = 'Some vulnerability'; }
      else { status = 'critical'; label = 'HIGH'; desc = 'Action required'; }

      riskCard.querySelector('.insight-value').textContent = label;
      riskCard.querySelector('.insight-trend').textContent = desc;
      riskCard.className = `insight-card status-${status}`;
    }

    const recCard = document.getElementById('recommendation-insight');
    if (recCard && this.bestPlan) {
      const summary = this.bestPlan.components?.map(c => this.formatType(c.type)).join(' + ') || 'Generate Plan';
      recCard.querySelector('.insight-value').textContent = summary.substring(0, 20);
    }
  },

  _calculateRisk() {
    const gpi = this._getAverageGPI();
    const rainfall = this.weatherData?.annual_rain || 0;
    let risk = 0;
    if (gpi < 0.3) risk += 0.4;
    if (rainfall < 600) risk += 0.3;
    if (risk > 0.7) risk += 0.2;
    return Math.min(risk, 1);
  },

  generateAlerts() {
    const alerts = [];
    const gpi = this._getAverageGPI();
    const rainfall = this.weatherData?.annual_rain || 0;
    const risk = this._calculateRisk();

    if (risk > 0.7) {
      alerts.push({
        level: 'critical',
        title: 'High Water Shortage Risk',
        message: "Your location has critical water scarcity.",
        action: 'Install storage and recharge systems immediately.',
        icon: '🚨'
      });
    }

    if (gpi < 0.3) {
      alerts.push({
        level: 'warning',
        title: 'Low Groundwater Levels',
        message: 'Groundwater availability is critically low.',
        action: 'Prioritize recharge pits to restore aquifer.',
        icon: '⚠️'
      });
    }

    if (rainfall > 2500) {
      alerts.push({
        level: 'success',
        title: 'Excellent Rainfall',
        message: 'Great conditions for water harvesting.',
        action: 'Maximize infrastructure for best returns.',
        icon: '✅'
      });
    }

    if (this.bestPlan?.waterSaved > 50000) {
      alerts.push({
        level: 'info',
        title: 'High Water Savings Potential',
        message: `Estimated ${(this.bestPlan.waterSaved / 1000).toFixed(0)}k L/year savings.`,
        action: 'Proceed with recommended plan.',
        icon: '💡'
      });
    }

    return alerts;
  },

  renderAlerts() {
    const alerts = this.generateAlerts();
    const container = document.getElementById('smart-alerts');
    if (!container) return;

    container.innerHTML = alerts.map(alert => `
      <div class="alert-item alert-${alert.level}">
        <div class="alert-header">
          <span class="alert-icon">${alert.icon}</span>
          <span class="alert-title">${alert.title}</span>
        </div>
        <p class="alert-message">${alert.message}</p>
        <button class="alert-action" onclick="MAP_ENGINE._handleAlertAction('${alert.level}')">${alert.action}</button>
      </div>
    `).join('');
  },

  _handleAlertAction(level) {
    if (level === 'critical' || level === 'warning') {
      const checkbox = document.getElementById('layer-recharge');
      if (checkbox) {
        checkbox.checked = true;
        this._toggleLayer('layer-recharge', true);
      }
      const recCheckbox = document.getElementById('layer-recommendations');
      if (recCheckbox) {
        recCheckbox.checked = true;
        this._toggleLayer('layer-recommendations', true);
      }
    }
  },

  BASE_TILES: {
    standard: {
      name: 'OpenStreetMap',
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '© OpenStreetMap'
    },
    topo: {
      name: 'Topographic',
      url: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
      attribution: '© OpenTopoMap © OpenStreetMap'
    },
    minimal: {
      name: 'Minimal',
      url: 'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
      attribution: '© CartoDB'
    },
    satellite: {
      name: 'Satellite',
      url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      attribution: '© Esri'
    }
  },

  SOIL_INFILTRATION: {
    sand: 0.95,
    loamy_sand: 0.85,
    sandy_loam: 0.75,
    loam: 0.65,
    silt_loam: 0.55,
    clay_loam: 0.40,
    silty_clay: 0.25,
    clay: 0.15
  },

  computeGPI(rainfall_mm, soilType, slope, soilMoisture) {
    const rainfallScore = Math.min(rainfall_mm / 1500, 1);
    const infiltrationScore = this.SOIL_INFILTRATION[soilType] || 0.5;
    const slopeScore = Math.max(0, 1 - (slope / 45));
    const moistureScore = soilMoisture ? Math.min(soilMoisture / 0.5, 1) : 0.5;

    return Math.min(
      (rainfallScore * 0.35) +
      (infiltrationScore * 0.25) +
      (slopeScore * 0.20) +
      (moistureScore * 0.20),
      1
    );
  },

  getCachedGPI(lat, lng) {
    const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
    if (this.gpiCache.has(key)) {
      return this.gpiCache.get(key);
    }
    return null;
  },

  classifyGPI(gpi) {
    if (gpi >= 0.6) return 'High';
    if (gpi >= 0.3) return 'Moderate';
    return 'Low';
  },

  estimateWaterTableDepth(gpi, elevation) {
    const baseDepth = 50 - (gpi * 30);
    return {
      min: Math.round(baseDepth - 7),
      max: Math.round(baseDepth + 7)
    };
  },

  interpolateRainfall(stations, targetLat, targetLng) {
    if (!stations || stations.length === 0) return 1000;

    let numerator = 0;
    let denominator = 0;

    for (const station of stations) {
      const dLat = targetLat - station.lat;
      const dLon = targetLng - station.lng;
      const distance = Math.sqrt(dLat * dLat + dLon * dLon);

      if (distance < 0.0001) return station.rainfall;

      const weight = 1 / Math.pow(distance, 2);
      numerator += weight * station.rainfall;
      denominator += weight;
    }

    return denominator > 0 ? numerator / denominator : 1000;
  },

  calculateRechargeScore(point) {
    const slopeFlatness = 1 - (point.slope || 0);
    const groundwaterNeed = 1 - (point.gpi || 0.5);

    return (
      (point.rainfall || 0) / 2500 * 0.30 +
      (point.soilInfiltration || 0.5) * 0.30 +
      slopeFlatness * 0.25 +
      groundwaterNeed * 0.15
    );
  },

  classifyZone(score) {
    if (score >= 0.6) return { grade: 'excellent', color: '#22c55e', label: 'High Potential' };
    if (score >= 0.3) return { grade: 'moderate', color: '#eab308', label: 'Medium Potential' };
    return { grade: 'poor', color: '#ef4444', label: 'Low Potential' };
  },

  detectRechargeZones() {
    if (!this.terrainData?.elevations || !this.weatherData) return [];

    const grid = this.terrainData.elevations;
    const gridSize = this.terrainData.grid_size;
    const zones = [];

    const step = Math.max(4, Math.floor(gridSize / 12));

    for (let row = 0; row < gridSize - step; row += step) {
      for (let col = 0; col < gridSize - step; col += step) {
        const centerRow = Math.min(row + step / 2, gridSize - 1);
        const centerCol = Math.min(col + step / 2, gridSize - 1);

        const lat = this.terrainData.lat_max - (centerRow / gridSize) * (this.terrainData.lat_max - this.terrainData.lat_min);
        const lon = this.terrainData.lon_min + (centerCol / gridSize) * (this.terrainData.lon_max - this.terrainData.lon_min);

        const elev = grid[centerRow][centerCol];

        const rowAbove = Math.max(0, row - 1);
        const rowBelow = Math.min(gridSize - 1, row + step + 1);
        const colLeft = Math.max(0, col - 1);
        const colRight = Math.min(gridSize - 1, col + step + 1);

        const dzdx = (grid[centerRow][colRight] - grid[centerRow][colLeft]) / 2;
        const dzdy = (grid[rowBelow][centerCol] - grid[rowAbove][centerCol]) / 2;
        const slope = Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy)) * (180 / Math.PI) / 45;

        const soilType = this._inferSoilType(elev);
        const infiltration = this.SOIL_INFILTRATION[soilType] || 0.5;

        const gpi = this.getCachedGPI(lat, lon) || 0.5;

        const point = {
          lat,
          lon,
          elevation: elev,
          slope,
          rainfall: this.weatherData.annual_rain,
          soilInfiltration: infiltration,
          gpi
        };

        const score = this.calculateRechargeScore(point);
        const classification = this.classifyZone(score);

        zones.push({
          center: [lat, lon],
          bounds: [
            [this.terrainData.lat_max - (row / gridSize) * (this.terrainData.lat_max - this.terrainData.lat_min), this.terrainData.lon_min + (col / gridSize) * (this.terrainData.lon_max - this.terrainData.lon_min)],
            [this.terrainData.lat_max - ((row + step) / gridSize) * (this.terrainData.lat_max - this.terrainData.lat_min), this.terrainData.lon_min + ((col + step) / gridSize) * (this.terrainData.lon_max - this.terrainData.lon_min)]
          ],
          score,
          ...classification,
          rainfall: this.weatherData.annual_rain,
          soilType,
          slope
        });
      }
    }

    return zones.sort((a, b) => b.score - a.score);
  },

  renderRechargeZones(zones) {
    this.layers.rechargeZones.clearLayers();

    const displayed = zones.slice(0, 15);
    for (const zone of displayed) {
      if (zone.score < 0.2) continue;

      const polygon = L.rectangle(zone.bounds, {
        color: zone.color,
        fillColor: zone.color,
        fillOpacity: 0.4,
        weight: 2
      }).bindPopup(`
        <div class="rec-popup">
          <b>${zone.label}</b><br>
          Score: ${(zone.score * 100).toFixed(0)}%<br>
          Rainfall: ${zone.rainfall}mm<br>
          Soil: ${zone.soilType}
        </div>
      `);

      this.layers.rechargeZones.addLayer(polygon);
    }

    if (document.getElementById('layer-recharge')?.checked) {
      this.layers.rechargeZones.addTo(this.map);
    }
  },

  RECOMMENDATION_ICONS: {
    storage_tank: '🔵',
    recharge_pit: '🟢',
    percolation_trench: '🟡'
  },

  generateRecommendations() {
    if (!this.rechargeZones.length || !this.terrainData) return [];

    const recs = [];
    const buildings = this._getBuildingLocations();

    for (const zone of this.rechargeZones) {
      if (zone.score < 0.3) continue;
      if (zone.score > 0.6 && zone.slope < 0.3) {
        recs.push({
          type: 'recharge_pit',
          location: zone.center,
          reason: 'Flat terrain with high infiltration capacity',
          impact: 'Recharge 15-25% more groundwater annually',
          priority: 'high',
          estimatedCost: 25000,
          waterSaved: 50000
        });
      }

      if (zone.score > 0.4 && zone.slope > 0.2 && zone.slope < 0.6) {
        recs.push({
          type: 'percolation_trench',
          location: zone.center,
          reason: 'Sloped area with good soil permeability',
          impact: 'Slow runoff and increase infiltration by 30%',
          priority: 'medium',
          estimatedCost: 35000,
          waterSaved: 75000
        });
      }
    }

    for (const building of buildings) {
      if (building.roofArea > 80 && zone.rainfall > 800) {
        recs.push({
          type: 'storage_tank',
          location: building.center,
          reason: `${building.roofArea}m² roof in high rainfall area`,
          impact: `Harvest ${(building.roofArea * zone.rainfall * 0.8).toFixed(0)}L annually`,
          priority: zone.gpi < 0.4 ? 'high' : 'medium',
          estimatedCost: 45000,
          waterSaved: building.roofArea * zone.rainfall * 0.8,
          capacity: 40000
        });
      }
    }

    return this._deduplicateRecommendations(recs);
  },

  _getBuildingLocations() {
    if (!this.osmData?.buildings) {
      const { lat, lon } = this.currentLocation || { lat: 0, lon: 0 };
      return [
        { center: [lat, lon], roofArea: 120 },
        { center: [lat + 0.002, lon + 0.001], roofArea: 150 }
      ];
    }
    return this.osmData.buildings.map(b => ({ center: [b.lat, b.lon], roofArea: b.area || 100 }));
  },

  _deduplicateRecommendations(recs) {
    const MIN_DISTANCE = 0.001;
    const filtered = [];

    recs.sort((a, b) => b.waterSaved - a.waterSaved);

    for (const rec of recs) {
      const tooClose = filtered.some(existing => {
        const dLat = Math.abs(rec.location[0] - existing.location[0]);
        const dLon = Math.abs(rec.location[1] - existing.location[1]);
        return Math.sqrt(dLat * dLat + dLon * dLon) < MIN_DISTANCE;
      });
      if (!tooClose) filtered.push(rec);
    }

    return filtered.slice(0, 10);
  },

  formatType(type) {
    const names = {
      storage_tank: 'Storage Tank',
      recharge_pit: 'Recharge Pit',
      percolation_trench: 'Percolation Trench'
    };
    return names[type] || type;
  },

  getIconEmoji(type) {
    return this.RECOMMENDATION_ICONS[type] || '⚪';
  },

  generateBestPlan(budget = 150000) {
    if (!this.recommendations.length) return null;

    const sorted = [...this.recommendations].sort((a, b) =>
      (b.waterSaved / b.estimatedCost) - (a.waterSaved / a.estimatedCost)
    );

    const plan = [];
    let totalCost = 0;
    let totalWater = 0;

    for (const rec of sorted) {
      if (totalCost + rec.estimatedCost <= budget) {
        plan.push(rec);
        totalCost += rec.estimatedCost;
        totalWater += rec.waterSaved;
      }
    }

    const types = new Set(plan.map(r => r.type));
    if (types.size === 1 && plan.length > 3) {
      const alternative = sorted.find(r => !types.has(r.type) && totalCost + r.estimatedCost <= budget);
      if (alternative) {
        plan.push(alternative);
        totalCost += alternative.estimatedCost;
        totalWater += alternative.waterSaved;
      }
    }

    const roi = totalWater > 0 ? totalCost / totalWater : 0;
    const summary = this.generateSummary(plan);

    return {
      components: plan,
      totalCost,
      totalWater,
      roi,
      summary
    };
  },

  generateSummary(plan) {
    const counts = {};
    plan.forEach(item => {
      const type = this.formatType(item.type);
      counts[type] = (counts[type] || 0) + 1;
    });

    return Object.entries(counts)
      .map(([type, count]) => `${count} × ${type}`)
      .join(' + ');
  },

  renderRecommendations() {
    this.layers.recommendations = this.layers.recommendations || L.layerGroup();
    this.layers.recommendations.clearLayers();

    for (const rec of this.recommendations) {
      const icon = L.divIcon({
        className: 'rec-marker',
        html: `<div class="rec-icon-inner">${this.getIconEmoji(rec.type)}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      const popup = `
        <div class="rec-popup">
          <h3>${this.formatType(rec.type)}</h3>
          <div class="priority-${rec.priority}">${rec.priority.toUpperCase()} PRIORITY</div>
          <h4>Why Here?</h4>
          <p>${rec.reason}</p>
          <h4>Expected Impact</h4>
          <p>${rec.impact}</p>
          <div class="rec-stats">
            <span>💰 ₹${rec.estimatedCost.toLocaleString()}</span>
            <span>💧 ${(rec.waterSaved / 1000).toFixed(0)}k L/year</span>
          </div>
        </div>
      `;

      const marker = L.marker(rec.location, { icon })
        .bindPopup(popup);

      this.layers.recommendations.addLayer(marker);
    }

    if (document.getElementById('layer-recommendations')?.checked) {
      this.layers.recommendations.addTo(this.map);
    }
  },

  updateRecommendationsUI() {
    const plan = this.bestPlan;
    if (!plan) return;

    const summaryEl = document.getElementById('plan-summary');
    if (summaryEl) summaryEl.textContent = plan.summary;

    const waterEl = document.getElementById('total-water');
    if (waterEl) waterEl.textContent = `${(plan.totalWater / 1000).toFixed(0)}k L/year`;

    const costEl = document.getElementById('total-cost');
    if (costEl) costEl.textContent = `₹${plan.totalCost.toLocaleString()}`;

    const roiEl = document.getElementById('roi');
    if (roiEl) roiEl.textContent = `${plan.roi.toFixed(1)} years`;

    const container = document.getElementById('individual-recommendations');
    if (container) {
      container.innerHTML = plan.components.map(rec => `
        <div class="rec-card priority-${rec.priority}">
          <div class="rec-icon">${this.getIconEmoji(rec.type)}</div>
          <div class="rec-content">
            <h4>${this.formatType(rec.type)}</h4>
            <p>${rec.reason}</p>
            <div class="rec-metrics">
              <span>💧 ${(rec.waterSaved / 1000).toFixed(0)}k L/yr</span>
              <span>💰 ₹${rec.estimatedCost.toLocaleString()}</span>
            </div>
          </div>
        </div>
      `).join('');
    }
  },

  ELEVATION_COLORS: [
    { elevation: 0, color: [13, 71, 161] },
    { elevation: 200, color: [46, 125, 50] },
    { elevation: 500, color: [85, 139, 47] },
    { elevation: 1000, color: [249, 168, 37] },
    { elevation: 2000, color: [230, 81, 0] },
    { elevation: 3000, color: [191, 54, 12] },
    { elevation: 4000, color: [255, 255, 255] }
  ],
  
  init() {
    const mapEl = document.getElementById('map');
    if (!mapEl) {
      console.error('Map container not found');
      return;
    }
    
    this.map = L.map('map', {
      center: [20.5937, 78.9629],
      zoom: 5,
      zoomControl: false,
      attributionControl: true
    });
    
    this.map.attributionControl.setPrefix('');
    this.map.attributionControl.addAttribution('Water Harvesting Advisor');
    
    this._setupBaseLayer('topo');
    this._initLayers();
    this._bindEvents();
    this._bindMapControls();
  },
  
  _setupBaseLayer(type) {
    const config = this.BASE_TILES[type] || this.BASE_TILES.topo;
    
    if (this.layers.base) {
      this.map.removeLayer(this.layers.base);
    }
    
    this.layers.base = L.tileLayer(config.url, {
      maxZoom: 18,
      attribution: config.attribution
    });
    
this.layers.base.addTo(this.map);
    
    this.map.on('zoomend', () => this._handleZoomChange());
    this.map.on('moveend', () => this._checkMapStyle());
  },

  _determineBestMapStyle() {
    if (this.currentMapMode !== 'smart') {
      return this.currentMapMode;
    }
    
    const zoom = this.map.getZoom();
    const activeLayers = this._getActiveLayers();
    
    if (activeLayers.groundwater || activeLayers.recharge || activeLayers.recommendations) {
      return 'topo';
    }
    
    if (activeLayers.rainfall) {
      return 'minimal';
    }
    
    if (zoom < 10) {
      return 'standard';
    }
    
    if (zoom >= 14) {
      return 'satellite';
    }
    
    return 'topo';
  },

  _getActiveLayers() {
    return {
      groundwater: this.map.hasLayer(this.layers.groundwater),
      recharge: this.map.hasLayer(this.layers.rechargeZones),
      rainfall: this.map.hasLayer(this.layers.rainfall),
      recommendations: this.map.hasLayer(this.layers.recommendations),
      elevation: this.map.hasLayer(this.layers.elevation),
      contours: this.map.hasLayer(this.layers.contours),
      rivers: this.map.hasLayer(this.layers.rivers)
    };
  },

  _checkMapStyle() {
    if (this.currentMapMode !== 'smart') return;
    
    const recommended = this._determineBestMapStyle();
    if (recommended !== this.mapStyleCache) {
      this._switchMapStyle(recommended, true);
    }
  },

  _handleZoomChange() {
    const zoom = this.map.getZoom();
    const zoomChanged = Math.abs(zoom - this.lastZoom) > 1;
    this.lastZoom = zoom;
    
    if (this.currentMapMode === 'smart' && zoomChanged) {
      this._checkMapStyle();
    }
    
    this._applyFocusMode();
  },

  _switchMapStyle(style, animate = true) {
    if (this.mapStyleCache === style) return;
    
    const oldLayer = this.layers.base;
    const newConfig = this.BASE_TILES[style] || this.BASE_TILES.topo;
    
    this.layers.base = L.tileLayer(newConfig.url, {
      maxZoom: 18,
      attribution: newConfig.attribution,
      opacity: this.focusModeEnabled ? 0.3 : 1
    });
    
    if (animate) {
      this.layers.base.setOpacity(0);
      this.layers.base.addTo(this.map);
      
      let opacity = 0;
      const fadeIn = setInterval(() => {
        opacity += 0.1;
        this.layers.base.setOpacity(opacity);
        if (opacity >= 1) {
          clearInterval(fadeIn);
          if (oldLayer) {
            this.map.removeLayer(oldLayer);
          }
        }
      }, 30);
    } else {
      this.layers.base.addTo(this.map);
      if (oldLayer) {
        this.map.removeLayer(oldLayer);
      }
    }
    
    this.mapStyleCache = style;
    this._updateMapIndicator(style);
  },

  _setMapMode(mode) {
    this.currentMapMode = mode;
    
    const mapEl = document.getElementById('map');
    const viewport = document.getElementById('viewport');
    
    if (viewport) viewport.style.display = 'none';
    if (mapEl) mapEl.style.display = 'block';
    
    if (mode === 'smart') {
      this._checkMapStyle();
    } else {
      this._switchMapStyle(mode, true);
    }
    
    localStorage.setItem('mapMode', mode);
  },

  _toggleFocusMode() {
    this.focusModeEnabled = !this.focusModeEnabled;
    this._applyFocusMode();
    
    localStorage.setItem('focusMode', this.focusModeEnabled);
  },

  _applyFocusMode() {
    if (!this.layers.base) return;
    
    const activeLayers = this._getActiveLayers();
    const hasActiveLayers = Object.values(activeLayers).some(v => v);
    
    let baseOpacity = 1;
    if (this.focusModeEnabled) {
      baseOpacity = hasActiveLayers ? 0.3 : 0.5;
    }
    
    this.layers.base.setOpacity(baseOpacity);
    
    const layerOpacity = this.focusModeEnabled ? 1 : 0.7;
    if (this.layers.groundwater) {
      this.layers.groundwater.eachLayer(layer => {
        if (layer.setOpacity) {
          layer.setOpacity(layerOpacity);
        }
      });
    }
  },

  _updateMapIndicator(style) {
    const indicator = document.getElementById('map-view-indicator');
    if (indicator) {
      const labels = {
        standard: 'Standard',
        topo: 'Topographic',
        minimal: 'Minimal',
        satellite: 'Satellite',
        smart: 'Smart View'
      };
      indicator.textContent = labels[style] || style;
    }
    
    const select = document.getElementById('map-mode-select');
    if (select) {
      select.value = this.currentMapMode;
    }
    
    document.querySelectorAll('.map-mode-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mode === (this.currentMapMode === 'smart' ? 'smart' : style));
    });
  },

  initMapMode() {
    const savedMode = localStorage.getItem('mapMode') || 'topo';
    const savedFocus = localStorage.getItem('focusMode') === 'true';
    
    this.currentMapMode = savedMode;
    this.focusModeEnabled = savedFocus;
    
    const mapEl = document.getElementById('map');
    const viewport = document.getElementById('viewport');
    
    if (viewport) viewport.style.display = 'none';
    if (mapEl) mapEl.style.display = 'block';
    
    if (savedMode === 'smart') {
      this._checkMapStyle();
    } else if (savedMode !== 'topo') {
      this._switchMapStyle(savedMode, false);
    }
    
    const select = document.getElementById('map-mode-select');
    if (select) select.value = savedMode;
  },

  _initLayers() {
    this.layers.elevation = L.layerGroup();
    this.layers.contours = L.layerGroup();
    this.layers.hillshade = L.layerGroup();
    this.layers.rivers = L.layerGroup();
    this.layers.lakes = L.layerGroup();
    this.layers.recharge = L.layerGroup();
    this.layers.groundwater = L.layerGroup();
    this.layers.wells = L.layerGroup();
    this.layers.roads = L.layerGroup();
    this.layers.places = L.layerGroup();
    this.layers.peaks = L.layerGroup();
    this.layers.rainfall = L.layerGroup();
    this.layers.wind = L.layerGroup();
    this.layers.drainage = L.layerGroup();
    this.layers.rechargeZones = L.layerGroup();
    this.layers.recommendations = L.layerGroup();

    this._createGroundwaterCanvas();
    this._createRainfallCanvas();
  },

  _createGroundwaterCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    canvas.style.display = 'none';
    document.body.appendChild(canvas);
    this.groundwaterCanvas = canvas;
  },

  _createRainfallCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    canvas.style.display = 'none';
    document.body.appendChild(canvas);
    this.rainfallCanvas = canvas;
  },

  async renderGroundwaterLayer() {
    if (!this.terrainData?.elevations || !this.weatherData) return;

    const canvas = this.groundwaterCanvas;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const grid = this.terrainData.elevations;
    const gridSize = this.terrainData.grid_size;
    const latStep = (this.terrainData.lat_max - this.terrainData.lat_min) / 20;
    const lonStep = (this.terrainData.lon_max - this.terrainData.lon_min) / 20;

    const gradient = ctx.createLinearGradient(0, 0, 512, 512);
    gradient.addColorStop(0, '#d32f2f');
    gradient.addColorStop(0.3, '#f57c00');
    gradient.addColorStop(0.5, '#fbc02d');
    gradient.addColorStop(0.7, '#7cb342');
    gradient.addColorStop(1, '#2e7d32');

    const cellSize = 512 / 20;

    for (let row = 0; row < 20; row++) {
      for (let col = 0; col < 20; col++) {
        const lat = this.terrainData.lat_max - (row + 0.5) * latStep;
        const lon = this.terrainData.lon_min + (col + 0.5) * lonStep;

        const gRow = Math.floor((this.terrainData.lat_max - lat) / (this.terrainData.lat_max - this.terrainData.lat_min) * (gridSize - 1));
        const gCol = Math.floor((lon - this.terrainData.lon_min) / (this.terrainData.lon_max - this.terrainData.lon_min) * (gridSize - 1));

        if (gRow >= 0 && gRow < gridSize && gCol >= 0 && gCol < gridSize) {
          const elev = grid[gRow][gCol];

          const gRowAbove = Math.max(0, gRow - 1);
          const gRowBelow = Math.min(gridSize - 1, gRow + 1);
          const gColLeft = Math.max(0, gCol - 1);
          const gColRight = Math.min(gridSize - 1, gCol + 1);

          const dzdx = (grid[gRow][gColRight] - grid[gRow][gColLeft]) / 2;
          const dzdy = (grid[gRowBelow][gCol] - grid[gRowAbove][gCol]) / 2;
          const slopeDegrees = Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy)) * (180 / Math.PI);
          const slopeFactor = Math.max(0, 1 - (slopeDegrees / 45));

          const soilType = this._inferSoilType(elev);
          const soilMoisture = this._estimateSoilMoisture(lat, lon);
          const gpi = this.computeGPI(
            this.weatherData.annual_rain,
            soilType,
            slopeDegrees,
            soilMoisture
          );

          this.gpiCache.set(`${lat.toFixed(4)},${lon.toFixed(4)}`, gpi);

          if (gpi > 0.1) {
            const t = gpi;
            let r, g, b;
            if (t < 0.3) {
              const p = t / 0.3;
              r = 211 + p * (245 - 211);
              g = 124 + p * (124 - 124);
              b = 47 + p * (47 - 47);
            } else if (t < 0.5) {
              const p = (t - 0.3) / 0.2;
              r = 245 + p * (251 - 245);
              g = 124 + p * (192 - 124);
              b = 45 + p * (45 - 45);
            } else if (t < 0.7) {
              const p = (t - 0.5) / 0.2;
              r = 251 + p * (123 - 251);
              g = 192 + p * (179 - 192);
              b = 45 + p * (66 - 45);
            } else {
              const p = (t - 0.7) / 0.3;
              r = 123 + p * (46 - 123);
              g = 179 + p * (125 - 179);
              b = 66 + p * (50 - 66);
            }

            ctx.fillStyle = `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, 0.6)`;
            ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
          }
        }
      }
    }

    this.layers.groundwater.clearLayers();

    const imageBounds = [
      [this.terrainData.lat_max, this.terrainData.lon_min],
      [this.terrainData.lat_min, this.terrainData.lon_max]
    ];

    const imageOverlay = L.imageOverlay(canvas.toDataURL(), imageBounds, {
      opacity: 0.7,
      interactive: false
    });

    this.layers.groundwater.addLayer(imageOverlay);
  },

  async renderRainfallLayer() {
    if (!this.weatherData) return;

    const canvas = this.rainfallCanvas;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const bounds = this.map.getBounds();
    const latStep = (bounds.getNorth() - bounds.getSouth()) / 20;
    const lonStep = (bounds.getEast() - bounds.getWest()) / 20;

    const stations = this._getRainfallStations();
    const annualRain = this.weatherData.annual_rain || 1000;

    for (let row = 0; row < 20; row++) {
      for (let col = 0; col < 20; col++) {
        const lat = bounds.getSouth() + (row + 0.5) * latStep;
        const lon = bounds.getWest() + (col + 0.5) * lonStep;

        const rainfall = this.interpolateRainfall(stations, lat, lon);
        const normalized = Math.min(rainfall / 2500, 1);

        let r, g, b, a;
        if (normalized < 0.2) {
          r = 187; g = 222; b = 251; a = 0.25;
        } else if (normalized < 0.4) {
          r = 100; g = 181; b = 246; a = 0.3;
        } else if (normalized < 0.6) {
          r = 66; g = 165; b = 245; a = 0.4;
        } else if (normalized < 0.8) {
          r = 30; g = 136; b = 229; a = 0.5;
        } else {
          r = 13; g = 71; b = 161; a = 0.6;
        }

        const cellSize = 512 / 20;
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
        ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
      }
    }

    this.layers.rainfall.clearLayers();

    const imageBounds = [
      [bounds.getSouth(), bounds.getWest()],
      [bounds.getNorth(), bounds.getEast()]
    ];

    const imageOverlay = L.imageOverlay(canvas.toDataURL(), imageBounds, {
      opacity: 0.4,
      interactive: false
    });

    this.layers.rainfall.addLayer(imageOverlay);
  },

  _inferSoilType(elevation) {
    const rainfall = this.weatherData?.annual_rain || 1000;

    if (elevation < 200) return 'clay';
    if (elevation < 500) return 'clay_loam';
    if (elevation < 800) return 'loam';
    if (elevation < 1200) return 'silt_loam';
    if (rainfall > 2000) return 'sandy_loam';
    return 'sand';
  },

  _estimateSoilMoisture(lat, lon) {
    const elev = this._getElevationAt(lat, lon);
    if (!elev) return 0.3;

    const precip = this.weatherData?.annual_rain || 1000;
    return (precip / 3000) * 0.4;
  },

  _getRainfallStations() {
    if (!this.currentLocation) return [];
    const { lat, lon } = this.currentLocation;

    return [
      { lat: lat - 0.05, lon: lon - 0.05, rainfall: this.weatherData?.annual_rain || 1200 },
      { lat: lat + 0.05, lon: lon + 0.05, rainfall: this.weatherData?.annual_rain || 1100 },
      { lat: lat - 0.05, lon: lon + 0.05, rainfall: this.weatherData?.annual_rain || 1300 },
      { lat: lat + 0.05, lon: lon - 0.05, rainfall: this.weatherData?.annual_rain || 1150 },
      { lat: lat, lon: lon, rainfall: this.weatherData?.annual_rain || 1250 }
    ];
  },

  async _computeHydrology() {
    if (!this.terrainData?.elevations) return;
    if (!window.DecisionEngine?.ready) return;
    
    const grid = this.terrainData.elevations;
    const gridSize = this.terrainData.grid_size;
    
    try {
      const flowDir = await window.DecisionEngine.computeD8Flow(grid, gridSize, this.terrainData.cell_m);
      const flowAcc = await window.DecisionEngine.computeFlowAccumulation(flowDir, gridSize);
    
      this.flowData = { flowDir, flowAcc };
    
      const bounds = {
        latMin: this.terrainData.lat_min,
        latMax: this.terrainData.lat_max,
        lonMin: this.terrainData.lon_min,
        lonMax: this.terrainData.lon_max
      };
    
      const drainagePaths = await window.DecisionEngine.extractDrainagePaths(flowDir, flowAcc, 50, gridSize, bounds);
      this._renderDrainagePaths(drainagePaths);
    
      const highRunoff = flowAcc.flat().filter(v => v > 100).length;
      const optimalZones = this._findOptimalRechargeZones(grid, flowAcc, gridSize);
      this._renderRechargeZones(optimalZones);
    
      return { drainagePaths, highRunoff, optimalZones };
    } catch (e) {
      console.warn('Hydrology compute skipped:', e);
    }
  },

  _renderDrainagePaths(paths) {
    this.layers.drainage.clearLayers();
    
    for (const path of paths.slice(0, 50)) {
      if (!path.points || path.points.length < 3) continue;
      
      const polyline = L.polyline(path.points, {
        color: '#1976D2',
        weight: 2,
        opacity: 0.7
      });
      
      this.layers.drainage.addLayer(polyline);
    }
    
    if (document.getElementById('layer-drainage')?.checked) {
      this.layers.drainage.addTo(this.map);
    }
  },

  _findOptimalRechargeZones(grid, flowAcc, gridSize) {
    const zones = [];
    const threshold = Math.max(...flowAcc.flat()) * 0.3;
    
    for (let row = 0; row < gridSize; row += 4) {
      for (let col = 0; col < gridSize; col += 4) {
        if (flowAcc[row][col] > threshold) {
          const lat = this.terrainData.lat_max - (row / gridSize) * (this.terrainData.lat_max - this.terrainData.lat_min);
          const lon = this.terrainData.lon_min + (col / gridSize) * (this.terrainData.lon_max - this.terrainData.lon_min);
          zones.push({ lat, lon, accumulation: flowAcc[row][col] });
        }
      }
    }
    
    return zones.slice(0, 10);
  },

  _renderRechargeZones(zones) {
    this.layers.rechargeZones.clearLayers();
    
    for (const zone of zones) {
      const circle = L.circle([zone.lat, zone.lon], {
        radius: 30,
        fillColor: '#4CAF50',
        fillOpacity: 0.4,
        color: '#2E7D32',
        weight: 1
      }).bindPopup(`<b>Optimal Recharge Zone</b><br>Accumulation: ${zone.accumulation}`);
      
      this.layers.rechargeZones.addLayer(circle);
    }
    
    if (document.getElementById('layer-recharge')?.checked) {
      this.layers.rechargeZones.addTo(this.map);
    }
  },

  async runOptimization(propertyData) {
    if (!this.weatherData) return null;
    if (!window.DecisionEngine?.ready) return null;
    
    const data = {
      propertySize: propertyData.roof_area + propertyData.land_area,
      annualRainfall: this.weatherData.annual_rain,
      budget: propertyData.budget || 100000,
      soilPermeability: window.SOIL_INF?.[propertyData.soil] || 25,
      roofArea: propertyData.roof_area,
      landArea: propertyData.land_area,
      people: propertyData.people
    };
    
    try {
      this.optimizedSetup = await window.DecisionEngine.optimize(data);
    } catch (e) {
      console.warn('Optimization skipped:', e);
    }
    return this.optimizedSetup;
  },

  async projectGroundwater(rechargeVolume, area, currentDepth = 50) {
    if (!this.weatherData) return null;
    
    const data = {
      rechargeVolume,
      area,
      currentDepth,
      soilPermeability: 25,
      years: 5
    };
    
    this.groundwaterProjection = await window.DecisionEngine.projectGroundwater(data);
    return this.groundwaterProjection;
  },

  getSmartAlerts() {
    return window.SmartAlerts.analyze(
      this.weatherData,
      { groundwater_depth: 50 },
      this.optimizedSetup
    );
  },
  
  _bindEvents() {
    document.getElementById('baseLayerSelector')?.addEventListener('change', (e) => {
      this._setupBaseLayer(e.target.value);
    });
    
    document.querySelectorAll('.layer-toggle input[type="checkbox"]').forEach(cb => {
      cb.addEventListener('change', (e) => this._toggleLayer(e.target.id, e.target.checked));
    });
    
    this.map.on('click', (e) => this._onMapClick(e));
  },
  
  _bindMapControls() {
    document.getElementById('zoom-in')?.addEventListener('click', () => this.map.zoomIn());
    document.getElementById('zoom-out')?.addEventListener('click', () => this.map.zoomOut());
    document.getElementById('locate-btn')?.addEventListener('click', () => this._goToLocation());
    document.getElementById('measure-btn')?.addEventListener('click', () => this._toggleMeasure());
  },
  
  _toggleLayer(layerId, visible) {
    const layerMap = {
      'layer-elevation': this.layers.elevation,
      'layer-contours': this.layers.contours,
      'layer-hillshade': this.layers.hillshade,
      'layer-rivers': this.layers.rivers,
      'layer-lakes': this.layers.lakes,
      'layer-recharge': this.layers.rechargeZones,
      'layer-groundwater': this.layers.groundwater,
      'layer-wells': this.layers.wells,
      'layer-roads': this.layers.roads,
      'layer-places': this.layers.places,
      'layer-peaks': this.layers.peaks,
      'layer-rainfall': this.layers.rainfall,
      'layer-wind': this.layers.wind,
      'layer-drainage': this.layers.drainage,
      'layer-recommendations': this.layers.recommendations
    };

    const layer = layerMap[layerId];
    if (!layer) return;

    if (visible) {
      if (!this.map.hasLayer(layer)) {
        layer.addTo(this.map);
      }
      if (layerId === 'layer-groundwater') {
        this.renderGroundwaterLayer();
      } else if (layerId === 'layer-rainfall') {
        this.renderRainfallLayer();
      }
    } else {
      if (this.map.hasLayer(layer)) {
        this.map.removeLayer(layer);
      }
    }
  },
  
  async _onMapClick(e) {
    const { lat, lng } = e.latlng;

    let popupContent = `
      <div class="location-popup">
        <h4>Location Data</h4>
        <table>
          <tr><td>Latitude:</td><td>${lat.toFixed(5)}°</td></tr>
          <tr><td>Longitude:</td><td>${lng.toFixed(5)}°</td></tr>
    `;

    let elev = null;
    if (this.terrainData) {
      elev = this._getElevationAt(lat, lng);
      if (elev !== null) {
        popupContent += `<tr><td>Elevation:</td><td>${elev.toFixed(0)} m</td></tr>`;
      }
    }

    if (this.weatherData) {
      popupContent += `<tr><td>Annual Rain:</td><td>${this.weatherData.annual_rain || '--'} mm</td></tr>`;
      popupContent += `<tr><td>Altitude:</td><td>${this.weatherData.altitude || '--'} m</td></tr>`;
    }

    if (this.terrainData && elev !== null) {
      const cachedGpi = this.getCachedGPI(lat, lng);

      if (cachedGpi !== null) {
        const classification = this.classifyGPI(cachedGpi);
        const depth = this.estimateWaterTableDepth(cachedGpi, elev);
        const rechargePotential = cachedGpi >= 0.5 ? 'Good' : (cachedGpi >= 0.3 ? 'Moderate' : 'Low');

        popupContent += `
          </table>
          <div style="margin-top:12px;padding-top:12px;border-top:1px solid #eee">
            <h4 style="margin:0 0 8px 0;color:var(--accent)">Groundwater Analysis</h4>
            <table>
              <tr><td>Potential:</td><td class="status-${classification.toLowerCase()}"><b>${classification}</b></td></tr>
              <tr><td>Index (GPI):</td><td>${(cachedGpi * 100).toFixed(1)}%</td></tr>
              <tr><td>Est. Depth:</td><td>${depth.min}–${depth.max}m</td></tr>
              <tr><td>Recharge:</td><td>${rechargePotential}</td></tr>
            </table>
          </div>
        `;
      } else {
        popupContent += '</table>';
      }
    } else {
      popupContent += '</table>';
    }

    popupContent += '</div>';

    L.popup()
      .setLatLng(e.latlng)
      .setContent(popupContent)
      .openOn(this.map);
  },
  
  _getElevationAt(lat, lng) {
    if (!this.terrainData || !this.terrainData.elevations) return null;
    
    const grid = this.terrainData.elevations;
    const gridSize = this.terrainData.grid_size;
    const latMin = this.terrainData.lat_min;
    const latMax = this.terrainData.lat_max;
    const lonMin = this.terrainData.lon_min;
    const lonMax = this.terrainData.lon_max;
    
    const row = Math.floor((latMax - lat) / (latMax - latMin) * (gridSize - 1));
    const col = Math.floor((lon - lonMin) / (lonMax - lonMin) * (gridSize - 1));
    
    if (row >= 0 && row < gridSize && col >= 0 && col < gridSize) {
      return grid[row][col];
    }
    return null;
  },
  
  _goToLocation() {
    if (this.currentLocation) {
      this.map.setView([this.currentLocation.lat, this.currentLocation.lon], 13);
    } else {
      navigator.geolocation?.getCurrentPosition(
        (pos) => {
          this.map.setView([pos.coords.latitude, pos.coords.longitude], 13);
        },
        () => alert('Could not get location')
      );
    }
  },
  
  _toggleMeasure() {
    if (this._measuring) {
      this._measuring = false;
      if (this._measureHandler) {
        this.map.off('click', this._measureHandler);
        this._measureHandler = null;
      }
      this._measurePoints = [];
      document.getElementById('measure-btn').classList.remove('active');
      return;
    }
    
    this._measuring = true;
    this._measurePoints = [];
    document.getElementById('measure-btn').classList.add('active');
    
    this._measureHandler = (e) => {
      this._measurePoints.push(e.latlng);
      if (this._measurePoints.length >= 2) {
        const dist = this._measurePoints[this._measurePoints.length - 1]
          .distanceTo(this._measurePoints[this._measurePoints.length - 2]);
        
        L.popup()
          .setLatLng(e.latlng)
          .setContent(`Distance: ${(dist / 1000).toFixed(2)} km`)
          .openOn(this.map);
      }
    };
    
    this.map.on('click', this._measureHandler);
  },
  
  async loadLocation(city, lat, lon, highRes = true) {
    const loading = document.getElementById('loading-overlay');
    loading.classList.add('active');
    
    try {
      const response = await fetch('/api/geodata', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, lat, lon, high_res: highRes })
      });
      
      const data = await response.json();
      
      if (!data.ok) {
        throw new Error(data.error || 'Failed to load data');
      }
      
      this.terrainData = data.terrain;
      this.waterData = data.water;
      this.weatherData = data.weather;
      this.osmData = data.osm;
      this.currentLocation = data.location;
      
      this._updateMapCenter(lat, lon);
      this._renderElevationLayer();
      this._renderContourLayer();
      this._renderHillshadeLayer();
      this._renderWaterFeatures();
      this._renderRoadsAndPlaces();
      this._updateWeatherWidget();
      this._updateLocationInfo();
      this._addLocationMarker(lat, lon);

      if (document.getElementById('layer-groundwater')?.checked) {
        this.renderGroundwaterLayer();
      }

      const budget = parseFloat(document.getElementById('budget')?.value) || 150000;
      this.rechargeZones = this.detectRechargeZones();
      this.renderRechargeZones(this.rechargeZones);

      if (this.rechargeZones.length) {
        this.recommendations = this.generateRecommendations();
        this.bestPlan = this.generateBestPlan(budget);
        this.renderRecommendations();
        this.updateRecommendationsUI();
      }

      this.bestPlan = this.generateOptimalPlan('residential', budget);
      this.updateInsightPanel();
      this.renderAlerts();

      const hydro = await this._computeHydrology();
      this._renderSmartAlerts(hydro);
      
      document.getElementById('geoStatus').textContent = 'Terrain data loaded successfully';
      document.getElementById('geoStatus').classList.remove('error');
      
    } catch (err) {
      document.getElementById('geoStatus').textContent = 'Error: ' + err.message;
      document.getElementById('geoStatus').classList.add('error');
    } finally {
      loading.classList.remove('active');
    }
  },
  
  _updateMapCenter(lat, lon) {
    this.map.setView([lat, lon], 13, { animate: true });
  },
  
  _renderElevationLayer() {
    this.layers.elevation.clearLayers();
    
    if (!this.terrainData || !this.terrainData.elevations) return;
    
    const grid = this.terrainData.elevations;
    const gridSize = this.terrainData.grid_size;
    const latMin = this.terrainData.lat_min;
    const latMax = this.terrainData.lat_max;
    const lonMin = this.terrainData.lon_min;
    const lonMax = this.terrainData.lon_max;
    
    const step = Math.max(1, Math.floor(gridSize / 50));
    
    for (let row = 0; row < gridSize - 1; row += step) {
      for (let col = 0; col < gridSize - 1; col += step) {
        const elev = grid[row][col];
        const lat1 = latMax - (row / (gridSize - 1)) * (latMax - latMin);
        const lon1 = lonMin + (col / (gridSize - 1)) * (lonMax - lonMin);
        const lat2 = latMax - ((row + step) / (gridSize - 1)) * (latMax - latMin);
        const lon2 = lonMin + ((col + step) / (gridSize - 1)) * (lonMax - lonMin);
        
        const color = this._getElevationColor(elev);
        
        const polygon = L.polygon([
          [lat1, lon1],
          [lat1, lon2],
          [lat2, lon2],
          [lat2, lon1]
        ], {
          fillColor: color,
          fillOpacity: 0.35,
          stroke: false,
          interactive: false
        });
        
        this.layers.elevation.addLayer(polygon);
      }
    }
    
    if (document.getElementById('layer-elevation').checked) {
      this.layers.elevation.addTo(this.map);
    }
  },
  
  _getElevationColor(elev) {
    const colors = this.ELEVATION_COLORS;
    
    for (let i = 0; i < colors.length - 1; i++) {
      if (elev >= colors[i].elevation && elev < colors[i + 1].elevation) {
        const t = (elev - colors[i].elevation) / (colors[i + 1].elevation - colors[i].elevation);
        const r = Math.round(colors[i].color[0] + t * (colors[i + 1].color[0] - colors[i].color[0]));
        const g = Math.round(colors[i].color[1] + t * (colors[i + 1].color[1] - colors[i].color[1]));
        const b = Math.round(colors[i].color[2] + t * (colors[i + 1].color[2] - colors[i].color[2]));
        return `rgb(${r}, ${g}, ${b})`;
      }
    }
    
    return `rgb(${colors[colors.length - 1].color.join(', ')})`;
  },
  
  _renderContourLayer() {
    this.layers.contours.clearLayers();
    
    if (!this.terrainData || !this.terrainData.elevations) return;
    
    const grid = this.terrainData.elevations;
    const gridSize = this.terrainData.grid_size;
    const minElev = this.terrainData.min_elev;
    const maxElev = this.terrainData.max_elev;
    const latMin = this.terrainData.lat_min;
    const latMax = this.terrainData.lat_max;
    const lonMin = this.terrainData.lon_min;
    const lonMax = this.terrainData.lon_max;
    
    const range = maxElev - minElev;
    const majorInterval = Math.max(50, Math.round(range / 15));
    const minorInterval = majorInterval / 5;
    
    for (let level = 1; level <= Math.ceil(range / minorInterval); level++) {
      const targetElev = minElev + level * minorInterval;
      if (targetElev > maxElev) break;
      
      const isMajor = Math.round(targetElev) % majorInterval < minorInterval;
      
      for (let row = 0; row < gridSize - 1; row++) {
        for (let col = 0; col < gridSize - 1; col++) {
          const e00 = grid[row][col];
          const e10 = grid[row][col + 1];
          const e01 = grid[row + 1][col];
          const e11 = grid[row + 1][col + 1];
          
          const lat0 = latMax - (row / (gridSize - 1)) * (latMax - latMin);
          const lat1 = latMax - ((row + 1) / (gridSize - 1)) * (latMax - latMin);
          const lon0 = lonMin + (col / (gridSize - 1)) * (lonMax - lonMin);
          const lon1 = lonMin + ((col + 1) / (gridSize - 1)) * (lonMax - lonMin);
          
          const edges = [
            { lat: lat0, lon: lon0, elev: e00, lat2: lat1, lon2: lon0, elev2: e01 },
            { lat: lat0, lon: lon0, elev: e00, lat2: lat0, lon2: lon1, elev2: e10 },
            { lat: lat0, lon: lon1, elev: e10, lat2: lat1, lon2: lon1, elev2: e11 },
            { lat: lat1, lon: lon0, elev: e01, lat2: lat1, lon2: lon1, elev2: e11 }
          ];
          
          const crossings = [];
          for (const edge of edges) {
            if (Math.abs(edge.elev2 - edge.elev) > 0.01) {
              const t = (targetElev - edge.elev) / (edge.elev2 - edge.elev);
              if (t >= 0 && t <= 1) {
                crossings.push({
                  lat: edge.lat + t * (edge.lat2 - edge.lat),
                  lon: edge.lon + t * (edge.lon2 - edge.lon)
                });
              }
            }
          }
          
          if (crossings.length >= 2) {
            const polyline = L.polyline(
              crossings.map(c => [c.lat, c.lon]),
              {
                color: isMajor ? '#5D4037' : '#8D6E63',
                weight: isMajor ? 2 : 1,
                opacity: isMajor ? 0.8 : 0.4
              }
            );
            this.layers.contours.addLayer(polyline);
          }
        }
      }
    }
    
    if (document.getElementById('layer-contours').checked) {
      this.layers.contours.addTo(this.map);
    }
  },
  
  _renderHillshadeLayer() {
    this.layers.hillshade.clearLayers();
    
    if (!this.terrainData || !this.terrainData.elevations) return;
    
    const grid = this.terrainData.elevations;
    const gridSize = this.terrainData.grid_size;
    
    const azimuth = 315 * (Math.PI / 180);
    const zenith = 35 * (Math.PI / 180);
    const scale = 1.2;
    
    const hillshade = [];
    for (let y = 0; y < gridSize; y++) {
      hillshade[y] = [];
      for (let x = 0; x < gridSize; x++) {
        const y0 = Math.max(0, y - 1);
        const y1 = Math.min(gridSize - 1, y + 1);
        const x0 = Math.max(0, x - 1);
        const x1 = Math.min(gridSize - 1, x + 1);
        
        const dzdx = ((grid[y0][x1] - grid[y0][x0]) + (grid[y1][x1] - grid[y1][x0])) / 2;
        const dzdy = ((grid[y1][x0] - grid[y0][x0]) + (grid[y1][x1] - grid[y0][x1])) / 2;
        
        const slope = Math.atan(scale * Math.sqrt(dzdx * dzdx + dzdy * dzdy));
        const aspect = Math.atan2(dzdy, -dzdx);
        
        const hs = Math.max(0, Math.cos(slope) * Math.cos(zenith) + 
          Math.sin(slope) * Math.sin(zenith) * Math.cos(azimuth - aspect + Math.PI));
        
        hillshade[y][x] = Math.floor(hs * 255);
      }
    }
    
    const latMin = this.terrainData.lat_min;
    const latMax = this.terrainData.lat_max;
    const lonMin = this.terrainData.lon_min;
    const lonMax = this.terrainData.lon_max;
    const step = Math.max(1, Math.floor(gridSize / 30));
    
    for (let row = 0; row < gridSize - 1; row += step) {
      for (let col = 0; col < gridSize - 1; col += step) {
        const value = hillshade[row][col];
        const gray = value;
        
        const lat1 = latMax - (row / (gridSize - 1)) * (latMax - latMin);
        const lon1 = lonMin + (col / (gridSize - 1)) * (lonMax - lonMin);
        const lat2 = latMax - ((row + step) / (gridSize - 1)) * (latMax - latMin);
        const lon2 = lonMin + ((col + step) / (gridSize - 1)) * (lonMax - lonMin);
        
        const polygon = L.polygon([
          [lat1, lon1],
          [lat1, lon2],
          [lat2, lon2],
          [lat2, lon1]
        ], {
          fillColor: `rgb(${gray}, ${gray}, ${gray})`,
          fillOpacity: 0.25,
          stroke: false,
          interactive: false
        });
        
        this.layers.hillshade.addLayer(polygon);
      }
    }
    
    if (document.getElementById('layer-hillshade').checked) {
      this.layers.hillshade.addTo(this.map);
    }
  },
  
  _renderWaterFeatures() {
    this.layers.rivers.clearLayers();
    this.layers.lakes.clearLayers();
    
    if (!this.waterData) return;
    
    for (const river of (this.waterData.rivers || [])) {
      if (!river.points || river.points.length < 2) continue;
      
      const latlngs = river.points.map(p => [p[0], p[1]]);
      const weight = river.type === 'river' ? 3 : (river.type === 'stream' ? 2 : 1);
      
      const polyline = L.polyline(latlngs, {
        color: '#1976D2',
        weight: weight,
        opacity: 0.8
      }).bindPopup(`<b>${river.Name || 'Unnamed River'}</b><br>Type: ${river.type}`);
      
      this.layers.rivers.addLayer(polyline);
    }
    
    for (const lake of (this.waterData.lakes || [])) {
      if (!lake.points || lake.points.length < 3) continue;
      
      const latlngs = lake.points.map(p => [p[0], p[1]]);
      
      const polygon = L.polygon(latlngs, {
        color: '#0288D1',
        fillColor: '#03A9F4',
        fillOpacity: 0.5
      }).bindPopup(`<b>${lake.name || 'Unnamed Lake'}</b>`);
      
      this.layers.lakes.addLayer(polygon);
    }
    
    if (document.getElementById('layer-rivers').checked) {
      this.layers.rivers.addTo(this.map);
    }
    if (document.getElementById('layer-lakes').checked) {
      this.layers.lakes.addTo(this.map);
    }
  },
  
  _renderRoadsAndPlaces() {
    this.layers.roads.clearLayers();
    this.layers.places.clearLayers();
    this.layers.peaks.clearLayers();
    
    if (!this.osmData) return;
    
    const roadColors = {
      highway: '#666666',
      secondary: '#888888',
      local: '#AAAAAA',
      path: '#CCCCCC'
    };
    
    const roads = this.osmData.roads || {};
    for (const [type, roadList] of Object.entries(roads)) {
      for (const road of roadList) {
        if (!road.points || road.points.length < 2) continue;
        
        const latlngs = road.points.map(p => [p[0], p[1]]);
        const polyline = L.polyline(latlngs, {
          color: roadColors[type] || '#888888',
          weight: type === 'highway' ? 4 : (type === 'secondary' ? 3 : 2),
          opacity: 0.7
        });
        
        this.layers.roads.addLayer(polyline);
      }
    }
    
    const places = this.osmData.places || [];
    for (const place of places) {
      const icon = L.divIcon({
        className: 'place-marker',
        html: `<div style="
          background: ${place.type === 'city' ? '#D32F2F' : place.type === 'town' ? '#F57C00' : '#388E3C'};
          width: ${place.type === 'city' ? 12 : place.type === 'town' ? 10 : 8}px;
          height: ${place.type === 'city' ? 12 : place.type === 'town' ? 10 : 8}px;
          border-radius: 50%;
          border: 2px solid white;
        "></div>`,
        iconSize: [16, 16],
        iconAnchor: [8, 8]
      });
      
      L.marker([place.lat, place.lon], { icon })
        .bindPopup(`<b>${place.name}</b><br>${place.type}`)
        .addTo(this.layers.places);
    }
    
    const peaks = this.osmData.peaks || [];
    for (const peak of peaks) {
      const icon = L.divIcon({
        className: 'peak-marker',
        html: `<div style="
          background: #8D6E63;
          width: 10px;
          height: 10px;
          border-radius: 50% 50% 50% 0;
          border: 2px solid white;
          transform: rotate(-45deg);
        "></div>`,
        iconSize: [14, 14],
        iconAnchor: [7, 14]
      });
      
      const popup = `<b>${peak.name}</b>`;
      L.marker([peak.lat, peak.lon], { icon })
        .bindPopup(popup)
        .addTo(this.layers.peaks);
    }
    
    if (document.getElementById('layer-roads').checked) {
      this.layers.roads.addTo(this.map);
    }
    if (document.getElementById('layer-places').checked) {
      this.layers.places.addTo(this.map);
    }
    if (document.getElementById('layer-peaks').checked) {
      this.layers.peaks.addTo(this.map);
    }
  },
  
  _updateWeatherWidget() {
    const section = document.getElementById('weather-section');
    if (!this.weatherData) {
      section.style.display = 'none';
      return;
    }
    
    section.style.display = 'block';
    
    const current = this.weatherData.current || {};
    const temp = current.temp || 0;
    const raining = current.raining;
    
    const icon = raining ? '🌧️' : (current.cloud > 70 ? '☁️' : (current.cloud > 30 ? '⛅' : '☀️'));
    document.getElementById('weather-icon').textContent = icon;
    document.getElementById('weather-temp').textContent = `${Math.round(temp)}°C`;
    document.getElementById('weather-details').textContent = 
      `Humidity: ${current.hum || '--'}% | Wind: ${current.wind_spd || '--'} m/s`;
    
    const forecast = this.weatherData.forecast || [];
    const forecastEl = document.getElementById('weather-forecast');
    forecastEl.innerHTML = forecast.slice(0, 7).map(d => `
      <div class="forecast-day">
        <div class="day">${d.date?.slice(5) || '--'}</div>
        <div class="rain">${Math.round(d.rain || 0)}mm</div>
        <div>${d.prob || 0}%</div>
      </div>
    `).join('');
  },
  
  _updateLocationInfo() {
    const section = document.getElementById('location-info-section');
    if (!this.weatherData) {
      section.style.display = 'none';
      return;
    }
    
    section.style.display = 'block';
    
    const elev = this._getElevationAt(this.currentLocation?.lat, this.currentLocation?.lon);
    document.getElementById('info-elevation').textContent = elev ? `${Math.round(elev)} m` : '--';
    document.getElementById('info-rainfall').textContent = `${this.weatherData.annual_rain || '--'} mm`;
    document.getElementById('info-climate').textContent = `${this.weatherData.stress || '--'} Stress`;
  },
  
  _addLocationMarker(lat, lon) {
    if (this.locationMarker) {
      this.map.removeLayer(this.locationMarker);
    }
    
    const icon = L.divIcon({
      className: 'location-marker-container',
      html: `<div id="location-marker"></div>`,
      iconSize: [16, 16],
      iconAnchor: [8, 8]
    });
    
    this.locationMarker = L.marker([lat, lon], { icon });
    this.locationMarker.bindPopup(`<b>Selected Location</b><br>${lat.toFixed(4)}°, ${lon.toFixed(4)}°`);
    this.locationMarker.addTo(this.map);
  },

  _renderSmartAlerts(hydroData) {
    const alerts = this.getSmartAlerts();
    const alertsContainer = document.getElementById('smart-alerts');
    if (!alertsContainer) return;
    
    alertsContainer.innerHTML = alerts.map(alert => `
      <div class="alert-item alert-${alert.level}">
        <div class="alert-header">
          <span class="alert-icon">${alert.level === 'danger' ? '⚠️' : alert.level === 'warning' ? '⚡' : 'ℹ️'}</span>
          <span class="alert-title">${alert.title}</span>
        </div>
        <p class="alert-message">${alert.message}</p>
        <button class="alert-action" onclick="MAP_ENGINE._handleAlertAction('${alert.type}')">${alert.action}</button>
      </div>
    `).join('');
  },

  _handleAlertAction(alertType) {
    const actions = {
      runoff: () => this._showRechargePlacementMode(),
      water_table: () => this._showTankPlacementMode(),
      low_rain: () => document.getElementById('runAnalysis')?.click(),
      seasonal: () => this._showStorageRecommendation()
    };
    
    actions[alertType]?.();
  },

  _showRechargePlacementMode() {
    if (this.layers.rechargeZones) {
      this.layers.rechargeZones.addTo(this.map);
      this.map.setView([this.currentLocation?.lat, this.currentLocation?.lon], 15);
    }
  },

  _showTankPlacementMode() {
    alert('Recommended: Install 20,000L+ tank for surface storage');
  },

  _showStorageRecommendation() {
    alert('Maximize tank capacity to capture monsoon rainfall');
  }
};

window.SOIL_INF = { sandy: 50, loamy: 25, laterite: 15, clay_loam: 10, clay: 5, rocky: 2 };

function initWizard() {
  document.querySelectorAll('.step').forEach(step => {
    step.addEventListener('click', () => {
      const stepNum = parseInt(step.dataset.step);
      goToStep(stepNum);
    });
  });
  
  document.getElementById('back-btn')?.addEventListener('click', () => goToStep(2));
  document.getElementById('new-analysis-btn')?.addEventListener('click', () => {
    goToStep(1);
    document.getElementById('geoStatus').textContent = '';
    document.getElementById('analysisStatus').textContent = '';
  });
  
  document.getElementById('loadGeo')?.addEventListener('click', () => {
    const city = document.getElementById('city')?.value;
    const lat = parseFloat(document.getElementById('lat')?.value) || 0;
    const lon = parseFloat(document.getElementById('lon')?.value) || 0;
    
    if (!city && (!lat || !lon)) {
      document.getElementById('geoStatus').textContent = 'Please select a city or enter coordinates';
      document.getElementById('geoStatus').classList.add('error');
      return;
    }
    
    MAP_ENGINE.loadLocation(city, lat, lon).then(() => {
      goToStep(2);
    });
  });
  
  document.getElementById('gpsBtn')?.addEventListener('click', () => {
    if (!navigator.geolocation) {
      document.getElementById('geoStatus').textContent = 'Geolocation not supported';
      document.getElementById('geoStatus').classList.add('error');
      return;
    }
    
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        document.getElementById('lat').value = pos.coords.latitude.toFixed(4);
        document.getElementById('lon').value = pos.coords.longitude.toFixed(4);
        document.getElementById('city').value = '';
        
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        
        if (MAP_ENGINE.map) {
          MAP_ENGINE.map.setView([lat, lon], 13, { animate: true });
          MAP_ENGINE.currentLocation = { lat, lon };
        }
        
        document.getElementById('geoStatus').textContent = 'GPS location set';
        document.getElementById('geoStatus').classList.remove('error');
      },
      () => {
        document.getElementById('geoStatus').textContent = 'Could not get location';
        document.getElementById('geoStatus').classList.add('error');
      }
    );
  });
  
  document.getElementById('city')?.addEventListener('change', (e) => {
    const city = e.target.value;
    if (!city) return;
    
    const cityCoords = {
      "Mumbai": { lat: 19.0760, lon: 72.8777 },
      "Delhi": { lat: 28.7041, lon: 77.1025 },
      "Bangalore": { lat: 12.9716, lon: 77.5946 },
      "Chennai": { lat: 13.0827, lon: 80.2707 },
      "Hyderabad": { lat: 17.3850, lon: 78.4867 },
      "Kolkata": { lat: 22.5726, lon: 88.3639 },
      "Pune": { lat: 18.5204, lon: 73.8567 },
      "Ahmedabad": { lat: 23.0225, lon: 72.5714 },
      "Jaipur": { lat: 26.9124, lon: 75.7873 },
      "Lucknow": { lat: 26.8467, lon: 80.9462 },
      "Shimla": { lat: 31.1048, lon: 77.1734 },
      "Guwahati": { lat: 26.1445, lon: 91.7362 },
      "Thiruvananthapuram": { lat: 8.5241, lon: 76.9366 }
    };
    
    const coords = cityCoords[city];
    if (coords && MAP_ENGINE.map) {
      MAP_ENGINE.map.setView([coords.lat, coords.lon], 13, { animate: true });
      MAP_ENGINE.currentLocation = coords;
    }
  });
  
  document.getElementById('city-select')?.addEventListener('change', (e) => {
    const city = e.target.value;
    if (!city) return;
    
    const cityCoords = {
      "Mumbai": { lat: 19.0760, lon: 72.8777 },
      "Delhi": { lat: 28.7041, lon: 77.1025 },
      "Bangalore": { lat: 12.9716, lon: 77.5946 },
      "Chennai": { lat: 13.0827, lon: 80.2707 },
      "Hyderabad": { lat: 17.3850, lon: 78.4867 },
      "Kolkata": { lat: 22.5726, lon: 88.3639 },
      "Pune": { lat: 18.5204, lon: 73.8567 },
      "Ahmedabad": { lat: 23.0225, lon: 72.5714 },
      "Jaipur": { lat: 26.9124, lon: 75.7873 },
      "Lucknow": { lat: 26.8467, lon: 80.9462 },
      "Shimla": { lat: 31.1048, lon: 77.1734 },
      "Guwahati": { lat: 26.1445, lon: 91.7362 },
      "Thiruvananthapuram": { lat: 8.5241, lon: 76.9366 }
    };
    
    const coords = cityCoords[city];
    if (coords && MAP_ENGINE.map) {
      MAP_ENGINE.map.setView([coords.lat, coords.lon], 13, { animate: true });
      MAP_ENGINE.currentLocation = coords;
    }
  });
  
  document.getElementById('runAnalysis')?.addEventListener('click', async () => {
    const body = {
      roof_area: parseFloat(document.getElementById('roof_area')?.value) || 0,
      surface: document.getElementById('surface')?.value || 'concrete',
      land_area: parseFloat(document.getElementById('land_area')?.value) || 0,
      land_type: document.getElementById('land_type')?.value || 'open',
      people: parseInt(document.getElementById('people')?.value) || 0,
      kitchen: document.getElementById('kitchen')?.checked,
      ac_units: parseInt(document.getElementById('ac_units')?.value) || 0,
      ac_hrs: parseFloat(document.getElementById('ac_hrs')?.value) || 0,
      ac_mos: parseInt(document.getElementById('ac_mos')?.value) || 0,
      soil: document.getElementById('soil')?.value || 'loamy',
      budget: parseFloat(document.getElementById('budget')?.value) || 100000
    };
    
    if (body.roof_area <= 0 && body.land_area <= 0) {
      document.getElementById('analysisStatus').textContent = 'Please enter roof or land area';
      document.getElementById('analysisStatus').classList.add('error');
      return;
    }
    
    goToStep(3);
    updateAnalysisProgress(20, 'Fetching climate data...');
    
    body.weather = {
      annual_rain: MAP_ENGINE.weatherData?.annual_rain || 0,
      current: MAP_ENGINE.weatherData?.current || {},
      monthly: MAP_ENGINE.weatherData?.monthly || []
    };
    
    updateAnalysisProgress(50, 'Calculating water potential...');
    
    try {
      const response = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const result = await response.json();
      
      updateAnalysisProgress(100, 'Complete!');
      
      if (result.ok) {
        const opt = await MAP_ENGINE.runOptimization(body);
        setTimeout(() => showResults(result, opt), 300);
      } else {
        document.getElementById('analysisStatus').textContent = result.error || 'Analysis failed';
        document.getElementById('analysisStatus').classList.add('error');
        goToStep(2);
      }
    } catch (err) {
      document.getElementById('analysisStatus').textContent = 'Error: ' + err.message;
      document.getElementById('analysisStatus').classList.add('error');
      goToStep(2);
    }
  });
  
  document.getElementById('export-pdf')?.addEventListener('click', () => {
    if (window.currentAnalysisResult) {
      window.Reporting.generatePDF(window.currentAnalysisResult);
    }
  });
  
  document.getElementById('share-state')?.addEventListener('click', () => {
    if (window.currentAnalysisResult) {
      const url = window.Reporting.serializeState(window.currentAnalysisResult);
      navigator.clipboard?.writeText(url);
      alert('Shareable URL copied to clipboard!');
    }
  });
}

function goToStep(stepNum) {
  console.log('goToStep:', stepNum);
  
  // Clear all panels first
  document.querySelectorAll('.step-panel').forEach(p => {
    p.style.display = 'none';
    p.classList.remove('active');
  });
  
  // Show the selected panel
  let targetId = 'step-1';
  if (stepNum === 2) targetId = 'step-2';
  if (stepNum === 3) targetId = 'step-3';
  if (stepNum === 4) targetId = 'step-4';
  
  const target = document.getElementById(targetId);
  if (target) {
    target.style.display = 'block';
    target.classList.add('active');
    console.log('Showing', targetId);
  } else {
    console.log('Not found:', targetId);
  }
  
  // Update step navigation
  document.querySelectorAll('.step-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i + 1 === stepNum);
    dot.classList.toggle('done', i + 1 < stepNum);
  });
  
  document.querySelectorAll('.step-label').forEach((label, i) => {
    label.classList.toggle('active', i + 1 === stepNum);
  });
  
  if (stepNum === 4 && MAP_ENGINE._enableResultsLayers) {
    MAP_ENGINE._enableResultsLayers();
  }
}

MAP_ENGINE._enableResultsLayers = function() {
  if (this.bestPlan) {
    const checkbox = document.getElementById('layer-groundwater');
    if (checkbox) checkbox.checked = true;
    this._toggleLayer('layer-groundwater', true);
    
    const recCheckbox = document.getElementById('layer-recommendations');
    if (recCheckbox) {
      recCheckbox.checked = true;
      this._toggleLayer('layer-recommendations', true);
    }
  }
};

MAP_ENGINE._disableResultsLayers = function() {};

function updateInsightBar() {
  const gpi = MAP_ENGINE._getAverageGPI();
  const rainfall = MAP_ENGINE.weatherData?.annual_rain || 0;
  const risk = MAP_ENGINE._calculateRisk();
  
  const gwEl = document.querySelector('.insight-gw');
  const rainEl = document.querySelector('.insight-rain');
  const riskEl = document.querySelector('.insight-risk');
  
  if (gwEl) {
    if (gpi > 0.6) { gwEl.textContent = 'HIGH'; gwEl.style.color = 'var(--success)'; }
    else if (gpi > 0.3) { gwEl.textContent = 'MODERATE'; gwEl.style.color = 'var(--warning)'; }
    else { gwEl.textContent = 'LOW'; gwEl.style.color = 'var(--danger)'; }
  }
  
  if (rainEl) {
    if (rainfall > 1500) { rainEl.textContent = 'HIGH'; rainEl.style.color = 'var(--success)'; }
    else if (rainfall > 800) { rainEl.textContent = 'MODERATE'; rainEl.style.color = 'var(--warning)'; }
    else { rainEl.textContent = 'LOW'; rainEl.style.color = 'var(--danger)'; }
  }
  
  if (riskEl) {
    if (risk < 0.3) { riskEl.textContent = 'LOW'; riskEl.style.color = 'var(--success)'; }
    else if (risk < 0.6) { riskEl.textContent = 'MEDIUM'; riskEl.style.color = 'var(--warning)'; }
    else { riskEl.textContent = 'HIGH'; riskEl.style.color = 'var(--danger)'; }
  }
}

function showResults(data, optimization) {
  console.log('showResults called', { data, optimization });
  const result = data?.data;
  if (!result) {
    console.log('showResults: no result');
    return;
  }
  
  // Show results panel as overlay
  const resultsPanel = document.getElementById('results-panel');
  if (resultsPanel) {
    resultsPanel.classList.add('active');
    console.log('Results panel shown');
  }
  
  if (document.getElementById('water-score-number')) {
    populateAnalysisLayers(result, optimization, MAP_ENGINE.weatherData);
  }
  
  const resultTotalEl = document.getElementById('result-total');
  if (resultTotalEl) resultTotalEl.textContent = formatNumber(result.total || 0);
}
  
  window.currentAnalysisResult = { ...result, optimization };
  
  if (document.getElementById('water-score-number')) {
    populateAnalysisLayers(result, optimization, MAP_ENGINE.weatherData);
  }
  
  const resultTotalEl = document.getElementById('result-total');
  const resultSavingsEl = document.getElementById('result-savings');
  const resultRainEl = document.getElementById('result-rain');
  const recListEl = document.getElementById('rec-list');
  const methodsListEl = document.getElementById('methods-list');
  const comparisonViewEl = document.getElementById('comparison-view');
  
  if (resultTotalEl) resultTotalEl.textContent = formatNumber(result.total || 0);
  if (resultSavingsEl) resultSavingsEl.textContent = '₹' + formatNumber(result.financial?.annual_savings || 0);
  if (resultRainEl) resultRainEl.textContent = (MAP_ENGINE.weatherData?.annual_rain || 0) + ' mm';
  
  updateInsightBar();
  
  if (recListEl) {
    recListEl.innerHTML = '';
    
    if (optimization?.recommendations?.length > 0) {
      optimization.recommendations.forEach(rec => {
        const item = document.createElement('div');
        item.className = 'rec-item';
        item.innerHTML = `
          <span class="rec-icon">✓</span>
          <div class="rec-text">
            <strong>${rec.name}</strong><br>
            <span style="font-size:11px;color:var(--ink-muted)">₹${rec.cost?.toLocaleString()} | ${rec.reason}</span>
          </div>
        `;
        recListEl.appendChild(item);
      });
    } else {
      const actions = result.actions?.slice(0, 3) || [];
      if (actions.length === 0) {
        recListEl.innerHTML = '<div class="rec-item"><span class="rec-icon">💡</span><span class="rec-text">Run analysis to get personalized recommendations.</span></div>';
      } else {
        actions.forEach(action => {
          const item = document.createElement('div');
          item.className = 'rec-item';
          item.innerHTML = `<span class="rec-icon">✓</span><span class="rec-text">${action}</span>`;
          recListEl.appendChild(item);
        });
      }
    }
  }
  
  if (methodsListEl) {
    methodsListEl.innerHTML = '';
    const ranked = result.ranked || result.methods?.slice(0, 4) || [];
    ranked.forEach((method, i) => {
      const item = document.createElement('div');
      item.className = 'method-item';
      item.innerHTML = `
        <span class="method-rank">${i + 1}</span>
        <div class="method-info">
          <span class="method-name">${method.icon || ''} ${method.name}</span>
        </div>
        <span class="method-yield">${formatNumber(method.annual || 0)} L</span>
      `;
      if (methodsListEl) methodsListEl.appendChild(item);
    });
  }
  
  if (optimization) {
    if (comparisonViewEl) {
      comparisonViewEl.innerHTML = renderComparison(result.total, optimization.totalAnnualLiters);
    }
  }
  
  console.log('showResults: calling goToStep(4)');
  goToStep(4);
}

function renderComparison(statusQuo, optimized) {
  const maxVal = Math.max(statusQuo, optimized, 1);
  const statusPct = (statusQuo / maxVal) * 100;
  const optPct = (optimized / maxVal) * 100;
  
  return `
    <div class="opt-bar">
      <div class="opt-bar-item">
        <div class="opt-label">Status Quo</div>
        <div class="opt-value">${formatNumber(statusQuo)} L</div>
        <div class="opt-bar-fill status" style="width:${statusPct}%"></div>
      </div>
      <div class="opt-bar-item">
        <div class="opt-label">Optimized</div>
        <div class="opt-value">${formatNumber(optimized)} L</div>
        <div class="opt-bar-fill optimized" style="width:${optPct}%"></div>
      </div>
    </div>
  `;
}

function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return Math.round(num).toString();
}

function toggleAdvanced() {
  const el = document.getElementById('advanced-fields');
  const btn = document.querySelector('button[onclick="toggleAdvanced()"]');
  if (el) {
    const isHidden = el.style.display === 'none';
    el.style.display = isHidden ? 'block' : 'none';
    if (btn) btn.textContent = isHidden ? 'Advanced ▲' : 'Advanced ▼';
  }
}

function toggleAdvancedLayers() {
  const el = document.getElementById('advanced-layers');
  const btn = document.querySelector('button[onclick="toggleAdvancedLayers()"]');
  if (el) {
    const isHidden = el.style.display === 'none';
    el.style.display = isHidden ? 'block' : 'none';
    if (btn) btn.textContent = isHidden ? 'Advanced Layers ▲' : 'Advanced Layers ▼';
  }
}

function toggleAnalysisLayer(headerBtn) {
  const layer = headerBtn.closest('.analysis-layer');
  const content = layer.querySelector('.layer-content');
  const icon = layer.querySelector('.expand-icon');
  content.classList.toggle('expanded');
  icon.textContent = content.classList.contains('expanded') ? '▲' : '▼';
}

function calculateWaterScore(result, weatherData) {
  let score = 50;
  
  if (weatherData?.annual_rain) {
    score += Math.min((weatherData.annual_rain / 2000) * 25, 25);
  }
  
  if (result?.gpi) {
    score += result.gpi * 30;
  }
  
  if (result?.total > 0) {
    score += Math.min((result.total / 200000) * 15, 15);
  }
  
  if (result?.financial?.risk_level) {
    score += (1 - result.financial.risk_level) * 10;
  }
  
  return Math.min(Math.round(score), 100);
}

function getRiskLevel(score) {
  if (score >= 70) return { level: 'low', label: 'LOW RISK', class: 'low' };
  if (score >= 50) return { level: 'moderate', label: 'MODERATE RISK', class: 'moderate' };
  return { level: 'high', label: 'HIGH RISK', class: 'high' };
}

function getInsightStatement(score, rainfall, gpi) {
  if (gpi > 0.6 && rainfall > 1000) {
    return "Good groundwater with high rainfall — storage + recharge infrastructure recommended";
  } else if (gpi < 0.4 && rainfall > 1000) {
    return "High rainfall with limited groundwater — prioritize recharge systems";
  } else if (rainfall < 800 && gpi > 0.6) {
    return "Low rainfall but good groundwater — implement storage efficiently";
  } else if (score < 50) {
    return "Critical water stress — urgent infrastructure and conservation needed";
  }
  return "Balanced conditions — combine storage and recharge for resilience";
}

function updateAnalysisProgress(percent, msg) {
  const bar = document.getElementById('analysis-progress');
  const msgEl = document.getElementById('analysis-msg');
  if (bar) bar.style.width = percent + '%';
  if (msgEl) msgEl.textContent = msg;
}

function populateAnalysisLayers(result, optimization, weatherData) {
  const score = calculateWaterScore(result, weatherData);
  const risk = getRiskLevel(score);
  const gpi = result?.gpi || 0.5;
  const rainfall = weatherData?.annual_rain || 800;
  const roofArea = parseFloat(document.getElementById('roof_area')?.value) || 120;
  const harvestable = Math.round(roofArea * rainfall * 0.8 / 1000) * 1000;
  const annualSavings = result?.financial?.annual_savings || 0;
  const totalCost = optimization?.totalCost || 50000;
  const payback = totalCost > 0 && annualSavings > 0 ? (totalCost / annualSavings).toFixed(1) : '--';
  const totalWater = result?.total || optimization?.totalAnnualLiters || 0;
  
  const scoreNum = document.getElementById('water-score-number');
  const scoreRing = document.getElementById('water-score-ring');
  const badge = document.getElementById('risk-badge');
  const riskText = document.getElementById('risk-text');
  const insightStmt = document.getElementById('insight-statement');
  const statSavings = document.getElementById('stat-savings');
  const statPayback = document.getElementById('stat-payback');
  const statInvest = document.getElementById('stat-investment');
  const metricRain = document.getElementById('metric-rainfall');
  const metricRainCtx = document.getElementById('metric-rainfall-context');
  const metricMonsoon = document.getElementById('metric-monsoon');
  const metricHarvest = document.getElementById('metric-harvestable');
  const gwLevelBar = document.getElementById('gw-level-bar');
  const gwGpi = document.getElementById('gw-gpi');
  const gwRecharge = document.getElementById('gw-recharge');
  const gwWhy = document.getElementById('gw-why');
  
  if (scoreNum) scoreNum.textContent = score;
  if (scoreRing) scoreRing.style.setProperty('--score-deg', (score / 100) * 360 + 'deg');
  if (badge) badge.className = 'status-badge ' + risk.class;
  if (riskText) riskText.textContent = risk.label;
  if (insightStmt) insightStmt.textContent = getInsightStatement(score, rainfall, gpi);
  if (statSavings) statSavings.textContent = '₹' + formatNumber(annualSavings);
  if (statPayback) statPayback.textContent = payback === '--' ? '--' : payback + ' yrs';
  if (statInvest) statInvest.textContent = '₹' + formatNumber(totalCost);
  if (metricRain) metricRain.textContent = rainfall + ' mm';
  if (metricRainCtx) metricRainCtx.textContent = rainfall > 1000 ? 'Above regional average' : 'Below average';
  if (metricMonsoon) metricMonsoon.textContent = '78%';
  if (metricHarvest) metricHarvest.textContent = formatNumber(harvestable) + ' L';
  
  if (gwLevelBar) {
    const gwLevel = Math.round(gpi * 100);
    gwLevelBar.style.height = gwLevel + '%';
    gwLevelBar.setAttribute('data-level', gwLevel + '%');
  }
  if (gwGpi) {
    const gwBadge = gpi > 0.6 ? { text: 'Good', class: 'success' } : gpi > 0.4 ? { text: 'Moderate', class: '' } : { text: 'Poor', class: '' };
    gwGpi.innerHTML = gpi.toFixed(2) + ' <span class="badge">' + gwBadge.text + '</span>';
  }
  if (gwRecharge) {
    const rechargeText = gpi > 0.6 ? '+35%' : gpi > 0.4 ? '+20%' : '+10%';
    gwRecharge.innerHTML = (gpi > 0.6 ? 'High' : gpi > 0.4 ? 'Moderate' : 'Low') + ' <span class="badge success">' + rechargeText + '</span>';
  }
  if (gwWhy) gwWhy.textContent = gpi > 0.6 ? 'Good groundwater means the aquifer can support current usage. Recharge systems will improve availability by 25-40% annually.' : 'Moderate groundwater needs recharge infrastructure to sustain long-term availability.';
  
  const tankSize = totalWater > 300000 ? 60000 : totalWater > 150000 ? 40000 : 20000;
  const pitCount = totalWater > 300000 ? 3 : totalWater > 150000 ? 2 : 1;
  const tankCost = tankSize === 60000 ? 48000 : tankSize === 40000 ? 32000 : 16000;
  const pitCost = pitCount * 9000;
  
  const infraTankSpec = document.getElementById('infra-tank-spec');
  const infraTankCost = document.getElementById('infra-tank-cost');
  const infraPitsSpec = document.getElementById('infra-pits-spec');
  const infraPitsCost = document.getElementById('infra-pits-cost');
  const planInvest = document.getElementById('plan-investment');
  const planWater = document.getElementById('plan-water');
  const planEff = document.getElementById('plan-efficiency');
  
  if (infraTankSpec) infraTankSpec.textContent = formatNumber(tankSize) + ' L';
  if (infraTankCost) infraTankCost.textContent = '₹' + formatNumber(tankCost);
  if (infraPitsSpec) infraPitsSpec.textContent = pitCount + ' units × 3m depth';
  if (infraPitsCost) infraPitsCost.textContent = '₹' + formatNumber(pitCost);
  if (planInvest) planInvest.textContent = '₹' + formatNumber(tankCost + pitCost + 8500);
  if (planWater) planWater.textContent = formatNumber(totalWater) + ' L/yr';
  if (planEff) planEff.textContent = (totalWater > 250000 ? '8.7' : totalWater > 150000 ? '7.5' : '6.2') + '/10';
  
  const altBalancedTank = document.getElementById('alt-balanced-tank');
  const altBalancedPits = document.getElementById('alt-balanced-pits');
  const altBalancedCost = document.getElementById('alt-balanced-cost');
  const altBalancedWater = document.getElementById('alt-balanced-water');
  const altBudgetCost = document.getElementById('alt-budget-cost');
  const altBudgetWater = document.getElementById('alt-budget-water');
  
  if (altBalancedTank) altBalancedTank.textContent = formatNumber(tankSize) + ' L tank';
  if (altBalancedPits) altBalancedPits.textContent = pitCount + ' recharge pits';
  if (altBalancedCost) altBalancedCost.textContent = '₹' + formatNumber(tankCost + pitCost);
  if (altBalancedWater) altBalancedWater.textContent = formatNumber(totalWater) + ' L/yr';
  if (altBudgetCost) altBudgetCost.textContent = '₹' + formatNumber(16000 + 9000 + 5000);
  if (altBudgetWater) altBudgetWater.textContent = formatNumber(Math.round(totalWater * 0.55)) + ' L/yr';
  
  const costTankSpec = document.getElementById('cost-tank-spec');
  const costTank = document.getElementById('cost-tank');
  const costPitsSpec = document.getElementById('cost-pits-spec');
  const costPits = document.getElementById('cost-pits');
  const costInstall = document.getElementById('cost-install');
  const costTotal = document.getElementById('cost-total');
  
  if (costTankSpec) costTankSpec.textContent = formatNumber(tankSize) + ' L';
  if (costTank) costTank.textContent = '₹' + formatNumber(tankCost);
  if (costPitsSpec) costPitsSpec.textContent = pitCount + ' units';
  if (costPits) costPits.textContent = '₹' + formatNumber(pitCost);
  if (costInstall) costInstall.textContent = '₹8,500';
  if (costTotal) costTotal.innerHTML = '<strong>₹' + formatNumber(tankCost + pitCost + 8500) + '</strong>';
  
  const savingsMonthly = document.getElementById('savings-monthly');
  const savingsAnnual = document.getElementById('savings-annual');
  const savingsAnnualNote = document.getElementById('savings-annual-note');
  const savingsPayback = document.getElementById('savings-payback');
  
  if (savingsMonthly) savingsMonthly.textContent = '₹' + formatNumber(Math.round(annualSavings / 12));
  if (savingsAnnual) savingsAnnual.textContent = '₹' + formatNumber(annualSavings);
  if (savingsAnnualNote) savingsAnnualNote.textContent = formatNumber(totalWater) + ' L @ ₹0.09/L';
  if (savingsPayback) savingsPayback.textContent = payback === '--' ? '-- years' : payback + ' years';
  
  const fiveYear = annualSavings * 5 - (tankCost + pitCost + 8500);
  const proj5yr = document.getElementById('proj-5yr');
  const projProfit = document.getElementById('proj-profit');
  const projRoi = document.getElementById('proj-roi');
  const roi = annualSavings > 0 ? Math.round((annualSavings * 5 / (tankCost + pitCost + 8500)) * 100) : 0;
  
  if (proj5yr) proj5yr.textContent = '₹' + formatNumber(annualSavings * 5);
  if (projProfit) projProfit.textContent = '₹' + formatNumber(Math.max(0, fiveYear));
  if (projRoi) projRoi.textContent = roi + '%';
  
  const shortageRisk = Math.max(0, 100 - (score * 0.8));
  const riskShortFill = document.getElementById('risk-shortage-fill');
  const riskShortVal = document.getElementById('risk-shortage-value');
  const riskShortExplain = document.getElementById('risk-shortage-explain');
  const riskShort = document.getElementById('risk-shortage');
  
  if (riskShortFill) riskShortFill.style.width = shortageRisk + '%';
  if (riskShortVal) riskShortVal.textContent = shortageRisk > 60 ? 'HIGH (' + shortageRisk + '%)' : shortageRisk > 30 ? 'MODERATE (' + shortageRisk + '%)' : 'LOW (' + shortageRisk + '%)';
  if (riskShortExplain) riskShortExplain.textContent = shortageRisk > 40 ? 'Limited groundwater + seasonal rainfall = potential shortages in peak summer' : 'Storage tank reduces risk significantly';
  if (riskShort) riskShort.setAttribute('data-level', shortageRisk > 60 ? 'high' : shortageRisk > 30 ? 'moderate' : 'low');
  
  const depletionRisk = Math.max(0, Math.round((1 - gpi) * 100 + 20));
  const riskDeplFill = document.getElementById('risk-depletion-fill');
  const riskDeplVal = document.getElementById('risk-depletion-value');
  const riskDeplExplain = document.getElementById('risk-depletion-explain');
  const riskDepl = document.getElementById('risk-depletion');
  
  if (riskDeplFill) riskDeplFill.style.width = depletionRisk + '%';
  if (riskDeplVal) riskDeplVal.textContent = depletionRisk > 60 ? 'HIGH (' + depletionRisk + '%)' : depletionRisk > 30 ? 'MODERATE (' + depletionRisk + '%)' : 'LOW (' + depletionRisk + '%)';
  if (riskDeplExplain) riskDeplExplain.textContent = gpi < 0.5 ? 'Current extraction rate exceeds recharge. Recharge pits can reverse trend.' : 'Groundwater levels stable with proper management';
  if (riskDepl) riskDepl.setAttribute('data-level', depletionRisk > 60 ? 'high' : depletionRisk > 30 ? 'moderate' : 'low');
  
  const floodRisk = Math.min(30, Math.round(rainfall / 50));
  const riskFloodFill = document.getElementById('risk-flood-fill');
  const riskFloodVal = document.getElementById('risk-flood-value');
  const riskFloodExplain = document.getElementById('risk-flood-explain');
  const riskFlood = document.getElementById('risk-flood');
  
  if (riskFloodFill) riskFloodFill.style.width = floodRisk + '%';
  if (riskFloodVal) riskFloodVal.textContent = 'LOW (' + floodRisk + '%)';
  if (riskFloodExplain) riskFloodExplain.textContent = 'Recommended infrastructure can handle peak monsoon overflow';
  if (riskFlood) riskFlood.setAttribute('data-level', 'low');
  
  const seasonCurrent = document.getElementById('season-current');
  const seasonMonsoon = document.getElementById('season-monsoon');
  const seasonMonsoonStatus = document.getElementById('season-monsoon-status');
  
  if (seasonCurrent) seasonCurrent.textContent = 'Low rainfall (8%)';
  if (seasonMonsoon) seasonMonsoon.textContent = rainfall > 1000 ? 'Monsoon onset (52%)' : 'Moderate (35%)';
  if (seasonMonsoonStatus) seasonMonsoonStatus.textContent = rainfall > 1000 ? 'Recharge phase' : 'Prepare systems';
  
  const scenarioRainDays = document.getElementById('scenario-rain-days');
  const scenarioRainRisk = document.getElementById('scenario-rain-risk');
  const scenarioNoInfraCost = document.getElementById('scenario-no-infra-cost');
  const scenarioNoInfraDays = document.getElementById('scenario-no-infra-days');
  
  if (scenarioRainDays) scenarioRainDays.textContent = Math.round(45 * 0.7) + ' days';
  if (scenarioRainRisk) scenarioRainRisk.textContent = Math.min(100, Math.round(shortageRisk * 1.3)) + '%';
  if (scenarioNoInfraCost) scenarioNoInfraCost.textContent = '₹' + formatNumber(annualSavings || 28800) + '/yr';
  if (scenarioNoInfraDays) scenarioNoInfraDays.textContent = '85/year';
}

document.addEventListener('DOMContentLoaded', async () => {
  window.toggleLayer = (layerId, btn) => MAP_ENGINE._toggleLayer(layerId, btn && btn.classList.contains('active'));
  
  window.CacheEngine?.init?.();
  MAP_ENGINE.init();
  MAP_ENGINE.initMapMode();
  initWizard();
  
  setTimeout(() => {
    window.DecisionEngine?.init?.();
  }, 100);
  
  const savedState = window.Reporting?.loadState?.();
  if (savedState) {
    console.log('Loaded shared state:', savedState);
  }
  console.log('map.js: Loaded completely');
});
