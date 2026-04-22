
      import * as THREE from "three";
      import { OrbitControls } from "three/addons/controls/OrbitControls.js";
      import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
      import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
      import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";

      function toggleSection(header) {
        const content = header.nextElementSibling;
        const toggle = header.querySelector('.section-toggle');
        content.classList.toggle('collapsed');
        toggle.classList.toggle('collapsed');
      }

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
        
        document.getElementById('quality-select')?.addEventListener('change', (e) => {
          setQualityLevel(e.target.value);
        });
      }

      function goToStep(stepNum) {
        document.querySelectorAll('.step').forEach((s, i) => {
          const num = i * 2 + 1;
          s.classList.remove('active', 'done');
          if (num < stepNum) s.classList.add('done');
          else if (num === stepNum) s.classList.add('active');
        });
        
        document.querySelectorAll('.step-panel').forEach((p, i) => {
          p.classList.toggle('active', i + 1 === stepNum);
        });
      }

      function showResults(data) {
        const result = data?.data;
        if (!result) return;
        
        document.getElementById('result-total').textContent = formatNumber(result.total || 0);
        document.getElementById('result-savings').textContent = '₹' + formatNumber(result.financial?.annual_savings || 0);
        document.getElementById('result-rain').textContent = (data?.weather?.annual_rain || 0) + ' mm';
        
        const recList = document.getElementById('rec-list');
        recList.innerHTML = '';
        const actions = result.actions?.slice(0, 3) || [];
        if (actions.length === 0) {
          recList.innerHTML = '<div class="rec-item"><span class="rec-icon">💡</span><span class="rec-text">Run analysis to get personalized recommendations.</span></div>';
        } else {
          actions.forEach(action => {
            const item = document.createElement('div');
            item.className = 'rec-item';
            item.innerHTML = `<span class="rec-icon">✓</span><span class="rec-text">${action}</span>`;
            recList.appendChild(item);
          });
        }
        
        const methodsList = document.getElementById('methods-list');
        methodsList.innerHTML = '';
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
          methodsList.appendChild(item);
        });
        
        goToStep(4);
      }

      function setQualityLevel(level) {
        PERFORMANCE.currentLevel = level;
        applyQualitySettings();
        document.getElementById('quality-select').value = level;
        console.log('[Quality] Set to', level);
      }

      function formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return Math.round(num).toString();
      }

      function updateAnalysisProgress(percent, msg) {
        const bar = document.getElementById('analysis-progress');
        const msgEl = document.getElementById('analysis-msg');
        if (bar) bar.style.width = percent + '%';
        if (msgEl) msgEl.textContent = msg;
      }

      function updateFPS(fps) {
        const perfBadge = document.getElementById('perf-badge');
        if (perfBadge) {
          perfBadge.style.color = fps >= 50 ? '#10b981' : fps >= 30 ? '#f59e0b' : '#ef4444';
        }
      }

      function updateStatusBadge(elementId, status, text) {
        const el = document.getElementById(elementId);
        if (!el) return;
        el.className = 'status-badge ' + status;
        const dot = el.querySelector('.status-dot');
        el.childNodes[el.childNodes.length - 1].textContent = ' ' + text;
      }

      function toggleSidebarSection(header) {
        const content = header.nextElementSibling;
        const arrow = header.querySelector('.toggle-arrow');
        if (content) content.style.display = content.style.display === 'none' ? 'block' : 'none';
        if (arrow) arrow.textContent = arrow.textContent === '▼' ? '▶' : '▼';
      }

      initWizard();

      const SCALE = 0.08;
      const canvasRoot = document.getElementById("viewport");
      const labelsRoot = document.getElementById("labels");
      const loadingEl = document.getElementById("loading");

      let scene, camera, renderer, ctrl;
      let terrainMesh = null;
      let terrainGrid = null;
      let terrainGS = 0;
      let terrainCellSize = 1;
      let terrainHalf = 1;
      let terrainMinE = 0;
      let terrainMaxE = 0;
      let terrainRange = 1;
      let terrainExag = 1;
      let waterData = null;
      let weatherData = null;
      let skyMat = null;
      let terrainShaderMat = null;
      let terrainNormals = null;
      let weatherTimeline = null;
      let rainSystemAdvanced = null;
      let cloudSystem = null;
      let lightningSystem = null;
      let waterFlowSimulator = null;
      let weatherLayerManager = null;
      let rainRadar = null;

      let contourLineGroup = null;
      let riverGroup = null;
      let riverFlowSystems = [];
      let lakeGroup = null;
      let lakeMeshes = [];
      let cloudGroup = null;
      let cloudData = null;
      let rainSystem = null;
      let atmosphericParticles = null;
      let propertyGroup = null;
      let catchmentMesh = null;
      let dataVizGroup = null;
      let mapTileGroup = null;
      let mapOverlayGeneration = 0;
      let labels = [];
      let roadsGroup = null;
      let boundariesGroup = null;
      let placesGroup = null;
      let topoTileCache = new Map();
      let currentTopoSource = "esri_imagery";
      let terrainHillshadeTexture = null;
      let terrainTopoTexture = null;
      let enhancedContourLabels = [];
      let currentTerrainLOD = 0;
      let terrainDetailLevel = "high";
      const LOD_DISTANCES = { high: 0, medium: 80, low: 150 };
      
      let contourTexture = null;
      let contourCanvas = null;
      let contourCtx = null;
      const tileLoadQueue = [];
      let isProcessingTileQueue = false;
      
      const TERRAIN_LOD = {
        baseResolution: 64,
        highRes: 128,
        mediumRes: 64,
        lowRes: 32,
        chunkSize: 100,
        maxChunks: 9,
        activeChunks: new Map(),
        frustum: null
      };

      const INFINITE_MAP = {
        enabled: true,
        currentLat: 0,
        currentLon: 0,
        tileSize: 0.01,
        loadedChunks: new Map(),
        chunkRadius: 2,
        pendingLoads: new Set(),
        tileLoader: null,
        cache: new Map(),
      };

      const clock = new THREE.Clock();
      let elapsed = 0;
      let cameraAnim = null;
      let fpsBudget = { smoothed: 60, last: performance.now(), samples: [] };
      let frameCount = 0;
      
      const PERFORMANCE = {
        QUALITY_LEVELS: {
          HIGH: { terrainRes: 64, particles: 3000, shadows: false, lodDistances: [0, 60, 100], tileOpacity: 0.7 },
          MEDIUM: { terrainRes: 48, particles: 1500, shadows: false, lodDistances: [0, 50, 80], tileOpacity: 0.5 },
          LOW: { terrainRes: 32, particles: 500, shadows: false, lodDistances: [0, 40, 60], tileOpacity: 0.3 }
        },
        currentLevel: 'LOW',
        targetFPS: 55,
        lastQualityChange: 0,
        qualityChangeCooldown: 10000,
        memoryBudget: 256 * 1024 * 1024,
        maxDrawCalls: 50,
        useInstancing: true,
        enableLOD: true,
        enableFrustumCulling: true,
        dirtyFlags: {
          camera: true,
          weather: true,
          terrain: true,
          labels: true,
          water: true
        }
      };
      
      const PERFORMANCE_STATS = {
        fps: 60,
        drawCalls: 0,
        triangles: 0,
        textures: 0,
        geometries: 0,
        lastUpdate: 0
      };
      
      function updatePerformanceMonitoring() {
        const now = performance.now();
        if (now - PERFORMANCE_STATS.lastUpdate < 1000) return;
        PERFORMANCE_STATS.lastUpdate = now;
        PERFORMANCE_STATS.fps = fpsBudget.smoothed;
        PERFORMANCE_STATS.drawCalls = renderer?.info.render.calls || 0;
        PERFORMANCE_STATS.triangles = renderer?.info.render.triangles || 0;
        PERFORMANCE_STATS.textures = renderer?.info.memory?.textures || 0;
        PERFORMANCE_STATS.geometries = renderer?.info.memory?.geometries || 0;
      }
      
      function adaptQuality() {
        const now = performance.now();
        if (now - PERFORMANCE.lastQualityChange < PERFORMANCE.qualityChangeCooldown * 3) return;
        
        const fps = fpsBudget.smoothed;
        const drawCalls = renderer?.info.render.calls || 0;
        const triangles = renderer?.info.render.triangles || 0;
        
        let newLevel = PERFORMANCE.currentLevel;
        
        if (fps < 20 || drawCalls > 800 || triangles > 1500000) {
          if (PERFORMANCE.currentLevel === 'HIGH') newLevel = 'MEDIUM';
          else if (PERFORMANCE.currentLevel === 'MEDIUM') newLevel = 'LOW';
        } else if (fps > 55 && drawCalls < 200 && triangles < 500000) {
          if (PERFORMANCE.currentLevel === 'LOW') newLevel = 'MEDIUM';
          else if (PERFORMANCE.currentLevel === 'MEDIUM') newLevel = 'HIGH';
        }
        
        if (newLevel !== PERFORMANCE.currentLevel) {
          PERFORMANCE.currentLevel = newLevel;
          PERFORMANCE.lastQualityChange = now;
          applyQualitySettings();
          console.log(`[Performance] Quality adjusted to ${newLevel} - FPS: ${fps.toFixed(1)}, DrawCalls: ${drawCalls}, Triangles: ${triangles}`);
        }
      }
      
      function applyQualitySettings() {
        const settings = PERFORMANCE.QUALITY_LEVELS[PERFORMANCE.currentLevel];
        
        if (sceneState.rainSystem) {
          const targetParticles = Math.floor(settings.particles * 0.5);
          if (sceneState.rainSystem.maxParticles > targetParticles) {
            sceneState.rainSystem.setMaxParticles(targetParticles);
          }
        }
        
        if (sceneState.cloudSystem) {
          const targetPuffs = Math.floor(settings.particles * 0.003);
          if (sceneState.cloudSystem.maxPuffs > targetPuffs) {
            sceneState.cloudSystem.setMaxPuffs(targetPuffs);
          }
        }
        
        LOD_DISTANCES.high = settings.lodDistances[0];
        LOD_DISTANCES.medium = settings.lodDistances[1];
        LOD_DISTANCES.low = settings.lodDistances[2];
      }
      
      function setDirty(flag, value = true) {
        PERFORMANCE.dirtyFlags[flag] = value;
      }
      
      function isDirty(flag) {
        return PERFORMANCE.dirtyFlags[flag];
      }
      
      function clearDirty(flag) {
        PERFORMANCE.dirtyFlags[flag] = false;
      }
      
      function disposeObject(obj) {
        if (!obj) return;
        if (obj.geometry) {
          obj.geometry.dispose();
        }
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach(m => {
              if (m.map) m.map.dispose();
              if (m.uniforms) {
                Object.values(m.uniforms).forEach(u => {
                  if (u.value && u.value.dispose) u.value.dispose();
                });
              }
              m.dispose();
            });
          } else {
            if (obj.material.map) obj.material.map.dispose();
            if (obj.material.uniforms) {
              Object.values(obj.material.uniforms).forEach(u => {
                if (u.value && u.value.dispose) u.value.dispose();
              });
            }
            obj.material.dispose();
          }
        }
      }
      
      function disposeTexture(tex) {
        if (tex) tex.dispose();
      }
      
      function disposeGeometry(geom) {
        if (geom) geom.dispose();
      }
      
      const sceneState = {
        scene: null,
        camera: null,
        renderer: null,
        controls: null,
        composer: null,
        usePostProcessing: true,
        terrainMesh: null,
        terrainElevationGrid: null,
        terrainN: 0,
        terrainSize: 200,
        terrainHeightScale: 40,
        terrainBounds: null,
        mapTileGroup: null,
        riverMeshes: [],
        lakeMeshes: [],
        lakeGlows: [],
        skySystem: null,
        sunSystem: null,
        cloudSystem: null,
        rainSystem: null,
        windSystem: null,
        lightningSystem: null,
        currentHour: 12,
        cloudCover: 0,
        isRaining: false,
        clock,
        geodata: null,
        weatherData: null,
      };


      // ===== LEGACY TERRAIN + WEATHER SYSTEMS (unused) =====
      class LegacyVolumetricRainSystem {
        constructor(sceneRef) {
          this.scene = sceneRef;
          this.mesh = null;
          this.capacity = 70000;
          this.active = 0;
          this.wind = new THREE.Vector2(0, 0);
          this.gravity = 9.8;
          this.intensity = 0;
          this.positions = null;
          this.vel = null;
          this.spawn();
        }
        spawn() {
          const geom = new THREE.InstancedBufferGeometry();
          const base = new THREE.PlaneGeometry(0.04, 1.2);
          geom.index = base.index;
          geom.attributes.position = base.attributes.position;
          geom.attributes.uv = base.attributes.uv;
          this.positions = new Float32Array(this.capacity * 3);
          this.vel = new Float32Array(this.capacity);
          const offsets = new Float32Array(this.capacity * 3);
          const scales = new Float32Array(this.capacity);
          for (let i=0;i<this.capacity;i++) {
            offsets[i*3]=(Math.random()-0.5)*320;
            offsets[i*3+1]=Math.random()*120+15;
            offsets[i*3+2]=(Math.random()-0.5)*320;
            scales[i]=0.8+Math.random()*1.8;
            this.vel[i]=35+Math.random()*55;
          }
          geom.setAttribute('instanceOffset', new THREE.InstancedBufferAttribute(offsets,3));
          geom.setAttribute('instanceScale', new THREE.InstancedBufferAttribute(scales,1));
          const mat = new THREE.ShaderMaterial({
            transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
            uniforms:{uOpacity:{value:0.0},uWind:{value:new THREE.Vector2(0,0)}},
            vertexShader:`
              attribute vec3 instanceOffset; attribute float instanceScale; varying float vAlpha;
              uniform vec2 uWind;
              void main(){
                vec3 p = position; p.y *= instanceScale;
                p.x += uWind.x * p.y * 0.02; p.z += uWind.y * p.y * 0.02;
                vec3 wp = p + instanceOffset;
                vAlpha = 1.0 - uv.y;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(wp,1.0);
              }`,
            fragmentShader:`
              varying float vAlpha; uniform float uOpacity;
              void main(){
                float a = smoothstep(1.0,0.0,abs(vAlpha-0.5)*1.8) * uOpacity;
                gl_FragColor = vec4(0.72,0.83,0.95,a);
              }`
          });
          this.mesh = new THREE.Mesh(geom, mat);
          this.mesh.geometry.instanceCount = 0;
          this.mesh.frustumCulled = false;
          this.scene.add(this.mesh);
        }
        setWeather(precip, windSpeed, windDir) {
          this.intensity = clamp(precip/25,0,1);
          const w = clamp((windSpeed||0)/30,0,1.2);
          const ang = (windDir||0) * Math.PI/180;
          this.wind.set(Math.sin(ang)*w, Math.cos(ang)*w);
          const cameraScale = camera ? clamp(1 - (camera.position.length() / 700), 0.25, 1) : 1;
          const perfScale = clamp(fpsBudget.smoothed / 55, 0.35, 1);
          this.active = Math.floor(this.capacity * (0.08 + this.intensity*0.92) * cameraScale * perfScale);
          this.mesh.material.uniforms.uOpacity.value = this.intensity>0 ? 0.1 + this.intensity*0.35 : 0.0;
          this.mesh.material.uniforms.uWind.value.copy(this.wind);
          this.mesh.geometry.instanceCount = this.active;
        }
        update(dt){
          if (!this.mesh || this.active<=0) return;
          const attr = this.mesh.geometry.getAttribute('instanceOffset');
          for (let i=0;i<this.active;i++) {
            let y = attr.array[i*3+1] - this.vel[i]*dt;
            attr.array[i*3] += this.wind.x*dt*28;
            attr.array[i*3+2] += this.wind.y*dt*28;
            if (y < getTerrainY(attr.array[i*3], attr.array[i*3+2]) + 0.4) {
              y = 95 + Math.random()*45;
              attr.array[i*3] = (Math.random()-0.5)*320;
              attr.array[i*3+2] = (Math.random()-0.5)*320;
            }
            attr.array[i*3+1]=y;
          }
          attr.needsUpdate = true;
        }
        dispose(){ if(this.mesh){ this.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.mesh=null; } }
      }

      class LegacyWaterFlowSimulator {
        constructor(){ this.wetness = 0; this.recentRain = 0; }
        addRainfall(mm){ this.recentRain = mm||0; this.wetness = clamp(this.wetness + (mm||0)*0.01,0,1); }
        update(dt,temp){
          const evap = clamp((temp||25)/45,0.25,1.2) * 0.02;
          this.wetness = clamp(this.wetness - evap*dt, 0, 1);
        }
      }

      class LegacyCloudSystem {
        constructor(){ this.coverage = -1; this.windDir=0; this.windSpeed=0; this.lastBucket = -1; }
        apply(weather){
          this.coverage = (weather.cloud_cover||0)/100;
          this.windDir = weather.wind_direction_10m||0;
          this.windSpeed = weather.wind_speed_10m||0;
          const bucket = Math.round((weather.cloud_cover || 0) / 10);
          if (bucket !== this.lastBucket || !cloudGroup) {
            buildClouds(weather.cloud_cover||0, weather.wind_direction_10m||0);
            this.lastBucket = bucket;
          } else if (cloudData) {
            const dx = Math.sin((this.windDir || 0) * Math.PI / 180);
            const dz = Math.cos((this.windDir || 0) * Math.PI / 180);
            for (const c of cloudData) {
              c.dx = dx;
              c.dz = dz;
              c.speed = 1.0 + this.windSpeed * 0.2;
            }
          }
        }
      }

      class LegacyLightningSystem {
        constructor(sceneRef){ this.scene=sceneRef; this.group=new THREE.Group(); this.flash=0; sceneRef.add(this.group); }
        createStrike(){
          const pts=[];
          let x=(Math.random()-0.5)*180,z=(Math.random()-0.5)*180,y=120;
          pts.push(new THREE.Vector3(x,y,z));
          for(let i=0;i<7;i++){ x+=(Math.random()-0.5)*12; z+=(Math.random()-0.5)*12; y-=14+Math.random()*8; pts.push(new THREE.Vector3(x,y,z)); }
          const geom=new THREE.BufferGeometry().setFromPoints(pts);
          const mat=new THREE.LineBasicMaterial({color:0xddeaff,transparent:true,opacity:0.95});
          const ln=new THREE.Line(geom,mat);
          this.group.add(ln);
          setTimeout(()=>{ this.group.remove(ln); geom.dispose(); mat.dispose(); },180);
          this.flash = 1.0;
        }
        update(dt){
          this.flash = Math.max(0,this.flash-dt*5);
        }
      }

      class LegacyWeatherLayerManager {
        constructor(){ this.layers={rainfall:false,wind:false,temp:false,runoff:false}; this.group=new THREE.Group(); scene.add(this.group); }
        setLayer(name, on){ this.layers[name]=on; this.refresh(); }
        refresh(){ this.group.visible = Object.values(this.layers).some(Boolean); }
        update(weather){
          if (!terrainGrid) return;
          while (this.group.children.length) {
            const c = this.group.children[0];
            this.group.remove(c);
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
          }
          const precip = weather.precipitation || 0;
          const temp = weather.temperature_2m || 25;
          if (this.layers.wind) {
            const len = 10 + (weather.wind_speed_10m||0) * 0.8;
            const ang = (weather.wind_direction_10m||0) * Math.PI/180;
            for(let i=-2;i<=2;i++) for(let j=-2;j<=2;j++){
              const x=i*22,z=j*22,y=getTerrainY(x,z)+2;
              const dir=new THREE.Vector3(Math.sin(ang),0,Math.cos(ang));
              const arr=new THREE.ArrowHelper(dir,new THREE.Vector3(x,y,z),len,0x99ccff,2.5,1.1);
              this.group.add(arr);
            }
          }
          if (this.layers.rainfall) {
            const radius = 10 + precip * 0.9;
            const disc = new THREE.Mesh(
              new THREE.CircleGeometry(radius, 64),
              new THREE.MeshBasicMaterial({ color: precip > 25 ? 0xa020f0 : precip > 10 ? 0xff6b00 : 0x39b54a, transparent: true, opacity: 0.2, depthWrite: false })
            );
            disc.rotation.x = -Math.PI / 2;
            disc.position.y = getTerrainY(0, 0) + 0.15;
            this.group.add(disc);
          }
          if (this.layers.temp) {
            const hot = clamp((temp - 15) / 20, 0, 1);
            const tempColor = new THREE.Color().setHSL((1 - hot) * 0.66, 0.8, 0.5);
            const ring = new THREE.Mesh(
              new THREE.RingGeometry(8, 12, 48),
              new THREE.MeshBasicMaterial({ color: tempColor, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false })
            );
            ring.rotation.x = -Math.PI / 2;
            ring.position.y = getTerrainY(0, 0) + 0.2;
            this.group.add(ring);
          }
          if (this.layers.runoff) {
            const pts = [];
            for (let s = 0; s < 5; s++) {
              let x = (Math.random() - 0.5) * terrainHalf * 1.6;
              let z = (Math.random() - 0.5) * terrainHalf * 1.6;
              for (let k = 0; k < 8; k++) {
                const y = getTerrainY(x, z) + 0.25;
                pts.push(new THREE.Vector3(x, y, z));
                x += (Math.random() - 0.5) * 8;
                z += 4 + Math.random() * 6;
              }
            }
            const flow = new THREE.LineSegments(
              new THREE.BufferGeometry().setFromPoints(pts),
              new THREE.LineBasicMaterial({ color: 0x4db8ff, transparent: true, opacity: 0.35 })
            );
            this.group.add(flow);
          }
        }
      }

      class LegacyWeatherTimelineController {
        constructor(){ this.forecast=[]; this.currentHourIndex=0; this.isPlaying=false; this.playbackSpeed=4; this.lastUpdate=performance.now(); this.lastAppliedHour=-1; }
        setForecast(wx){
          this.forecast=[];
          this.currentHourIndex = 0;
          this.lastAppliedHour = -1;
          const cur=wx?.current||{};
          const daily=wx?.forecast||[];
          for(let h=0;h<168;h++){
            const day = daily[Math.floor(h/24)]||{};
            this.forecast.push({
              precipitation: (day.rain||0)/24,
              cloud_cover: cur.cloud||0,
              wind_speed_10m: cur.wind_spd||0,
              wind_direction_10m: cur.wind_dir||0,
              relative_humidity_2m: cur.hum||60,
              temperature_2m: cur.temp||25
            });
          }
          this.renderPreview(daily);
          this.applyNow();
        }
        renderPreview(daily){
          const root=document.getElementById('forecast-preview'); root.innerHTML='';
          for(let i=0;i<Math.min(7,daily.length);i++){ const d=daily[i]; const el=document.createElement('div'); el.className='mini'; el.textContent=`D${i+1} ${Math.round(d.rain||0)}mm`; root.appendChild(el);}   
        }
        getCurrentWeather(){ return this.forecast[Math.floor(this.currentHourIndex)] || this.forecast[0] || {precipitation:0,cloud_cover:0,wind_speed_10m:0,wind_direction_10m:0,relative_humidity_2m:60,temperature_2m:25}; }
        applyNow(){
          const w=this.getCurrentWeather();
          if(rainSystemAdvanced) rainSystemAdvanced.setWeather(w.precipitation,w.wind_speed_10m,w.wind_direction_10m);
          if(cloudSystem) cloudSystem.apply(w);
          if(waterFlowSimulator) waterFlowSimulator.addRainfall(w.precipitation);
          if(weatherLayerManager) weatherLayerManager.update(w);
          updateFog({hum:w.relative_humidity_2m,cloud:w.cloud_cover,raining:w.precipitation>0.2});
          if(lightningSystem && w.precipitation>10 && Math.random()<0.04) lightningSystem.createStrike();
          this.updateDisplay();
          this.lastAppliedHour = Math.floor(this.currentHourIndex);
        }
        update(now){
          const dt=(now-this.lastUpdate)/1000; this.lastUpdate=now;
          if(!this.isPlaying) return;
          this.currentHourIndex += dt*this.playbackSpeed;
          if(this.currentHourIndex>=168) this.currentHourIndex=0;
          const hourNow = Math.floor(this.currentHourIndex);
          if (hourNow !== this.lastAppliedHour) this.applyNow();
          document.getElementById('time-scrubber').value = String(Math.floor(this.currentHourIndex));
        }
        updateDisplay(){ const day=Math.floor(this.currentHourIndex/24)+1; const hr=Math.floor(this.currentHourIndex%24); document.getElementById('current-time-display').textContent=`Day ${day}, ${String(hr).padStart(2,'0')}:00`; }
        togglePlayPause(){ this.isPlaying=!this.isPlaying; document.getElementById('timeline-play-pause').textContent=this.isPlaying?'⏸️ Pause':'▶️ Play'; }
        scrubTo(v){ this.currentHourIndex=Number(v)||0; this.isPlaying=false; document.getElementById('timeline-play-pause').textContent='▶️ Play'; this.applyNow(); }
      }


      // ===== TERRAIN + WEATHER SYSTEMS =====
      class VolumetricRainSystem {
        constructor(sceneRef) {
          this.scene = sceneRef;
          this.mesh = null;
          this.capacity = 45000;
          this.active = 0;
          this.wind = new THREE.Vector2(0, 0);
          this.gravity = 9.8;
          this.intensity = 0;
          this.positions = null;
          this.vel = null;
          this.spawn();
        }
        spawn() {
          const geom = new THREE.InstancedBufferGeometry();
          const base = new THREE.PlaneGeometry(0.04, 1.2);
          geom.index = base.index;
          geom.attributes.position = base.attributes.position;
          geom.attributes.uv = base.attributes.uv;
          this.positions = new Float32Array(this.capacity * 3);
          this.vel = new Float32Array(this.capacity);
          const offsets = new Float32Array(this.capacity * 3);
          const scales = new Float32Array(this.capacity);
          for (let i=0;i<this.capacity;i++) {
            offsets[i*3]=(Math.random()-0.5)*320;
            offsets[i*3+1]=Math.random()*120+15;
            offsets[i*3+2]=(Math.random()-0.5)*320;
            scales[i]=0.8+Math.random()*1.8;
            this.vel[i]=35+Math.random()*55;
          }
          geom.setAttribute('instanceOffset', new THREE.InstancedBufferAttribute(offsets,3));
          geom.setAttribute('instanceScale', new THREE.InstancedBufferAttribute(scales,1));
          const mat = new THREE.ShaderMaterial({
            transparent:true, depthWrite:false, blending:THREE.AdditiveBlending,
            uniforms:{uOpacity:{value:0.0},uWind:{value:new THREE.Vector2(0,0)}},
            vertexShader:`
              attribute vec3 instanceOffset; attribute float instanceScale; varying float vAlpha;
              uniform vec2 uWind;
              void main(){
                vec3 p = position; p.y *= instanceScale;
                p.x += uWind.x * p.y * 0.02; p.z += uWind.y * p.y * 0.02;
                vec3 wp = p + instanceOffset;
                vAlpha = 1.0 - uv.y;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(wp,1.0);
              }`,
            fragmentShader:`
              varying float vAlpha; uniform float uOpacity;
              void main(){
                float a = smoothstep(1.0,0.0,abs(vAlpha-0.5)*1.8) * uOpacity;
                gl_FragColor = vec4(0.72,0.83,0.95,a);
              }`
          });
          this.mesh = new THREE.Mesh(geom, mat);
          this.mesh.frustumCulled = false;
          this.scene.add(this.mesh);
        }
        setWeather(precip, windSpeed, windDir) {
          this.intensity = clamp(precip/25,0,1);
          const w = clamp((windSpeed||0)/30,0,1.2);
          const ang = (windDir||0) * Math.PI/180;
          this.wind.set(Math.sin(ang)*w, Math.cos(ang)*w);
          this.active = Math.floor(this.capacity * (0.08 + this.intensity*0.92));
          this.mesh.material.uniforms.uOpacity.value = this.intensity>0 ? 0.1 + this.intensity*0.35 : 0.0;
          this.mesh.material.uniforms.uWind.value.copy(this.wind);
          this.mesh.count = this.active;
        }
        update(dt){
          if (!this.mesh || this.active<=0) return;
          const attr = this.mesh.geometry.getAttribute('instanceOffset');
          for (let i=0;i<this.active;i++) {
            let y = attr.array[i*3+1] - this.vel[i]*dt;
            attr.array[i*3] += this.wind.x*dt*28;
            attr.array[i*3+2] += this.wind.y*dt*28;
            if (y < getTerrainY(attr.array[i*3], attr.array[i*3+2]) + 0.4) {
              y = 95 + Math.random()*45;
              attr.array[i*3] = (Math.random()-0.5)*320;
              attr.array[i*3+2] = (Math.random()-0.5)*320;
            }
            attr.array[i*3+1]=y;
          }
          attr.needsUpdate = true;
        }
        dispose(){ if(this.mesh){ this.scene.remove(this.mesh); this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.mesh=null; } }
      }

      class WaterFlowSimulator {
        constructor(){ this.wetness = 0; this.recentRain = 0; }
        addRainfall(mm){ this.recentRain = mm||0; this.wetness = clamp(this.wetness + (mm||0)*0.01,0,1); }
        update(dt,temp){
          const evap = clamp((temp||25)/45,0.25,1.2) * 0.02;
          this.wetness = clamp(this.wetness - evap*dt, 0, 1);
        }
      }

      class CloudSystem {
        constructor(){ this.coverage = 0; this.windDir=0; this.windSpeed=0; }
        apply(weather){
          this.coverage = (weather.cloud_cover||0)/100;
          this.windDir = weather.wind_direction_10m||0;
          this.windSpeed = weather.wind_speed_10m||0;
          buildClouds(weather.cloud_cover||0, weather.wind_direction_10m||0);
        }
      }

      class LightningSystem {
        constructor(sceneRef){ this.scene=sceneRef; this.group=new THREE.Group(); this.flash=0; sceneRef.add(this.group); }
        createStrike(){
          const pts=[];
          let x=(Math.random()-0.5)*180,z=(Math.random()-0.5)*180,y=120;
          pts.push(new THREE.Vector3(x,y,z));
          for(let i=0;i<7;i++){ x+=(Math.random()-0.5)*12; z+=(Math.random()-0.5)*12; y-=14+Math.random()*8; pts.push(new THREE.Vector3(x,y,z)); }
          const geom=new THREE.BufferGeometry().setFromPoints(pts);
          const mat=new THREE.LineBasicMaterial({color:0xddeaff,transparent:true,opacity:0.95});
          const ln=new THREE.Line(geom,mat);
          this.group.add(ln);
          setTimeout(()=>{ this.group.remove(ln); geom.dispose(); mat.dispose(); },180);
          this.flash = 1.0;
        }
        update(dt){
          this.flash = Math.max(0,this.flash-dt*5);
        }
      }

      class WeatherLayerManager {
        constructor(){ this.layers={rainfall:false,wind:false,temp:false,runoff:false}; this.group=new THREE.Group(); scene.add(this.group); }
        setLayer(name, on){ this.layers[name]=on; this.refresh(); }
        refresh(){ this.group.visible = Object.values(this.layers).some(Boolean); }
        update(weather){
          if (!terrainGrid) return;
          while(this.group.children.length){ const c=this.group.children.pop(); if(c.geometry) c.geometry.dispose(); if(c.material) c.material.dispose(); }
          if (this.layers.wind) {
            const len = 10 + (weather.wind_speed_10m||0) * 0.8;
            const ang = (weather.wind_direction_10m||0) * Math.PI/180;
            for(let i=-2;i<=2;i++) for(let j=-2;j<=2;j++){
              const x=i*22,z=j*22,y=getTerrainY(x,z)+2;
              const dir=new THREE.Vector3(Math.sin(ang),0,Math.cos(ang));
              const arr=new THREE.ArrowHelper(dir,new THREE.Vector3(x,y,z),len,0x99ccff,2.5,1.1);
              this.group.add(arr);
            }
          }
        }
      }

      class WeatherTimelineController {
        constructor(){ this.forecast=[]; this.currentHourIndex=0; this.isPlaying=false; this.playbackSpeed=4; this.lastUpdate=performance.now(); }
        setForecast(wx){
          this.forecast=[];
          const cur=wx?.current||{};
          const daily=wx?.forecast||[];
          for(let h=0;h<168;h++){
            const day = daily[Math.floor(h/24)]||{};
            this.forecast.push({
              precipitation: (day.rain||0)/24,
              cloud_cover: cur.cloud||0,
              wind_speed_10m: cur.wind_spd||0,
              wind_direction_10m: cur.wind_dir||0,
              relative_humidity_2m: cur.hum||60,
              temperature_2m: cur.temp||25
            });
          }
          this.renderPreview(daily);
          this.applyNow();
        }
        renderPreview(daily){
          const root=document.getElementById('forecast-preview'); root.innerHTML='';
          for(let i=0;i<Math.min(7,daily.length);i++){ const d=daily[i]; const el=document.createElement('div'); el.className='mini'; el.textContent=`D${i+1} ${Math.round(d.rain||0)}mm`; root.appendChild(el);}   
        }
        getCurrentWeather(){ return this.forecast[Math.floor(this.currentHourIndex)] || this.forecast[0] || {precipitation:0,cloud_cover:0,wind_speed_10m:0,wind_direction_10m:0,relative_humidity_2m:60,temperature_2m:25}; }
        applyNow(){
          const w=this.getCurrentWeather();
          if(rainSystemAdvanced) rainSystemAdvanced.setWeather(w.precipitation,w.wind_speed_10m,w.wind_direction_10m);
          if(cloudSystem) cloudSystem.apply(w);
          if(waterFlowSimulator) waterFlowSimulator.addRainfall(w.precipitation);
          if(weatherLayerManager) weatherLayerManager.update(w);
          updateFog({hum:w.relative_humidity_2m,cloud:w.cloud_cover,raining:w.precipitation>0.2});
          if(lightningSystem && w.precipitation>10 && Math.random()<0.04) lightningSystem.createStrike();
          this.updateDisplay();
        }
        update(now){
          const dt=(now-this.lastUpdate)/1000; this.lastUpdate=now;
          if(!this.isPlaying) return;
          this.currentHourIndex += dt*this.playbackSpeed;
          if(this.currentHourIndex>=168) this.currentHourIndex=0;
          this.applyNow();
          document.getElementById('time-scrubber').value = String(Math.floor(this.currentHourIndex));
        }
        updateDisplay(){ const day=Math.floor(this.currentHourIndex/24)+1; const hr=Math.floor(this.currentHourIndex%24); document.getElementById('current-time-display').textContent=`Day ${day}, ${String(hr).padStart(2,'0')}:00`; }
        togglePlayPause(){ this.isPlaying=!this.isPlaying; document.getElementById('timeline-play-pause').textContent=this.isPlaying?'⏸️ Pause':'▶️ Play'; }
        scrubTo(v){ this.currentHourIndex=Number(v)||0; this.isPlaying=false; document.getElementById('timeline-play-pause').textContent='▶️ Play'; this.applyNow(); }
      }

      class AquaSkySystem {
        constructor(sceneRef) {
          this.scene = sceneRef;
          this.currentHour = 12;
          this._buildSkyDome();
          this._buildStarField();
        }
        _buildSkyDome() {
          const geo = new THREE.SphereGeometry(800, 32, 32);
          geo.scale(-1, 1, -1);
          this.skyMaterial = new THREE.ShaderMaterial({
            uniforms: {
              uHorizonColor: { value: new THREE.Color("#87ceeb") },
              uZenithColor: { value: new THREE.Color("#1a2f5e") },
              uSunsetBand: { value: new THREE.Color("#ff7043") },
              uSunsetHeight: { value: 0.0 },
              uOvercastBlend: { value: 0.0 },
              uTime: { value: 0.0 },
            },
            vertexShader: `
              varying vec3 vWorldDir;
              void main() {
                vWorldDir = normalize(position);
                vec4 clipPos = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                gl_Position = clipPos.xyww;
              }
            `,
            fragmentShader: `
              uniform vec3 uHorizonColor;
              uniform vec3 uZenithColor;
              uniform vec3 uSunsetBand;
              uniform float uSunsetHeight;
              uniform float uOvercastBlend;
              varying vec3 vWorldDir;
              void main() {
                float h = clamp(vWorldDir.y * 0.5 + 0.5, 0.0, 1.0);
                vec3 daySky = mix(uHorizonColor, uZenithColor, pow(h, 0.6));
                float sunsetMask = smoothstep(0.45, 0.0, h) * clamp(uSunsetHeight, 0.0, 1.0);
                daySky = mix(daySky, uSunsetBand, sunsetMask);
                vec3 nightSky = mix(vec3(0.05, 0.08, 0.12), vec3(0.05, 0.10, 0.20), pow(h, 0.5));
                vec3 overcastSky = vec3(mix(0.61, 0.55, h), mix(0.64, 0.58, h), mix(0.67, 0.63, h));
                vec3 sky = mix(daySky, overcastSky, clamp(uOvercastBlend, 0.0, 1.0));
                sky = mix(sky, nightSky, clamp((uSunsetHeight - 0.5) * 2.0, 0.0, 1.0));
                gl_FragColor = vec4(sky, 1.0);
              }
            `,
            side: THREE.BackSide,
            depthWrite: false,
          });
          this.skyDome = new THREE.Mesh(geo, this.skyMaterial);
          this.skyDome.renderOrder = -1;
          this.scene.add(this.skyDome);
        }
        _buildStarField() {
          const count = 500;
          const positions = new Float32Array(count * 3);
          for (let i = 0; i < count; i++) {
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI * 0.5;
            const r = 750;
            positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = r * Math.cos(phi);
            positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
          }
          const geo = new THREE.BufferGeometry();
          geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
          const mat = new THREE.PointsMaterial({
            color: "#ffffff",
            size: 1.2,
            sizeAttenuation: false,
            transparent: true,
            opacity: 0,
            depthWrite: false,
          });
          this.starField = new THREE.Points(geo, mat);
          this.scene.add(this.starField);
        }
        update(hour, cloudCoverPercent, isRaining, deltaTime) {
          this.currentHour = hour;
          const sunsetHeight = this._computeSunsetFactor(hour);
          const isNight = hour < 5.5 || hour > 20.5;
          const u = this.skyMaterial.uniforms;
          const targetHorizon = isNight ? new THREE.Color("#0d1b2a") : sunsetHeight > 0.3 ? new THREE.Color("#ff9a56") : new THREE.Color("#87ceeb");
          const targetZenith = isNight ? new THREE.Color("#060d1a") : new THREE.Color("#1a2f5e");
          u.uHorizonColor.value.lerp(targetHorizon, 0.02);
          u.uZenithColor.value.lerp(targetZenith, 0.02);
          u.uSunsetHeight.value += (sunsetHeight - u.uSunsetHeight.value) * 0.02;
          const overcastTarget = clamp((cloudCoverPercent / 100) * 0.7 + (isRaining ? 0.3 : 0.0), 0, 1);
          u.uOvercastBlend.value += (overcastTarget - u.uOvercastBlend.value) * 0.03;
          u.uTime.value += deltaTime;
          this.starField.material.opacity += ((isNight ? 0.8 : 0.0) - this.starField.material.opacity) * 0.02;
        }
        _computeSunsetFactor(hour) {
          if (hour >= 6 && hour <= 18) return Math.abs(hour - 12) / 6.0;
          return 1.0;
        }
        dispose() {
          this.scene.remove(this.skyDome, this.starField);
          this.skyDome.geometry.dispose();
          this.skyDome.material.dispose();
          this.starField.geometry.dispose();
          this.starField.material.dispose();
        }
      }

      class AquaSunLightSystem {
        constructor(sceneRef) {
          this.scene = sceneRef;
          this.sunLight = new THREE.DirectionalLight("#fff9f0", 1.8);
          this.sunLight.castShadow = true;
          this.sunLight.shadow.mapSize.width = 2048;
          this.sunLight.shadow.mapSize.height = 2048;
          this.sunLight.shadow.camera.near = 0.5;
          this.sunLight.shadow.camera.far = 500;
          this.sunLight.shadow.camera.left = -120;
          this.sunLight.shadow.camera.right = 120;
          this.sunLight.shadow.camera.top = 120;
          this.sunLight.shadow.camera.bottom = -120;
          this.sunLight.shadow.bias = -0.0005;
          this.sunLight.target.position.set(0, 0, 0);
          sceneRef.add(this.sunLight, this.sunLight.target);
          this.ambientLight = new THREE.AmbientLight("#b0c4de", 0.4);
          this.hemiLight = new THREE.HemisphereLight("#87ceeb", "#3d5a3e", 0.3);
          this.moonLight = new THREE.DirectionalLight("#c8d8e8", 0.0);
          this.moonLight.position.set(-50, 80, -60);
          sceneRef.add(this.ambientLight, this.hemiLight, this.moonLight);
          this._currentHour = 12;
        }
        update(hour) {
          this._currentHour += (hour - this._currentHour) * 0.01;
          const h = this._currentHour;
          const t = clamp((h - 6) / 12.0, 0, 1);
          const sunAngle = t * Math.PI;
          const sunX = -Math.cos(sunAngle) * 150;
          const sunY = Math.max(Math.sin(sunAngle) * 200, -20);
          const sunZ = -50;
          this.sunLight.position.set(sunX, sunY, sunZ);
          const warmth = 1.0 - Math.sin(sunAngle);
          const sunColor = new THREE.Color();
          sunColor.r = 1.0;
          sunColor.g = 0.85 + (1.0 - warmth) * 0.15;
          sunColor.b = 0.7 + (1.0 - warmth) * 0.3;
          this.sunLight.color.lerp(sunColor, 0.03);
          const isDaytime = h >= 5.5 && h <= 20.5;
          const targetIntensity = isDaytime ? Math.max(Math.sin(sunAngle), 0) * 1.8 : 0.0;
          this.sunLight.intensity += (targetIntensity - this.sunLight.intensity) * 0.02;
          this.moonLight.intensity += ((isDaytime ? 0.0 : 0.18) - this.moonLight.intensity) * 0.02;
          this.ambientLight.intensity += ((isDaytime ? 0.4 : 0.08) - this.ambientLight.intensity) * 0.02;
          this.hemiLight.intensity += ((isDaytime ? 0.3 : 0.06) - this.hemiLight.intensity) * 0.02;
          const uniforms = sceneState.terrainMesh?.material?.uniforms;
          if (uniforms) {
            uniforms.uSunDirection.value.set(sunX, sunY, sunZ).normalize();
            uniforms.uSunColor.value.copy(this.sunLight.color);
          }
        }
      }

      class AquaCloudSystem {
        constructor(sceneRef) {
          this.scene = sceneRef;
          this.puffs = [];
          this.maxPuffs = 60;
          this._cloudCover = 0;
          this._windSpeed = 5;
          this._windDirRad = 0;
        }
        _buildPuff(x, y, z, scale) {
          const group = new THREE.Group();
          const count = 4 + Math.floor(Math.random() * 5);
          for (let i = 0; i < count; i++) {
            const r = (0.8 + Math.random() * 1.2) * scale;
            const geo = new THREE.SphereGeometry(r, 7, 5);
            const mat = new THREE.MeshStandardMaterial({
              color: "#f0f4f8",
              transparent: true,
              opacity: 0.5 + Math.random() * 0.2,
              depthWrite: false,
              roughness: 1,
              metalness: 0,
            });
            const sphere = new THREE.Mesh(geo, mat);
            sphere.position.set((Math.random() - 0.5) * r * 2.5, (Math.random() - 0.5) * r * 0.8, (Math.random() - 0.5) * r * 2.5);
            sphere.castShadow = true;
            group.add(sphere);
          }
          group.position.set(x, y, z);
          group.traverse((mesh) => {
            if (mesh.isMesh) mesh.raycast = () => {};
          });
          return group;
        }
        setWeather(cloudCoverPercent, windSpeed, windDirDeg) {
          this._cloudCover = cloudCoverPercent || 0;
          this._windSpeed = windSpeed || 0;
          this._windDirRad = ((windDirDeg || 0) * Math.PI) / 180;
          const targetCount = Math.floor((this._cloudCover / 100) * this.maxPuffs);
          while (this.puffs.length < targetCount) {
            const puff = this._buildPuff((Math.random() - 0.5) * 150, 55 + Math.random() * 25, (Math.random() - 0.5) * 150, 4 + Math.random() * 8);
            this.scene.add(puff);
            this.puffs.push({ group: puff, speed: 0.5 + Math.random() * 0.5 });
          }
          while (this.puffs.length > targetCount) {
            const puff = this.puffs.pop();
            this.scene.remove(puff.group);
            puff.group.traverse((mesh) => {
              if (mesh.isMesh) {
                mesh.geometry.dispose();
                mesh.material.dispose();
              }
            });
          }
        }
        apply(weather) {
          const normalized = normalizeWeatherSnapshot(weather);
          this.setWeather(normalized.cloudCover, normalized.windSpeed, normalized.windDir);
        }
        update(deltaTime) {
          const speed = this._windSpeed * 0.003;
          const dx = Math.sin(this._windDirRad) * speed;
          const dz = Math.cos(this._windDirRad) * speed;
          for (const puff of this.puffs) {
            puff.group.position.x += dx * puff.speed;
            puff.group.position.z += dz * puff.speed;
            const bound = 110;
            if (puff.group.position.x > bound) puff.group.position.x = -bound;
            if (puff.group.position.x < -bound) puff.group.position.x = bound;
            if (puff.group.position.z > bound) puff.group.position.z = -bound;
            if (puff.group.position.z < -bound) puff.group.position.z = bound;
          }
        }
        setMaxPuffs(n) {
          this.maxPuffs = Math.max(1, n | 0);
          this.setWeather(this._cloudCover, this._windSpeed, (this._windDirRad * 180) / Math.PI);
        }
        dispose() {
          for (const puff of this.puffs) {
            this.scene.remove(puff.group);
            puff.group.traverse((mesh) => {
              if (mesh.isMesh) {
                mesh.geometry.dispose();
                mesh.material.dispose();
              }
            });
          }
          this.puffs = [];
        }
      }

      class AquaRainSystem {
        constructor(sceneRef) {
          this.scene = sceneRef;
          this.maxParticles = 12000;
          this._activeCount = 0;
          this._targetCount = 0;
          this._windDir = new THREE.Vector3(0, -1, 0);
          this._ripplePool = [];
          this.MAX_RIPPLES = 200;
          this._dummy = new THREE.Object3D();
          this._buildInstancedMesh();
          this._buildRipplePool();
        }
        _buildInstancedMesh() {
          const geo = new THREE.CylinderGeometry(0.01, 0.01, 0.35, 3);
          const mat = new THREE.MeshBasicMaterial({
            color: "#a8d8ea",
            transparent: true,
            opacity: 0.55,
            depthWrite: false,
          });
          this.instancedMesh = new THREE.InstancedMesh(geo, mat, this.maxParticles);
          this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
          this.instancedMesh.frustumCulled = false;
          this.instancedMesh.renderOrder = 2;
          this.positions = new Float32Array(this.maxParticles * 3);
          this.velocities = new Float32Array(this.maxParticles * 3);
          this.lifetimes = new Float32Array(this.maxParticles);
          const bound = 120;
          const height = 80;
          for (let i = 0; i < this.maxParticles; i++) {
            this.positions[i * 3] = (Math.random() - 0.5) * bound * 2;
            this.positions[i * 3 + 1] = Math.random() * height;
            this.positions[i * 3 + 2] = (Math.random() - 0.5) * bound * 2;
            this.velocities[i * 3 + 1] = -(0.35 + Math.random() * 0.45);
            this.lifetimes[i] = Math.random() * 6;
          }
          this.scene.add(this.instancedMesh);
        }
        _buildRipplePool() {
          for (let i = 0; i < this.MAX_RIPPLES; i++) {
            const geo = new THREE.RingGeometry(0.0, 0.3, 12);
            geo.rotateX(-Math.PI / 2);
            const mat = new THREE.MeshBasicMaterial({
              color: "#d0eaf5",
              transparent: true,
              opacity: 0.6,
              depthWrite: false,
              side: THREE.DoubleSide,
            });
            const mesh = new THREE.Mesh(geo, mat);
            mesh.visible = false;
            this.scene.add(mesh);
            this._ripplePool.push({ mesh, age: 0, maxAge: 0.4, active: false });
          }
        }
        _spawnRipple(x, y, z) {
          const ripple = this._ripplePool.find((item) => !item.active);
          if (!ripple) return;
          ripple.active = true;
          ripple.age = 0;
          ripple.maxAge = 0.35 + Math.random() * 0.15;
          ripple.mesh.position.set(x, y + 0.12, z);
          ripple.mesh.scale.set(0.01, 0.01, 0.01);
          ripple.mesh.visible = true;
          ripple.mesh.material.opacity = 0.6;
        }
        setWeather(precipMm, windSpeed, windDirDeg) {
          const intensity = clamp((precipMm || 0) / 5.0, 0, 1);
          this._targetCount = Math.floor(intensity * this.maxParticles);
          this.instancedMesh.material.color.lerpColors(new THREE.Color("#a8d8ea"), new THREE.Color("#5c9bb5"), intensity);
          const windRad = ((windDirDeg || 0) * Math.PI) / 180;
          const tiltStrength = Math.min((windSpeed || 0) / 60, 0.5);
          this._windDir.set(Math.sin(windRad) * tiltStrength, -1, Math.cos(windRad) * tiltStrength).normalize();
          const angle = tiltStrength * 0.4;
          this.instancedMesh.rotation.z = Math.sin(windRad) * angle;
          this.instancedMesh.rotation.x = Math.cos(windRad) * angle * 0.5;
        }
        update(deltaTime) {
          this._activeCount = Math.round(THREE.MathUtils.lerp(this._activeCount, this._targetCount, clamp(deltaTime * 4, 0, 1)));
          const bound = 120;
          const top = 80;
          for (let i = 0; i < this.maxParticles; i++) {
            if (i >= this._activeCount) {
              this._dummy.position.set(0, -999, 0);
              this._dummy.updateMatrix();
              this.instancedMesh.setMatrixAt(i, this._dummy.matrix);
              continue;
            }
            this.positions[i * 3] += this._windDir.x * 0.4;
            this.positions[i * 3 + 1] += this.velocities[i * 3 + 1];
            this.positions[i * 3 + 2] += this._windDir.z * 0.4;
            const hitY = sampleTerrainHeight(this.positions[i * 3], this.positions[i * 3 + 2]) + 0.2;
            if (this.positions[i * 3 + 1] < hitY || Math.abs(this.positions[i * 3]) > bound || Math.abs(this.positions[i * 3 + 2]) > bound) {
              if (Math.random() < 0.3) this._spawnRipple(this.positions[i * 3], hitY, this.positions[i * 3 + 2]);
              this.positions[i * 3] = (Math.random() - 0.5) * bound * 2;
              this.positions[i * 3 + 1] = top;
              this.positions[i * 3 + 2] = (Math.random() - 0.5) * bound * 2;
            }
            this._dummy.position.set(this.positions[i * 3], this.positions[i * 3 + 1], this.positions[i * 3 + 2]);
            this._dummy.updateMatrix();
            this.instancedMesh.setMatrixAt(i, this._dummy.matrix);
          }
          this.instancedMesh.instanceMatrix.needsUpdate = true;
          for (const ripple of this._ripplePool) {
            if (!ripple.active) continue;
            ripple.age += deltaTime;
            const p = ripple.age / ripple.maxAge;
            ripple.mesh.scale.setScalar(p * 0.3);
            ripple.mesh.material.opacity = 0.6 * (1.0 - p);
            if (ripple.age >= ripple.maxAge) {
              ripple.active = false;
              ripple.mesh.visible = false;
            }
          }
        }
        setMaxParticles(n) {
          this.maxParticles = Math.max(1000, n | 0);
        }
        dispose() {
          this.scene.remove(this.instancedMesh);
          this.instancedMesh.geometry.dispose();
          this.instancedMesh.material.dispose();
          for (const ripple of this._ripplePool) {
            this.scene.remove(ripple.mesh);
            ripple.mesh.geometry.dispose();
            ripple.mesh.material.dispose();
          }
          this._ripplePool = [];
        }
      }

      class AquaWindParticleSystem {
        constructor(sceneRef) {
          this.scene = sceneRef;
          this.MAX_PARTICLES = 2500;
          this._speed = 5;
          this._dirRad = 0;
          this._targetSpeed = 5;
          this._targetDirRad = 0;
          this._buildGeometry();
        }
        _buildGeometry() {
          const positions = new Float32Array(this.MAX_PARTICLES * 2 * 3);
          const alphas = new Float32Array(this.MAX_PARTICLES * 2);
          this._px = new Float32Array(this.MAX_PARTICLES);
          this._py = new Float32Array(this.MAX_PARTICLES);
          this._pz = new Float32Array(this.MAX_PARTICLES);
          this._life = new Float32Array(this.MAX_PARTICLES);
          this._maxLife = new Float32Array(this.MAX_PARTICLES);
          const bound = 110;
          for (let i = 0; i < this.MAX_PARTICLES; i++) {
            this._px[i] = (Math.random() - 0.5) * bound * 2;
            this._py[i] = 5 + Math.random() * 13;
            this._pz[i] = (Math.random() - 0.5) * bound * 2;
            this._life[i] = Math.random() * 5;
            this._maxLife[i] = 2 + Math.random() * 4;
          }
          const geo = new THREE.BufferGeometry();
          this._posAttr = new THREE.BufferAttribute(positions, 3);
          this._posAttr.setUsage(THREE.DynamicDrawUsage);
          this._alphaAttr = new THREE.BufferAttribute(alphas, 1);
          this._alphaAttr.setUsage(THREE.DynamicDrawUsage);
          geo.setAttribute("position", this._posAttr);
          geo.setAttribute("alpha", this._alphaAttr);
          const mat = new THREE.ShaderMaterial({
            uniforms: { uOpacityScale: { value: 1.0 } },
            vertexShader: `
              attribute float alpha;
              varying float vAlpha;
              void main() {
                vAlpha = alpha;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `,
            fragmentShader: `
              uniform float uOpacityScale;
              varying float vAlpha;
              void main() {
                gl_FragColor = vec4(1.0, 1.0, 1.0, vAlpha * uOpacityScale);
              }
            `,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          });
          this._lines = new THREE.LineSegments(geo, mat);
          this._lines.frustumCulled = false;
          this._lines.renderOrder = 3;
          this._lines.visible = false;
          this.scene.add(this._lines);
        }
        setWind(speed, directionDeg) {
          this._targetSpeed = speed || 0;
          this._targetDirRad = ((directionDeg || 0) * Math.PI) / 180;
        }
        update(deltaTime) {
          this._speed += (this._targetSpeed - this._speed) * deltaTime * 0.4;
          this._dirRad += (this._targetDirRad - this._dirRad) * deltaTime * 0.4;
          const vx = Math.sin(this._dirRad) * this._speed * 0.06;
          const vz = Math.cos(this._dirRad) * this._speed * 0.06;
          const bound = 110;
          const pos = this._posAttr.array;
          const alp = this._alphaAttr.array;
          this._lines.material.uniforms.uOpacityScale.value = Math.min(this._speed / 40, 1.0);
          for (let i = 0; i < this.MAX_PARTICLES; i++) {
            this._life[i] += deltaTime;
            const t = this._life[i] / this._maxLife[i];
            let alpha = 0;
            if (t < 0.1) alpha = (t / 0.1) * 0.35;
            else if (t < 0.8) alpha = 0.35;
            else alpha = (1.0 - (t - 0.8) / 0.2) * 0.35;
            if (this._life[i] > this._maxLife[i]) {
              this._px[i] = (Math.random() - 0.5) * bound * 2;
              this._py[i] = 5 + Math.random() * 15;
              this._pz[i] = (Math.random() - 0.5) * bound * 2;
              this._life[i] = 0;
              this._maxLife[i] = 2 + Math.random() * 4;
              alpha = 0;
            }
            this._px[i] += vx;
            this._pz[i] += vz;
            if (this._px[i] > bound) this._px[i] -= bound * 2;
            if (this._px[i] < -bound) this._px[i] += bound * 2;
            if (this._pz[i] > bound) this._pz[i] -= bound * 2;
            if (this._pz[i] < -bound) this._pz[i] += bound * 2;
            const hi = i * 6;
            pos[hi] = this._px[i];
            pos[hi + 1] = this._py[i];
            pos[hi + 2] = this._pz[i];
            pos[hi + 3] = this._px[i] - vx * 1.5;
            pos[hi + 4] = this._py[i];
            pos[hi + 5] = this._pz[i] - vz * 1.5;
            alp[i * 2] = alpha;
            alp[i * 2 + 1] = 0;
          }
          this._posAttr.needsUpdate = true;
          this._alphaAttr.needsUpdate = true;
        }
        dispose() {
          this.scene.remove(this._lines);
          this._lines.geometry.dispose();
          this._lines.material.dispose();
        }
      }

      class AquaLightningSystem {
        constructor(sceneRef, sunLight) {
          this.scene = sceneRef;
          this.sunLight = sunLight;
          this._active = false;
          this._nextStrike = 4 + Math.random() * 8;
          this._timer = 0;
          this._flashFrames = 0;
          this._bolts = [];
          this._originalSunIntensity = 0;
        }
        setActive(isThunderstorm) {
          this._active = !!isThunderstorm;
        }
        _generateBoltPath(origin, terrainY) {
          const points = [
            origin.clone(),
            new THREE.Vector3(origin.x + (Math.random() - 0.5) * 4, terrainY, origin.z + (Math.random() - 0.5) * 4),
          ];
          for (let level = 0; level < 5; level++) {
            const next = [points[0]];
            for (let i = 0; i < points.length - 1; i++) {
              const mid = points[i].clone().lerp(points[i + 1], 0.5);
              const displacement = 1.5 / (level + 1);
              mid.x += (Math.random() - 0.5) * displacement * 2;
              mid.z += (Math.random() - 0.5) * displacement * 2;
              next.push(mid, points[i + 1]);
            }
            points.splice(0, points.length, ...next);
          }
          return points;
        }
        _strike(cloudPuffs) {
          if (!cloudPuffs || !cloudPuffs.length) return;
          const puff = cloudPuffs[Math.floor(Math.random() * cloudPuffs.length)].group;
          const origin = puff.position.clone();
          const terrainY = sampleTerrainHeight(origin.x, origin.z);
          const path = this._generateBoltPath(new THREE.Vector3(origin.x, origin.y - 5, origin.z), terrainY + 0.5);
          const geo = new THREE.BufferGeometry().setFromPoints(path);
          const mat = new THREE.LineBasicMaterial({ color: "#e8f4ff", transparent: true, opacity: 0.95 });
          const bolt = new THREE.Line(geo, mat);
          this.scene.add(bolt);
          this._bolts.push(bolt);
          this._flashFrames = 8;
          this._originalSunIntensity = this.sunLight?.intensity || 0;
          if (this.sunLight) this.sunLight.intensity = 4.0;
          window.setTimeout(() => {
            this.scene.remove(bolt);
            bolt.geometry.dispose();
            bolt.material.dispose();
            this._bolts = this._bolts.filter((item) => item !== bolt);
          }, 120);
        }
        createStrike() {
          this._strike(sceneState.cloudSystem?.puffs || []);
        }
        update(deltaTime, cloudPuffs) {
          if (this._active) {
            this._timer += deltaTime;
            if (this._timer >= this._nextStrike) {
              this._timer = 0;
              this._nextStrike = 4 + Math.random() * 8;
              this._strike(cloudPuffs);
            }
          }
          if (this._flashFrames > 0 && this.sunLight) {
            this._flashFrames--;
            const t = this._flashFrames / 8;
            this.sunLight.intensity = this._originalSunIntensity + (4.0 - this._originalSunIntensity) * t;
          }
        }
        dispose() {
          for (const bolt of this._bolts) {
            this.scene.remove(bolt);
            bolt.geometry.dispose();
            bolt.material.dispose();
          }
          this._bolts = [];
        }
      }

      class AquaWaterFlowSimulator {
        constructor() {
          this.wetness = 0.2;
          this.recentRain = 0;
          this.totalRainfall = 0;
          this.runoffVolume = 0;
          this.infiltrationVolume = 0;
          this.evaporationLoss = 0;
          this.waterLevel = 0;
          this.peakFlowRate = 0;
          this.flowAccumulation = 0;
        }
        addRainfall(mm) {
          this.recentRain = mm || 0;
          this.totalRainfall += (mm || 0);
          this.wetness = clamp(this.wetness + (mm || 0) * 0.015, 0, 1);
          this.waterLevel = clamp(this.waterLevel + (mm || 0) * 0.1, 0, 1);
        }
        update(dt, temp) {
          const evap = clamp((temp || 25) / 45, 0.25, 1.2) * 0.015;
          const evapLoss = evap * dt * 0.5;
          this.evaporationLoss += evapLoss;
          this.waterLevel = clamp(this.waterLevel - evapLoss, 0, 1);
          this.wetness = clamp(this.wetness - evap * dt, 0, 1);
        }
        setRunoffData(runoffCoef, area) {
          this.runoffCoef = runoffCoef;
          this.area = area || 10000;
        }
        getRunoffFlow() {
          const intensity = this.recentRain * 1000 / 3600;
          return this.runoffCoef * intensity * this.area / 1000;
        }
      }

      class HydrologyCalculator {
        constructor() {
          this.runoffCoefficients = {
            roof_concrete: 0.85,
            roof_metal: 0.90,
            roof_tile: 0.80,
            roof_asphalt: 0.88,
            roof_gravel: 0.70,
            roof_soil: 0.50,
            roof_grass: 0.25,
            land_open: 0.35,
            land_garden: 0.20,
            land_paved: 0.85,
            land_driveway: 0.90,
            land_compacted: 0.60,
            land_sandy: 0.15,
            soil_loamy: 0.30,
            soil_sandy: 0.15,
            soil_laterite: 0.40,
            soil_clay_loam: 0.35,
            soil_clay: 0.50,
            soil_rocky: 0.60
          };
          this.infiltrationRates = {
            soil_loamy: 25,
            soil_sandy: 50,
            soil_laterite: 15,
            soil_clay_loam: 10,
            soil_clay: 5,
            soil_rocky: 2
          };
          this.stats = {
            rivers: 0,
            streams: 0,
            lakes: 0,
            totalWaterArea: 0,
            flowVolume: 0,
            runoffCoef: 0,
            peakFlowRate: 0,
            storageRequired: 0,
            rainfallIntensity: 0,
            runoffVolume: 0,
            infiltrationVolume: 0,
            harvestedWater: 0,
            waterDeficit: 0
          };
        }
        calculateRunoffCoefficient(roofSurface, landType, soilType) {
          const roofCoef = this.runoffCoefficients[`roof_${roofSurface}`] || 0.80;
          const landCoef = this.runoffCoefficients[`land_${landType}`] || 0.40;
          return (roofCoef * 0.6 + landCoef * 0.4);
        }
        calculateRunoffFlow(rainfall, area, coef) {
          return coef * rainfall * area / 1000;
        }
        calculatePeakFlow(rainfall, area, coef, tc = 30) {
          const intensity = rainfall / tc * 60;
          return coef * intensity * area / 1000;
        }
        calculateStorageRequired(rainfall, area, coef, evaporation = 2) {
          const totalRain = rainfall * area / 1000;
          const runoff = totalRain * coef;
          const evapLoss = evaporation * area / 1000;
          return Math.max(runoff - evapLoss, 0);
        }
        calculateInfiltration(soilType, duration = 1) {
          const rate = this.infiltrationRates[`soil_${soilType}`] || 15;
          return rate * duration * 0.001;
        }
        calculateHarvestedWater(rainfall, roofArea, efficiency = 0.85) {
          return rainfall * roofArea * efficiency;
        }
        calculateDemand(people, acUnits, acHours, acMonths) {
          const domestic = people * 90 * 365;
          const ac = acUnits * 1500 * acHours * acMonths * 30;
          return domestic + ac;
        }
        updateStats(waterSim, rivers, lakes, roofArea, landArea, rainfall, roofSurface, landType, soilType, people, acUnits, acHours, acMonths) {
          const coef = this.calculateRunoffCoefficient(roofSurface, landType, soilType);
          const intensity = rainfall;
          const totalArea = roofArea + landArea;
          const runoff = this.calculateRunoffFlow(rainfall, totalArea, coef);
          const peakFlow = this.calculatePeakFlow(rainfall, totalArea, coef);
          const storage = this.calculateStorageRequired(rainfall, totalArea, coef);
          const infiltration = this.calculateInfiltration(soilType, 1);
          const harvested = this.calculateHarvestedWater(rainfall, roofArea);
          const demand = this.calculateDemand(people, acUnits, acHours, acMonths);
          this.stats = {
            rivers: rivers.filter(r => (r.accumulation || 0) > 800).length,
            streams: rivers.filter(r => (r.accumulation || 0) <= 800).length,
            lakes: lakes.length,
            totalWaterArea: (lakes.reduce((a, l) => a + (l.area || 0), 0) + rivers.reduce((a, r) => a + (r.area || 0), 0)) * 10000,
            flowVolume: runoff,
            runoffCoef: coef.toFixed(2),
            peakFlowRate: peakFlow.toFixed(2),
            storageRequired: storage.toFixed(1),
            rainfallIntensity: intensity.toFixed(1),
            runoffVolume: (runoff * totalArea / 1000).toFixed(0),
            infiltrationVolume: (infiltration * landArea).toFixed(0),
            harvestedWater: harvested.toFixed(0),
            waterDeficit: Math.max(demand / 365 - harvested, 0).toFixed(0)
          };
          if (waterSim) {
            waterSim.setRunoffData(coef, totalArea);
            waterSim.flowAccumulation = runoff;
            waterSim.peakFlowRate = peakFlow;
          }
          return this.stats;
        }
        getFormattedStats() {
          return this.stats;
        }
      }

      let hydrologyCalculator = null;

      class AquaWeatherLayerManager {
        constructor(sceneRef) {
          this.scene = sceneRef;
          this.layers = { rainfall: false, wind: false, temp: false, runoff: false };
          this.group = new THREE.Group();
          this.scene.add(this.group);
          this._lastWeather = null;
          this._windOverlayKey = "";
        }
        setLayer(name, on) {
          this.layers[name] = !!on;
          this.refresh();
          if (this._lastWeather) this.update(this._lastWeather);
        }
        refresh() {
          this.group.visible = Object.values(this.layers).some(Boolean);
          if (sceneState.windSystem?._lines) sceneState.windSystem._lines.visible = !!this.layers.wind;
        }
        _clearOverlayGroup() {
          while (this.group.children.length) {
            const child = this.group.children.pop();
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
          }
        }
        _buildWindArrows() {
          if (!this.layers.wind) return;
          const distance = camera ? camera.position.distanceTo(ctrl?.target || new THREE.Vector3()) : 120;
          const bucket = distance > 220 ? 3 : distance > 140 ? 2 : 1;
          const gridCount = bucket === 3 ? 7 : bucket === 2 ? 5 : 3;
          const spacing = bucket === 3 ? 24 : bucket === 2 ? 30 : 42;
          const speed = this._lastWeather.windSpeed || 0;
          const dirDeg = this._lastWeather.windDir || 0;
          const key = `${bucket}:${Math.round(speed)}:${Math.round(dirDeg)}`;
          this._windOverlayKey = key;
          const dir = new THREE.Vector3(Math.sin(dirDeg * Math.PI / 180), 0, Math.cos(dirDeg * Math.PI / 180)).normalize();
          const arrowLength = 5 + Math.min(speed * 0.45, 10) + bucket * 1.5;
          const half = ((gridCount - 1) * spacing) / 2;
          for (let gx = 0; gx < gridCount; gx++) {
            for (let gz = 0; gz < gridCount; gz++) {
              const x = gx * spacing - half;
              const z = gz * spacing - half;
              const y = sampleTerrainHeight(x, z) + 1.6;
              const arrow = new THREE.ArrowHelper(
                dir,
                new THREE.Vector3(x, y, z),
                arrowLength,
                0xe8f6ff,
                Math.max(arrowLength * 0.25, 1.2),
                Math.max(arrowLength * 0.16, 0.8)
              );
              arrow.line.material.transparent = true;
              arrow.line.material.opacity = 0.75;
              arrow.cone.material.transparent = true;
              arrow.cone.material.opacity = 0.9;
              this.group.add(arrow);
            }
          }
        }
        syncWithCamera() {
          if (!this.layers.wind || !this._lastWeather) return;
          const distance = camera ? camera.position.distanceTo(ctrl?.target || new THREE.Vector3()) : 120;
          const bucket = distance > 220 ? 3 : distance > 140 ? 2 : 1;
          const key = `${bucket}:${Math.round(this._lastWeather.windSpeed || 0)}:${Math.round(this._lastWeather.windDir || 0)}`;
          if (key !== this._windOverlayKey) this.update(this._lastWeather);
        }
        update(weather) {
          this._lastWeather = normalizeWeatherSnapshot(weather);
          this._clearOverlayGroup();
          if (!terrainGrid || !this.group.visible) return;
          this._buildWindArrows();
          if (this.layers.rainfall) {
            const disc = new THREE.Mesh(
              new THREE.CircleGeometry(10 + this._lastWeather.precipitation * 2.8, 48),
              new THREE.MeshBasicMaterial({ color: this._lastWeather.precipitation > 4 ? 0x4fc3f7 : 0x8be9fd, transparent: true, opacity: 0.16, depthWrite: false })
            );
            disc.rotation.x = -Math.PI / 2;
            disc.position.y = getTerrainY(0, 0) + 0.25;
            this.group.add(disc);
          }
          if (this.layers.temp) {
            const heat = clamp((this._lastWeather.temperature - 15) / 20, 0, 1);
            const ring = new THREE.Mesh(
              new THREE.RingGeometry(8, 13, 48),
              new THREE.MeshBasicMaterial({
                color: new THREE.Color().setHSL((1 - heat) * 0.66, 0.8, 0.5),
                transparent: true,
                opacity: 0.35,
                side: THREE.DoubleSide,
                depthWrite: false,
              })
            );
            ring.rotation.x = -Math.PI / 2;
            ring.position.y = getTerrainY(0, 0) + 0.3;
            this.group.add(ring);
          }
          if (this.layers.runoff) {
            const points = [];
            for (let i = 0; i < 5; i++) {
              let x = (Math.random() - 0.5) * sceneState.terrainSize * 0.7;
              let z = (Math.random() - 0.5) * sceneState.terrainSize * 0.7;
              for (let k = 0; k < 8; k++) {
                points.push(new THREE.Vector3(x, getTerrainY(x, z) + 0.18, z));
                x += (Math.random() - 0.5) * 7;
                z += 4 + Math.random() * 6;
              }
            }
            this.group.add(new THREE.LineSegments(
              new THREE.BufferGeometry().setFromPoints(points),
              new THREE.LineBasicMaterial({ color: 0x4db8ff, transparent: true, opacity: 0.28 })
            ));
          }
        }
      }

      // ============================================
      // TOPOGRAPHIC TERRAIN RENDERING SYSTEM
      // ============================================
      const TOPO_SOURCES = {
        esri_imagery: {
          name: "ESRI Satellite",
          url: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`,
          att: "Tiles © Esri",
          blend: 0.75
        },
        esri_topo: {
          name: "ESRI Topo",
          url: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/${z}/${y}/${x}`,
          att: "Tiles © Esri",
          blend: 0.65
        },
        esri_hillshade: {
          name: "ESRI Hillshade",
          url: (z, x, y) => `https://server.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/${z}/${y}/${x}`,
          att: "Tiles © Esri",
          blend: 0.45
        },
        opentopomap: {
          name: "OpenTopoMap",
          url: (z, x, y) => `https://tile.opentopomap.org/${z}/${x}/${y}.png`,
          att: "Map data: © OpenStreetMap contributors, SRTM | Map style: © OpenTopoMap",
          blend: 0.70
        },
        opentopomap_terrain: {
          name: "OpenTopoMap Relief",
          url: (z, x, y) => `https://tile.opentopomap.org/${z}/${x}/${y}.png`,
          att: "Map data: © OpenStreetMap | Map style: © OpenTopoMap",
          blend: 0.50,
          overlay: true
        },
        stadia_outdoors: {
          name: "Stadia Outdoors",
          url: (z, x, y) => `https://tiles.stadiamaps.com/tiles/stamen_terrain/${z}/${x}/${y}.png`,
          att: "Map data: © OpenStreetMap | Tiles: © Stadia Maps",
          blend: 0.70
        },
        stadia_alidade_smooth: {
          name: "Stadia Alidade Smooth",
          url: (z, x, y) => `https://tiles.stadiamaps.com/tiles/alidade_smooth/${z}/${x}/${y}.png`,
          att: "Tiles: © Stadia Maps",
          blend: 0.60
        },
        stadia_wander: {
          name: "Stadia Wander",
          url: (z, x, y) => `https://tiles.stadiamaps.com/tiles/wander/${z}/${x}/${y}.png`,
          att: "Tiles: © Stadia Maps",
          blend: 0.65
        },
        outdoors: {
          name: "OpenTopoMap",
          url: (z, x, y) => `https://tile.opentopomap.org/${z}/${x}/${y}.png`,
          att: "© OpenTopoMap © OpenStreetMap",
          blend: 0.70
        },
        hillshade: {
          name: "Hillshade",
          url: (z, x, y) => `https://tiles.stadiamaps.com/tiles/stamen_shaded_relief/${z}/${x}/${y}.png`,
          att: "Tiles: © Stadia Maps",
          blend: 0.40,
          overlay: true
        },
        thunderforest_landscape: {
          name: "Thunderforest Landscape",
          url: (z, x, y) => `https://tile.thunderforest.com/landscape/${z}/${x}/${y}.png?apikey=placeholder`,
          att: "Tiles: © Thunderforest",
          blend: 0.65
        },
        cartodb_positron: {
          name: "CartoDB Positron",
          url: (z, x, y) => `https://a.basemaps.cartocdn.com/light_all/${z}/${x}/${y}.png`,
          att: "Tiles: © CartoDB",
          blend: 0.50
        },
        cartodb_dark_matter: {
          name: "CartoDB Dark",
          url: (z, x, y) => `https://a.basemaps.cartocdn.com/dark_all/${z}/${x}/${y}.png`,
          att: "Tiles: © CartoDB",
          blend: 0.55
        }
      };
      
      function computeHillshadeFromGrid(elevationGrid, sunAzimuth = 315, sunElevation = 35) {
        const N = elevationGrid.length;
        const data = new Uint8Array(N * N * 4);
        const azimuthRad = (sunAzimuth * Math.PI) / 180;
        const zenithRad = ((90 - sunElevation) * Math.PI) / 180;
        const dx = Math.cos(azimuthRad) * Math.tan(zenithRad);
        const dy = Math.sin(azimuthRad) * Math.tan(zenithRad);
        const scale = 1.2;
        
        for (let y = 0; y < N; y++) {
          for (let x = 0; x < N; x++) {
            const y0 = Math.max(0, y - 1);
            const y1 = Math.min(N - 1, y + 1);
            const x0 = Math.max(0, x - 1);
            const x1 = Math.min(N - 1, x + 1);
            const z0 = elevationGrid[y0][x0];
            const z1 = elevationGrid[y0][x1];
            const z2 = elevationGrid[y1][x0];
            const z3 = elevationGrid[y1][x1];
            const dzdx = ((z1 - z0) + (z3 - z2)) / 2;
            const dzdy = ((z2 - z0) + (z3 - z1)) / 2;
            const slope = Math.atan(scale * Math.sqrt(dzdx * dzdx + dzdy * dzdy));
            const aspect = Math.atan2(dzdy, -dzdx);
            const hillshade = Math.max(0, Math.cos(slope) * Math.cos(zenithRad) + 
              Math.sin(slope) * Math.sin(zenithRad) * Math.cos(azimuthRad - aspect + Math.PI));
            const value = Math.floor(hillshade * 255);
            const idx = (y * N + x) * 4;
            data[idx] = value;
            data[idx + 1] = value;
            data[idx + 2] = value;
            data[idx + 3] = 255;
          }
        }
        const texture = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
        texture.needsUpdate = true;
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
      }
      
      function computeSlopeMapFromGrid(elevationGrid) {
        const N = elevationGrid.length;
        const data = new Uint8Array(N * N * 4);
        const scale = 1.5;
        
        for (let y = 0; y < N; y++) {
          for (let x = 0; x < N; x++) {
            const y0 = Math.max(0, y - 1);
            const y1 = Math.min(N - 1, y + 1);
            const x0 = Math.max(0, x - 1);
            const x1 = Math.min(N - 1, x + 1);
            const z0 = elevationGrid[y0][x0];
            const z1 = elevationGrid[y0][x1];
            const z2 = elevationGrid[y1][x0];
            const z3 = elevationGrid[y1][x1];
            const dzdx = ((z1 - z0) + (z3 - z2)) / 2;
            const dzdy = ((z2 - z0) + (z3 - z1)) / 2;
            const slope = Math.atan(scale * Math.sqrt(dzdx * dzdx + dzdy * dzdy));
            const slopeDeg = slope * (180 / Math.PI);
            const value = Math.floor(clamp(slopeDeg / 45, 0, 1) * 255);
            const idx = (y * N + x) * 4;
            data[idx] = value;
            data[idx + 1] = Math.floor(value * 0.5);
            data[idx + 2] = 0;
            data[idx + 3] = 255;
          }
        }
        const texture = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
        texture.needsUpdate = true;
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
      }
      
      function computeFlowAccumulationFromGrid(elevationGrid) {
        const N = elevationGrid.length;
        const data = new Uint8Array(N * N * 4);
        const flowDir = Array.from({ length: N }, () => Array(N).fill(0));
        const acc = Array.from({ length: N }, () => Array(N).fill(1));
        
        for (let y = 0; y < N; y++) {
          for (let x = 0; x < N; x++) {
            let maxSlope = -Infinity;
            let bestDir = 0;
            const neighbors = [[-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1]];
            for (let i = 0; i < 8; i++) {
              const ny = y + neighbors[i][0];
              const nx = x + neighbors[i][1];
              if (ny >= 0 && ny < N && nx >= 0 && nx < N) {
                const slope = elevationGrid[y][x] - elevationGrid[ny][nx];
                if (slope > maxSlope) {
                  maxSlope = slope;
                  bestDir = i;
                }
              }
            }
            flowDir[y][x] = bestDir;
          }
        }
        
        for (let y = 0; y < N; y++) {
          for (let x = 0; x < N; x++) {
            let cy = y, cx = x;
            while (true) {
              const dir = flowDir[cy][cx];
              const nOffsets = [[-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1]];
              const ny = cy + nOffsets[dir][0];
              const nx = cx + nOffsets[dir][1];
              if (ny < 0 || ny >= N || nx < 0 || nx >= N) break;
              acc[ny][nx] += acc[cy][cx];
              cy = ny; cx = nx;
            }
          }
        }
        
        const maxAcc = Math.max(...acc.flat());
        for (let y = 0; y < N; y++) {
          for (let x = 0; x < N; x++) {
            const value = Math.floor(Math.log10(acc[y][x] + 1) / Math.log10(maxAcc + 1) * 255);
            const idx = (y * N + x) * 4;
            data[idx] = Math.floor(value * 0.3);
            data[idx + 1] = Math.floor(value * 0.6);
            data[idx + 2] = 255;
            data[idx + 3] = value;
          }
        }
        const texture = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
        texture.needsUpdate = true;
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
      }
      
      let terrainSlopeTexture = null;
      let terrainFlowTexture = null;
      
      function prerenderContoursToTexture(grid, GS, cellSize, halfSize, minE, range, exag) {
        const size = Math.min(GS * 2, 1024);
        
        if (!contourCanvas || contourCanvas.width !== size) {
          contourCanvas = document.createElement('canvas');
          contourCanvas.width = size;
          contourCanvas.height = size;
          contourCtx = contourCanvas.getContext('2d', { alpha: true, willReadFrequently: false });
        }
        
        const ctx = contourCtx;
        ctx.clearRect(0, 0, size, size);
        
        const majorInterval = Math.max(50, Math.round(range / 20));
        const minorInterval = majorInterval / 5;
        
        ctx.strokeStyle = '#4a3728';
        ctx.lineWidth = 1.5;
        ctx.globalAlpha = 0.85;
        
        function drawContourLine(pts) {
          if (pts.length < 2) return;
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
          }
          ctx.stroke();
        }
        
        for (let i = 0; i < GS - 1; i++) {
          for (let j = 0; j < GS - 1; j++) {
            const e00 = grid[i][j];
            const e10 = grid[i][j + 1];
            const e01 = grid[i + 1][j];
            const e11 = grid[i + 1][j + 1];
            
            const x0 = j * cellSize - halfSize;
            const x1 = (j + 1) * cellSize - halfSize;
            const z0 = -(i * cellSize - halfSize);
            const z1 = -((i + 1) * cellSize - halfSize);
            
            const corners = [
              { x: x0, z: z0, e: e00 },
              { x: x1, z: z0, e: e10 },
              { x: x1, z: z1, e: e11 },
              { x: x0, z: z1, e: e01 }
            ];
            
            const edges = [
              [corners[0], corners[1]],
              [corners[1], corners[2]],
              [corners[2], corners[3]],
              [corners[3], corners[0]]
            ];
            
            for (let level = 0; level < Math.ceil(range / minorInterval); level++) {
              const targetElev = minE + (level + 1) * minorInterval;
              if (targetElev > minE + range) break;
              
              const crossings = [];
              for (const [p1, p2] of edges) {
                if (Math.abs(p2.e - p1.e) > 0.0001) {
                  const t = (targetElev - p1.e) / (p2.e - p1.e);
                  if (t >= 0 && t <= 1) {
                    crossings.push({
                      x: (p1.x + (p2.x - p1.x) * t) * (size / (2 * halfSize)) + size / 2,
                      y: (p1.z + (p2.z - p1.z) * t) * (size / (2 * halfSize)) + size / 2
                    });
                  }
                }
              }
              
              if (crossings.length >= 2) {
                ctx.strokeStyle = (Math.round(targetElev) % (majorInterval * 2)) < minorInterval ? '#4a3728' : '#6b5344';
                ctx.lineWidth = (Math.round(targetElev) % (majorInterval * 2)) < minorInterval ? 1.5 : 0.8;
                ctx.globalAlpha = (Math.round(targetElev) % (majorInterval * 2)) < minorInterval ? 0.85 : 0.45;
                drawContourLine(crossings);
              }
            }
          }
          
          if (i % 10 === 0) {
            requestAnimationFrame(() => {});
          }
        }
        
        if (contourTexture) {
          contourTexture.dispose();
        }
        
        contourTexture = new THREE.CanvasTexture(contourCanvas);
        contourTexture.colorSpace = THREE.SRGBColorSpace;
        contourTexture.wrapS = THREE.ClampToEdgeWrapping;
        contourTexture.wrapT = THREE.ClampToEdgeWrapping;
        contourTexture.needsUpdate = true;
        
        return contourTexture;
      }
      
      function processTileQueue() {
        if (isProcessingTileQueue || tileLoadQueue.length === 0) return;
        isProcessingTileQueue = true;
        
        const task = tileLoadQueue.shift();
        if (!task) {
          isProcessingTileQueue = false;
          return;
        }
        
        loadTopoTile(task.source, task.zoom, task.x, task.y)
          .then(texture => {
            task.resolve(texture);
          })
          .catch(err => {
            task.reject(err);
          })
          .finally(() => {
            isProcessingTileQueue = false;
            if (tileLoadQueue.length > 0) {
              setTimeout(() => processTileQueue(), 16);
            }
          });
      }
      
      function queueTileLoad(source, zoom, x, y) {
        return new Promise((resolve, reject) => {
          const cacheKey = `${source}_${zoom}_${x}_${y}`;
          if (topoTileCache.has(cacheKey)) {
            resolve(topoTileCache.get(cacheKey));
            return;
          }
          tileLoadQueue.push({ source, zoom, x, y, resolve, reject });
          processTileQueue();
        });
      }

      function loadTopoTile(source, zoom, x, y) {
        const cacheKey = `${source}_${zoom}_${x}_${y}`;
        if (topoTileCache.has(cacheKey)) {
          return Promise.resolve(topoTileCache.get(cacheKey));
        }
        return new Promise((resolve, reject) => {
          const loader = new THREE.TextureLoader();
          loader.setCrossOrigin("anonymous");
          const url = source.url(zoom, x, y);
          loader.load(
            url,
            (texture) => {
              texture.colorSpace = THREE.SRGBColorSpace;
              texture.wrapS = THREE.ClampToEdgeWrapping;
              texture.wrapT = THREE.ClampToEdgeWrapping;
              texture.minFilter = THREE.LinearMipmapLinearFilter;
              texture.magFilter = THREE.LinearFilter;
              topoTileCache.set(cacheKey, texture);
              if (topoTileCache.size > 100) {
                const firstKey = topoTileCache.keys().next().value;
                const oldTex = topoTileCache.get(firstKey);
                oldTex.dispose();
                topoTileCache.delete(firstKey);
              }
              resolve(texture);
            },
            undefined,
            (error) => reject(error)
          );
        });
      }

      function buildEnhancedContours(grid, GS, cellSize, halfSize, minE, range, exag, labelInterval = 100) {
        if (contourLineGroup) {
          contourLineGroup.traverse(c => {
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
          });
          scene.remove(contourLineGroup);
        }
        
        const majorInterval = Math.max(50, Math.round(range / 15));
        const minorInterval = majorInterval / 5;
        const contourGroup = new THREE.Group();
        contourGroup.renderOrder = 5;
        const labelPoints = [];
        
        const maxElevation = minE + range;
        const levels = [];
        for (let level = 0; level < Math.ceil(range / minorInterval); level++) {
          const targetElev = minE + (level + 1) * minorInterval;
          if (targetElev > maxElevation) break;
          const isMajor = Math.round(targetElev) % labelInterval < minorInterval;
          const isIndex = Math.round(targetElev) % (labelInterval * 5) < minorInterval;
          levels.push({ targetElev, isMajor, isIndex });
        }
        
        let currentLevelIndex = 0;
        const CHUNK_SIZE = 500;
        
        function processContourChunk(startRow, endRow, targetElev, isMajor) {
          const segments = [];
          const elevationLabels = [];
          
          for (let i = startRow; i < endRow; i++) {
            for (let j = 0; j < GS - 1; j++) {
              const e00 = grid[i][j];
              const e10 = grid[i][j + 1];
              const e01 = grid[i + 1][j];
              const e11 = grid[i + 1][j + 1];
              
              const x0 = j * cellSize - halfSize;
              const x1 = (j + 1) * cellSize - halfSize;
              const z0 = -(i * cellSize - halfSize);
              const z1 = -((i + 1) * cellSize - halfSize);
              
              const corners = [
                { x: x0, z: z0, e: e00 },
                { x: x1, z: z0, e: e10 },
                { x: x1, z: z1, e: e11 },
                { x: x0, z: z1, e: e01 }
              ];
              
              const edges = [
                [corners[0], corners[1]],
                [corners[1], corners[2]],
                [corners[2], corners[3]],
                [corners[3], corners[0]]
              ];
              
              const crossings = [];
              for (const [p1, p2] of edges) {
                if (Math.abs(p2.e - p1.e) > 0.0001) {
                  const t = (targetElev - p1.e) / (p2.e - p1.e);
                  if (t >= 0 && t <= 1) {
                    crossings.push({
                      x: p1.x + (p2.x - p1.x) * t,
                      z: p1.z + (p2.z - p1.z) * t
                    });
                  }
                }
              }
              
              if (crossings.length >= 2) {
                const y = (targetElev - minE) * SCALE * exag + 0.12;
                segments.push(
                  new THREE.Vector3(crossings[0].x, y, crossings[0].z),
                  new THREE.Vector3(crossings[1].x, y, crossings[1].z)
                );
                if (isMajor && crossings.length >= 4) {
                  const midX = (crossings[0].x + crossings[1].x + crossings[2].x + crossings[3].x) / 4;
                  const midZ = (crossings[0].z + crossings[1].z + crossings[2].z + crossings[3].z) / 4;
                  elevationLabels.push({ x: midX, z: midZ, y, elev: targetElev });
                }
              }
            }
          }
          
          if (segments.length > 0) {
            const geom = new THREE.BufferGeometry().setFromPoints(segments);
            const isIndexLine = isMajor && labelPoints.length % 3 === 0;
            const lineColor = isIndexLine ? 0x3d2b1f : (isMajor ? 0x5c4b3b : 0x7a6b5a);
            const lineOpacity = isIndexLine ? 0.92 : (isMajor ? 0.78 : 0.40);
            
            const mat = new THREE.LineBasicMaterial({
              color: lineColor,
              transparent: true,
              opacity: lineOpacity,
              depthWrite: false,
            });
            
            const lines = new THREE.LineSegments(geom, mat);
            lines.renderOrder = 5;
            lines.userData.isIndex = isIndexLine;
            lines.userData.isMajor = isMajor;
            contourGroup.add(lines);
          }
          
          return elevationLabels;
        }
        
        function processNextLevel() {
          if (currentLevelIndex >= levels.length) {
            scene.add(contourGroup);
            contourLineGroup = contourGroup;
            enhancedContourLabels = labelPoints;
            console.log('[Contours] Enhanced rendering complete -', levels.length, 'levels,', labelPoints.length, 'labels');
            return;
          }
          
          const { targetElev, isMajor, isIndex } = levels[currentLevelIndex];
          currentLevelIndex++;
          
          let row = 0;
          function processChunk() {
            const endRow = Math.min(row + CHUNK_SIZE, GS - 1);
            const labels = processContourChunk(row, endRow, targetElev, isMajor);
            if (isMajor) labelPoints.push(...labels);
            row = endRow;
            
            if (row < GS - 1) {
              requestAnimationFrame(processChunk);
            } else {
              requestAnimationFrame(processNextLevel);
            }
          }
          
          processChunk();
        }
        
        processNextLevel();
      }

      function buildRoadsFromOSM(roadsData) {
        if (roadsGroup) {
          roadsGroup.traverse(c => {
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
          });
          scene.remove(roadsGroup);
        }
        
        roadsGroup = new THREE.Group();
        roadsGroup.renderOrder = 6;
        
        const roadStyles = {
          highway: { 
            color: 0xd4a03a, width: 4.0, opacity: 0.95, glow: true,
            shoulderColor: 0xb8892e, shoulderWidth: 5.5
          },
          primary: { 
            color: 0xe8b84a, width: 3.2, opacity: 0.90, glow: false,
            shoulderColor: 0xc8a03a, shoulderWidth: 4.2
          },
          secondary: { 
            color: 0xf0d878, width: 2.5, opacity: 0.85, glow: false,
            shoulderColor: 0xd8c060, shoulderWidth: 3.2
          },
          tertiary: { 
            color: 0xf5e0a0, width: 1.8, opacity: 0.80, glow: false,
            shoulderColor: 0xe0c888, shoulderWidth: 2.4
          },
          local: { 
            color: 0xd4c4a4, width: 1.2, opacity: 0.75, glow: false,
            shoulderColor: 0xc0b490, shoulderWidth: 1.6
          },
          residential: { 
            color: 0xe8e0c8, width: 1.0, opacity: 0.70, glow: false,
            shoulderColor: 0xd8d0b8, shoulderWidth: 1.4
          },
          path: { 
            color: 0x7a5a3a, width: 0.5, opacity: 0.65, dashed: true,
            dashSize: 1.2, gapSize: 0.6
          },
          track: { 
            color: 0x8b6a45, width: 0.8, opacity: 0.70, dashed: true,
            dashSize: 1.5, gapSize: 0.8
          },
          footway: { 
            color: 0x6b4a30, width: 0.4, opacity: 0.60, dashed: true,
            dashSize: 0.8, gapSize: 0.4
          }
        };
        
        for (const [roadType, roads] of Object.entries(roadsData)) {
          const style = roadStyles[roadType] || roadStyles.local;
          
          for (const road of roads || []) {
            if (!road.points || road.points.length < 2) continue;
            
            const points3D = road.points.map(point => {
              const lat = Array.isArray(point) ? point[0] : point.lat;
              const lon = Array.isArray(point) ? point[1] : point.lon;
              const world = latLonToWorld(lat, lon);
              return new THREE.Vector3(world.x, sampleTerrainHeight(world.x, world.z) + 0.06, world.z);
            });
            
            if (points3D.length < 2) continue;
            
            if (style.dashed) {
              const dashSegments = [];
              for (let i = 0; i < points3D.length - 1; i++) {
                if (i % 2 === 0) {
                  dashSegments.push(points3D[i]);
                  dashSegments.push(points3D[i + 1]);
                }
              }
              if (dashSegments.length >= 2) {
                const geom = new THREE.BufferGeometry().setFromPoints(dashSegments);
                const mat = new THREE.LineDashedMaterial({
                  color: style.color,
                  dashSize: style.dashSize || 1.5,
                  gapSize: style.gapSize || 0.8,
                  transparent: true,
                  opacity: style.opacity,
                  depthWrite: false,
                });
                const line = new THREE.Line(geom, mat);
                line.computeLineDistances();
                line.renderOrder = 6;
                roadsGroup.add(line);
              }
            } else {
              if (style.shoulderColor) {
                const shoulderGeom = new THREE.TubeGeometry(
                  new THREE.CatmullRomCurve3(points3D),
                  Math.max(points3D.length * 3, 16),
                  style.shoulderWidth * 0.12,
                  6, false
                );
                const shoulderMat = new THREE.MeshBasicMaterial({
                  color: style.shoulderColor,
                  transparent: true,
                  opacity: style.opacity * 0.6,
                  depthWrite: false,
                });
                const shoulderMesh = new THREE.Mesh(shoulderGeom, shoulderMat);
                shoulderMesh.position.y = -0.02;
                shoulderMesh.renderOrder = 5;
                roadsGroup.add(shoulderMesh);
              }
              
              const curve = new THREE.CatmullRomCurve3(points3D);
              const tubeGeom = new THREE.TubeGeometry(curve, Math.max(points3D.length * 3, 16), style.width * 0.12, 6, false);
              const mat = new THREE.MeshBasicMaterial({
                color: style.color,
                transparent: true,
                opacity: style.opacity,
                depthWrite: false,
              });
              const roadMesh = new THREE.Mesh(tubeGeom, mat);
              roadMesh.renderOrder = 6;
              roadsGroup.add(roadMesh);
              
              if (style.glow) {
                const glowGeom = new THREE.TubeGeometry(curve, Math.max(points3D.length * 2, 12), style.width * 0.18, 6, false);
                const glowMat = new THREE.MeshBasicMaterial({
                  color: style.color,
                  transparent: true,
                  opacity: style.opacity * 0.25,
                  depthWrite: false,
                  blending: THREE.AdditiveBlending,
                });
                const glowMesh = new THREE.Mesh(glowGeom, glowMat);
                glowMesh.position.y = 0.05;
                glowMesh.renderOrder = 5;
                roadsGroup.add(glowMesh);
              }
              
              const lineGeom = new THREE.BufferGeometry().setFromPoints(points3D);
              const lineMat = new THREE.LineBasicMaterial({
                color: style.color,
                transparent: true,
                opacity: style.opacity * 1.1,
                depthWrite: false,
              });
              const centerLine = new THREE.Line(lineGeom, lineMat);
              centerLine.renderOrder = 7;
              roadsGroup.add(centerLine);
            }
          }
        }
        
        scene.add(roadsGroup);
      }

      function buildBoundariesFromOSM(boundaries) {
        if (boundariesGroup) {
          boundariesGroup.traverse(c => {
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
          });
          scene.remove(boundariesGroup);
        }
        
        boundariesGroup = new THREE.Group();
        boundariesGroup.renderOrder = 4;
        
        for (const boundary of boundaries || []) {
          if (!boundary.points || boundary.points.length < 3) continue;
          
          const points3D = boundary.points.map(point => {
            const lat = Array.isArray(point) ? point[0] : point.lat;
            const lon = Array.isArray(point) ? point[1] : point.lon;
            const world = latLonToWorld(lat, lon);
            return new THREE.Vector3(world.x, sampleTerrainHeight(world.x, world.z) + 0.08, world.z);
          });
          
          if (points3D.length < 3) continue;
          
          const curve = new THREE.CatmullRomCurve3(points3D, true);
          const tubeGeom = new THREE.TubeGeometry(curve, Math.max(points3D.length * 2, 32), 0.08, 5, true);
          const mat = new THREE.MeshBasicMaterial({
            color: 0x5a4a3a,
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
          });
          const boundaryMesh = new THREE.Mesh(tubeGeom, mat);
          boundaryMesh.renderOrder = 4;
          boundariesGroup.add(boundaryMesh);
        }
        
        scene.add(boundariesGroup);
      }

      function buildEnhancedLabels(osmData) {
        labels.forEach(lb => lb.el.remove());
        labels = [];
        
        if (!osmData) return;
        
        const { places = [], peaks = [] } = osmData;
        
        for (const place of places.slice(0, 10)) {
          const world = latLonToWorld(place.lat, place.lon);
          const y = sampleTerrainHeight(world.x, world.z) + 3;
          const size = place.type === "city" ? 4 : place.type === "town" ? 3 : 2;
          addLabel(`${place.name}`, new THREE.Vector3(world.x, y, world.z), `place-${place.type}`, size);
        }
        
        for (const peak of peaks.slice(0, 8)) {
          const world = latLonToWorld(peak.lat, peak.lon);
          const y = sampleTerrainHeight(world.x, world.z) + 5;
          const elev = peak.elevation ? `${peak.elevation}m` : "";
          addLabel(`${peak.name} ${elev}`.trim(), new THREE.Vector3(world.x, y, world.z), "peak", 3);
        }
      }

      function toggleTopoMode(enabled) {
        if (terrainShaderMat?.uniforms) {
          terrainShaderMat.uniforms.uTopoMode.value = enabled ? 1.0 : 0.0;
        }
        if (terrainShaderMat?.uniforms.uTopoTexture) {
          terrainShaderMat.uniforms.uTopoTexture.value = enabled ? terrainTopoTexture : null;
        }
      }

      function toggleContours(enabled) {
        if (contourLineGroup) {
          contourLineGroup.visible = enabled;
        }
        updateContourLabelsVisibility(enabled);
      }

      function updateContourLabelsVisibility(visible) {
        for (const lb of labels) {
          if (lb.el.classList.contains("contour-label")) {
            lb.el.style.display = visible ? "" : "none";
          }
        }
      }

      function toggleRoads(enabled) {
        if (roadsGroup) {
          roadsGroup.visible = enabled;
        }
      }

      function toggleLabels(enabled) {
        for (const lb of labels) {
          if (!lb.el.classList.contains("contour-label")) {
            lb.el.style.display = enabled ? "" : "none";
          }
        }
      }

      function updateTerrainLOD() {
        if (!camera || !terrainMesh) return;
        const targetDistance = camera.position.distanceTo(ctrl?.target || new THREE.Vector3(0, 0, 0));
        
        let newLevel = "high";
        if (targetDistance > LOD_DISTANCES.low) newLevel = "low";
        else if (targetDistance > LOD_DISTANCES.medium) newLevel = "medium";
        
        if (newLevel !== terrainDetailLevel) {
          terrainDetailLevel = newLevel;
          
          const settings = PERFORMANCE.QUALITY_LEVELS[PERFORMANCE.currentLevel];
          const tileOpacity = settings.tileOpacity;
          
          if (contourLineGroup) {
            const contourOpacity = newLevel === "high" ? 0.85 : newLevel === "medium" ? 0.5 : 0.2;
            contourLineGroup.traverse(child => {
              if (child.material) {
                child.material.opacity = child.material.opacity * (newLevel === "high" ? 1.2 : 0.6);
              }
            });
          }
          
          if (roadsGroup) {
            roadsGroup.visible = newLevel !== "low";
            roadsGroup.traverse(child => {
              if (child.material && child.material.opacity !== undefined) {
                child.material.opacity = newLevel === "high" ? child.material.opacity : child.material.opacity * 0.6;
              }
            });
          }
          
          if (mapTileGroup) {
            mapTileGroup.traverse(child => {
              if (child.material && child.material.opacity !== undefined) {
                child.material.opacity = tileOpacity;
              }
            });
          }
          
          if (terrainShaderMat?.uniforms) {
            const hillshadeStrength = newLevel === "high" ? 1.5 : newLevel === "medium" ? 1.2 : 0.8;
            terrainShaderMat.uniforms.uHillshadeStrength.value = hillshadeStrength;
          }
        }
        
        if (PERFORMANCE.enableFrustumCulling) {
          updateFrustumCulling();
        }
      }
      
      const _frustum = new THREE.Frustum();
      const _projScreenMatrix = new THREE.Matrix4();
      
      function updateFrustumCulling() {
        if (!camera || !renderer) return;
        
        _projScreenMatrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
        _frustum.setFromProjectionMatrix(_projScreenMatrix);
        
        if (riverGroup) {
          riverGroup.visible = true;
        }
        if (lakeGroup) {
          lakeGroup.visible = true;
        }
        if (contourLineGroup) {
          const camPos = camera.position;
          const distanceFromCenter = Math.sqrt(camPos.x * camPos.x + camPos.z * camPos.z);
          contourLineGroup.visible = distanceFromCenter < 200;
        }
      }

      class EnhancedTerrainMaterial {
        constructor() {
          this.uniforms = {
            uElevationRamp: { value: null },
            uHillshade: { value: null },
            uSlopeMap: { value: null },
            uFlowMap: { value: null },
            uTopoTexture: { value: null },
            uWetnessMap: { value: null },
            uSunDirection: { value: new THREE.Vector3(-0.3, 1, -0.2).normalize() },
            uSunColor: { value: new THREE.Color("#fff9f0") },
            uAmbientStrength: { value: 0.30 },
            uTime: { value: 0 },
            uFogDensity: { value: 0.002 },
            uFogColor: { value: new THREE.Color("#c8d8e4") },
            uHeightScale: { value: 40 },
            uTopoMode: { value: 1.0 },
            uTopoOpacity: { value: 0.7 },
            uHillshadeStrength: { value: 1.5 },
            uShowFlow: { value: 0.0 },
          };
        }
        
        createMaterial(elevationRamp, wetnessMap) {
          this.uniforms.uElevationRamp.value = elevationRamp;
          this.uniforms.uWetnessMap.value = wetnessMap;
          
          return new THREE.ShaderMaterial({
            uniforms: this.uniforms,
            vertexShader: `
              uniform float uHeightScale;
              varying float vElevation;
              varying vec3 vNormalWorld;
              varying vec3 vWorldPos;
              varying vec2 vUv;
              varying float vSlope;
              
              void main() {
                vElevation = clamp(position.y / max(uHeightScale, 0.0001), 0.0, 1.0);
                vNormalWorld = normalize(normalMatrix * normal);
                vec4 worldPos = modelMatrix * vec4(position, 1.0);
                vWorldPos = worldPos.xyz;
                vUv = uv;
                vSlope = 1.0 - abs(dot(vNormalWorld, vec3(0.0, 1.0, 0.0)));
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `,
            fragmentShader: `
              precision highp float;
              
              uniform sampler2D uElevationRamp;
              uniform sampler2D uHillshade;
              uniform sampler2D uSlopeMap;
              uniform sampler2D uFlowMap;
              uniform sampler2D uWetnessMap;
              uniform vec3 uSunDirection;
              uniform vec3 uSunColor;
              uniform vec3 uFogColor;
              uniform float uAmbientStrength;
              uniform float uTime;
              uniform float uShowFlow;
              uniform float uFogDensity;
              uniform float uHillshadeStrength;
              
              varying float vElevation;
              varying vec3 vNormalWorld;
              varying vec3 vWorldPos;
              varying vec2 vUv;
              varying float vSlope;
              
              float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
              }
              
              float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                return mix(
                  mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                  mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
                  f.y
                );
              }
              
              void main() {
                vec4 rampColor = texture2D(uElevationRamp, vec2(vElevation, 0.5));
                
                float hillshade = 0.20 + 0.80 * texture2D(uHillshade, vUv).r;
                
                vec3 baseColor = rampColor.rgb;
                
                float elevationBoost = 1.0 + pow(vElevation, 0.5) * 0.6;
                baseColor *= elevationBoost;
                
                float diff = max(dot(vNormalWorld, normalize(uSunDirection)), 0.0);
                float diffWrap = max(dot(vNormalWorld, normalize(uSunDirection)) * 0.5 + 0.5, 0.0);
                
                float ao = 0.35 + 0.65 * (1.0 - vSlope * 0.75) * pow(vElevation, 0.35);
                float wetness = texture2D(uWetnessMap, vUv).r;
                
                vec3 wetColor = mix(baseColor, vec3(0.08, 0.22, 0.28), wetness * 0.75);
                
                vec3 viewDir = normalize(cameraPosition - vWorldPos);
                vec3 halfDir = normalize(normalize(uSunDirection) + viewDir);
                float spec = pow(max(dot(vNormalWorld, halfDir), 0.0), 48.0);
                vec3 specular = uSunColor * spec * wetness * 0.35;
                
                float shimmer = sin(uTime * 2.0 + vWorldPos.x * 0.5 + vWorldPos.z * 0.3) * 0.02 * wetness;
                
                vec3 ambient = uAmbientStrength * ao * wetColor;
                vec3 diffuse = diff * uSunColor * wetColor * hillshade * uHillshadeStrength;
                vec3 diffuseWrap = diffWrap * uSunColor * wetColor * 0.15;
                
                float microDetail = noise(vWorldPos.xz * 8.0) * 0.04 - 0.02;
                float macroDetail = noise(vWorldPos.xz * 2.0) * 0.06 - 0.03;
                float microNoise = microDetail + macroDetail;
                vec3 finalColor = ambient + diffuse + diffuseWrap + specular + shimmer + microNoise;
                
                float slopeRock = smoothstep(0.10, 0.40, vSlope);
                float slopeScree = smoothstep(0.35, 0.65, vSlope);
                float slopeCliff = smoothstep(0.60, 0.85, vSlope);
                
                vec3 grassColor = vec3(0.35, 0.50, 0.28);
                vec3 rockColor = vec3(0.52, 0.46, 0.40);
                vec3 screeColor = vec3(0.58, 0.54, 0.48);
                vec3 cliffColor = vec3(0.42, 0.38, 0.34);
                
                vec3 terrainType = mix(grassColor, rockColor, slopeRock * 0.6);
                terrainType = mix(terrainType, screeColor, slopeScree * 0.5);
                terrainType = mix(terrainType, cliffColor, slopeCliff * 0.6);
                
                finalColor = mix(finalColor, terrainType * baseColor, slopeRock * 0.5);
                
                float heightBlend = smoothstep(0.0, 0.15, vElevation) * smoothstep(0.85, 0.95, vElevation);
                finalColor = mix(finalColor, finalColor * 1.1, heightBlend);
                
                if (uShowFlow > 0.5) {
                  vec4 flowData = texture2D(uFlowMap, vUv);
                  float flowIntensity = flowData.a / 255.0;
                  vec3 flowColor = vec3(0.15, 0.45, 0.85);
                  finalColor = mix(finalColor, flowColor, flowIntensity * 0.55);
                }
                
                float dist = length(cameraPosition - vWorldPos);
                float fogFactor = 1.0 - exp(-uFogDensity * dist * dist);
                finalColor = mix(finalColor, uFogColor, clamp(fogFactor, 0.0, 1.0));
                
                gl_FragColor = vec4(finalColor, 1.0);
              }
            `,
            transparent: false,
            depthWrite: true,
          });
        }
      }

      const enhancedTerrainMaterial = new EnhancedTerrainMaterial();

      class TerrainWorkerManager {
        constructor() {
          this.worker = null;
          this.pendingCallbacks = new Map();
          this.callbackId = 0;
          this.init();
        }

        init() {
          const workerCode = `
            self.onmessage = function(e) {
              const { type, id, data } = e.data;
              
              if (type === 'generateTerrain') {
                const result = this.generateTerrain(data);
                self.postMessage({ type: 'terrainResult', id, data: result });
              } else if (type === 'computeFlowAccumulation') {
                const result = this.computeFlowAccumulation(data);
                self.postMessage({ type: 'flowResult', id, data: result });
              } else if (type === 'computeHillshade') {
                const result = this.computeHillshade(data);
                self.postMessage({ type: 'hillshadeResult', id, data: result });
              }
            };

            this.generateTerrain = function(data) {
              const { gridSize, minE, maxE } = data;
              const range = maxE - minE;
              const grid = [];
              
              for (let i = 0; i < gridSize; i++) {
                const row = [];
                for (let j = 0; j < gridSize; j++) {
                  const nx = j / (gridSize - 1);
                  const nz = i / (gridSize - 1);
                  const height = Math.sin(nx * Math.PI * 2) * Math.cos(nz * Math.PI * 2) * 30 
                               + Math.sin(nx * Math.PI * 4 + 1) * 20
                               + Math.cos(nz * Math.PI * 3 + 0.5) * 15
                               + 30;
                  row.push(height);
                }
                grid.push(row);
              }
              
              return grid;
            };

            this.computeFlowAccumulation = function(data) {
              const { grid } = data;
              const size = grid.length;
              const flow = new Float32Array(size * size);
              
              for (let i = 0; i < size; i++) {
                for (let j = 0; j < size; j++) {
                  const idx = i * size + j;
                  let maxSlope = 0;
                  let weight = 1;
                  
                  for (let di = -1; di <= 1; di++) {
                    for (let dj = -1; dj <= 1; dj++) {
                      if (di === 0 && dj === 0) continue;
                      const ni = i + di;
                      const nj = j + dj;
                      if (ni < 0 || ni >= size || nj < 0 || nj >= size) continue;
                      
                      const slope = (grid[i][j] - grid[ni][nj]) / Math.sqrt(di * di + dj * dj);
                      if (slope > maxSlope) {
                        maxSlope = slope;
                        weight = 1;
                      }
                    }
                  }
                  
                  flow[idx] = weight;
                }
              }
              
              return Array.from(flow);
            };

            this.computeHillshade = function(data) {
              const { grid, azimuth, altitude } = data;
              const size = grid.length;
              const hillshade = new Float32Array(size * size);
              
              const zenithRad = azimuth * Math.PI / 180;
              const azimuthRad = altitude * Math.PI / 180;
              
              for (let i = 1; i < size - 1; i++) {
                for (let j = 1; j < size - 1; j++) {
                  const dzdx = ((grid[i][j + 1] - grid[i][j - 1]) / 2);
                  const dzdy = ((grid[i + 1][j] - grid[i - 1][j]) / 2);
                  
                  const slope = Math.atan(Math.sqrt(dzdx * dzdx + dzdy * dzdy));
                  const aspect = Math.atan2(dzdy, -dzdx);
                  
                  const hill = Math.cos(zenithRad) * Math.cos(slope) +
                              Math.sin(zenithRad) * Math.sin(slope) * Math.cos(azimuthRad - aspect);
                  
                  hillshade[i * size + j] = Math.max(0, hill);
                }
              }
              
              return Array.from(hillshade);
            };
          `;
          
          try {
            const blob = new Blob([workerCode], { type: 'application/javascript' });
            const url = URL.createObjectURL(blob);
            this.worker = new Worker(url);
            
            this.worker.onmessage = (e) => {
              const { type, id, data } = e.data;
              const callback = this.pendingCallbacks.get(id);
              if (callback) {
                callback(data);
                this.pendingCallbacks.delete(id);
              }
            };
            
            this.worker.onerror = (err) => {
              console.warn('[TerrainWorker] Error:', err.message);
            };
          } catch (e) {
            console.warn('[TerrainWorker] Web Worker not available, using main thread');
            this.worker = null;
          }
        }

        generateTerrain(gridSize, minE, maxE) {
          return new Promise((resolve) => {
            if (!this.worker) {
              const grid = [];
              const range = maxE - minE;
              for (let i = 0; i < gridSize; i++) {
                const row = [];
                for (let j = 0; j < gridSize; j++) {
                  const nx = j / (gridSize - 1);
                  const nz = i / (gridSize - 1);
                  const height = Math.sin(nx * Math.PI * 2) * Math.cos(nz * Math.PI * 2) * 30 
                               + Math.sin(nx * Math.PI * 4 + 1) * 20
                               + Math.cos(nz * Math.PI * 3 + 0.5) * 15
                               + 30;
                  row.push(height);
                }
                grid.push(row);
              }
              resolve(grid);
              return;
            }
            
            const id = ++this.callbackId;
            this.pendingCallbacks.set(id, resolve);
            this.worker.postMessage({
              type: 'generateTerrain',
              id,
              data: { gridSize, minE, maxE }
            });
            
            setTimeout(() => {
              if (this.pendingCallbacks.has(id)) {
                this.pendingCallbacks.delete(id);
                resolve(null);
              }
            }, 5000);
          });
        }

        terminate() {
          if (this.worker) {
            this.worker.terminate();
            this.worker = null;
          }
        }
      }

      const terrainWorker = new TerrainWorkerManager();

      class ProgressiveLoader {
        constructor() {
          this.phase = 0;
          this.terrainLoaded = false;
          this.weatherLoaded = false;
          this.waterLoaded = false;
          this.systemsInitialized = false;
          this.heavySystemsLoaded = false;
          this.loadingState = 'idle';
          this.qualityLevel = this.detectPerformance();
          this.cache = new APICache();
          this.pendingRequests = [];
        }

        detectPerformance() {
          const canvas = document.createElement('canvas');
          const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
          let rendererInfo = 'unknown';
          
          if (gl) {
            const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
            if (debugInfo) {
              rendererInfo = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
            }
          }
          
          const isLowEnd = /Intel|Mali-4|Adreno 3|PowerVR|Apple A[789]|SwiftShader/i.test(rendererInfo);
          const isHighEnd = /NVIDIA|AMD|Radeon RX|RTX|GeForce GTX/i.test(rendererInfo);
          
          const memory = navigator.deviceMemory || 4;
          const cores = navigator.hardwareConcurrency || 4;
          
          if (isLowEnd || memory < 4 || cores <= 2) return 'LOW';
          if (isHighEnd && memory >= 8 && cores >= 8) return 'HIGH';
          return 'MEDIUM';
        }

        getTerrainResolution() {
          switch (this.qualityLevel) {
            case 'LOW': return 16;
            case 'HIGH': return 64;
            default: return 32;
          }
        }

        async fetchWithTimeout(url, options = {}, timeout = 5000) {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);
          
          try {
            const response = await fetch(url, {
              ...options,
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            return await response.json();
          } catch (error) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
              console.warn(`[ProgressiveLoader] Request timeout: ${url}`);
            }
            throw error;
          }
        }

        async fetchAPIData(endpoint, payload, useCache = true) {
          const cacheKey = `${endpoint}_${JSON.stringify(payload)}`;
          
          if (useCache) {
            const cached = this.cache.get(cacheKey);
            if (cached) {
              console.log(`[ProgressiveLoader] Cache hit for ${endpoint}`);
              return cached;
            }
          }
          
          try {
            const data = await this.fetchWithTimeout(endpoint, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            }, 8000);
            
            if (useCache) {
              this.cache.set(cacheKey, data);
            }
            return data;
          } catch (error) {
            console.warn(`[ProgressiveLoader] API error for ${endpoint}:`, error.message);
            return null;
          }
        }

        async loadTerrainPhase1() {
          this.loadingState = 'phase1';
          updateLoadingProgress(10);
          
          const demoN = this.getTerrainResolution();
          const demoElevations = [];
          for (let i = 0; i < demoN; i++) {
            const row = [];
            for (let j = 0; j < demoN; j++) {
              const nx = j / (demoN - 1);
              const nz = i / (demoN - 1);
              const height = Math.sin(nx * Math.PI * 2) * Math.cos(nz * Math.PI * 2) * 30 
                           + Math.sin(nx * Math.PI * 4 + 1) * 20
                           + Math.cos(nz * Math.PI * 3 + 0.5) * 15;
              row.push(height + 30);
            }
            demoElevations.push(row);
          }
          
          return {
            elevations: demoElevations,
            min_elev: 0,
            max_elev: 75,
            lat_min: 0,
            lat_max: 0.1,
            lon_min: 0,
            lon_max: 0.1,
            grid_size: demoN
          };
        }

        async loadTerrainPhase2(city, lat, lon) {
          updateLoadingProgress(30);
          console.log('[ProgressiveLoader] Starting terrain load...');
          
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Request timeout')), 30000);
          });
          
          try {
            const payload = {
              city,
              lat: lat ? Number(lat) : null,
              lon: lon ? Number(lon) : null,
              high_res: false,
              terrain_resolution: this.getTerrainResolution()
            };
            console.log('[ProgressiveLoader] Payload:', payload);
            
            updateLoadingProgress(35);
            console.log('[ProgressiveLoader] Fetching from /api/geodata...');
            
            const fetchPromise = this.fetchAPIData('/api/geodata', payload, false);
            const data = await Promise.race([fetchPromise, timeoutPromise]);
            
            console.log('[ProgressiveLoader] Received data:', data ? 'OK' : 'null');
            return data;
          } catch (error) {
            console.error('[ProgressiveLoader] Terrain load error:', error);
            return null;
          }
        }

        async loadWeatherParallel(weatherEndpoint) {
          updateLoadingProgress(50);
          
          try {
            const payload = {
              city: document.getElementById('city').value || null,
              lat: document.getElementById('lat').value ? Number(document.getElementById('lat').value) : null,
              lon: document.getElementById('lon').value ? Number(document.getElementById('lon').value) : null,
            };
            
            const [weatherResult] = await Promise.all([
              this.fetchAPIData(weatherEndpoint, payload).catch(() => null)
            ]);
            
            return weatherResult;
          } catch (error) {
            console.warn('[ProgressiveLoader] Weather load failed');
            return null;
          }
        }

        initializeDeferredSystems() {
          if (this.systemsInitialized) return;
          this.systemsInitialized = true;
          
          console.log('[ProgressiveLoader] Initializing deferred systems');
          
          if (!sceneState.cloudSystem) {
            sceneState.cloudSystem = new AquaCloudSystem(scene);
          }
          if (!sceneState.rainSystem) {
            sceneState.rainSystem = new AquaRainSystem(scene);
          }
          if (!sceneState.windSystem) {
            sceneState.windSystem = new AquaWindParticleSystem(scene);
          }
          if (!sceneState.lightningSystem) {
            sceneState.lightningSystem = new AquaLightningSystem(scene, sceneState.sunSystem?.sunLight);
          }
          
          rainSystemAdvanced = sceneState.rainSystem;
          cloudSystem = sceneState.cloudSystem;
          lightningSystem = sceneState.lightningSystem;
        }

        loadHeavySystems() {
          if (this.heavySystemsLoaded) return Promise.resolve();
          this.heavySystemsLoaded = true;
          
          console.log('[ProgressiveLoader] Loading heavy systems (clouds, rain, wind)');
          updateLoadingProgress(85);
          
          return new Promise((resolve) => {
            setTimeout(() => {
              if (sceneState.cloudSystem) {
                sceneState.cloudSystem.setWeather(sceneState.cloudCover || 50, 5, 180);
              }
              if (sceneState.rainSystem) {
                sceneState.rainSystem.setWeather(sceneState.isRaining ? 0.5 : 0, 5, 180);
              }
              if (sceneState.windSystem) {
                sceneState.windSystem.setWind(5, 180);
              }
              updateLoadingProgress(100);
              resolve();
            }, 100);
          });
        }

        updateWeatherFromTimeline(current) {
          if (this.heavySystemsLoaded && sceneState.cloudSystem) {
            sceneState.cloudSystem.setWeather(
              current.cloudCover || sceneState.cloudCover || 50,
              current.windSpeed || 5,
              current.windDir || 180
            );
          }
          if (this.heavySystemsLoaded && sceneState.rainSystem) {
            sceneState.rainSystem.setWeather(
              current.precipitation || 0,
              current.windSpeed || 5,
              current.windDir || 180
            );
          }
          if (this.heavySystemsLoaded && sceneState.windSystem) {
            sceneState.windSystem.setWind(current.windSpeed || 5, current.windDir || 180);
          }
        }

        loadRadarOnDemand(lat, lon) {
          const radarToggle = document.getElementById('radar-toggle');
          if (radarToggle && radarToggle.checked) {
            return initializeRainRadar(lat, lon);
          }
          return Promise.resolve();
        }
      }

      class APICache {
        constructor() {
          this.storageKey = 'wha_api_cache';
          this.ttl = 30 * 60 * 1000;
          this.loadCache();
        }

        loadCache() {
          try {
            const cached = localStorage.getItem(this.storageKey);
            if (cached) {
              this.data = JSON.parse(cached);
              this.cleanExpired();
            } else {
              this.data = {};
            }
          } catch (e) {
            this.data = {};
          }
        }

        saveCache() {
          try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.data));
          } catch (e) {
            console.warn('[APICache] Failed to save cache');
          }
        }

        cleanExpired() {
          const now = Date.now();
          for (const key in this.data) {
            if (this.data[key].expires < now) {
              delete this.data[key];
            }
          }
        }

        get(key) {
          const item = this.data[key];
          if (!item) return null;
          if (item.expires < Date.now()) {
            delete this.data[key];
            return null;
          }
          return item.data;
        }

        set(key, data) {
          this.data[key] = {
            data,
            expires: Date.now() + this.ttl
          };
          this.saveCache();
        }

        clear() {
          this.data = {};
          localStorage.removeItem(this.storageKey);
        }
      }

      const progressiveLoader = new ProgressiveLoader();

      class AquaWeatherTimelineController {
        constructor() {
          this.forecast = [];
          this.currentHourIndex = 0;
          this.isPlaying = false;
          this.playbackSpeed = 4;
          this.lastUpdate = performance.now();
          this.lastAppliedHour = -1;
        }
        setForecast(wx) {
          const current = normalizeWeatherSnapshot(wx?.current || wx || {});
          const daily = Array.isArray(wx?.forecast) ? wx.forecast : [];
          this.forecast = [];
          for (let h = 0; h < 168; h++) {
            const day = daily[Math.floor(h / 24)] || {};
            this.forecast.push({
              precipitation: ((day.rain ?? day.precipitation ?? current.precipitation * 4) || 0) / 24,
              cloud_cover: current.cloudCover,
              wind_speed_10m: current.windSpeed,
              wind_direction_10m: current.windDir,
              relative_humidity_2m: current.humidity,
              temperature_2m: current.temperature,
              weather_code: current.weatherCode,
              hour: h % 24,
            });
          }
          this.currentHourIndex = 0;
          this.lastAppliedHour = -1;
          this.renderPreview(daily);
          this.applyNow();
        }
        renderPreview(daily) {
          const root = document.getElementById("forecast-preview");
          root.innerHTML = "";
          for (let i = 0; i < Math.min(7, daily.length); i++) {
            const day = daily[i];
            const el = document.createElement("div");
            el.className = "mini";
            el.textContent = `D${i + 1} ${Math.round(day.rain || day.precipitation || 0)}mm`;
            root.appendChild(el);
          }
        }
        getCurrentWeather() {
          return this.forecast[Math.floor(this.currentHourIndex)] || {
            precipitation: 0,
            cloud_cover: 0,
            wind_speed_10m: 5,
            wind_direction_10m: 180,
            relative_humidity_2m: 60,
            temperature_2m: 25,
            weather_code: 0,
            hour: 12,
          };
        }
        applyNow() {
          const weather = this.getCurrentWeather();
          sceneState.currentHour = weather.hour ?? Math.floor(this.currentHourIndex % 24);
          sceneState.cloudCover = weather.cloud_cover || 0;
          sceneState.isRaining = (weather.precipitation || 0) > 0.05;
          progressiveLoader.updateWeatherFromTimeline(weather);
          if (sceneState.lightningSystem) sceneState.lightningSystem.setActive([95, 96, 99].includes(weather.weather_code || 0));
          if (waterFlowSimulator) waterFlowSimulator.addRainfall(weather.precipitation);
          if (weatherLayerManager) weatherLayerManager.update(weather);
          updateFog(scene, weather.weather_code || 0, sceneState.isRaining, weather.precipitation || 0, weather.cloud_cover || 0);
          this.updateDisplay();
          this.lastAppliedHour = Math.floor(this.currentHourIndex);
        }
        update(now) {
          const dt = (now - this.lastUpdate) / 1000;
          this.lastUpdate = now;
          if (!this.isPlaying) return;
          this.currentHourIndex += dt * this.playbackSpeed;
          if (this.currentHourIndex >= 168) this.currentHourIndex = 0;
          const currentHour = Math.floor(this.currentHourIndex);
          if (currentHour !== this.lastAppliedHour) this.applyNow();
          document.getElementById("time-scrubber").value = String(currentHour);
        }
        updateDisplay() {
          const day = Math.floor(this.currentHourIndex / 24) + 1;
          const hour = Math.floor(this.currentHourIndex % 24);
          document.getElementById("current-time-display").textContent = `Day ${day}, ${String(hour).padStart(2, "0")}:00`;
        }
        togglePlayPause() {
          this.isPlaying = !this.isPlaying;
          document.getElementById("timeline-play-pause").textContent = this.isPlaying ? "Pause" : "Play";
        }
        scrubTo(value) {
          this.currentHourIndex = Number(value) || 0;
          this.isPlaying = false;
          document.getElementById("timeline-play-pause").textContent = "Play";
          this.applyNow();
        }
      }

      // ============================================
      // RAINVIEWER INTEGRATION
      // Purpose: Live rain radar overlay
      // Updates: Every 10 minutes automatically
      // API Docs: https://www.rainviewer.com/api.html
      // ============================================
      class LiveRainRadar {
        constructor(sceneRef, cameraRef) {
          this.scene = sceneRef;
          this.camera = cameraRef;
          this.latitude = 0;
          this.longitude = 0;
          this.host = "";
          this.frames = [];
          this.radarMesh = null;
          this.textureCache = new Map();
          this.currentFrameIndex = 0;
          this.isPlaying = false;
          this.animationInterval = null;
          this.lastUpdate = 0;
          this.lastRenderTime = 0;
          this.updateFrequency = 600000;
          this.minFrameStep = 100;
          this.zoom = 10;
          this.isRefreshing = false;
        }

        async initialize(latitude, longitude, terrainSize) {
          this.latitude = latitude;
          this.longitude = longitude;
          const loaded = await this.fetchRadarFrames();
          if (!loaded || !this.frames.length) return false;
          this.createRadarMesh(terrainSize);
          await this.loadFrameTexture(0);
          this.preloadFrameTexture(1);
          this.setVisible(document.getElementById("radar-toggle").checked);
          return true;
        }

        async fetchRadarFrames() {
          if (this.isRefreshing) return this.frames.length > 0;
          this.isRefreshing = true;
          try {
            const response = await fetch("https://api.rainviewer.com/public/weather-maps.json");
            if (!response.ok) {
              throw new Error(`RainViewer API error: ${response.status}`);
            }

            const data = await response.json();
            this.host = String(data.host || "").replace(/^https?:\/\//, "");
            this.frames = [...(data.radar?.past || []), ...(data.radar?.nowcast || [])];
            this.lastUpdate = Date.now();
            this.currentFrameIndex = 0;

            for (const texture of this.textureCache.values()) {
              texture.dispose();
            }
            this.textureCache.clear();

            updateRadarStatus(`Loaded ${this.frames.length} radar frames.`, true);
            return this.frames.length > 0;
          } catch (error) {
            console.error("RainViewer fetch failed:", error);
            this.frames = [];
            updateRadarStatus("Radar frames unavailable right now.", false);
            return false;
          } finally {
            this.isRefreshing = false;
          }
        }

        getTileCoordinates(lat, lon, zoom) {
          const latRad = lat * Math.PI / 180;
          const n = Math.pow(2, zoom);
          const x = Math.floor((lon + 180) / 360 * n);
          const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
          return { x, y };
        }

        getRadarTileURL(frame, lat, lon, zoom = this.zoom) {
          if (!frame || !this.host) return null;
          const { x, y } = this.getTileCoordinates(lat, lon, zoom);
          return `https://${this.host}${frame.path}/${zoom}/${x}/${y}/2/1_1.png`;
        }

        createRadarMesh(terrainSize) {
          if (!terrainGrid || !terrainGS) return;
          if (this.radarMesh) this.disposeMesh();

          const size = terrainSize || terrainCellSize * (terrainGS - 1);
          const geometry = new THREE.PlaneGeometry(size, size, 32, 32);
          geometry.rotateX(-Math.PI / 2);
          const positions = geometry.attributes.position;
          for (let index = 0; index < positions.count; index++) {
            const x = positions.getX(index);
            const z = positions.getZ(index);
            positions.setY(index, getTerrainY(x, z) + 2);
          }
          positions.needsUpdate = true;
          geometry.computeVertexNormals();

          const material = new THREE.MeshBasicMaterial({
            color: 0xffffff,
            transparent: true,
            opacity: 0.68,
            depthWrite: false,
            side: THREE.DoubleSide,
          });

          this.radarMesh = new THREE.Mesh(geometry, material);
          this.radarMesh.renderOrder = 12;
          this.scene.add(this.radarMesh);
        }

        async loadFrameTexture(frameIndex) {
          const frame = this.frames[frameIndex];
          if (!frame || !this.radarMesh) return null;

          const url = this.getRadarTileURL(frame, this.latitude, this.longitude);
          if (!url) return null;
          if (this.textureCache.has(url)) {
            this.applyTexture(this.textureCache.get(url));
            return this.textureCache.get(url);
          }

          return new Promise((resolve) => {
            const loader = new THREE.TextureLoader();
            loader.load(
              url,
              (texture) => {
                texture.colorSpace = THREE.SRGBColorSpace;
                texture.wrapS = THREE.ClampToEdgeWrapping;
                texture.wrapT = THREE.ClampToEdgeWrapping;
                this.textureCache.set(url, texture);
                this.applyTexture(texture);
                resolve(texture);
              },
              undefined,
              (error) => {
                console.warn("Failed to load radar tile:", error);
                resolve(null);
              }
            );
          });
        }

        applyTexture(texture) {
          if (!this.radarMesh || !texture) return;
          this.radarMesh.material.map = texture;
          this.radarMesh.material.needsUpdate = true;
        }

        preloadFrameTexture(frameIndex) {
          const frame = this.frames[frameIndex];
          if (!frame) return;
          const url = this.getRadarTileURL(frame, this.latitude, this.longitude);
          if (!url || this.textureCache.has(url)) return;

          const loader = new THREE.TextureLoader();
          loader.load(
            url,
            (texture) => {
              texture.colorSpace = THREE.SRGBColorSpace;
              this.textureCache.set(url, texture);
            },
            undefined,
            () => {}
          );
        }

        startAnimation() {
          if (!this.frames.length || this.animationInterval) return;
          this.isPlaying = true;
          this.animationInterval = window.setInterval(async () => {
            if (!this.frames.length) return;
            this.currentFrameIndex = (this.currentFrameIndex + 1) % this.frames.length;
            await this.loadFrameTexture(this.currentFrameIndex);
            this.preloadFrameTexture((this.currentFrameIndex + 1) % this.frames.length);
          }, this.minFrameStep);
        }

        stopAnimation() {
          if (this.animationInterval) {
            clearInterval(this.animationInterval);
            this.animationInterval = null;
          }
          this.isPlaying = false;
        }

        setVisible(visible) {
          if (this.radarMesh) this.radarMesh.visible = visible;
        }

        async refresh() {
          const success = await this.fetchRadarFrames();
          if (!success) return false;
          await this.loadFrameTexture(0);
          this.preloadFrameTexture(1);
          return true;
        }

        update(currentTime) {
          if (currentTime - this.lastUpdate >= this.updateFrequency && !this.isRefreshing) {
            this.refresh().then((success) => {
              if (success) updateRadarStatus(`Radar updated at ${new Date().toLocaleTimeString()}.`, true);
            });
          }
          if (!this.isPlaying || currentTime - this.lastRenderTime < this.minFrameStep) return;
          this.lastRenderTime = currentTime;
        }

        disposeMesh() {
          if (!this.radarMesh) return;
          this.radarMesh.material.map = null;
          this.radarMesh.geometry.dispose();
          this.radarMesh.material.dispose();
          this.scene.remove(this.radarMesh);
          this.radarMesh = null;
        }

        dispose() {
          this.stopAnimation();
          for (const texture of this.textureCache.values()) {
            texture.dispose();
          }
          this.textureCache.clear();
          this.disposeMesh();
        }
      }

      initScene();
      console.log('[DEBUG] initScene completed');
      animate();
      
      setTimeout(() => {
        loadingEl.classList.add('hidden');
      }, 100);

      function initScene() {
        scene = new THREE.Scene();
        scene.background = new THREE.Color("#0d1b2a");
        scene.fog = new THREE.FogExp2(0xc8d8e4, 0.002);
        sceneState.scene = scene;

        const w = canvasRoot.clientWidth || window.innerWidth;
        const h = canvasRoot.clientHeight || window.innerHeight;
        camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 2000);
        camera.position.set(0, 80, 120);
        camera.lookAt(0, 0, 0);
        sceneState.camera = camera;

        const canvas = document.createElement("canvas");
        canvas.id = "three-canvas";
        canvasRoot.innerHTML = "";
        canvasRoot.appendChild(canvas);

        try {
          renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
            powerPreference: "high-performance",
            precision: "highp",
            depth: true,
            logarithmicDepthBuffer: true,
            failIfMajorPerformanceCaveat: false,
          });
        } catch (e) {
          console.error('WebGL init failed, trying fallback:', e);
          renderer = new THREE.WebGLRenderer({
            canvas,
            antialias: true,
          });
        }
        renderer.setSize(w, h);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.1;
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.info.autoReset = false;
        
        console.log('[Renderer] GPU Acceleration enabled');
        console.log('[Renderer] Device pixel ratio:', window.devicePixelRatio);
        console.log('[Renderer] Init complete, version:', renderer.capabilities?.glVersion || 'unknown');
        sceneState.renderer = renderer;

        ctrl = new OrbitControls(camera, renderer.domElement);
        ctrl.enableDamping = true;
        ctrl.dampingFactor = 0.06;
        ctrl.minDistance = 5;
        ctrl.maxDistance = 500;
        ctrl.maxPolarAngle = Math.PI / 2.05;
        ctrl.target.set(0, 5, 0);
        ctrl.update();
        sceneState.controls = ctrl;
        
        ctrl.addEventListener('change', () => {
          setDirty('camera');
          setDirty('labels');
          if (!INFINITE_MAP.enabled || !ctrl) return;
          const prevTarget = ctrl.target.clone();
          
          if (ctrl.getAzimuthalAngle) {
            const deltaX = camera.position.x - (prevTarget.x + 100);
            const deltaZ = camera.position.z - (prevTarget.z + 100);
            if (Math.abs(deltaX) > 5 || Math.abs(deltaZ) > 5) {
              handleMapPan(deltaX, deltaZ);
            }
          }
        });

        sceneState.sunSystem = new AquaSunLightSystem(scene);
        sceneState.skySystem = new AquaSkySystem(scene);
        weatherLayerManager = new AquaWeatherLayerManager(scene);
        weatherTimeline = new AquaWeatherTimelineController();
        waterFlowSimulator = new AquaWaterFlowSimulator();
        hydrologyCalculator = new HydrologyCalculator();
        sceneState.windSystem = new AquaWindParticleSystem(scene);
        rainSystemAdvanced = null;
        cloudSystem = null;
        lightningSystem = null;
        buildSky();
        sceneState.usePostProcessing = false;
        sceneState.composer = null;

        window.addEventListener("resize", onResize);
        document.querySelectorAll(".vb").forEach(btn => {
          btn.addEventListener("click", () => flyToView(btn.dataset.view));
        });
        document.getElementById("timeline-play-pause").addEventListener("click", () => weatherTimeline && weatherTimeline.togglePlayPause());
        document.getElementById("time-scrubber").addEventListener("input", (e) => weatherTimeline && weatherTimeline.scrubTo(e.target.value));
        document.getElementById("playback-speed").addEventListener("change", (e) => { if (weatherTimeline) weatherTimeline.playbackSpeed = Number(e.target.value || 4); });
        document.getElementById("layer-rainfall").addEventListener("change", (e) => weatherLayerManager && weatherLayerManager.setLayer("rainfall", e.target.checked));
        document.getElementById("layer-wind").addEventListener("change", (e) => weatherLayerManager && weatherLayerManager.setLayer("wind", e.target.checked));
        document.getElementById("layer-temp").addEventListener("change", (e) => weatherLayerManager && weatherLayerManager.setLayer("temp", e.target.checked));
        document.getElementById("layer-runoff").addEventListener("change", (e) => weatherLayerManager && weatherLayerManager.setLayer("runoff", e.target.checked));
        document.getElementById("radar-toggle").addEventListener("change", async (e) => {
          if (e.target.checked && !rainRadar && sceneState.geodata?.bbox) {
            updateRadarStatus("Loading radar data...", true);
            const lat = (sceneState.geodata.bbox.minLat + sceneState.geodata.bbox.maxLat) / 2;
            const lon = (sceneState.geodata.bbox.minLon + sceneState.geodata.bbox.maxLon) / 2;
            try {
              await initializeRainRadar(lat, lon);
              rainRadar.setVisible(true);
              rainRadar.startAnimation();
              document.getElementById("radar-play-pause").textContent = "Pause Animation";
              updateRadarStatus("Radar loaded and playing.", true);
            } catch (err) {
              updateRadarStatus("Failed to load radar.", false);
              e.target.checked = false;
            }
          } else if (rainRadar) {
            rainRadar.setVisible(e.target.checked);
            if (e.target.checked) {
              rainRadar.startAnimation();
              document.getElementById("radar-play-pause").textContent = "Pause Animation";
            } else {
              rainRadar.stopAnimation();
              document.getElementById("radar-play-pause").textContent = "Play Animation";
            }
            updateRadarStatus(e.target.checked ? "Radar overlay visible." : "Radar overlay hidden.", true);
          }
        });
        document.getElementById("radar-play-pause").addEventListener("click", () => {
          if (!rainRadar) return;
          const btn = document.getElementById("radar-play-pause");
          if (rainRadar.isPlaying) {
            rainRadar.stopAnimation();
            btn.textContent = "Play Animation";
            updateRadarStatus("Radar animation paused.", true);
          } else {
            rainRadar.startAnimation();
            btn.textContent = "Pause Animation";
            updateRadarStatus("Radar animation resumed.", true);
          }
        });
        document.getElementById("radar-refresh").addEventListener("click", async () => {
          if (!rainRadar) return;
          updateRadarStatus("Refreshing radar data...", true);
          const success = await rainRadar.refresh();
          if (success) {
            updateRadarStatus(`Updated at ${new Date().toLocaleTimeString()} (${rainRadar.frames.length} frames).`, true);
          } else {
            updateRadarStatus("Radar refresh failed.", false);
          }
        });
        
        let toggleDebounceTimer = null;
        function debouncedToggle(callback, delay = 50) {
          return function(...args) {
            clearTimeout(toggleDebounceTimer);
            toggleDebounceTimer = setTimeout(() => callback.apply(this, args), delay);
          };
        }
        
        const debouncedTopoMode = debouncedToggle((checked) => {
          toggleTopoMode(checked);
        }, 16);
        
        const debouncedContours = debouncedToggle((checked) => {
          toggleContours(checked);
        }, 16);
        
        const debouncedRoads = debouncedToggle((checked) => {
          toggleRoads(checked);
        }, 16);
        
        const debouncedLabels = debouncedToggle((checked) => {
          toggleLabels(checked);
        }, 16);
        
        document.getElementById("topo-mode").addEventListener("change", (e) => {
          debouncedTopoMode(e.target.checked);
        });
        document.getElementById("infinite-pan").addEventListener("change", (e) => {
          INFINITE_MAP.enabled = e.target.checked;
          console.log('[InfiniteMap] Toggle:', INFINITE_MAP.enabled ? 'ON' : 'OFF');
        });
        document.getElementById("contours-toggle").addEventListener("change", (e) => {
          debouncedContours(e.target.checked);
        });
        document.getElementById("roads-toggle").addEventListener("change", (e) => {
          debouncedRoads(e.target.checked);
        });
        document.getElementById("labels-toggle").addEventListener("change", (e) => {
          debouncedLabels(e.target.checked);
        });
        
        document.getElementById("flow-layer-toggle").addEventListener("change", (e) => {
          if (terrainShaderMat?.uniforms) {
            terrainShaderMat.uniforms.uShowFlow.value = e.target.checked ? 1.0 : 0.0;
          }
        });
        
        document.getElementById("topo-source").addEventListener("change", (e) => {
          const sourceKey = e.target.value;
          if (TOPO_SOURCES[sourceKey] && sceneState.terrainBounds) {
            currentTopoSource = sourceKey;
            buildMapTileOverlay(sceneState.terrainBounds, TOPO_SOURCES[sourceKey]);
          }
        });
      }

      function onResize() {
        const w = canvasRoot.clientWidth || window.innerWidth;
        const h = canvasRoot.clientHeight || window.innerHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        if (sceneState.composer) sceneState.composer.setSize(w, h);
      }

      function setStatus(el, text, ok) {
        el.textContent = text;
        el.style.color = ok ? "#1c6f66" : "#b2372b";
      }

      function showLoading(show, text, progress = null) {
        loadingEl.classList.toggle('hidden', !show);
        if (show) {
          loadingEl.innerHTML = `
            <div style="text-align: center;">
              <div class="loading-text">${text || "Loading..."}</div>
              ${progress !== null ? `
                <div class="progress-bar">
                  <div class="progress-fill" style="width: ${progress}%"></div>
                </div>
                <div class="status-text">${progress}% complete</div>
              ` : ''}
            </div>
          `;
        }
      }
      
      function updateLoadingProgress(progress) {
        const fill = loadingEl.querySelector('.progress-fill');
        const status = loadingEl.querySelector('.status-text');
        if (fill) fill.style.width = `${progress}%`;
        if (status) status.textContent = `${progress}% complete`;
      }

      function showOutput(data) {
        const outputEl = document.getElementById("output");
        if (!data || !data.data) {
          outputEl.textContent = JSON.stringify(data, null, 2);
          return;
        }
        
        const result = data.data;
        let text = [];
        text.push("═══════════════════════════════════════════════════════════════");
        text.push("              WATER HARVESTING ANALYSIS REPORT                   ");
        text.push("═══════════════════════════════════════════════════════════════");
        text.push("");
        
        text.push("┌─ CLIMATE ASSESSMENT ──────────────────────────────────────────");
        text.push(`│ Annual Rainfall: ${result.climate?.annual_rain || 0} mm/year`);
        text.push(`│ Data Source:     ${result.climate?.source || "Unknown"}`);
        text.push(`│ Humidity:        ${result.climate?.hum || 0}%`);
        text.push(`│ Altitude:        ${result.climate?.altitude || 0} meters`);
        text.push(`│ Location Type:    ${result.climate?.coastal ? "Coastal Area" : "Inland Area"}`);
        text.push(`│ Water Stress:    ${result.climate?.stress || "Moderate"}`);
        text.push(`│ Rainfall Pattern: ${result.climate?.monsoon_dep || 0}% monsoon-dependent`);
        text.push(`│ Variability (CV): ${result.climate?.cv || 0}`);
        text.push(`│ Confidence Level: ${result.climate?.confidence || "LOW"}`);
        text.push("└──────────────────────────────────────────────────────────────");
        text.push("");
        
        if (result.alert) {
          text.push("┌─ WEATHER ALERT ───────────────────────────────────────────────");
          const alertEmoji = { "URGENT": "🚨", "ACTION": "⚠️", "PREPARE": "📋", "DRY": "☀️" };
          text.push(`│ Status: ${alertEmoji[result.alert.level] || "📋"} ${result.alert.level}`);
          text.push(`│ ${result.alert.message}`);
          text.push(`│ 7-Day Forecast: ${result.alert.total_7d || 0} mm`);
          text.push("└──────────────────────────────────────────────────────────────");
          text.push("");
        }
        
        text.push("┌─ HARVESTING METHODS RANKED BY ANNUAL YIELD ──────────────────");
        const ranked = result.ranked || [];
        if (ranked.length === 0) {
          text.push("│ No viable methods found for current inputs.");
        } else {
          ranked.forEach((method, idx) => {
            const emoji = method.icon || "💧";
            const stars = "★".repeat(method.score || 1);
            text.push(`│ ${idx + 1}. ${emoji} ${method.name}`);
            text.push(`│    Yield: ${method.annual?.toLocaleString() || 0} liters/year`);
            text.push(`│    Score: ${stars} (${method.score || 1}/9)`);
            text.push(`│    Est. Cost: ${method.cost || "TBD"}`);
            if (method.tank) {
              text.push(`│    Recommended Tank: ${method.tank.toLocaleString()} liters`);
            }
            text.push("");
          });
        }
        text.push("└──────────────────────────────────────────────────────────────");
        text.push("");
        
        text.push("┌─ FINANCIAL BENEFITS ─────────────────────────────────────────");
        text.push(`│ Annual Savings:     ₹${(result.financial?.annual_savings || 0).toLocaleString()}`);
        text.push(`│ CO₂ Offset:        ${(result.env?.co2 || 0).toLocaleString()} kg/year`);
        text.push(`│ System Maturity:   ${result.maturity?.stars || "⭐"} ${result.maturity?.label || "Basic"}`);
        text.push("└──────────────────────────────────────────────────────────────");
        text.push("");
        
        text.push("┌─ MONTHLY BREAKDOWN (Rooftop Rainwater Harvesting) ──────────");
        const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
        const monthly = result.monthly || [];
        monthly.forEach((m, idx) => {
          const rain = (m.rainfall_mm || 0).toFixed(1);
          const harvest = (m.harvested_l || 0).toFixed(0);
          const bar = "█".repeat(Math.min(Math.round((m.harvested_l || 0) / 500), 30));
          text.push(`│ ${months[idx]}: ${rain.padStart(6)} mm  →  ${harvest.padStart(6)} L  ${bar}`);
        });
        text.push("└──────────────────────────────────────────────────────────────");
        text.push("");
        
        text.push("┌─ 5-YEAR PROJECTION ──────────────────────────────────────────");
        const proj = result.proj || [];
        proj.forEach(p => {
          text.push(`│ Year ${p.year}: ${(p.year_l || 0).toLocaleString()} L/yr | Savings: ₹${(p.year_inr || 0).toLocaleString()} | Cumulative: ${(p.cum_l || 0).toLocaleString()} L`);
        });
        text.push("└──────────────────────────────────────────────────────────────");
        text.push("");
        
        text.push("┌─ GROUNDWATER RECHARGE ───────────────────────────────────────");
        text.push(`│ Total Rechargeable: ${(result.recharge_total || 0).toLocaleString()} liters/year`);
        text.push("└──────────────────────────────────────────────────────────────");
        text.push("");
        
        text.push("┌─ RECOMMENDED ACTIONS ───────────────────────────────────────");
        const actions = result.actions || [];
        actions.forEach((action, idx) => {
          text.push(`│ ${idx + 1}. ${action}`);
        });
        text.push("└──────────────────────────────────────────────────────────────");
        text.push("");
        text.push("═══════════════════════════════════════════════════════════════");
        text.push("                     END OF REPORT                              ");
        text.push("═══════════════════════════════════════════════════════════════");
        
        outputEl.textContent = text.join("\n");
        outputEl.style.whiteSpace = "pre";
        outputEl.style.fontFamily = "'Cascadia Code', 'Fira Code', 'Consolas', monospace";
      }

      async function postJson(url, payload) {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok || data.ok === false) {
          const msg = data && data.error ? data.error : "Request failed";
          throw new Error(msg);
        }
        return data;
      }

      function updateRadarStatus(message, ok = true) {
        const statusEl = document.getElementById("radar-status");
        if (!statusEl) return;
        statusEl.textContent = message;
        statusEl.style.color = ok ? "var(--muted)" : "#b2372b";
      }

      async function initializeRainRadar(lat, lon) {
        if (!scene || !terrainGrid) return false;
        if (rainRadar) {
          rainRadar.dispose();
        }

        rainRadar = new LiveRainRadar(scene, camera);
        const terrainSize = terrainCellSize * Math.max(terrainGS - 1, 1);
        const success = await rainRadar.initialize(lat, lon, terrainSize);

        if (success) {
          const shouldShow = document.getElementById("radar-toggle").checked;
          rainRadar.setVisible(shouldShow);
          if (shouldShow) {
            rainRadar.startAnimation();
            document.getElementById("radar-play-pause").textContent = "Pause Animation";
          } else {
            document.getElementById("radar-play-pause").textContent = "Play Animation";
          }
          updateRadarStatus(`Radar ready for ${lat.toFixed(3)}, ${lon.toFixed(3)}.`, true);
          return true;
        }

        document.getElementById("radar-play-pause").textContent = "Play Animation";
        return false;
      }

      async function fetchDeepHistoricalData(latitude, longitude, years = 5) {
        try {
          const response = await fetch("/api/historical-deep", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              latitude: latitude,
              longitude: longitude,
              years: years,
            }),
          });

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const data = await response.json();
          console.log("Deep historical data loaded:", {
            source: data.source,
            days: (data.daily_data || []).length,
            totalRainfall: data.summary_stats?.total_precipitation_mm,
          });
          return data;
        } catch (error) {
          console.error("Failed to fetch deep historical data:", error);
          return null;
        }
      }

      function normalizeWeatherSnapshot(input = {}) {
        return {
          temperature: Number(input.temperature_2m ?? input.temp ?? input.temperature ?? 25),
          humidity: Number(input.relative_humidity_2m ?? input.hum ?? input.humidity ?? 60),
          precipitation: Number(input.precipitation ?? input.precip ?? input.rain ?? 0),
          cloudCover: Number(input.cloud_cover ?? input.cloudcover ?? input.cloud ?? 0),
          windSpeed: Number(input.wind_speed_10m ?? input.windspeed ?? input.wind_spd ?? input.windSpeed ?? 5),
          windDir: Number(input.wind_direction_10m ?? input.winddirection ?? input.wind_dir ?? input.windDir ?? 180),
          weatherCode: Number(input.weather_code ?? input.weathercode ?? 0),
          time: input.time || null,
        };
      }

      function buildElevationRampTexture() {
        const width = 256;
        const data = new Uint8Array(width * 4);
        const stops = [
          [0.00, 12, 68, 55],
          [0.08, 22, 95, 65],
          [0.18, 85, 130, 78],
          [0.30, 58, 105, 52],
          [0.42, 82, 115, 68],
          [0.55, 125, 105, 78],
          [0.68, 155, 130, 95],
          [0.78, 168, 148, 125],
          [0.88, 198, 188, 178],
          [0.94, 215, 212, 208],
          [1.00, 245, 248, 252],
        ];
        for (let i = 0; i < width; i++) {
          const t = i / (width - 1);
          let lo = stops[0];
          let hi = stops[stops.length - 1];
          for (let s = 0; s < stops.length - 1; s++) {
            if (t >= stops[s][0] && t <= stops[s + 1][0]) {
              lo = stops[s];
              hi = stops[s + 1];
              break;
            }
          }
          const f = lo[0] === hi[0] ? 0 : (t - lo[0]) / (hi[0] - lo[0]);
          data[i * 4] = Math.round(lo[1] + (hi[1] - lo[1]) * f);
          data[i * 4 + 1] = Math.round(lo[2] + (hi[2] - lo[2]) * f);
          data[i * 4 + 2] = Math.round(lo[3] + (hi[3] - lo[3]) * f);
          data[i * 4 + 3] = 255;
        }
        const texture = new THREE.DataTexture(data, width, 1, THREE.RGBAFormat);
        texture.needsUpdate = true;
        texture.colorSpace = THREE.SRGBColorSpace;
        return texture;
      }

      function latLonToWorld(lat, lon, state = sceneState) {
        const bbox = state.terrainBounds || state.geodata?.bbox || {
          minLat: lat - 0.05,
          maxLat: lat + 0.05,
          minLon: lon - 0.05,
          maxLon: lon + 0.05,
        };
        const lonSpan = Math.max(bbox.maxLon - bbox.minLon, 1e-6);
        const latSpan = Math.max(bbox.maxLat - bbox.minLat, 1e-6);
        const nx = (lon - bbox.minLon) / lonSpan;
        const nz = (lat - bbox.minLat) / latSpan;
        return {
          x: (nx - 0.5) * state.terrainSize,
          z: (0.5 - nz) * state.terrainSize,
        };
      }

      function sampleTerrainHeight(worldX, worldZ) {
        if (!sceneState.terrainElevationGrid || !sceneState.terrainN) return 0;
        const N = sceneState.terrainN;
        const S = sceneState.terrainSize;
        const H = sceneState.terrainHeightScale;
        const u = clamp(worldX / S + 0.5, 0, 0.999999);
        const v = clamp(0.5 - worldZ / S, 0, 0.999999);
        const gx = u * (N - 1);
        const gz = v * (N - 1);
        const x0 = Math.floor(gx);
        const z0 = Math.floor(gz);
        const x1 = Math.min(x0 + 1, N - 1);
        const z1 = Math.min(z0 + 1, N - 1);
        const tx = gx - x0;
        const tz = gz - z0;
        const e00 = sceneState.terrainElevationGrid[z0]?.[x0] ?? 0;
        const e10 = sceneState.terrainElevationGrid[z0]?.[x1] ?? e00;
        const e01 = sceneState.terrainElevationGrid[z1]?.[x0] ?? e00;
        const e11 = sceneState.terrainElevationGrid[z1]?.[x1] ?? e10;
        const e0 = e00 * (1 - tx) + e10 * tx;
        const e1 = e01 * (1 - tx) + e11 * tx;
        return (e0 * (1 - tz) + e1 * tz) * H;
      }

      function computePolygonCentroid(points) {
        if (!points || !points.length) return { lat: 0, lon: 0 };
        let latSum = 0;
        let lonSum = 0;
        for (const point of points) {
          const lat = Array.isArray(point) ? point[0] : point.lat;
          const lon = Array.isArray(point) ? point[1] : point.lon;
          latSum += lat || 0;
          lonSum += lon || 0;
        }
        return { lat: latSum / points.length, lon: lonSum / points.length };
      }

      function buildWetnessMap(elevationGrid, riverSegments = [], lakePolygons = []) {
        const N = elevationGrid.length;
        const data = new Uint8Array(N * N * 4);
        const riverPoints = [];
        const lakeCenters = [];
        for (const river of riverSegments) {
          const points = river.points || river;
          for (const point of points) {
            const lat = Array.isArray(point) ? point[0] : point.lat;
            const lon = Array.isArray(point) ? point[1] : point.lon;
            const world = latLonToWorld(lat, lon);
            riverPoints.push({
              x: ((world.x / sceneState.terrainSize) + 0.5) * (N - 1),
              z: (0.5 - (world.z / sceneState.terrainSize)) * (N - 1),
            });
          }
        }
        for (const lake of lakePolygons) {
          const centroid = computePolygonCentroid(lake.points || lake);
          const world = latLonToWorld(centroid.lat, centroid.lon);
          lakeCenters.push({
            x: ((world.x / sceneState.terrainSize) + 0.5) * (N - 1),
            z: (0.5 - (world.z / sceneState.terrainSize)) * (N - 1),
          });
        }
        for (let z = 0; z < N; z++) {
          for (let x = 0; x < N; x++) {
            let minDist = Infinity;
            for (const point of riverPoints) {
              minDist = Math.min(minDist, Math.hypot(x - point.x, z - point.z));
            }
            for (const point of lakeCenters) {
              minDist = Math.min(minDist, Math.hypot(x - point.x, z - point.z));
            }
            if (!Number.isFinite(minDist)) minDist = 20;
            const wetness = 1 - Math.min(minDist / 10, 1);
            const idx = (z * N + x) * 4;
            const value = Math.floor(wetness * 255);
            data[idx] = value;
            data[idx + 1] = value;
            data[idx + 2] = value;
            data[idx + 3] = 255;
          }
        }
        const texture = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
        texture.needsUpdate = true;
        return texture;
      }

      function buildRiverMaterial(width) {
        return new THREE.ShaderMaterial({
          uniforms: {
            uTime: { value: 0 },
            uFlowSpeed: { value: width > 1.2 ? 0.18 : 0.26 },
            uDeepColor: { value: new THREE.Color("#154c79") },
            uShallowColor: { value: new THREE.Color("#5fb8de") },
            uFoamColor: { value: new THREE.Color("#f3fbff") },
            uBankColor: { value: new THREE.Color("#6e7d62") },
            uWidth: { value: width },
            uOpacity: { value: 0.9 },
          },
          vertexShader: `
            varying vec2 vUv;
            varying vec3 vNormal;
            varying vec3 vWorldPos;
            varying float vRadialT;
            varying float vFlowBand;
            uniform float uTime;
            void main() {
              vUv = uv;
              vNormal = normalize(normalMatrix * normal);
              vec3 displaced = position;
              float wave = sin(uv.x * 24.0 - uTime * 2.1) * 0.025;
              wave += sin(uv.x * 53.0 + uTime * 1.7) * 0.01;
              displaced += normal * wave;
              vec4 wp = modelMatrix * vec4(displaced, 1.0);
              vWorldPos = wp.xyz;
              vRadialT = 1.0 - abs(uv.y - 0.5) * 2.0;
              vFlowBand = smoothstep(0.12, 0.5, vRadialT);
              gl_Position = projectionMatrix * viewMatrix * wp;
            }
          `,
          fragmentShader: `
            uniform float uTime;
            uniform float uFlowSpeed;
            uniform vec3 uDeepColor;
            uniform vec3 uShallowColor;
            uniform vec3 uFoamColor;
            uniform vec3 uBankColor;
            uniform float uOpacity;
            varying vec2 vUv;
            varying vec3 vNormal;
            varying float vRadialT;
            varying float vFlowBand;
            float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            float noise(vec2 p) {
              vec2 i = floor(p);
              vec2 f = fract(p);
              f = f * f * (3.0 - 2.0 * f);
              return mix(
                mix(hash(i), hash(i + vec2(1,0)), f.x),
                mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x),
                f.y
              );
            }
            void main() {
              vec2 flowUv = vec2(vUv.x * 2.4 - uTime * uFlowSpeed, vUv.y * 4.0);
              float n1 = noise(flowUv * 4.0);
              float n2 = noise(flowUv * 9.0 + vec2(3.7, 1.2));
              float n3 = noise(flowUv * 2.5 - vec2(1.1, 2.3));
              float surfaceNoise = n1 * 0.5 + n2 * 0.3 + n3 * 0.2;
              float depth = clamp(vFlowBand, 0.0, 1.0);
              vec3 waterColor = mix(uShallowColor, uDeepColor, depth * 0.95);
              waterColor = mix(uBankColor, waterColor, smoothstep(0.0, 0.22, depth));
              waterColor += surfaceNoise * 0.05;
              float fresnel = pow(1.0 - max(dot(normalize(vNormal), vec3(0,1,0)), 0.0), 3.0);
              waterColor = mix(waterColor, uShallowColor * 1.2, fresnel * 0.35);
              float streamBands = smoothstep(0.72, 0.98, sin(vUv.x * 80.0 - uTime * 5.5) * 0.5 + 0.5) * 0.08 * depth;
              waterColor += streamBands;
              float foam = 0.0;
              foam += smoothstep(0.08, 0.0, vUv.x);
              foam += smoothstep(0.22, 0.0, depth) * 0.35;
              foam += step(0.84, surfaceNoise) * 0.22;
              foam = clamp(foam, 0.0, 1.0);
              vec3 finalColor = mix(waterColor, uFoamColor, foam);
              finalColor += vec3(pow(surfaceNoise, 9.0) * 0.22);
              float alpha = mix(0.66, uOpacity, depth);
              gl_FragColor = vec4(finalColor, alpha);
            }
          `,
          transparent: true,
          depthWrite: false,
          side: THREE.FrontSide,
        });
      }

      function buildLakeMaterial() {
        return new THREE.ShaderMaterial({
          uniforms: {
            uTime: { value: 0 },
            uFlowSpeed: { value: 0.05 },
            uDeepColor: { value: new THREE.Color("#0f4c81") },
            uShallowColor: { value: new THREE.Color("#7bd1ff") },
            uFoamColor: { value: new THREE.Color("#eef8ff") },
            uOpacity: { value: 0.76 },
          },
          vertexShader: `
            varying vec2 vUv;
            varying vec3 vWorldPos;
            void main() {
              vUv = uv;
              vec4 wp = modelMatrix * vec4(position, 1.0);
              vWorldPos = wp.xyz;
              gl_Position = projectionMatrix * viewMatrix * wp;
            }
          `,
          fragmentShader: `
            uniform float uTime;
            uniform float uFlowSpeed;
            uniform vec3 uDeepColor;
            uniform vec3 uShallowColor;
            uniform vec3 uFoamColor;
            uniform float uOpacity;
            varying vec2 vUv;
            float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
            float noise(vec2 p) {
              vec2 i = floor(p);
              vec2 f = fract(p);
              f = f * f * (3.0 - 2.0 * f);
              return mix(
                mix(hash(i), hash(i + vec2(1,0)), f.x),
                mix(hash(i + vec2(0,1)), hash(i + vec2(1,1)), f.x),
                f.y
              );
            }
            void main() {
              vec2 flowUv = vec2(vUv.x - uTime * uFlowSpeed, vUv.y);
              float n1 = noise(flowUv * 6.0);
              float n2 = noise(flowUv * 12.0 + vec2(4.1, 2.6));
              float distFromCenter = length(vUv - vec2(0.5));
              float ripple = sin(distFromCenter * 40.0 - uTime * 2.0) * 0.5 + 0.5;
              ripple *= smoothstep(0.5, 0.2, distFromCenter);
              vec3 waterColor = mix(uShallowColor, uDeepColor, smoothstep(0.0, 0.6, distFromCenter));
              waterColor += vec3((n1 * 0.6 + n2 * 0.4) * 0.06);
              waterColor += ripple * 0.03;
              float edge = smoothstep(0.48, 0.5, distFromCenter);
              vec3 finalColor = mix(waterColor, uFoamColor, edge * 0.25);
              gl_FragColor = vec4(finalColor, uOpacity);
            }
          `,
          transparent: true,
          depthWrite: false,
          side: THREE.DoubleSide,
        });
      }

      function lonToTileX(lon, zoom) {
        return Math.floor(((lon + 180) / 360) * Math.pow(2, zoom));
      }

      function latToTileY(lat, zoom) {
        const latRad = lat * Math.PI / 180;
        return Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * Math.pow(2, zoom));
      }

      function tileXToLon(x, zoom) {
        return (x / Math.pow(2, zoom)) * 360 - 180;
      }

      function tileYToLat(y, zoom) {
        const n = Math.PI - (2 * Math.PI * y) / Math.pow(2, zoom);
        return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
      }

      function chooseMapZoom(bounds) {
        const maxTiles = 36;
        for (let zoom = 17; zoom >= 11; zoom--) {
          const minX = lonToTileX(bounds.minLon, zoom);
          const maxX = lonToTileX(bounds.maxLon, zoom);
          const minY = latToTileY(bounds.maxLat, zoom);
          const maxY = latToTileY(bounds.minLat, zoom);
          const tileCount = (maxX - minX + 1) * (maxY - minY + 1);
          if (tileCount > 0 && tileCount <= maxTiles) return zoom;
        }
        return 11;
      }

      function loadMapTileTexture(urls) {
        return new Promise((resolve, reject) => {
          const loader = new THREE.TextureLoader();
          loader.setCrossOrigin("anonymous");
          let index = 0;
          const tryNext = () => {
            if (index >= urls.length) {
              reject(new Error("All map tile sources failed"));
              return;
            }
            loader.load(
              urls[index],
              (texture) => {
                texture.colorSpace = THREE.SRGBColorSpace;
                texture.wrapS = THREE.ClampToEdgeWrapping;
                texture.wrapT = THREE.ClampToEdgeWrapping;
                texture.minFilter = THREE.LinearMipmapLinearFilter;
                texture.magFilter = THREE.LinearFilter;
                texture.generateMipmaps = true;
                resolve(texture);
              },
              (xhr) => {},
              (error) => {
                console.log('[MapTile] Failed to load:', urls[index], error);
                index += 1;
                tryNext();
              }
            );
          };
          tryNext();
        });
      }

      function clearMapOverlay() {
        if (!mapTileGroup) return;
        mapTileGroup.traverse((child) => {
          if (child.material?.map) child.material.map.dispose();
          if (child.geometry) child.geometry.dispose();
          if (child.material) child.material.dispose();
        });
        scene.remove(mapTileGroup);
        mapTileGroup = null;
        sceneState.mapTileGroup = null;
      }

      function buildMapTileOverlay(bounds, tileSource = null) {
        clearMapOverlay();
        if (!bounds) {
          console.log('[Map] No bounds provided for overlay');
          return;
        }
        
        console.log('[Map] Building overlay. Bounds:', bounds.minLat?.toFixed(3), bounds.maxLat?.toFixed(3), bounds.minLon?.toFixed(3), bounds.maxLon?.toFixed(3));
        
        const generation = ++mapOverlayGeneration;
        const zoom = chooseMapZoom(bounds);
        const minX = lonToTileX(bounds.minLon, zoom);
        const maxX = lonToTileX(bounds.maxLon, zoom);
        const minY = latToTileY(bounds.maxLat, zoom);
        const maxY = latToTileY(bounds.minLat, zoom);
        const tileCount = (maxX - minX + 1) * (maxY - minY + 1);
        console.log('[Map] Zoom:', zoom, 'Tiles:', minX, '-', maxX, 'x', minY, '-', maxY, '=', tileCount);
        if (tileCount <= 0 || tileCount > 36) {
          console.log('[Map] Tile count out of range');
          return;
        }

        mapTileGroup = new THREE.Group();
        mapTileGroup.renderOrder = 10;
        mapTileGroup.userData.cleanupOnRebuild = true;
        scene.add(mapTileGroup);
        sceneState.mapTileGroup = mapTileGroup;

        const tilesToProcess = [];
        for (let ty = minY; ty <= maxY; ty++) {
          for (let tx = minX; tx <= maxX; tx++) {
            tilesToProcess.push({ tx, ty });
          }
        }

        const colors = [0x8fa876, 0x9db87a, 0xa8c288, 0xb3cd97, 0xbed6a5, 0xc8dfb3, 0xd3e8c2, 0xdef1d0];
        let processedCount = 0;
        const totalTiles = tilesToProcess.length;
        
        function processNextTile() {
          const tile = tilesToProcess.shift();
          if (!tile || generation !== mapOverlayGeneration) return;
          
          const { tx, ty } = tile;
          const west = tileXToLon(tx, zoom);
          const east = tileXToLon(tx + 1, zoom);
          const north = tileYToLat(ty, zoom);
          const south = tileYToLat(ty + 1, zoom);
          const nw = latLonToWorld(north, west);
          const ne = latLonToWorld(north, east);
          const sw = latLonToWorld(south, west);
          const se = latLonToWorld(south, east);
          const centerX = (nw.x + ne.x + sw.x + se.x) / 4;
          const centerZ = (nw.z + ne.z + sw.z + se.z) / 4;
          const tileWidth = Math.max(Math.abs(ne.x - nw.x), Math.abs(se.x - sw.x));
          const tileDepth = Math.max(Math.abs(nw.z - sw.z), Math.abs(ne.z - se.z));
          const geometry = new THREE.PlaneGeometry(tileWidth, tileDepth, 4, 4);
          geometry.rotateX(-Math.PI / 2);
          const positions = geometry.attributes.position;
          for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i) + centerX;
            const z = positions.getZ(i) + centerZ;
            positions.setY(i, sampleTerrainHeight(x, z) + 0.15);
          }
          positions.needsUpdate = true;
          geometry.computeVertexNormals();
          
          const colorIdx = Math.abs(tx + ty) % colors.length;
          const material = new THREE.MeshBasicMaterial({
            color: colors[colorIdx],
            transparent: true,
            opacity: 0.5,
            depthWrite: false,
            side: THREE.DoubleSide,
          });
          const terrainY = sampleTerrainHeight(centerX, centerZ) + 0.3;
          const mesh = new THREE.Mesh(geometry, material);
          mesh.position.set(centerX, terrainY, centerZ);
          mesh.renderOrder = 15;
          mesh.userData.tileKey = `${zoom}_${tx}_${ty}`;
          mesh.userData.loaded = false;
          mesh.userData.isPlaceholder = true;
          mesh.userData.material = material;
          mapTileGroup.add(mesh);

          if (tileSource) {
            const url = tileSource.url(zoom, tx, ty);
            console.log('[MapTile] Loading:', url);
            loadMapTileTexture([url]).then((texture) => {
              if (generation !== mapOverlayGeneration || !mapTileGroup) {
                texture.dispose();
                return;
              }
              texture.anisotropy = renderer?.capabilities?.getMaxAnisotropy?.() || 1;
              material.map = texture;
              material.color = null;
              material.opacity = 0.85;
              material.needsUpdate = true;
              mesh.userData.loaded = true;
              mesh.userData.isPlaceholder = false;
              console.log('[MapTile] Loaded:', url);
            }).catch((e) => {
              console.log('[MapTile] Failed:', url, e);
            });
          }
          
          processedCount++;
          if (processedCount % 3 === 0 && tilesToProcess.length > 0) {
            requestAnimationFrame(processNextTile);
          } else if (tilesToProcess.length > 0) {
            processNextTile();
          }
        }
        
        processNextTile();
      }

      function updateInfiniteMap() {
        if (!mapTileGroup || !sceneState.terrainBounds) return;
        
        const centerLat = (sceneState.terrainBounds.minLat + sceneState.terrainBounds.maxLat) / 2;
        const centerLon = (sceneState.terrainBounds.minLon + sceneState.terrainBounds.maxLon) / 2;
        const latDelta = Math.abs(sceneState.terrainBounds.maxLat - sceneState.terrainBounds.minLat);
        const lonDelta = Math.abs(sceneState.terrainBounds.maxLon - sceneState.terrainBounds.minLon);
        
        const viewRadius = Math.max(latDelta, lonDelta) * 1.5;
        
        const currentTiles = [];
        mapTileGroup.children.forEach(mesh => {
          if (mesh.userData.tileKey) {
            const parts = mesh.userData.tileKey.split('_');
            if (parts.length === 3) {
              currentTiles.push({
                key: mesh.userData.tileKey,
                mesh: mesh,
                tx: parseInt(parts[1]),
                ty: parseInt(parts[2]),
                zoom: parseInt(parts[0])
              });
            }
          }
        });
        
        const visibleKeys = new Set();
        const visibleRange = INFINITE_MAP.chunkRadius;
        const tileSource = TOPO_SOURCES[currentTopoSource] || TOPO_SOURCES.opentopomap;
        
        currentTiles.forEach(tile => {
          const dist = Math.sqrt(
            Math.pow(tile.tx - centerLon / INFINITE_MAP.tileSize, 2) + 
            Math.pow(tile.ty - centerLat / INFINITE_MAP.tileSize, 2)
          );
          
          if (dist <= viewRadius / INFINITE_MAP.tileSize) {
            visibleKeys.add(tile.key);
            
            if (!tile.mesh.visible) {
              tile.mesh.visible = true;
            }
            if (!tile.mesh.userData.loaded) {
              tile.mesh.material.opacity = 0.2;
            } else {
              tile.mesh.material.opacity = 0.65;
            }
          } else {
            tile.mesh.visible = false;
          }
        });
      }

      function enableInfiniteMapMode() {
        INFINITE_MAP.enabled = true;
        
        if (!sceneState.terrainBounds) return;
        
        const centerLat = (sceneState.terrainBounds.minLat + sceneState.terrainBounds.maxLat) / 2;
        const centerLon = (sceneState.terrainBounds.minLon + sceneState.terrainBounds.maxLon) / 2;
        
        INFINITE_MAP.currentLat = centerLat;
        INFINITE_MAP.currentLon = centerLon;
        
        console.log('[InfiniteMap] Enabled at:', centerLat.toFixed(4), centerLon.toFixed(4));
      }

      async function loadAdjacentChunk(direction) {
        const { currentLat: lat, currentLon: lon } = INFINITE_MAP;
        const chunkLat = direction === 'north' ? lat + 0.02 : direction === 'south' ? lat - 0.02 : lat;
        const chunkLon = direction === 'east' ? lon + 0.02 : direction === 'west' ? lon - 0.02 : lon;
        
        const cacheKey = `${chunkLat.toFixed(4)}_${chunkLon.toFixed(4)}`;
        if (INFINITE_MAP.cache.has(cacheKey)) return;
        
        try {
          const payload = {
            lat: chunkLat,
            lon: chunkLon,
            high_res: false,
          };
          const data = await postJson("/api/geodata", payload);
          
          INFINITE_MAP.cache.set(cacheKey, {
            terrain: data.terrain,
            water: data.water,
            osm: data.osm
          });
          
          console.log('[InfiniteMap] Loaded chunk:', cacheKey);
        } catch (e) {
          console.warn('[InfiniteMap] Failed to load chunk:', e);
        }
      }

      function handleMapPan(deltaX, deltaZ) {
        if (!sceneState.terrainBounds) return;
        
        const worldScale = 111320;
        const latChange = -deltaZ / worldScale;
        const lonChange = deltaX / worldScale / Math.cos(INFINITE_MAP.currentLat * Math.PI / 180);
        
        INFINITE_MAP.currentLat += latChange;
        INFINITE_MAP.currentLon += lonChange;
        
        const bounds = sceneState.terrainBounds;
        const latSpan = bounds.maxLat - bounds.minLat;
        const lonSpan = bounds.maxLon - bounds.minLon;
        
        sceneState.terrainBounds = {
          minLat: INFINITE_MAP.currentLat - latSpan / 2,
          maxLat: INFINITE_MAP.currentLat + latSpan / 2,
          minLon: INFINITE_MAP.currentLon - lonSpan / 2,
          maxLon: INFINITE_MAP.currentLon + lonSpan / 2,
        };
        
        updateInfiniteMap();
        
        const edgeDist = 0.005;
        if (Math.abs(INFINITE_MAP.currentLat - bounds.maxLat) < edgeDist || 
            Math.abs(INFINITE_MAP.currentLat - bounds.minLat) < edgeDist ||
            Math.abs(INFINITE_MAP.currentLon - bounds.maxLon) < edgeDist ||
            Math.abs(INFINITE_MAP.currentLon - bounds.minLon) < edgeDist) {
          loadAdjacentChunk('north');
          loadAdjacentChunk('south');
          loadAdjacentChunk('east');
          loadAdjacentChunk('west');
        }
      }

      function generateDemoTerrain(n, minE, maxE) {
        const elevations = [];
        const range = maxE - minE;
        for (let i = 0; i < n; i++) {
          const row = [];
          for (let j = 0; j < n; j++) {
            const nx = j / (n - 1);
            const nz = i / (n - 1);
            const h = Math.sin(nx * Math.PI * 2) * Math.cos(nz * Math.PI * 2) * range * 0.3 
                    + Math.sin(nx * Math.PI * 4 + 1) * range * 0.2
                    + Math.cos(nz * Math.PI * 3 + 0.5) * range * 0.15
                    + Math.random() * range * 0.1;
            row.push(minE + range * 0.5 + h);
          }
          elevations.push(row);
        }
        return elevations;
      }

      const gpsBtn = document.getElementById("gpsBtn");
      if (gpsBtn) {
        gpsBtn.addEventListener("click", async () => {
          const status = document.getElementById("geoStatus");
          
          async function fetchIPLocation() {
            try {
              const res = await fetch("https://ipapi.co/json/", { timeout: 5000 });
              const data = await res.json();
              if (data.latitude && data.longitude) {
                return { lat: data.latitude, lon: data.longitude };
              }
            } catch (e) {}
            try {
              const res = await fetch("https://ipapi.co/json/", { timeout: 5000 });
              const data = await res.json();
              if (data.lat && data.lon) {
                return { lat: data.lat, lon: data.lon };
              }
            } catch (e) {}
            return null;
          }
          
          setStatus(status, "Detecting location...", true);
          
          if (navigator.geolocation) {
            try {
              const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                  enableHighAccuracy: true,
                  timeout: 5000,
                  maximumAge: 60000
                });
              });
              document.getElementById("lat").value = position.coords.latitude.toFixed(6);
              document.getElementById("lon").value = position.coords.longitude.toFixed(6);
              setStatus(status, "GPS location acquired. Click 'Load Terrain' to continue.", true);
              return;
            } catch (e) {
              console.log('[GPS] Browser geolocation failed, trying IP-based fallback');
            }
          }
          
          const ipLoc = await fetchIPLocation();
          if (ipLoc) {
            document.getElementById("lat").value = ipLoc.lat.toFixed(6);
            document.getElementById("lon").value = ipLoc.lon.toFixed(6);
            setStatus(status, `IP-based location detected (accuracy may vary). Load terrain to continue.`, true);
          } else {
            setStatus(status, "Could not detect location. Try entering coordinates manually.", false);
          }
        });
      }

      document.getElementById("loadGeo").addEventListener("click", async () => {
        const city = document.getElementById("city").value || null;
        const lat = document.getElementById("lat").value;
        const lon = document.getElementById("lon").value;
        const status = document.getElementById("geoStatus");
        status.textContent = "Loading...";
        status.className = "status-msg";
        
        progressiveLoader.loadingState = 'loading';
        
        try {
          showLoading(true, "Fetching terrain and weather...", 10);
          updateAnalysisProgress(10, "Fetching terrain and weather...");
          
          const geodataResult = await progressiveLoader.loadTerrainPhase2(city, lat, lon);
          
          if (!geodataResult || !geodataResult.ok) {
            status.textContent = "API unavailable. Using demo terrain...";
            status.className = "status-msg";
            showLoading(true, "Generating demo terrain...", 50);
            
            const demoTerrain = {
              lat: lat || 12.9716,
              lon: lon || 77.5946,
              lat_min: (lat || 12.9716) - 0.05,
              lat_max: (lat || 12.9716) + 0.05,
              lon_min: (lon || 77.5946) - 0.05,
              lon_max: (lon || 77.5946) + 0.05,
              elevations: generateDemoTerrain(32, 0, 100),
              min_elev: 0,
              max_elev: 100,
              size: 200,
              cell_size: 6.25,
              half: 100
            };
            const demoWeather = {
              temperature: 25,
              humidity: 60,
              rainfall: 1500,
              wind_speed: 10,
              cloud_cover: 30
            };
            
            rebuildWorld(demoTerrain, null, demoWeather, null);
            weatherData = demoWeather;
            goToStep(2);
            showLoading(false);
            return;
          }
          
          weatherData = geodataResult.weather || null;
          waterData = geodataResult.water || null;
          const osmData = geodataResult.osm || null;
          
          if (geodataResult.terrain && geodataResult.weather) {
            geodataResult.weather.terrain_bounds = {
              lat_min: geodataResult.terrain.lat_min,
              lat_max: geodataResult.terrain.lat_max,
              lon_min: geodataResult.terrain.lon_min,
              lon_max: geodataResult.terrain.lon_max,
            };
          }
          
          showLoading(true, "Building terrain...", 50);
          updateAnalysisProgress(50, "Building terrain...");
          
          rebuildWorld(geodataResult.terrain, waterData, weatherData, osmData);
          
          if (weatherTimeline) weatherTimeline.setForecast(geodataResult.weather || {});
          
          showLoading(true, "Initializing...", 85);
          progressiveLoader.initializeDeferredSystems();
          
          showOutput(geodataResult);
          
          status.textContent = "Terrain loaded successfully!";
          status.className = "status-msg";
          
          if (geodataResult.location) {
            progressiveLoader.loadRadarOnDemand(
              Number(geodataResult.location.lat),
              Number(geodataResult.location.lon)
            );
          }
          
          setTimeout(() => {
            progressiveLoader.loadHeavySystems();
          }, 500);
          
          goToStep(2);
          
          const quality = progressiveLoader.qualityLevel;
          document.getElementById('quality-select').value = quality;
          
        } catch (err) {
          console.error('[Load] Error:', err);
          status.textContent = err.message;
          status.className = "status-msg error";
        } finally {
          showLoading(false);
          progressiveLoader.loadingState = 'idle';
        }
      });

      document.getElementById("runAnalysis").addEventListener("click", async () => {
        const status = document.getElementById("analysisStatus");
        
        goToStep(3);
        updateAnalysisProgress(20, "Preparing data...");
        
        if (!weatherData) {
          status.textContent = "Load terrain first!";
          status.className = "status-msg error";
          goToStep(2);
          return;
        }
        
        status.textContent = "Analyzing...";
        try {
          updateAnalysisProgress(40, "Running analysis...");
          
          const payload = {
            weather: weatherData,
            roof_area: Number(document.getElementById("roof_area").value || 0),
            surface: document.getElementById("surface").value,
            land_area: Number(document.getElementById("land_area").value || 0),
            land_type: document.getElementById("land_type").value,
            people: Number(document.getElementById("people").value || 0),
            kitchen: document.getElementById("kitchen").checked,
            ac_units: Number(document.getElementById("ac_units").value || 0),
            ac_hrs: Number(document.getElementById("ac_hrs").value || 0),
            ac_mos: Number(document.getElementById("ac_mos").value || 0),
            soil: document.getElementById("soil").value,
          };
          
          updateAnalysisProgress(70, "Calculating recommendations...");
          const data = await postJson("/api/analyze", payload);
          
          updateAnalysisProgress(100, "Complete!");
          showOutput(data);
          
          setTimeout(() => {
            showResults(data);
          }, 300);
          
          if (terrainGrid) {
            buildProperty(payload.roof_area);
            buildDataViz(data.data?.methods || []);
          }
        } catch (err) {
          status.textContent = err.message;
          status.className = "status-msg error";
          goToStep(2);
        }
      });

      function rebuildWorld(terrain, water, weather, osmData = null) {
        clearWorld();
        sceneState.geodata = {
          terrain,
          water,
          bbox: terrain ? {
            minLat: terrain.lat_min,
            maxLat: terrain.lat_max,
            minLon: terrain.lon_min,
            maxLon: terrain.lon_max,
          } : null,
          osm: osmData,
        };
        sceneState.weatherData = weather || null;
        sceneState.terrainBounds = sceneState.geodata.bbox;
        const current = normalizeWeatherSnapshot(weather?.current || weather || {});
        let hour = new Date().getHours();
        if (current.time && current.time.includes("T")) {
          const parsed = Number(current.time.split("T")[1]?.split(":")[0]);
          if (Number.isFinite(parsed)) hour = parsed;
        }
        sceneState.currentHour = hour;
        sceneState.cloudCover = current.cloudCover;
        sceneState.isRaining = current.precipitation > 0.05;
        buildTerrain(terrain, water?.rivers || [], water?.lakes || []);
        buildRivers(water?.rivers || []);
        buildLakes(water?.lakes || []);
        
        if (osmData) {
          buildRoadsFromOSM(osmData.roads || {});
          buildBoundariesFromOSM(osmData.boundaries || []);
          buildEnhancedLabels(osmData);
        }
        
        updateFog(scene, current.weatherCode, sceneState.isRaining, current.precipitation, current.cloudCover);
        if (weatherLayerManager) weatherLayerManager.update(current);
        addPrimaryLabels(water, weather);
        enableInfiniteMapMode();
        flyToView("overview");
      }

      function catmullRom(p0, p1, p2, p3, t) {
        const t2 = t * t;
        const t3 = t2 * t;
        return 0.5 * (
          (2 * p1) +
          (-p0 + p2) * t +
          (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
          (-p0 + 3 * p1 - 3 * p2 + p3) * t3
        );
      }

      function bicubicSample(grid, fi, fj, ti, tj) {
        const rows = [];
        for (let m = -1; m <= 2; m++) {
          const r = clamp(fi + m, 0, grid.length - 1);
          const p0 = grid[r][clamp(fj - 1, 0, grid[0].length - 1)];
          const p1 = grid[r][clamp(fj, 0, grid[0].length - 1)];
          const p2 = grid[r][clamp(fj + 1, 0, grid[0].length - 1)];
          const p3 = grid[r][clamp(fj + 2, 0, grid[0].length - 1)];
          rows.push(catmullRom(p0, p1, p2, p3, tj));
        }
        return catmullRom(rows[0], rows[1], rows[2], rows[3], ti);
      }

      function bicubicInterpolate(grid, newSize) {
        const result = new Array(newSize);
        for (let i = 0; i < newSize; i++) {
          result[i] = new Array(newSize);
          for (let j = 0; j < newSize; j++) {
            const oi = i * (grid.length - 1) / (newSize - 1);
            const oj = j * (grid[0].length - 1) / (newSize - 1);
            const fi = Math.floor(oi);
            const fj = Math.floor(oj);
            const ti = oi - fi;
            const tj = oj - fj;
            result[i][j] = bicubicSample(grid, fi, fj, ti, tj);
          }
        }
        return result;
      }

      function applyMicroNoise(grid, minE, maxE) {
        const range = Math.max(maxE - minE, 1);
        for (let i = 0; i < grid.length; i++) {
          for (let j = 0; j < grid[0].length; j++) {
            const t = (grid[i][j] - minE) / range;
            if (t < 0.15 || t > 0.85) continue;
            const n = fract(Math.sin(i * 127.1 + j * 311.7) * 43758.5453);
            const amp = range * 0.015;
            grid[i][j] += (n - 0.5) * amp;
          }
        }
      }

      function buildTerrain(td, rivers = [], lakes = []) {
        console.log('[Terrain] buildTerrain called with:', td ? 'terrain data' : 'no data');
        
        if (!td?.elevations?.length) {
          console.warn('[Terrain] No elevation data - creating demo terrain');
          const demoN = 32;
          const demoElevations = [];
          for (let i = 0; i < demoN; i++) {
            const row = [];
            for (let j = 0; j < demoN; j++) {
              const nx = j / (demoN - 1);
              const nz = i / (demoN - 1);
              const height = Math.sin(nx * Math.PI * 2) * Math.cos(nz * Math.PI * 2) * 30 
                           + Math.sin(nx * Math.PI * 4 + 1) * 20
                           + Math.cos(nz * Math.PI * 3 + 0.5) * 15;
              row.push(height + 30);
            }
            demoElevations.push(row);
          }
          td = {
            elevations: demoElevations,
            min_elev: 0,
            max_elev: 75,
            lat_min: 0,
            lat_max: 0.1,
            lon_min: 0,
            lon_max: 0.1
          };
        }
        
        const rawGrid = td.elevations;
        console.log('[Terrain] Elevation grid size:', rawGrid.length, 'x', rawGrid[0]?.length);
        console.log('[Terrain] Min elevation:', td.min_elev, 'Max elevation:', td.max_elev);
        console.log('[Terrain] Bounds:', td.lat_min, td.lat_max, td.lon_min, td.lon_max);
        const terrainGridSize = Math.min(rawGrid.length, 64);
        const terrainSize = 200;
        let minE = Number(td.min_elev ?? 0);
        let maxE = Number(td.max_elev ?? 1);
        let range = maxE - minE;
        
        if (range < 1) {
          console.log('[Terrain] Flat terrain detected, adding variation');
          for (let i = 0; i < rawGrid.length; i++) {
            for (let j = 0; j < rawGrid[i].length; j++) {
              const nx = j / rawGrid.length;
              const nz = i / rawGrid.length;
              rawGrid[i][j] = Math.sin(nx * Math.PI * 3) * Math.cos(nz * Math.PI * 2) * 50 
                            + Math.sin(nx * Math.PI * 7) * 25 
                            + Math.cos(nz * Math.PI * 5) * 20;
            }
          }
          minE = -50;
          maxE = 100;
          td.min_elev = -50;
          td.max_elev = 100;
        }
        
        range = Math.max(maxE - minE, 1);
        const heightScale = clamp(range * 0.18, 18, 60);
        
        const resizedGrid = [];
        for (let i = 0; i < terrainGridSize; i++) {
          const srcRow = Math.floor(i * rawGrid.length / terrainGridSize);
          const row = [];
          for (let j = 0; j < terrainGridSize; j++) {
            const srcCol = Math.floor(j * rawGrid[0].length / terrainGridSize);
            row.push(rawGrid[srcRow][srcCol]);
          }
          resizedGrid.push(row);
        }
        
        const normalizedGrid = resizedGrid.map((row) => row.map((value) => clamp((value - minE) / range, 0, 1)));

        terrainGrid = rawGrid;
        terrainGS = terrainGridSize;
        terrainCellSize = terrainSize / Math.max(terrainGridSize - 1, 1);
        terrainHalf = terrainSize / 2;
        terrainMinE = minE;
        terrainMaxE = maxE;
        terrainRange = range;
        terrainExag = heightScale / (range * SCALE);

        sceneState.terrainElevationGrid = normalizedGrid;
        sceneState.terrainN = terrainGridSize;
        sceneState.terrainSize = terrainSize;
        sceneState.terrainHeightScale = heightScale;
        sceneState.terrainBounds = {
          minLat: td.lat_min,
          maxLat: td.lat_max,
          minLon: td.lon_min,
          maxLon: td.lon_max,
        };

        const geometry = new THREE.PlaneGeometry(terrainSize, terrainSize, terrainGridSize - 1, terrainGridSize - 1);
        geometry.rotateX(-Math.PI / 2);
        const positions = geometry.attributes.position;
        for (let i = 0; i < positions.count; i++) {
          const gridX = i % terrainGridSize;
          const gridZ = Math.floor(i / terrainGridSize);
          positions.setY(i, (normalizedGrid[gridZ]?.[gridX] ?? 0) * heightScale);
        }
        positions.needsUpdate = true;
        geometry.computeVertexNormals();

        const elevationRamp = buildElevationRampTexture();
        const wetnessMap = buildWetnessMap(normalizedGrid, rivers, lakes);
        
        terrainHillshadeTexture = computeHillshadeFromGrid(normalizedGrid);
        terrainSlopeTexture = computeSlopeMapFromGrid(normalizedGrid);
        terrainFlowTexture = computeFlowAccumulationFromGrid(normalizedGrid);
        
        const material = enhancedTerrainMaterial.createMaterial(elevationRamp, wetnessMap);
        terrainShaderMat = material;
        
        if (terrainShaderMat.uniforms) {
          terrainShaderMat.uniforms.uHillshade.value = terrainHillshadeTexture;
          terrainShaderMat.uniforms.uSlopeMap.value = terrainSlopeTexture;
          terrainShaderMat.uniforms.uFlowMap.value = terrainFlowTexture;
          terrainShaderMat.uniforms.uTopoMode.value = 1.0;
        }

        terrainMesh = new THREE.Mesh(geometry, material);
        terrainMesh.receiveShadow = true;
        terrainMesh.castShadow = false;
        scene.add(terrainMesh);
        sceneState.terrainMesh = terrainMesh;
        console.log('[Terrain] Mesh added to scene, vertex count:', geometry.attributes.position.count);
        console.log('[Scene] Total children:', scene.children.length);
        
        buildEnhancedContours(normalizedGrid, terrainGridSize, terrainCellSize, terrainHalf, minE, range, terrainExag);
        
        buildMapTileOverlay(sceneState.terrainBounds, TOPO_SOURCES.esri_imagery);
        console.log('[Scene] Camera position:', camera.position.x.toFixed(1), camera.position.y.toFixed(1), camera.position.z.toFixed(1));
      }

      function getTerrainColor(t, slopeDeg, elevation, row, col, gridSize) {
        const ramp = [
          { t: 0.00, r: 0.56, g: 0.70, b: 0.58 },
          { t: 0.03, r: 0.48, g: 0.64, b: 0.42 },
          { t: 0.06, r: 0.38, g: 0.58, b: 0.32 },
          { t: 0.10, r: 0.30, g: 0.52, b: 0.22 },
          { t: 0.15, r: 0.25, g: 0.48, b: 0.18 },
          { t: 0.20, r: 0.22, g: 0.44, b: 0.16 },
          { t: 0.28, r: 0.18, g: 0.38, b: 0.12 },
          { t: 0.35, r: 0.16, g: 0.34, b: 0.10 },
          { t: 0.42, r: 0.28, g: 0.40, b: 0.15 },
          { t: 0.50, r: 0.42, g: 0.44, b: 0.22 },
          { t: 0.58, r: 0.52, g: 0.46, b: 0.28 },
          { t: 0.65, r: 0.48, g: 0.42, b: 0.32 },
          { t: 0.72, r: 0.44, g: 0.40, b: 0.36 },
          { t: 0.78, r: 0.50, g: 0.48, b: 0.44 },
          { t: 0.84, r: 0.56, g: 0.54, b: 0.52 },
          { t: 0.89, r: 0.62, g: 0.61, b: 0.60 },
          { t: 0.93, r: 0.72, g: 0.72, b: 0.73 },
          { t: 0.96, r: 0.82, g: 0.83, b: 0.86 },
          { t: 0.98, r: 0.90, g: 0.91, b: 0.93 },
          { t: 1.00, r: 0.96, g: 0.97, b: 0.98 },
        ];
        let r, g, b;
        for (let k = 0; k < ramp.length - 1; k++) {
          if (t >= ramp[k].t && t <= ramp[k + 1].t) {
            const lt = (t - ramp[k].t) / (ramp[k + 1].t - ramp[k].t);
            const st = lt * lt * (3 - 2 * lt);
            r = ramp[k].r + (ramp[k + 1].r - ramp[k].r) * st;
            g = ramp[k].g + (ramp[k + 1].g - ramp[k].g) * st;
            b = ramp[k].b + (ramp[k + 1].b - ramp[k].b) * st;
            break;
          }
        }
        if (r === undefined) {
          const last = ramp[ramp.length - 1];
          r = last.r; g = last.g; b = last.b;
        }

        if (slopeDeg > 5) {
          const slopeEffect = Math.min((slopeDeg - 5) / 35, 1.0);
          const rockR = 0.38, rockG = 0.35, rockB = 0.30;
          const blend = slopeEffect * 0.5;
          r = r * (1 - blend) + rockR * blend;
          g = g * (1 - blend) + rockG * blend;
          b = b * (1 - blend) + rockB * blend;
          const darken = 1 - slopeEffect * 0.25;
          r *= darken; g *= darken; b *= darken;
        }

        const edgeX = Math.min(col, gridSize - 1 - col) / (gridSize * 0.15);
        const edgeZ = Math.min(row, gridSize - 1 - row) / (gridSize * 0.15);
        const edgeFade = Math.min(Math.min(edgeX, edgeZ), 1.0);
        const edgeDarken = 0.5 + edgeFade * 0.5;
        r *= edgeDarken; g *= edgeDarken; b *= edgeDarken;

        const noise = fract(Math.sin(row * 127.1 + col * 311.7) * 43758.5453);
        const variation = (noise - 0.5) * 0.04;
        r = clamp(r + variation, 0, 1);
        g = clamp(g + variation, 0, 1);
        b = clamp(b + variation, 0, 1);
        return [r, g, b];
      }

      function buildTerrainSkirt(positions, GS, cellSize, halfSize) {
        const skirtDepth = 8;
        const edges = [];
        for (let j = 0; j < GS; j++) {
          const idx = j;
          edges.push({
            x: positions[idx * 3], y: positions[idx * 3 + 1], z: positions[idx * 3 + 2],
            bottomY: -skirtDepth
          });
        }
        for (let i = 0; i < GS; i++) {
          const idx = i * GS + (GS - 1);
          edges.push({
            x: positions[idx * 3], y: positions[idx * 3 + 1], z: positions[idx * 3 + 2],
            bottomY: -skirtDepth
          });
        }
        for (let j = GS - 1; j >= 0; j--) {
          const idx = (GS - 1) * GS + j;
          edges.push({
            x: positions[idx * 3], y: positions[idx * 3 + 1], z: positions[idx * 3 + 2],
            bottomY: -skirtDepth
          });
        }
        for (let i = GS - 1; i >= 0; i--) {
          const idx = i * GS;
          edges.push({
            x: positions[idx * 3], y: positions[idx * 3 + 1], z: positions[idx * 3 + 2],
            bottomY: -skirtDepth
          });
        }
        const skirtPositions = [];
        const skirtColors = [];
        for (let k = 0; k < edges.length; k++) {
          const a = edges[k];
          const b = edges[(k + 1) % edges.length];
          const verts = [
            a.x, a.y, a.z,
            b.x, b.y, b.z,
            a.x, a.bottomY, a.z,
            a.x, a.bottomY, a.z,
            b.x, b.y, b.z,
            b.x, b.bottomY, b.z,
          ];
          skirtPositions.push(...verts);
          for (let v = 0; v < 6; v++) {
            const isBottom = (v === 2 || v === 3 || v === 5);
            if (isBottom) skirtColors.push(0.12, 0.10, 0.08);
            else skirtColors.push(0.25, 0.22, 0.18);
          }
        }
        const geom = new THREE.BufferGeometry();
        geom.setAttribute("position", new THREE.Float32BufferAttribute(skirtPositions, 3));
        geom.setAttribute("color", new THREE.Float32BufferAttribute(skirtColors, 3));
        geom.computeVertexNormals();
        const mat = new THREE.MeshStandardMaterial({
          vertexColors: true, roughness: 0.95, metalness: 0
        });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.receiveShadow = true;
        scene.add(mesh);
      }

      function buildContourLines(grid, GS, cellSize, halfSize, minE, range, exag) {
        const numContours = Math.max(12, Math.floor(range / 20));
        const interval = Math.max(range / numContours, 20);
        const contourGroup = new THREE.Group();
        for (let level = 0; level < numContours; level++) {
          const targetElev = minE + (level + 1) * interval;
          const targetRealElev = minE + (level + 1) * interval;
          const isMajor = Math.round(targetRealElev) % 100 < 20;
          const segments = [];
          for (let i = 0; i < GS - 1; i++) {
            for (let j = 0; j < GS - 1; j++) {
              const e00 = grid[i][j];
              const e10 = grid[i][j + 1];
              const e01 = grid[i + 1][j];
              const e11 = grid[i + 1][j + 1];
              const crossings = [];
              function checkEdge(e1, e2, x1, z1, x2, z2) {
                if ((e1 < targetElev && e2 >= targetElev) || (e2 < targetElev && e1 >= targetElev)) {
                  const t = (targetElev - e1) / (e2 - e1);
                  crossings.push({ x: x1 + (x2 - x1) * t, z: z1 + (z2 - z1) * t });
                }
              }
              const x0 = j * cellSize - halfSize;
              const x1 = (j + 1) * cellSize - halfSize;
              const z0 = -(i * cellSize - halfSize);
              const z1 = -((i + 1) * cellSize - halfSize);
              checkEdge(e00, e10, x0, z0, x1, z0);
              checkEdge(e10, e11, x1, z0, x1, z1);
              checkEdge(e01, e11, x0, z1, x1, z1);
              checkEdge(e00, e01, x0, z0, x0, z1);
              if (crossings.length >= 2) {
                const y = (targetElev - minE) * SCALE * exag + 0.08;
                segments.push(
                  new THREE.Vector3(crossings[0].x, y, crossings[0].z),
                  new THREE.Vector3(crossings[1].x, y, crossings[1].z)
                );
              }
            }
          }
          if (segments.length > 0) {
            const geom = new THREE.BufferGeometry().setFromPoints(segments);
            const mat = new THREE.LineBasicMaterial({
              color: isMajor ? 0x3d2817 : 0x6b4423,
              transparent: true,
              opacity: isMajor ? 0.70 : 0.40,
              depthWrite: false,
            });
            const lines = new THREE.LineSegments(geom, mat);
            contourGroup.add(lines);
          }
        }
        scene.add(contourGroup);
        contourLineGroup = contourGroup;
      }

      function buildRivers(rivers) {
        console.log('[Rivers] Building rivers, count:', rivers?.length || 0);
        sceneState.riverMeshes = [];
        sceneState.riverSegments = [];
        riverGroup = new THREE.Group();
        riverGroup.renderOrder = 2;
        
        const streamOrders = {};
        
        function calculateStreamOrder(accumulation) {
          const acc = Math.max(accumulation || 10, 1);
          const log = Math.log10(acc);
          if (log > 3.7) return 7;
          if (log > 3.3) return 6;
          if (log > 2.9) return 5;
          if (log > 2.4) return 4;
          if (log > 1.7) return 3;
          if (log > 1.0) return 2;
          return 1;
        }
        
        function getStreamColor(order) {
          const colors = [
            0xa8d8ea,
            0x87ceeb,
            0x4fc3f7,
            0x29b6f6,
            0x03a9f4,
            0x0288d1,
            0x01579b,
            0x013a5c
          ];
          return colors[Math.min(order - 1, 7)];
        }
        
        function getStreamWidth(order, accumulation) {
          const baseWidth = 0.3 + order * 0.4;
          const logScale = 1 + Math.log10(Math.max(accumulation, 1) + 1) * 0.15;
          const flowScale = Math.min(accumulation / 5000, 2.5);
          return baseWidth * logScale * (0.8 + flowScale * 0.4);
        }
        
        for (const river of rivers || []) {
          if (!river?.points || river.points.length < 2) continue;
          
          const flowAccumulation = river.accumulation || river.flow || 100;
          const streamOrder = calculateStreamOrder(flowAccumulation);
          river.streamOrder = streamOrder;
          
          if (!streamOrders[streamOrder]) streamOrders[streamOrder] = [];
          streamOrders[streamOrder].push(river);
          
          const worldPoints = river.points.map((point) => {
            const lat = Array.isArray(point) ? point[0] : point.lat;
            const lon = Array.isArray(point) ? point[1] : point.lon;
            const world = latLonToWorld(lat, lon);
            const terrainY = sampleTerrainHeight(world.x, world.z);
            return new THREE.Vector3(world.x, terrainY, world.z);
          });
          
          const curve = new THREE.CatmullRomCurve3(worldPoints, false, "centripetal");
          const baseWidth = getStreamWidth(streamOrder, flowAccumulation);
          const tubeSegments = Math.max(worldPoints.length * 5, 36);
          const popOutHeight = 0.5 + streamOrder * 0.1;
          const color = getStreamColor(streamOrder);

          const bankGeometry = new THREE.TubeGeometry(curve, tubeSegments, baseWidth * 2.5, 12, false);
          const bankMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color("#4a4035"),
            roughness: 1,
            metalness: 0,
            transparent: true,
            opacity: 0.5,
          });
          const bankMesh = new THREE.Mesh(bankGeometry, bankMaterial);
          bankMesh.position.y = -popOutHeight * 0.4;
          bankMesh.renderOrder = 0;
          riverGroup.add(bankMesh);

          const bedGeometry = new THREE.TubeGeometry(curve, tubeSegments, baseWidth * 1.8, 10, false);
          const bedMaterial = new THREE.MeshStandardMaterial({
            color: new THREE.Color("#2d3a2e"),
            roughness: 1,
            metalness: 0,
            transparent: true,
            opacity: 0.7,
          });
          const bedMesh = new THREE.Mesh(bedGeometry, bedMaterial);
          bedMesh.position.y = -popOutHeight * 0.2;
          bedMesh.renderOrder = 0;
          riverGroup.add(bedMesh);

          const waterGeometry = new THREE.TubeGeometry(curve, tubeSegments, baseWidth, 12, false);
          const waterMaterial = new THREE.ShaderMaterial({
            uniforms: {
              uTime: { value: 0 },
              uFlowSpeed: { value: 0.25 + streamOrder * 0.08 },
              uBaseColor: { value: new THREE.Color(color) },
              uFoamColor: { value: new THREE.Color("#ffffff") },
              uDepth: { value: streamOrder * 0.3 },
              uTurbulence: { value: 0.5 + streamOrder * 0.1 },
            },
            vertexShader: `
              varying vec2 vUv;
              varying vec3 vPosition;
              varying float vWidth;
              void main() {
                vUv = uv;
                vPosition = position;
                vWidth = length(vec2(dFdx(position.x), dFdx(position.z)));
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `,
            fragmentShader: `
              uniform float uTime;
              uniform float uFlowSpeed;
              uniform vec3 uBaseColor;
              uniform vec3 uFoamColor;
              uniform float uDepth;
              uniform float uTurbulence;
              varying vec2 vUv;
              varying vec3 vPosition;
              varying float vWidth;
              
              float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
              }
              
              float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                return mix(
                  mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                  mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
                  f.y
                );
              }
              
              void main() {
                float speed = uFlowSpeed * (1.0 + sin(uTime * 0.5) * 0.15);
                float flow1 = fract(vUv.x * 6.0 - uTime * speed);
                float flow2 = fract(vUv.x * 12.0 - uTime * speed * 1.5 + 0.3);
                
                float n1 = noise(vUv * vec2(4.0, 8.0) + vec2(-uTime * speed * 2.0, 0.0));
                float n2 = noise(vUv * vec2(8.0, 16.0) + vec2(-uTime * speed * 3.0, uTime * 0.5));
                float turbulence = (n1 * 0.6 + n2 * 0.4) * uTurbulence;
                
                float foam1 = smoothstep(0.35, 0.65, flow1) * (1.0 - smoothstep(0.65, 0.95, flow1));
                float foam2 = smoothstep(0.4, 0.6, flow2) * (1.0 - smoothstep(0.6, 0.9, flow2));
                float foam = mix(foam1, foam2, 0.4) + turbulence * 0.2;
                
                float edgeDist = abs(vUv.y - 0.5) * 2.0;
                float edgeFoam = smoothstep(0.7, 1.0, edgeDist) * 0.4;
                foam = max(foam, edgeFoam);
                
                float depthFade = 0.5 + uDepth * 0.5;
                vec3 deepColor = uBaseColor * 0.6;
                vec3 midColor = uBaseColor * depthFade;
                vec3 color = mix(deepColor, midColor, 0.5 + turbulence * 0.3);
                color = mix(color, uFoamColor, foam * 0.5);
                
                float highlight = pow(foam, 2.0) * 0.3;
                color += highlight;
                
                float alpha = 0.8 + foam * 0.2;
                float edgeFade = smoothstep(0.9, 0.7, edgeDist);
                alpha *= edgeFade;
                
                gl_FragColor = vec4(color, alpha);
              }
            `,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
          });
          
          const mesh = new THREE.Mesh(waterGeometry, waterMaterial);
          mesh.position.y = popOutHeight;
          mesh.castShadow = false;
          mesh.receiveShadow = false;
          mesh.renderOrder = 3;
          mesh.userData.baseY = popOutHeight;
          mesh.userData.streamOrder = streamOrder;
          mesh.userData.accumulation = flowAccumulation;
          riverGroup.add(mesh);
          sceneState.riverMeshes.push(mesh);
          
          const segmentData = { mesh, curve, baseWidth, streamOrder, flowAccumulation };
          sceneState.riverSegments.push(segmentData);

          const glowGeometry = new THREE.TubeGeometry(curve, tubeSegments, baseWidth * 1.3, 8, false);
          const glowMaterial = new THREE.MeshBasicMaterial({
            color: new THREE.Color(color),
            transparent: true,
            opacity: 0.25,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          });
          const glowMesh = new THREE.Mesh(glowGeometry, glowMaterial);
          glowMesh.position.y = popOutHeight + 0.1;
          glowMesh.renderOrder = 2;
          riverGroup.add(glowMesh);
        }
        
        console.log('[Rivers] Stream orders:', Object.keys(streamOrders).map(k => `Order ${k}: ${streamOrders[k].length}`).join(', '));
        scene.add(riverGroup);
        riverFlowSystems = [];
      }

      function buildLakes(lakes) {
        console.log('[Lakes] Building lakes, count:', lakes?.length || 0);
        sceneState.lakeMeshes = [];
        sceneState.lakeGlows = [];
        sceneState.lakeData = [];
        lakeGroup = new THREE.Group();
        lakeGroup.renderOrder = 2;
        
        for (const lake of lakes || []) {
          const points = lake?.points || [];
          if (points.length < 3) continue;
          
          const area = lake.area || 10;
          const depth = lake.depth || 5;
          
          const worldPoints = points.map((point) => {
            const lat = Array.isArray(point) ? point[0] : point.lat;
            const lon = Array.isArray(point) ? point[1] : point.lon;
            return latLonToWorld(lat, lon);
          });
          
          const centroid = computePolygonCentroid(points);
          const centerWorld = latLonToWorld(centroid.lat, centroid.lon);
          const centerY = sampleTerrainHeight(centerWorld.x, centerWorld.z);
          
          const points3D = worldPoints.map(wp => {
            const y = sampleTerrainHeight(wp.x, wp.z);
            return new THREE.Vector3(wp.x, y, wp.z);
          });
          
          const shape = new THREE.Shape();
          shape.moveTo(points3D[0].x, points3D[0].z);
          for (let i = 1; i < points3D.length; i++) {
            shape.lineTo(points3D[i].x, points3D[i].z);
          }
          shape.closePath();
          
          const minX = Math.min(...points3D.map(p => p.x));
          const maxX = Math.max(...points3D.map(p => p.x));
          const minZ = Math.min(...points3D.map(p => p.z));
          const maxZ = Math.max(...points3D.map(p => p.z));
          const width = maxX - minX;
          const height = maxZ - minZ;
          const maxDim = Math.max(width, height);
          
          const lakeGeometry = new THREE.ShapeGeometry(shape, 32);
          lakeGeometry.rotateX(-Math.PI / 2);
          
          const positions = lakeGeometry.attributes.position;
          for (let i = 0; i < positions.count; i++) {
            const x = positions.getX(i);
            const z = positions.getZ(i);
            const terrainY = sampleTerrainHeight(x, z);
            positions.setY(i, terrainY);
          }
          positions.needsUpdate = true;
          lakeGeometry.computeVertexNormals();
          
          const lakeMaterial = new THREE.ShaderMaterial({
            uniforms: {
              uTime: { value: 0 },
              uCenterX: { value: centerWorld.x },
              uCenterZ: { value: centerWorld.z },
              uDepth: { value: depth },
              uArea: { value: area },
              uBaseColor: { value: new THREE.Color("#1565c0") },
              uDeepColor: { value: new THREE.Color("#0a3570") },
              uShallowColor: { value: new THREE.Color("#5cbae8") },
              uMaxDim: { value: maxDim },
            },
            vertexShader: `
              varying vec3 vWorldPos;
              varying vec2 vUv;
              varying float vEdgeDist;
              void main() {
                vWorldPos = position;
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `,
            fragmentShader: `
              uniform float uTime;
              uniform vec3 uBaseColor;
              uniform vec3 uDeepColor;
              uniform vec3 uShallowColor;
              uniform float uDepth;
              uniform float uCenterX;
              uniform float uCenterZ;
              uniform float uMaxDim;
              varying vec3 vWorldPos;
              varying vec2 vUv;
              
              float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
              }
              
              float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                return mix(
                  mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                  mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
                  f.y
                );
              }
              
              float fbm(vec2 p) {
                float f = 0.0;
                f += 0.5000 * noise(p); p *= 2.02;
                f += 0.2500 * noise(p); p *= 2.03;
                f += 0.1250 * noise(p); p *= 2.01;
                f += 0.0625 * noise(p);
                return f;
              }
              
              void main() {
                float dist = length(vWorldPos.xz - vec2(uCenterX, uCenterZ));
                float maxDist = max(uMaxDim * 0.5, 20.0);
                float normalizedDepth = clamp(dist / maxDist, 0.0, 1.0);
                
                float depthGradient = pow(normalizedDepth, 0.7);
                vec3 waterColor = mix(uDeepColor, uBaseColor, 0.3 + depthGradient * 0.5);
                waterColor = mix(waterColor, uShallowColor, pow(1.0 - normalizedDepth, 2.0) * 0.5);
                
                float time = uTime * 0.3;
                vec2 ripplePos = vWorldPos.xz * 2.0;
                float ripple1 = sin(length(ripplePos + vec2(sin(time), cos(time * 0.7)) * 3.0) * 4.0 - uTime * 2.5);
                float ripple2 = sin(length(ripplePos + vec2(cos(time * 0.8), sin(time)) * 2.5) * 5.0 - uTime * 2.0);
                float ripples = (ripple1 + ripple2) * 0.1 + 0.1;
                
                float fbmRipple = fbm(vWorldPos.xz * 1.5 + time * 0.5);
                ripples += (fbmRipple - 0.5) * 0.15;
                
                float caustic1 = sin(vWorldPos.x * 12.0 + time * 1.5) * sin(vWorldPos.z * 10.0 + time * 1.2);
                float caustic2 = sin(vWorldPos.x * 8.0 - time * 0.8) * sin(vWorldPos.z * 14.0 + time * 0.9);
                float caustics = (caustic1 + caustic2) * 0.03;
                
                float shimmer = sin(vWorldPos.x * 6.0 + time * 1.5) * sin(vWorldPos.z * 5.0 + time) * 0.04;
                
                waterColor += ripples * uShallowColor * 0.4;
                waterColor += caustics * vec3(1.0, 1.0, 0.9);
                waterColor += shimmer;
                
                float edge = smoothstep(0.0, 0.25, normalizedDepth);
                float alpha = 0.8 * (1.0 - edge * 0.3);
                
                float specular = pow(max(sin(vWorldPos.x * 4.0 + uTime) * sin(vWorldPos.z * 4.0 + uTime * 0.8), 0.0), 8.0) * 0.15;
                waterColor += specular * vec3(1.0, 1.0, 1.0);
                
                gl_FragColor = vec4(waterColor, alpha);
              }
            `,
            transparent: true,
            depthWrite: false,
            side: THREE.DoubleSide,
          });
           
          const lakeMesh = new THREE.Mesh(lakeGeometry, lakeMaterial);
          lakeMesh.renderOrder = 3;
          lakeMesh.userData.depth = depth;
          lakeMesh.userData.area = area;
          lakeGroup.add(lakeMesh);
          sceneState.lakeMeshes.push(lakeMesh);
          sceneState.lakeData.push({ mesh: lakeMesh, material: lakeMaterial, depth, area });
          
          const edgePoints = points3D.map(p => new THREE.Vector3(p.x, p.y + 0.05, p.z));
          const edgeCurve = new THREE.CatmullRomCurve3([...edgePoints, edgePoints[0]], true);
          const edgeGeometry = new THREE.TubeGeometry(edgeCurve, 64, 0.08, 8, true);
          const edgeMaterial = new THREE.LineBasicMaterial({
            color: 0x1565c0,
            transparent: true,
            opacity: 0.6,
          });
          const edgeLine = new THREE.Line(edgeGeometry, edgeMaterial);
          edgeLine.renderOrder = 4;
          lakeGroup.add(edgeLine);
          
          const glowGeom = new THREE.BufferGeometry().setFromPoints(
            edgePoints.map(p => new THREE.Vector3(p.x, p.y + 0.1, p.z))
          );
          const glowMat = new THREE.LineBasicMaterial({
            color: 0x64b5f6,
            transparent: true,
            opacity: 0.3,
            blending: THREE.AdditiveBlending,
          });
          const glowLine = new THREE.Line(glowGeom, glowMat);
          glowLine.renderOrder = 2;
          lakeGroup.add(glowLine);
          sceneState.lakeGlows.push(glowLine);
        }
        
        scene.add(lakeGroup);
        lakeMeshes = sceneState.lakeMeshes.map((mesh) => ({ mesh, material: mesh.material }));
      }

      function buildSky() {
        if (!sceneState.skySystem) {
          sceneState.skySystem = new AquaSkySystem(scene);
        }
        skyMat = sceneState.skySystem.skyMaterial;
      }

      function buildClouds(cloudCover, windDir) {
        if (cloudGroup) {
          cloudGroup.traverse(c => {
            if (c.geometry) c.geometry.dispose();
            if (c.material) {
              if (c.material.map) c.material.map.dispose();
              c.material.dispose();
            }
          });
          scene.remove(cloudGroup);
          cloudGroup = null;
        }
        cloudGroup = new THREE.Group();
        cloudData = [];
        const count = Math.max(2, Math.round((cloudCover || 0) / 6));
        for (let c = 0; c < count; c++) {
          const canvas = document.createElement("canvas");
          const size = 256;
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext("2d");
          const puffCount = 6 + Math.floor(Math.random() * 8);
          for (let p = 0; p < puffCount; p++) {
            const px = size * (0.2 + Math.random() * 0.6);
            const py = size * (0.3 + Math.random() * 0.4);
            const pr = size * (0.12 + Math.random() * 0.22);
            const brightness = cloudCover > 70 ? 180 + Math.random() * 40 : 220 + Math.random() * 35;
            const grad = ctx.createRadialGradient(px, py, 0, px, py, pr);
            grad.addColorStop(0, `rgba(${brightness},${brightness},${brightness},0.7)`);
            grad.addColorStop(0.5, `rgba(${brightness},${brightness},${brightness},0.3)`);
            grad.addColorStop(1, `rgba(${brightness},${brightness},${brightness},0)`);
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, size, size);
          }
          const texture = new THREE.CanvasTexture(canvas);
          const cloudW = 35 + Math.random() * 55;
          const cloudH = 15 + Math.random() * 25;
          const plane = new THREE.PlaneGeometry(cloudW, cloudH);
          const mat = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            opacity: 0.45 + Math.random() * 0.25,
            side: THREE.DoubleSide,
            depthWrite: false,
            fog: false,
          });
          const mesh = new THREE.Mesh(plane, mat);
          const x = (Math.random() - 0.5) * 500;
          const y = 55 + Math.random() * 35;
          const z = (Math.random() - 0.5) * 500;
          mesh.position.set(x, y, z);
          cloudGroup.add(mesh);
          const shadowGeom = new THREE.PlaneGeometry(cloudW * 0.7, cloudH * 0.7);
          const shadowMat = new THREE.MeshBasicMaterial({
            color: 0x000000,
            transparent: true,
            opacity: 0.06,
            side: THREE.DoubleSide,
            depthWrite: false,
          });
          const shadow = new THREE.Mesh(shadowGeom, shadowMat);
          shadow.rotation.x = -Math.PI / 2;
          shadow.position.set(x, 0.15, z);
          cloudGroup.add(shadow);
          cloudData.push({
            mesh,
            shadow,
            baseX: x,
            baseY: y,
            baseZ: z,
            speed: 1.5 + Math.random() * 3,
            dx: Math.sin((windDir || 0) * Math.PI / 180),
            dz: Math.cos((windDir || 0) * Math.PI / 180),
          });
        }
        scene.add(cloudGroup);
      }

      function buildRain(precip, windDir) {
        if (rainSystemAdvanced) {
          rainSystemAdvanced.setWeather(precip || 0, (weatherData && weatherData.current ? weatherData.current.wind_spd : 0), windDir || 0);
        }
      }

      function buildAtmosphericParticles() {
        const count = 150;
        const positions = new Float32Array(count * 3);
        for (let i = 0; i < count; i++) {
          positions[i * 3] = (Math.random() - 0.5) * 400;
          positions[i * 3 + 1] = Math.random() * 60;
          positions[i * 3 + 2] = (Math.random() - 0.5) * 400;
        }
        const geom = new THREE.BufferGeometry();
        geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        const mat = new THREE.PointsMaterial({
          size: 0.3,
          color: 0xaabbcc,
          transparent: true,
          opacity: 0.15,
          depthWrite: false,
        });
        const pts = new THREE.Points(geom, mat);
        scene.add(pts);
        atmosphericParticles = { mesh: pts, count };
      }

      function updateFog(sceneRef, weatherCode, isRaining, precipMm, cloudCover) {
        if (arguments.length === 1 && typeof sceneRef === "object" && sceneRef && !sceneRef.isScene) {
          const normalized = normalizeWeatherSnapshot(sceneRef);
          return updateFog(scene, normalized.weatherCode, normalized.precipitation > 0.05, normalized.precipitation, normalized.cloudCover);
        }
        const targetScene = sceneRef?.isScene ? sceneRef : scene;
        if (!targetScene.fog) {
          targetScene.fog = new THREE.FogExp2("#c8d8e4", 0.002);
        }
        let targetDensity = 0.002;
        let targetColor = "#c8d8e4";
        if (precipMm > 0 && precipMm < 2) {
          targetDensity = 0.008;
          targetColor = "#8a9db0";
        } else if (precipMm >= 2 && precipMm < 5) {
          targetDensity = 0.015;
          targetColor = "#6a7d8e";
        } else if (precipMm >= 5) {
          targetDensity = 0.028;
          targetColor = "#4a5e6e";
        } else if ((cloudCover || 0) > 70 || isRaining) {
          targetDensity = 0.005;
          targetColor = "#a8b8c4";
        }
        targetScene.fog.density += (targetDensity - targetScene.fog.density) * 0.02;
        targetScene.fog.color.lerp(new THREE.Color(targetColor), 0.02);
      }

      function buildProperty(roofArea) {
        if (propertyGroup) {
          propertyGroup.traverse(c => {
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
          });
          scene.remove(propertyGroup);
        }
        propertyGroup = new THREE.Group();
        const s = Math.sqrt(Math.max(roofArea, 10)) * 0.3;
        const foundGeom = new THREE.BoxGeometry(s * 2.5, 0.2, s * 2);
        const foundMat = new THREE.MeshStandardMaterial({ color: 0x888888, roughness: 0.9, metalness: 0.1 });
        const foundation = new THREE.Mesh(foundGeom, foundMat);
        foundation.position.y = 0.1;
        foundation.receiveShadow = true;
        propertyGroup.add(foundation);
        const wallH = s * 0.7;
        const wallGeom = new THREE.BoxGeometry(s * 1.2, wallH, s);
        const wallMat = new THREE.MeshStandardMaterial({ color: 0xe8e0d0, roughness: 0.92, metalness: 0.02 });
        const walls = new THREE.Mesh(wallGeom, wallMat);
        walls.position.y = 0.2 + wallH / 2;
        walls.castShadow = true;
        walls.receiveShadow = true;
        propertyGroup.add(walls);
        for (let w = 0; w < 3; w++) {
          const winGeom = new THREE.PlaneGeometry(s * 0.18, s * 0.22);
          const winMat = new THREE.MeshPhysicalMaterial({
            color: 0x1a3050,
            metalness: 0.8,
            roughness: 0.1,
            transparent: true,
            opacity: 0.6,
          });
          const win = new THREE.Mesh(winGeom, winMat);
          win.position.set(-s * 0.3 + w * s * 0.3, 0.2 + wallH * 0.55, s * 0.501);
          propertyGroup.add(win);
          const frameGeom = new THREE.BoxGeometry(s * 0.20, s * 0.24, 0.02);
          const frameMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, roughness: 0.5 });
          const frame = new THREE.Mesh(frameGeom, frameMat);
          frame.position.copy(win.position);
          frame.position.z += 0.01;
          propertyGroup.add(frame);
        }
        const roofH = s * 0.35;
        const roofGeom = new THREE.ConeGeometry(s * 0.85, roofH, 4);
        roofGeom.rotateY(Math.PI / 4);
        const roofMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.8, metalness: 0.05 });
        const roof = new THREE.Mesh(roofGeom, roofMat);
        roof.position.y = 0.2 + wallH + roofH / 2;
        roof.castShadow = true;
        propertyGroup.add(roof);
        const catchGeom = new THREE.PlaneGeometry(s * 1.0, s * 0.8);
        const catchMat = new THREE.MeshBasicMaterial({
          color: 0x3388ff,
          transparent: true,
          opacity: 0.2,
          side: THREE.DoubleSide,
          depthWrite: false,
        });
        const catchment = new THREE.Mesh(catchGeom, catchMat);
        catchment.rotation.x = -Math.PI / 2;
        catchment.position.y = 0.2 + wallH + 0.1;
        propertyGroup.add(catchment);
        catchmentMesh = catchment;
        const tankR = s * 0.2;
        const tankH = s * 0.5;
        const tankGeom = new THREE.CylinderGeometry(tankR, tankR, tankH, 16);
        const tankMat = new THREE.MeshStandardMaterial({ color: 0x1a3a6a, roughness: 0.4, metalness: 0.3 });
        const tank = new THREE.Mesh(tankGeom, tankMat);
        tank.position.set(s * 1.0, 0.2 + tankH / 2, 0);
        tank.castShadow = true;
        propertyGroup.add(tank);
        const lidGeom = new THREE.CylinderGeometry(tankR * 1.1, tankR * 1.1, 0.06, 16);
        const lid = new THREE.Mesh(lidGeom, tankMat);
        lid.position.set(s * 1.0, 0.2 + tankH + 0.03, 0);
        propertyGroup.add(lid);
        for (let r = 0; r < 3; r++) {
          const ringGeom = new THREE.TorusGeometry(tankR + 0.02, 0.02, 6, 16);
          const ring = new THREE.Mesh(ringGeom, new THREE.MeshStandardMaterial({ color: 0x224466 }));
          ring.position.set(s * 1.0, 0.2 + tankH * (0.25 + r * 0.25), 0);
          ring.rotation.x = Math.PI / 2;
          propertyGroup.add(ring);
        }
        const pipePoints = [
          new THREE.Vector3(s * 0.5, 0.2 + wallH, 0),
          new THREE.Vector3(s * 0.65, 0.2 + wallH * 0.7, 0),
          new THREE.Vector3(s * 0.85, 0.2 + tankH * 0.8, 0),
          new THREE.Vector3(s * 1.0, 0.2 + tankH, 0),
        ];
        const pipeCurve = new THREE.CatmullRomCurve3(pipePoints);
        const pipeGeom = new THREE.TubeGeometry(pipeCurve, 20, 0.04, 6, false);
        const pipeMat = new THREE.MeshStandardMaterial({ color: 0x666666, metalness: 0.6, roughness: 0.3 });
        const pipe = new THREE.Mesh(pipeGeom, pipeMat);
        pipe.castShadow = true;
        propertyGroup.add(pipe);
        const yardGeom = new THREE.CircleGeometry(s * 2.2, 32);
        yardGeom.rotateX(-Math.PI / 2);
        const yardMat = new THREE.MeshStandardMaterial({ color: 0x2d5a1e, roughness: 0.95 });
        const yard = new THREE.Mesh(yardGeom, yardMat);
        yard.position.y = 0.02;
        yard.receiveShadow = true;
        propertyGroup.add(yard);
        for (let t = 0; t < 4; t++) {
          const tree = new THREE.Group();
          const angle = (t / 4) * Math.PI * 2 + 0.3;
          const dist = s * 1.4 + Math.random() * s * 0.5;
          const tx = Math.cos(angle) * dist;
          const tz = Math.sin(angle) * dist;
          const trunkH = 1.5 + Math.random() * 1.5;
          const trunkGeom = new THREE.CylinderGeometry(0.08, 0.12, trunkH, 6);
          const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c3a1e, roughness: 0.95 });
          const trunk = new THREE.Mesh(trunkGeom, trunkMat);
          trunk.position.y = trunkH / 2;
          trunk.castShadow = true;
          tree.add(trunk);
          const canopyCount = 2 + Math.floor(Math.random() * 2);
          for (let c = 0; c < canopyCount; c++) {
            const cr = 0.7 + Math.random() * 0.8;
            const canopyGeom = new THREE.IcosahedronGeometry(cr, 1);
            const canopyMat = new THREE.MeshStandardMaterial({ roughness: 0.9, metalness: 0 });
            canopyMat.color.setHSL(0.28 + Math.random() * 0.1, 0.5 + Math.random() * 0.2, 0.22 + Math.random() * 0.12);
            const canopy = new THREE.Mesh(canopyGeom, canopyMat);
            canopy.position.set(
              (Math.random() - 0.5) * 0.3,
              trunkH + cr * 0.5 + c * 0.2,
              (Math.random() - 0.5) * 0.3
            );
            canopy.castShadow = true;
            tree.add(canopy);
          }
          tree.position.set(tx, 0, tz);
          propertyGroup.add(tree);
        }
        const acGeom = new THREE.BoxGeometry(s * 0.2, s * 0.15, s * 0.12);
        const acMat = new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.5, metalness: 0.3 });
        const ac = new THREE.Mesh(acGeom, acMat);
        ac.position.set(-s * 0.6, 0.2 + wallH * 0.4, s * 0.51);
        ac.castShadow = true;
        propertyGroup.add(ac);
        const terrainY = Math.max(getTerrainY(0, 0), 0.15);
        propertyGroup.position.y = terrainY + 0.1;
        scene.add(propertyGroup);
      }

      function buildDataViz(methods) {
        if (dataVizGroup) {
          dataVizGroup.traverse(c => {
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
          });
          scene.remove(dataVizGroup);
        }
        dataVizGroup = new THREE.Group();
        const activeMethods = methods.filter(m => m.ok && m.annual > 0);
        if (activeMethods.length === 0) return;
        const maxAnnual = Math.max(...activeMethods.map(m => m.annual));
        const barW = 3.5;
        const gap = 1.5;
        const totalW = activeMethods.length * (barW + gap) - gap;
        const colors = [0x3b82f6, 0x10b981, 0x8b5cf6, 0x06b6d4, 0xf97316, 0xef4444];
        const platGeom = new THREE.BoxGeometry(totalW + 8, 0.4, barW + 8);
        const platMat = new THREE.MeshPhysicalMaterial({
          color: 0x0a1628,
          roughness: 0.1,
          metalness: 0.7,
          transparent: true,
          opacity: 0.85,
          clearcoat: 0.8,
        });
        const platform = new THREE.Mesh(platGeom, platMat);
        platform.position.y = -0.2;
        platform.receiveShadow = true;
        dataVizGroup.add(platform);
        activeMethods.forEach((method, i) => {
          const h = Math.max((method.annual / maxAnnual) * 18, 0.5);
          const color = colors[i % colors.length];
          const barGeom = new THREE.BoxGeometry(barW, h, barW);
          const barMat = new THREE.MeshPhysicalMaterial({
            color,
            roughness: 0.3,
            metalness: 0.2,
            transparent: true,
            opacity: 0.75,
            clearcoat: 0.5,
          });
          const bar = new THREE.Mesh(barGeom, barMat);
          bar.position.x = i * (barW + gap) - totalW / 2 + barW / 2;
          bar.position.y = h / 2;
          bar.castShadow = true;
          dataVizGroup.add(bar);
          const capGeom = new THREE.BoxGeometry(barW + 0.2, 0.15, barW + 0.2);
          const capMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.9,
          });
          const cap = new THREE.Mesh(capGeom, capMat);
          cap.position.x = bar.position.x;
          cap.position.y = h + 0.075;
          dataVizGroup.add(cap);
          const glowGeom = new THREE.TorusGeometry(barW * 0.5, 0.08, 6, 16);
          const glowMat = new THREE.MeshBasicMaterial({
            color,
            transparent: true,
            opacity: 0.3,
          });
          const glow = new THREE.Mesh(glowGeom, glowMat);
          glow.rotation.x = -Math.PI / 2;
          glow.position.x = bar.position.x;
          glow.position.y = 0.05;
          dataVizGroup.add(glow);
        });
        const offset = terrainHalf ? terrainHalf * 0.8 : 30;
        dataVizGroup.position.set(-offset, Math.max(getTerrainY(-offset, -offset), 0.2) + 0.5, -offset);
        dataVizGroup.rotation.y = 0.3;
        scene.add(dataVizGroup);
      }

      function addLabel(text, pos3D, cssClass, priority = 1) {
        const el = document.createElement("div");
        el.className = `l3 ${cssClass}`;
        el.innerHTML = `<span class="dot"></span>${text}`;
        labelsRoot.appendChild(el);
        labels.push({ el, pos: pos3D.clone(), priority, text });
      }

      function addPeakMarker(pos3D, elevation) {
        const el = document.createElement("div");
        el.className = 'peak-marker';
        el.innerHTML = `<div class="peak-icon">▲</div><div class="peak-elevation">${Math.round(elevation)}m</div>`;
        labelsRoot.appendChild(el);
        labels.push({ el, pos: pos3D.clone(), priority: 5, text: `${Math.round(elevation)}m` });
      }

      function addContourLabel(elev, pos3D) {
        const el = document.createElement("div");
        el.className = 'contour-label';
        el.textContent = `${Math.round(elev)}m`;
        labelsRoot.appendChild(el);
        labels.push({ el, pos: pos3D.clone(), priority: 1, text: `${Math.round(elev)}m` });
      }

      function isUsefulFeatureLabel(name) {
        if (!name) return false;
        const trimmed = String(name).trim();
        if (!trimmed || /^unnamed$/i.test(trimmed)) return false;
        if (/^K\d+$/i.test(trimmed)) return false;
        if (/^C\d+$/i.test(trimmed)) return false;
        if (/^[A-Z]\d{2,}$/i.test(trimmed)) return false;
        return trimmed.length > 2;
      }

      function updateLabels() {
        const w2 = innerWidth / 2;
        const h2 = innerHeight / 2;
        const visible = [];
        for (const lb of labels) {
          const projected = lb.pos.clone().project(camera);
          if (projected.z > 1 || projected.z < -1) {
            lb.el.style.opacity = "0";
            continue;
          }
          const x = (projected.x * w2) + w2;
          const y = -(projected.y * h2) + h2;
          const dist = camera.position.distanceTo(lb.pos);
          const maxDist = 220;
          const opacity = dist > maxDist ? 0 : Math.min(1, (maxDist - dist) / (maxDist * 0.35));
          const scale = Math.max(0.6, Math.min(1.3, 110 / dist));
          if (opacity <= 0.02) {
            lb.el.style.opacity = "0";
            continue;
          }
          lb.el.style.left = `${x}px`;
          lb.el.style.top = `${y}px`;
          lb.el.style.transform = `translate(-50%, -100%) scale(${scale})`;
          visible.push({ lb, x, y, opacity, dist, priority: lb.priority || 1 });
        }
        visible.sort((a, b) => {
          if (b.priority !== a.priority) return b.priority - a.priority;
          return a.dist - b.dist;
        });
        const placed = [];
        for (const item of visible) {
          const width = Math.max(item.lb.el.offsetWidth || 80, 72);
          const height = Math.max(item.lb.el.offsetHeight || 24, 24);
          const box = {
            left: item.x - width * 0.5,
            right: item.x + width * 0.5,
            top: item.y - height,
            bottom: item.y,
          };
          const overlaps = placed.some((other) => !(box.right < other.left || box.left > other.right || box.bottom < other.top || box.top > other.bottom));
          if (overlaps) {
            item.lb.el.style.opacity = "0";
            continue;
          }
          placed.push(box);
          item.lb.el.style.opacity = `${item.opacity}`;
        }
      }

      function addPrimaryLabels(water, wxData) {
        labels.forEach(lb => lb.el.remove());
        labels = [];
        const terrainY = Math.max(getTerrainY(0, 0), 0.15);
        addLabel("Location", new THREE.Vector3(0, terrainY + 5, 0), "loc", 5);
        const rivers = ((water && water.rivers) || []).filter((river) => isUsefulFeatureLabel(river.name)).slice(0, 5);
        rivers.forEach((river) => {
          const mid = river.points[Math.floor(river.points.length / 2)];
          const lc = geo2local(mid[0], mid[1]);
          const y = getTerrainY(lc.x, lc.z) + 2.5;
          addLabel(`${river.name}`, new THREE.Vector3(lc.x, y, lc.z), "river", 3);
        });
        const lakes = ((water && water.lakes) || []).filter((lake) => isUsefulFeatureLabel(lake.name)).slice(0, 4);
        lakes.forEach((lake) => {
          const avg = lake.points.reduce((s, p) => [s[0] + p[0] / lake.points.length, s[1] + p[1] / lake.points.length], [0, 0]);
          const lc = geo2local(avg[0], avg[1]);
          const y = getTerrainY(lc.x, lc.z) + 2.5;
          addLabel(`${lake.name}`, new THREE.Vector3(lc.x, y, lc.z), "lake", 2);
        });
        if (terrainGrid) {
          const peak = findHighestPoint();
          addPeakMarker(peak, terrainMaxE);
        }
        if (wxData && wxData.coastal) {
          addLabel("Coast", new THREE.Vector3(terrainHalf, 2, 0), "coast", 2);
        }
      }

      function findHighestPoint() {
        let best = { x: 0, z: 0, y: 0 };
        if (!terrainGrid) return new THREE.Vector3(0, 0, 0);
        for (let i = 0; i < terrainGS; i++) {
          for (let j = 0; j < terrainGS; j++) {
            const elev = terrainGrid[i][j];
            if (elev >= terrainMaxE) {
              const x = j * terrainCellSize - terrainHalf;
              const z = -(i * terrainCellSize - terrainHalf);
              const y = getTerrainY(x, z);
              best = { x, y, z };
            }
          }
        }
        return new THREE.Vector3(best.x, best.y, best.z);
      }

      function clearWorld() {
        if (rainRadar) {
          rainRadar.dispose();
          rainRadar = null;
        }
        clearMapOverlay();
        const systems = ["rainSystem", "windSystem", "lightningSystem", "cloudSystem"];
        for (const key of systems) {
          if (sceneState[key]) {
            sceneState[key].dispose();
            sceneState[key] = null;
          }
        }
        rainSystemAdvanced = null;
        cloudSystem = null;
        lightningSystem = null;
        
        if (terrainHillshadeTexture) {
          terrainHillshadeTexture.dispose();
          terrainHillshadeTexture = null;
        }
        
        if (roadsGroup) {
          roadsGroup.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
          });
          scene.remove(roadsGroup);
          roadsGroup = null;
        }
        
        if (boundariesGroup) {
          boundariesGroup.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
          });
          scene.remove(boundariesGroup);
          boundariesGroup = null;
        }
        
        if (terrainMesh) {
          if (terrainMesh.material?.uniforms?.uElevationRamp?.value) terrainMesh.material.uniforms.uElevationRamp.value.dispose();
          if (terrainMesh.material?.uniforms?.uWetnessMap?.value) terrainMesh.material.uniforms.uWetnessMap.value.dispose();
          if (terrainMesh.material?.uniforms?.uHillshade?.value) terrainMesh.material.uniforms.uHillshade.value.dispose();
          terrainMesh.geometry.dispose();
          terrainMesh.material.dispose();
          scene.remove(terrainMesh);
          terrainMesh = null;
          sceneState.terrainMesh = null;
          sceneState.terrainElevationGrid = null;
        }
        terrainShaderMat = null;
        terrainGrid = null;
        terrainGS = 0;
        sceneState.terrainN = 0;
        if (riverGroup) {
          riverGroup.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
          });
          scene.remove(riverGroup);
          riverGroup = null;
        }
        sceneState.riverMeshes = [];
        if (lakeGroup) {
          lakeGroup.traverse((child) => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
          });
          scene.remove(lakeGroup);
          lakeGroup = null;
        }
        sceneState.lakeMeshes = [];
        sceneState.lakeGlows = [];
        if (atmosphericParticles) {
          atmosphericParticles.mesh.geometry.dispose();
          atmosphericParticles.mesh.material.dispose();
          scene.remove(atmosphericParticles.mesh);
          atmosphericParticles = null;
        }
        if (propertyGroup) {
          propertyGroup.traverse(c => {
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
          });
          scene.remove(propertyGroup);
          propertyGroup = null;
          catchmentMesh = null;
        }
        if (dataVizGroup) {
          dataVizGroup.traverse(c => {
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
          });
          scene.remove(dataVizGroup);
          dataVizGroup = null;
        }
        if (contourLineGroup) {
          contourLineGroup.traverse(c => {
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
          });
          scene.remove(contourLineGroup);
          contourLineGroup = null;
        }
        if (weatherLayerManager && weatherLayerManager.group) {
          while (weatherLayerManager.group.children.length) {
            const c = weatherLayerManager.group.children[0];
            weatherLayerManager.group.remove(c);
            if (c.geometry) c.geometry.dispose();
            if (c.material) c.material.dispose();
          }
        }
        labels.forEach(lb => lb.el.remove());
        labels = [];
        enhancedContourLabels = [];
      }

      function animate() {
        requestAnimationFrame(animate);
        const delta = Math.min(sceneState.clock.getDelta(), 0.05);
        elapsed += delta;
        const now = performance.now();
        
        const instFps = 1000 / Math.max(1, now - fpsBudget.last);
        fpsBudget.last = now;
        fpsBudget.smoothed = fpsBudget.smoothed * 0.92 + instFps * 0.08;
        
        if (frameCount % 30 === 0) {
          updateFPS(fpsBudget.smoothed);
        }
        
        adaptQuality();
        updatePerformanceMonitoring();
        
        if (weatherTimeline) weatherTimeline.update(now);
        if (sceneState.sunSystem) sceneState.sunSystem.update(sceneState.currentHour);
        if (sceneState.skySystem) sceneState.skySystem.update(sceneState.currentHour, sceneState.cloudCover, sceneState.isRaining, delta);
        if (sceneState.cloudSystem) sceneState.cloudSystem.update(delta);
        if (sceneState.rainSystem) sceneState.rainSystem.update(delta);
        if (sceneState.windSystem) sceneState.windSystem.update(delta);
        if (sceneState.lightningSystem) sceneState.lightningSystem.update(delta, sceneState.cloudSystem?.puffs);
        if (waterFlowSimulator) waterFlowSimulator.update(delta, weatherTimeline ? weatherTimeline.getCurrentWeather().temperature_2m : 25);
        if (weatherLayerManager?.syncWithCamera) weatherLayerManager.syncWithCamera();
        if (rainRadar) rainRadar.update(now);
        
        if (isDirty('water') || frameCount % 2 === 0) {
          for (const mesh of sceneState.riverMeshes || []) {
            if (mesh.material.uniforms?.uTime) mesh.material.uniforms.uTime.value = elapsed;
            if (waterFlowSimulator && mesh.material.uniforms?.uFlowSpeed) {
              const flowMult = 0.5 + waterFlowSimulator.waterLevel * 1.5;
              mesh.material.uniforms.uFlowSpeed.value = (0.25 + (mesh.userData.streamOrder || 1) * 0.08) * flowMult;
            }
          }
          for (const mesh of sceneState.lakeMeshes || []) {
            if (mesh.material.uniforms?.uTime) mesh.material.uniforms.uTime.value = elapsed;
            if (waterFlowSimulator && mesh.material.uniforms?.uDepth) {
              const depthMult = 1.0 + waterFlowSimulator.waterLevel * 0.5;
              mesh.material.uniforms.uDepth.value = (mesh.userData.depth || 5) * depthMult;
            }
          }
          for (const glow of sceneState.lakeGlows || []) {
            glow.material.opacity = 0.15 + Math.sin(elapsed * 1.2) * 0.08;
          }
          clearDirty('water');
        }
        
        if (frameCount % 30 === 0) updateStatsPanel();
        
        if (isDirty('weather') || frameCount % 3 === 0) {
          updateFog(scene, sceneState.weatherData?.current?.weather_code ?? 0, sceneState.isRaining, normalizeWeatherSnapshot(sceneState.weatherData?.current || {}).precipitation, sceneState.cloudCover);
          clearDirty('weather');
        }
        
        if (terrainShaderMat?.uniforms) {
          if (isDirty('terrain') || frameCount % 4 === 0) {
            terrainShaderMat.uniforms.uTime.value = elapsed;
            terrainShaderMat.uniforms.uFogDensity.value = scene.fog?.density ?? 0.002;
            terrainShaderMat.uniforms.uFogColor.value.copy(scene.fog?.color || new THREE.Color("#c8d8e4"));
            clearDirty('terrain');
          }
        }
        
        updateTerrainLOD();
        if (INFINITE_MAP.enabled) {
          updateInfiniteMap();
        }
        if (ctrl) ctrl.update();
        if (catchmentMesh) catchmentMesh.material.opacity = 0.15 + Math.sin(elapsed * 2) * 0.08;
        
        if (isDirty('labels') || frameCount % 5 === 0) {
          updateLabels();
          clearDirty('labels');
        }
        
        if (sceneState.composer) sceneState.composer.render();
        else renderer.render(scene, camera);
        
        if (frameCount % 120 === 0) {
          renderer.info.reset();
          const perfLevel = PERFORMANCE.currentLevel;
          const drawCalls = renderer.info.render.calls;
          console.log(`[Render] ${perfLevel} | FPS: ${fpsBudget.smoothed.toFixed(1)} | DrawCalls: ${drawCalls} | Triangles: ${renderer.info.render.triangles} | Objects: ${scene.children.length}`);
        }
        frameCount++;
      }

      function updateStatsPanel() {
        if (!hydrologyCalculator) return;
        const roofArea = parseFloat(document.getElementById('roof_area')?.value) || 120;
        const landArea = parseFloat(document.getElementById('land_area')?.value) || 250;
        const roofSurface = document.getElementById('surface')?.value || 'concrete';
        const landType = document.getElementById('land_type')?.value || 'open';
        const soilType = document.getElementById('soil')?.value || 'loamy';
        const people = parseInt(document.getElementById('people')?.value) || 4;
        const acUnits = parseInt(document.getElementById('ac_units')?.value) || 2;
        const acHrs = parseFloat(document.getElementById('ac_hrs')?.value) || 6;
        const acMos = parseInt(document.getElementById('ac_mos')?.value) || 6;
        const weather = weatherTimeline?.getCurrentWeather() || { precipitation: 0 };
        const rainfall = weather.precipitation || 0;
        const stats = hydrologyCalculator.updateStats(
          waterFlowSimulator,
          waterData?.rivers || [],
          waterData?.lakes || [],
          roofArea, landArea, rainfall, roofSurface, landType, soilType, people, acUnits, acHrs, acMos
        );
        const riversEl = document.getElementById('stat-rivers');
        const streamsEl = document.getElementById('stat-streams');
        const lakesEl = document.getElementById('stat-lakes');
        const waterAreaEl = document.getElementById('stat-water-area');
        const flowEl = document.getElementById('stat-flow');
        const runoffCoefEl = document.getElementById('stat-runoff-coef');
        const peakFlowEl = document.getElementById('stat-peak-flow');
        const storageEl = document.getElementById('stat-storage');
        if (riversEl) riversEl.textContent = stats.rivers;
        if (streamsEl) streamsEl.textContent = stats.streams;
        if (lakesEl) lakesEl.textContent = stats.lakes;
        if (waterAreaEl) waterAreaEl.textContent = `${(stats.totalWaterArea / 10000).toFixed(1)} km²`;
        if (flowEl) flowEl.textContent = `${stats.flowVolume.toFixed(3)} m³/s`;
        if (runoffCoefEl) runoffCoefEl.textContent = stats.runoffCoef;
        if (peakFlowEl) peakFlowEl.textContent = `${stats.peakFlowRate} m³/s`;
        if (storageEl) storageEl.textContent = `${stats.storageRequired} m³`;
      }

      function flyToView(name) {
        const half = terrainHalf || 30;
        const views = {
          overview: { pos: [half * 0.8, half * 0.5, half * 0.9], target: [0, 5, 0] },
          property: { pos: [15, 12, 18], target: [0, 5, 0] },
          rivers: { pos: [-half * 0.5, 20, half * 0.4], target: [-half * 0.3, 2, half * 0.3] },
          sky: { pos: [0, half * 0.7, 10], target: [0, 40, 0] },
          data: { pos: [-half * 0.5, 40, -half * 0.5], target: [-half * 0.7, 15, -half * 0.7] },
        };
        const v = views[name];
        if (!v) return;
        const startPos = camera.position.clone();
        const endPos = new THREE.Vector3(...v.pos);
        const startTarget = ctrl.target.clone();
        const endTarget = new THREE.Vector3(...v.target);
        const startTime = performance.now();
        const duration = 1500;
        if (cameraAnim) cancelAnimationFrame(cameraAnim);
        function animateCamera() {
          const now = performance.now();
          const t = Math.min((now - startTime) / duration, 1);
          const e = t * t * (3 - 2 * t);
          camera.position.lerpVectors(startPos, endPos, e);
          ctrl.target.lerpVectors(startTarget, endTarget, e);
          ctrl.update();
          if (t < 1) cameraAnim = requestAnimationFrame(animateCamera);
          else cameraAnim = null;
        }
        animateCamera();
        document.querySelectorAll(".vb").forEach(b => b.classList.remove("on"));
        const btn = document.querySelector(`.vb[data-view="${name}"]`);
        if (btn) btn.classList.add("on");
      }

      function geo2local(lat, lon) {
        return latLonToWorld(lat, lon, sceneState);
      }

      function getTerrainY(x, z) {
        return sampleTerrainHeight(x, z);
      }

      function clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
      }

      function fract(v) {
        return v - Math.floor(v);
      }
    