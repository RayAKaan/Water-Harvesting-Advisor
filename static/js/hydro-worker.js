const D8_DIRECTIONS = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1],          [0, 1],
  [1, -1],  [1, 0],  [1, 1]
];

self.onmessage = function(e) {
  const { type, data } = e.data;
  
  switch (type) {
    case 'd8_flow':
      self.postMessage({ type: 'd8_flow', result: computeD8Flow(data.grid, data.gridSize, data.cellSize) });
      break;
    case 'flow_accumulation':
      self.postMessage({ type: 'flow_accumulation', result: computeFlowAccumulation(data.flowDir, data.gridSize) });
      break;
    case 'contours':
      self.postMessage({ type: 'contours', result: generateContours(data.grid, data.gridSize, data.minElev, data.maxElev) });
      break;
    case 'hillshade':
      self.postMessage({ type: 'hillshade', result: computeHillshade(data.grid, data.gridSize) });
      break;
    case 'groundwater_projection':
      self.postMessage({ type: 'groundwater_projection', result: projectGroundwater(data) });
      break;
    case 'optimize':
      self.postMessage({ type: 'optimize', result: optimizeSetup(data) });
      break;
    case 'drainage_paths':
      self.postMessage({ type: 'drainage_paths', result: extractDrainagePaths(data.flowDir, data.flowAcc, data.threshold, data.gridSize, data.bounds) });
      break;
  }
};

function computeD8Flow(grid, gridSize, cellSize) {
  const flowDir = new Array(gridSize).fill(null).map(() => new Array(gridSize).fill(-1));
  
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const currentElev = grid[row][col];
      let minElev = currentElev;
      let bestDir = -1;
      
      for (let d = 0; d < D8_DIRECTIONS.length; d++) {
        const [dr, dc] = D8_DIRECTIONS[d];
        const nr = row + dr;
        const nc = col + dc;
        
        if (nr >= 0 && nr < gridSize && nc >= 0 && nc < gridSize) {
          const neighborElev = grid[nr][nc];
          if (neighborElev < minElev) {
            minElev = neighborElev;
            bestDir = d;
          }
        }
      }
      
      flowDir[row][col] = bestDir;
    }
  }
  
  return flowDir;
}

function computeFlowAccumulation(flowDir, gridSize) {
  const accumulation = new Array(gridSize).fill(null).map(() => new Array(gridSize).fill(1));
  
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      let r = row, c = col;
      const visited = new Set();
      
      while (true) {
        const key = `${r},${c}`;
        if (visited.has(key)) break;
        visited.add(key);
        
        const dir = flowDir[r][c];
        if (dir === -1) break;
        
        const [dr, dc] = D8_DIRECTIONS[dir];
        r += dr;
        c += dc;
        
        if (r < 0 || r >= gridSize || c < 0 || c >= gridSize) break;
        
        accumulation[r][c] += 1;
      }
    }
  }
  
  return accumulation;
}

function generateContours(grid, gridSize, minElev, maxElev) {
  const range = maxElev - minElev;
  const majorInterval = Math.max(50, Math.round(range / 15));
  const minorInterval = majorInterval / 5;
  const contours = { major: [], minor: [] };
  
  for (let level = 1; level <= Math.ceil(range / minorInterval); level++) {
    const targetElev = minElev + level * minorInterval;
    if (targetElev > maxElev) break;
    
    const isMajor = Math.round(targetElev) % majorInterval < minorInterval;
    const list = isMajor ? contours.major : contours.minor;
    
    for (let row = 0; row < gridSize - 1; row++) {
      for (let col = 0; col < gridSize - 1; col++) {
        const e00 = grid[row][col];
        const e10 = grid[row][col + 1];
        const e01 = grid[row + 1][col];
        const e11 = grid[row + 1][col + 1];
        
        const edges = [
          { r0: row, c0: col, r1: row + 1, c1: col, e0: e00, e1: e01 },
          { r0: row, c0: col, r1: row, c1: col + 1, e0: e00, e1: e10 },
          { r0: row, c0: col + 1, r1: row + 1, c1: col + 1, e0: e10, e1: e11 },
          { r0: row + 1, c0: col, r1: row + 1, c1: col + 1, e0: e01, e1: e11 }
        ];
        
        const crossings = [];
        for (const edge of edges) {
          if (Math.abs(edge.e1 - edge.e0) > 0.01) {
            const t = (targetElev - edge.e0) / (edge.e1 - edge.e0);
            if (t >= 0 && t <= 1) {
              const r = edge.r0 + t * (edge.r1 - edge.r0);
              const c = edge.c0 + t * (edge.c1 - edge.c0);
              crossings.push({ row: r, col: c });
            }
          }
        }
        
        if (crossings.length >= 2) {
          list.push(crossings.map(c => ({ row: c.row, col: c.col })));
        }
      }
    }
  }
  
  return contours;
}

function computeHillshade(grid, gridSize) {
  const hillshade = new Array(gridSize).fill(null).map(() => new Array(gridSize).fill(128));
  const azimuth = 315 * (Math.PI / 180);
  const zenith = 35 * (Math.PI / 180);
  const scale = 1.2;
  
  for (let y = 0; y < gridSize; y++) {
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
  
  return hillshade;
}

function projectGroundwater(data) {
  const { rechargeVolume, soilPermeability, currentDepth, area, years = 5 } = data;
  const impactZone = Math.min(area * 0.3, 5000);
  const monthlyRecharge = rechargeVolume / 12;
  const annualGrowthRate = 0.15 + (soilPermeability / 100);
  
  const projections = [];
  let cumulativeRise = 0;
  let currentWaterTable = currentDepth;
  
  for (let year = 1; year <= years; year++) {
    const annualRecharge = monthlyRecharge * 12 * (1 + annualGrowthRate * (year - 1));
    const risePerMeter = impactZone * 0.001;
    const localRise = Math.min(annualRecharge * risePerMeter / impactZone, 5);
    
    cumulativeRise += localRise;
    currentWaterTable = Math.max(0, currentDepth - cumulativeRise);
    
    projections.push({
      year,
      waterTableM: Math.round(currentWaterTable * 10) / 10,
      risePercent: Math.round((cumulativeRise / currentDepth) * 100),
      rechargeLiters: Math.round(annualRecharge),
      cumulativeRiseM: Math.round(cumulativeRise * 10) / 10
    });
  }
  
  return projections;
}

function optimizeSetup(data) {
  const { propertySize, annualRainfall, budget, soilPermeability, roofArea, landArea, people } = data;
  const maxBudget = budget || 100000;
  const rainPotential = annualRainfall * roofArea * 0.9;
  const stormPotential = annualRainfall * landArea * 0.4;
  const greyPotential = people * 110 * 365;
  
  const options = [
    { id: 'tank_5000', name: '5000L Rooftop Tank', cost: 15000, annual: rainPotential * 0.4, type: 'rooftop' },
    { id: 'tank_10000', name: '10000L Rooftop Tank', cost: 25000, annual: rainPotential * 0.7, type: 'rooftop' },
    { id: 'tank_20000', name: '20000L Rooftop Tank', cost: 45000, annual: Math.min(rainPotential, rainPotential), type: 'rooftop' },
    { id: 'pit', name: 'Recharge Pit', cost: 12000, annual: annualRainfall * (roofArea + landArea) * 0.15, type: 'recharge' },
    { id: 'trench', name: 'Percolation Trench', cost: 25000, annual: annualRainfall * (roofArea + landArea) * 0.25, type: 'recharge' },
    { id: 'greywater', name: 'Greywater System', cost: 35000, annual: greyPotential, type: 'recycling' }
  ];
  
  const validOptions = options.filter(o => o.cost <= maxBudget && o.annual > 0);
  validOptions.sort((a, b) => (b.annual / b.cost) - (a.annual / a.cost));
  
  let selected = [];
  let remainingBudget = maxBudget;
  let totalAnnual = 0;
  
  for (const opt of validOptions) {
    if (opt.cost <= remainingBudget) {
      selected.push(opt);
      remainingBudget -= opt.cost;
      totalAnnual += opt.annual;
    }
  }
  
  const roi = totalAnnual > 0 ? selected.reduce((sum, o) => sum + o.cost, 0) / totalAnnual : Infinity;
  
  return {
    selected,
    totalCost: selected.reduce((sum, o) => sum + o.cost, 0),
    totalAnnualLiters: Math.round(totalAnnual),
    roiYears: Math.round(roi),
    remainingBudget,
    recommendations: selected.map(o => ({
      ...o,
      reason: getRecommendationReason(o, data)
    }))
  };
}

function getRecommendationReason(option, data) {
  const reasons = {
    tank_5000: 'Compact solution for small budgets with quick ROI',
    tank_10000: 'Balanced storage for moderate rainfall areas',
    tank_20000: 'Maximum capture during heavy monsoon months',
    pit: 'Fast recharge to local groundwater table',
    trench: 'Slow infiltration ideal for clay soils',
    greywater: 'Year-round supply independent of rainfall'
  };
  return reasons[option.id] || 'Optimized for your property constraints';
}

function extractDrainagePaths(flowDir, flowAcc, threshold, gridSize, bounds) {
  const paths = [];
  const { latMin, latMax, lonMin, lonMax } = bounds;
  const latStep = (latMax - latMin) / gridSize;
  const lonStep = (lonMax - lonMin) / gridSize;
  
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      if (flowAcc[row][col] >= threshold) {
        const path = [];
        let r = row, c = col;
        const visited = new Set();
        
        while (true) {
          const key = `${r},${c}`;
          if (visited.has(key)) break;
          visited.add(key);
          
          const lat = latMax - (r / (gridSize - 1)) * (latMax - latMin);
          const lon = lonMin + (c / (gridSize - 1)) * (lonMax - lonMin);
          path.push([lat, lon]);
          
          const dir = flowDir[r][c];
          if (dir === -1) break;
          
          const [dr, dc] = D8_DIRECTIONS[dir];
          r += dr;
          c += dc;
          
          if (r < 0 || r >= gridSize || c < 0 || c >= gridSize) break;
        }
        
        if (path.length >= 3) {
          paths.push({ points: path, accumulation: flowAcc[row][col] });
        }
      }
    }
  }
  
  return paths;
}