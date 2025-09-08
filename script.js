document.addEventListener('DOMContentLoaded', () => {
  // --- GLOBAL VARIABLES ---
  let analyticsChart = null;
  let historicalData = []; // To store a history of live data points for charts
  let map, mainMarker, heatLayer;
  const userDetails = JSON.parse(localStorage.getItem('userDetails'));
  let activeAlerts = [];
  let unreadAlertCount = 0;

  // --- DOM Elements ---
  const alertBellBtn = document.getElementById('alert-bell-btn');
  const alertCountBadge = document.getElementById('alert-count-badge');
  const alertModal = document.getElementById('alert-modal');
  const closeAlertModalBtn = document.getElementById('close-alert-modal-btn');
  const alertsList = document.getElementById('alerts-list');
  const noAlertsMessage = document.getElementById('no-alerts-message');
  const clearAllAlertsBtn = document.getElementById('clear-all-alerts-btn');
  const mapTypeFilter = document.getElementById('map-type-filter');
  const mapLegend = document.getElementById('map-legend');

  // --- THEME & TABS ---
  const themeSwitcherBtn = document.getElementById('theme-switcher-btn');
  themeSwitcherBtn.addEventListener('click', (event) => { const currentTheme = document.body.getAttribute('data-theme') || 'light'; setTheme(currentTheme === 'light' ? 'dark' : 'light', event); });
  function setTheme(themeId, event) { if (event && document.startViewTransition) { const x = event.clientX; const y = event.clientY; document.documentElement.style.setProperty('--ripple-x', x + 'px'); document.documentElement.style.setProperty('--ripple-y', y + 'px'); document.startViewTransition(() => { document.body.setAttribute('data-theme', themeId); }); } else { document.body.setAttribute('data-theme', themeId); } localStorage.setItem('theme', themeId); themeSwitcherBtn.innerHTML = themeId === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>'; if (analyticsChart) { renderAnalyticsChart(); } }
  const tabs = { gauge: { btn: document.getElementById('tab-gauge'), content: document.getElementById('tab-content-gauge') }, analytics: { btn: document.getElementById('tab-analytics'), content: document.getElementById('tab-content-analytics') } };
  Object.keys(tabs).forEach(key => { tabs[key].btn.addEventListener('click', () => { Object.values(tabs).forEach(t => { t.btn.classList.remove('tab-active'); t.content.classList.add('hidden'); }); tabs[key].btn.classList.add('tab-active'); tabs[key].content.classList.remove('hidden'); if (key === 'analytics') { renderAnalyticsChart(); } }); });

  // --- GEOCODING ---
  async function getAddressFromCoords(lat, lng) { try { const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`); if (!response.ok) return "Address lookup failed."; const data = await response.json(); return data.display_name || "Unknown Location"; } catch (error) { console.error("Geocoding error:", error); return "Address not found."; } }

  // --- LIVE FIREBASE DATA FETCHING ---
  async function fetchData() {
    try {
      const response = await fetch('https://gas-value-33f5a-default-rtdb.firebaseio.com/SensorData.json');
      if (!response.ok) throw new Error(`Network Error: ${response.statusText}`);
      const liveData = await response.json();
      
      if (liveData && liveData.location) {
        const [lat, lng] = liveData.location.split(',').map(Number);
        const address = await getAddressFromCoords(lat, lng);
        const formattedData = {
          temperature: liveData.temperature, humidity: liveData.humidity, carbon: liveData.carbon,
          latitude: lat, longitude: lng, predictedCarbon: liveData.carbon * 1.05,
          locationName: address, timestamp: liveData.timestamp
        };

        updateDashboard(formattedData);
        checkThresholds(formattedData);
        
        historicalData.push(formattedData);
        if (historicalData.length > 10) {
            historicalData.shift();
        }

        if (!tabs.analytics.content.classList.contains('hidden')) { renderAnalyticsChart(); }
        updateMapDisplay();
      }
    } catch (error) { console.error("Failed to fetch live data:", error); }
  }

  // --- DASHBOARD UPDATE ---
  function updateGauge(fillId, coverId, value, max, unit) { const fillEl = document.getElementById(fillId); const coverEl = document.getElementById(coverId); if (!fillEl || !coverEl) return; const percentage = Math.max(0, Math.min(1, value / max)); fillEl.style.transform = `rotate(${percentage / 2}turn)`; coverEl.innerHTML = `${value.toFixed(0)}<span>${unit}</span>`; }
  function updateDashboard(data) {
    document.getElementById("lastUpdated").textContent = new Date(data.timestamp).toLocaleTimeString('en-US');
    updateGauge('temp-gauge-fill', 'temp-gauge-cover', data.temperature, 50, '°C');
    updateGauge('humidity-gauge-fill', 'humidity-gauge-cover', data.humidity, 100, '%');
    updateGauge('carbon-gauge-fill', 'carbon-gauge-cover', data.carbon, 1000, 'ppm');
    updateGauge('prediction-gauge-fill', 'prediction-gauge-cover', data.predictedCarbon, 1000, 'ppm');
    document.getElementById("sensorLocationVal").textContent = `${data.latitude.toFixed(4)}, ${data.longitude.toFixed(4)}`;
    document.getElementById("sensorLocationName").textContent = data.locationName;
    mainMarker.setLatLng([data.latitude, data.longitude]);
  }

  // --- ALERTING SYSTEM ---
  const THRESHOLDS = { temp: 45, co2: 500, humidity: 80 }; let lastAlertTimes = { temp: 0, co2: 0, humidity: 0 }; const ALERT_COOLDOWN = 300000;
  function checkThresholds(data) { const now = Date.now(); if (data.temperature > THRESHOLDS.temp && (now - lastAlertTimes.temp > ALERT_COOLDOWN)) { sendAlert('Temperature', `${data.temperature}°C`, 'error'); lastAlertTimes.temp = now; } if (data.carbon > THRESHOLDS.co2 && (now - lastAlertTimes.co2 > ALERT_COOLDOWN)) { sendAlert('CO2 Level', `${data.carbon} ppm`, 'error'); lastAlertTimes.co2 = now; } if (data.humidity > THRESHOLDS.humidity && (now - lastAlertTimes.humidity > ALERT_COOLDOWN)) { sendAlert('Humidity', `${data.humidity}%`, 'warning'); lastAlertTimes.humidity = now; } }
  function sendAlert(metric, value, type) { const location = document.getElementById('sensorLocationName').textContent; const message = `High ${metric} detected: ${value} at ${location}.`; const timestamp = new Date().toLocaleString(); console.log(`--- ALERT: SIMULATING SMS to ${userDetails?.phone} and Email to ${userDetails?.email} ---`); console.log(message); showToast(message, type); activeAlerts.unshift({ metric, value, type, location, timestamp }); unreadAlertCount++; updateAlertBadge(); }
  function showToast(message, type = 'error') { const container = document.getElementById('toast-container'); const toast = document.createElement('div'); toast.className = `toast toast-${type}`; toast.innerHTML = `<strong><i class="fas fa-exclamation-triangle mr-2"></i>Alert!</strong><p class="text-sm">${message}</p>`; container.appendChild(toast); setTimeout(() => toast.classList.add('show'), 100); setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 300); }, 5000); }

  // --- Alert Modal Logic ---
  alertBellBtn.addEventListener('click', () => { renderAlertsInModal(); alertModal.classList.remove('hidden'); unreadAlertCount = 0; updateAlertBadge(); });
  closeAlertModalBtn.addEventListener('click', () => { alertModal.classList.add('hidden'); });
  clearAllAlertsBtn.addEventListener('click', () => { activeAlerts = []; renderAlertsInModal(); unreadAlertCount = 0; updateAlertBadge(); });
  function updateAlertBadge() { if (unreadAlertCount > 0) { alertCountBadge.textContent = unreadAlertCount; alertCountBadge.classList.remove('hidden'); } else { alertCountBadge.classList.add('hidden'); } }
  function renderAlertsInModal() { alertsList.innerHTML = ''; if (activeAlerts.length === 0) { noAlertsMessage.classList.remove('hidden'); alertsList.appendChild(noAlertsMessage); } else { noAlertsMessage.classList.add('hidden'); activeAlerts.forEach(alert => { const alertDiv = document.createElement('div'); alertDiv.className = `bg-card-header p-3 rounded-md border-l-4 ${alert.type === 'error' ? 'border-red-500' : 'border-yellow-500'}`; alertDiv.innerHTML = `<p class="font-semibold text-text-primary">${alert.metric}: ${alert.value}</p><p class="text-xs text-text-secondary">${alert.location}</p><p class="text-xs text-text-secondary">${alert.timestamp}</p>`; alertsList.appendChild(alertDiv); }); } }
  
  // --- HEATMAP LOGIC ---
  mapTypeFilter.addEventListener('change', updateMapDisplay);

  function getGradient(type) {
    if (type === 'temperature') { return { 0.0: '#00008b', 0.5: '#0000ff', 0.88: '#ffff00', 0.9: '#ff0000' }; }
    if (type === 'humidity') { return { 0.33: '#ff0000', 0.66: '#ffff00', 1.0: '#0000ff' }; }
    if (type === 'co2') { return { 0.33: '#008000', 0.83: '#ffff00', 0.84: '#ff0000' }; }
    return {};
  }

  function updateMapDisplay() {
    const mapType = mapTypeFilter.value;
    if (heatLayer) map.removeLayer(heatLayer);
    mainMarker.setOpacity(0);

    if (mapType === 'marker') {
        mainMarker.setOpacity(1);
        mapLegend.classList.add('hidden');
    } else {
        if (historicalData.length > 0) {
            let heatPoints = [];
            let maxValue = 1;

            if (mapType === 'temperature') { heatPoints = historicalData.map(d => [d.latitude, d.longitude, d.temperature]); maxValue = 50; }
            else if (mapType === 'humidity') { heatPoints = historicalData.map(d => [d.latitude, d.longitude, d.humidity]); maxValue = 100; }
            else if (mapType === 'co2') { heatPoints = historicalData.map(d => [d.latitude, d.longitude, d.carbon]); maxValue = 600; }

            heatLayer = L.heatLayer(heatPoints, {
                radius: 25,
                blur: 15,
                maxZoom: 18,
                max: maxValue,
                gradient: getGradient(mapType)
            }).addTo(map);
            updateLegend(mapType);
            mapLegend.classList.remove('hidden');
        }
    }
  }

  function updateLegend(type) {
    let legendContent = '';
    if (type === 'temperature') { legendContent = `<div class='flex items-center'><div class='w-3 h-3 mr-2 rounded-full' style='background-color: #ff0000;'></div> > 45°C</div><div class='flex items-center'><div class='w-3 h-3 mr-2 rounded-full' style='background-color: #ffff00;'></div> 26-44°C</div><div class='flex items-center'><div class='w-3 h-3 mr-2 rounded-full' style='background-color: #0000ff;'></div> 0-25°C</div><div class='flex items-center'><div class='w-3 h-3 mr-2 rounded-full' style='background-color: #00008b;'></div> < 0°C</div>`; }
    else if (type === 'humidity') { legendContent = `<div class='flex items-center'><div class='w-3 h-3 mr-2 rounded-full' style='background-color: #0000ff;'></div> > 66%</div><div class='flex items-center'><div class='w-3 h-3 mr-2 rounded-full' style='background-color: #ffff00;'></div> 34-66%</div><div class='flex items-center'><div class='w-3 h-3 mr-2 rounded-full' style='background-color: #ff0000;'></div> < 34%</div>`; }
    else if (type === 'co2') { legendContent = `<div class='flex items-center'><div class='w-3 h-3 mr-2 rounded-full' style='background-color: #ff0000;'></div> > 500ppm</div><div class='flex items-center'><div class='w-3 h-3 mr-2 rounded-full' style='background-color: #ffff00;'></div> 200-499ppm</div><div class='flex items-center'><div class='w-3 h-3 mr-2 rounded-full' style='background-color: #008000;'></div> < 200ppm</div>`; }
    mapLegend.innerHTML = legendContent;
  }

  // --- ANALYTICS CHART LOGIC ---
  const chartCanvas = document.getElementById('analytics-chart');
  const chartTimeFilter = document.getElementById('chart-time-filter');
  const chartDataFilter = document.getElementById('chart-data-filter');
  chartTimeFilter.addEventListener('change', renderAnalyticsChart);
  chartDataFilter.addEventListener('change', renderAnalyticsChart);
  function renderAnalyticsChart() {
    if (historicalData.length === 0) return;
    if (analyticsChart) { analyticsChart.destroy(); }
    const timeFilter = chartTimeFilter.value;
    const now = new Date();
    let filteredData = historicalData;
    if (timeFilter === '24h') { const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000); filteredData = filteredData.filter(d => new Date(d.timestamp) > oneDayAgo); }
    else if (timeFilter === '7d') { const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); filteredData = filteredData.filter(d => new Date(d.timestamp) > sevenDaysAgo); }
    const theme = document.body.getAttribute('data-theme') || 'light';
    const gridColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const fontColor = theme === 'dark' ? '#f9fafb' : '#1f2937';
    const selectedDataKey = chartDataFilter.value;
    const labels = filteredData.map(d => new Date(d.timestamp));
    const dataPoints = filteredData.map(d => d[selectedDataKey]);
    analyticsChart = new Chart(chartCanvas, {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: chartDataFilter.options[chartDataFilter.selectedIndex].text,
          data: dataPoints,
          borderColor: 'var(--color-primary)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          fill: true, tension: 0.3, pointRadius: 2, borderWidth: 1.5
        }]
      },
      options: { responsive: true, maintainAspectRatio: false, scales: { x: { type: 'time', time: { unit: 'hour' }, grid: { color: gridColor }, ticks: { color: fontColor } }, y: { beginAtZero: false, grid: { color: gridColor }, ticks: { color: fontColor } } }, plugins: { legend: { labels: { color: fontColor } } }, }
    });
  }
  
  // --- INITIALIZATION ---
  function initializeDashboard() {
    setTheme(localStorage.getItem('theme') || 'light');
    const initialCoords = [10.9085, 76.9098];
    map = L.map('map').setView(initialCoords, 15);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
    mainMarker = L.marker(initialCoords).addTo(map).bindPopup("Live Data Point");
    
    fetchData();
    setInterval(fetchData, 5000);
    updateMapDisplay();
  }

  initializeDashboard();
});