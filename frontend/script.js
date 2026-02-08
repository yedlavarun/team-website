// Configuration
const API_URL = 'http://localhost:3000/api';
const USER_ID = 1; // "You"

// State
var isTracking = false;
var map, userMarker, userPath;
var pathCoordinates = [];
var conqueredGrids = new Set();
var watchId;
var timerInterval;
var startTime;
var totalDistance = 0;

// Initialize Map
function initMap() {
    // Default to a central location (e.g., New York) if geolocation fails
    // or wait for geolocation
    map = L.map('map').setView([40.7128, -74.0060], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    userPath = L.polyline([], { color: 'blue' }).addTo(map);

    // Load initial territories
    fetchTerritories();
}

// Start/Stop Tracking Logic
function toggleTracking() {
    isTracking = !isTracking;
    const mainBtn = document.getElementById("mainBtn");

    if (isTracking) {
        // Start
        mainBtn.textContent = "Stop Activity";
        document.getElementById("check_for_activity").style.background = "var(--success)";
        document.getElementById("check_for_activity").style.boxShadow = "0 0 8px var(--success)";

        startTimer();
        startGPS();
    } else {
        // Stop
        mainBtn.textContent = "Start Activity";
        document.getElementById("check_for_activity").style.background = "var(--failed)";
        document.getElementById("check_for_activity").style.boxShadow = "0 0 8px var(--failed)";

        stopTimer();
        stopGPS();
    }
}

// Timer Logic
function startTimer() {
    startTime = Date.now() - (parseTimer() * 1000); // Resume if needed, or start fresh logic
    // For simplicity, let's reset or continue. Let's assume continue for session.
    // If we want reset on stop, we can do that. Let's just continue for now.

    // Better: let's not reset for this demo, just accumulate.
    startTime = Date.now();
    timerInterval = setInterval(() => {
        const delta = Math.floor((Date.now() - startTime) / 1000);
        const m = Math.floor(delta / 60).toString().padStart(2, '0');
        const s = (delta % 60).toString().padStart(2, '0');
        document.getElementById("timer").textContent = `${m}:${s}`;
    }, 1000);
}

function stopTimer() {
    clearInterval(timerInterval);
}

function parseTimer() {
    // Helper if we wanted to resume, not used currently
    return 0;
}

// GPS Logic
function startGPS() {
    if ("geolocation" in navigator) {
        watchId = navigator.geolocation.watchPosition(
            handlePosition,
            handleError,
            { enableHighAccuracy: true, maximumAge: 10000, timeout: 5000 }
        );
    } else {
        alert("Geolocation is not supported by your browser.");
        toggleTracking(); // Turn off
    }
}

function stopGPS() {
    if (watchId) navigator.geolocation.clearWatch(watchId);
}

function handlePosition(position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const accuracy = position.coords.accuracy;

    // Update Map View (Center on user)
    const latLng = [lat, lng];
    if (!userMarker) {
        userMarker = L.circleMarker(latLng, {
            radius: 8,
            color: 'white',
            fillColor: '#6366f1',
            fillOpacity: 1
        }).addTo(map);
        map.setView(latLng, 18);
    } else {
        userMarker.setLatLng(latLng);
        map.panTo(latLng);
    }

    // Update Path
    pathCoordinates.push(latLng);
    userPath.setLatLngs(pathCoordinates);

    // Calculate Distance
    if (pathCoordinates.length > 1) {
        const lastPt = L.latLng(pathCoordinates[pathCoordinates.length - 2]);
        const currPt = L.latLng(latLng);
        totalDistance += lastPt.distanceTo(currPt) / 1000; // km
        document.getElementById("distance").textContent = totalDistance.toFixed(2);
    }

    // Capture Territory
    captureTerritory(lat, lng);
}

function handleError(error) {
    console.error("GPS Error: ", error);
}

// Backend Integration

function fetchTerritories() {
    fetch(`${API_URL}/territories`)
        .then(res => res.json())
        .then(data => {
            if (data.territories) {
                // Clear existing territory layers if we were storing them (optional)
                // For now, just drawing new ones. 
                // In production, might want to clear layerGroup.

                data.territories.forEach(t => {
                    drawTerritory(t.grid_id, t.color);
                });
                updateScoreBoard(data.territories);
            }
        })
        .catch(err => console.error("Error fetching territories:", err));
}

function captureTerritory(lat, lng) {
    fetch(`${API_URL}/update-location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lat, lng, userId: USER_ID })
    })
        .then(res => res.json())
        .then(data => {
            if (data.captured) {
                drawTerritory(data.gridId, '#6366f1'); // User color
                fetchTerritories(); // Refresh to update scores/rivals
            }
        })
        .catch(err => console.error("Error updating location:", err));
}

function drawTerritory(gridId, color) {
    // gridId is "latIndex,lngIndex"
    // We need to convert back to bounds
    // Resolution was 0.0001

    if (conqueredGrids.has(gridId)) return; // Already drawn (simple check)
    // Actually, we should allow redraw if color changes. 
    // For specific implementation, let's just draw rects.

    const [latIdx, lngIdx] = gridId.split(',').map(Number);
    const lat = latIdx / 10000;
    const lng = lngIdx / 10000;

    const bounds = [[lat, lng], [lat + 0.0001, lng + 0.0001]];

    L.rectangle(bounds, { color: color, weight: 1, fillOpacity: 0.4 }).addTo(map);
    conqueredGrids.add(gridId);
}

function updateScoreBoard(territories) {
    let myCount = 0;
    let rivalCount = 0;

    territories.forEach(t => {
        if (t.color === '#6366f1') myCount++; // User
        else rivalCount++; // Rival/Others
    });

    document.getElementById("myScore").textContent = myCount;
    document.getElementById("enemyScore").textContent = rivalCount;
}

// Initialize on Load
window.addEventListener('load', initMap);
