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
    const southWest = L.latLng(-85, -180);
    const northEast = L.latLng(85, 180);
    const bounds = L.latLngBounds(southWest, northEast);

    map = L.map('map', {
        zoomControl: false,
        minZoom: 2,
        maxZoom: 19,
        maxBounds: bounds,
        maxBoundsViscosity: 1.0
    }).setView([40.7128, -74.0060], 15); // Hide default zoom

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
        noWrap: true
    }).addTo(map);

    userPath = L.polyline([], { color: '#3b82f6', weight: 4, opacity: 0.8 }).addTo(map);

    // Load initial territories
    fetchTerritories();
}

// Start/Stop Tracking Logic
function toggleTracking() {
    isTracking = !isTracking;
    const mainBtn = document.getElementById("mainBtn");

    if (isTracking) {
        // Start
        mainBtn.textContent = "Stop Patrol";
        mainBtn.classList.add("stop");

        startTimer();
        startGPS();
        showToast("Patrol Started. Good luck!", "success");
    } else {
        // Stop
        mainBtn.textContent = "Start Patrol";
        mainBtn.classList.remove("stop");

        stopTimer();
        stopGPS();
        showSummary(); // Show End Screen
    }
}

// Timer Logic
function startTimer() {
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

// GPS Logic
function startGPS() {
    if ("geolocation" in navigator) {
        const options = {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 15000
        };

        watchId = navigator.geolocation.watchPosition(
            handlePosition,
            handleError,
            options
        );
    } else {
        alert("Geolocation is not supported by your browser.");
        toggleTracking(); // Turn off
    }
}

function stopGPS() {
    if (watchId) navigator.geolocation.clearWatch(watchId);
    if (accuracyCircle) map.removeLayer(accuracyCircle);
    accuracyCircle = null;
}

let lastUpdate = 0;
let lastLat = null;
let lastLng = null;
let lastTime = null;
let accuracyCircle = null;

function handlePosition(position) {
    const { latitude, longitude, accuracy, speed: gpsSpeed } = position.coords;
    const now = Date.now();

    // 1. Accuracy Filter (Relaxed)
    if (accuracy > 1000) {
        return;
    }

    // 2. Throttle Updates (1 sec)
    if (now - lastUpdate < 1000) return;
    lastUpdate = now;

    let currentLat = latitude;
    let currentLng = longitude;

    // 3. Smoothing
    if (lastLat !== null && lastLng !== null) {
        currentLat = lastLat * 0.7 + latitude * 0.3;
        currentLng = lastLng * 0.7 + longitude * 0.3;
    }

    // 4. Update UI
    let speedKmh = gpsSpeed ? (gpsSpeed * 3.6) : 0;

    // Fallback calc
    if (!gpsSpeed && lastLat !== null && lastTime !== null) {
        const distKm = getDistanceFromLatLonInKm(lastLat, lastLng, currentLat, currentLng);
        const timeDiffHours = (now - lastTime) / 1000 / 3600;
        if (timeDiffHours > 0) speedKmh = distKm / timeDiffHours;
    }
    if (speedKmh > 100) speedKmh = 0; // Cap

    document.getElementById("speed").textContent = speedKmh.toFixed(1);

    lastLat = currentLat;
    lastLng = currentLng;
    lastTime = now;

    // 5. Update Map Visuals
    const latLng = [currentLat, currentLng];

    if (!accuracyCircle) {
        accuracyCircle = L.circle(latLng, {
            radius: accuracy,
            color: '#3b82f6',
            fillColor: '#3b82f6',
            fillOpacity: 0.1,
            weight: 1,
            opacity: 0.3
        }).addTo(map);
    } else {
        accuracyCircle.setLatLng(latLng);
        accuracyCircle.setRadius(accuracy);
    }

    if (!userMarker) {
        userMarker = L.circleMarker(latLng, {
            radius: 8,
            color: 'white',
            fillColor: '#3b82f6',
            fillOpacity: 1
        }).addTo(map);
        map.setView(latLng, 18);
    } else {
        userMarker.setLatLng(latLng);
        map.panTo(latLng);
    }

    pathCoordinates.push(latLng);
    userPath.setLatLngs(pathCoordinates);

    if (pathCoordinates.length > 1) {
        const lastPt = L.latLng(pathCoordinates[pathCoordinates.length - 2]);
        const currPt = L.latLng(latLng);
        totalDistance += lastPt.distanceTo(currPt) / 1000;
        document.getElementById("distance").textContent = totalDistance.toFixed(2);
    }

    captureTerritory(currentLat, currentLng);
}

// Helper
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var dLat = deg2rad(lat2 - lat1);
    var dLon = deg2rad(lon2 - lon1);
    var a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var d = R * c;
    return d;
}

function deg2rad(deg) { return deg * (Math.PI / 180) }

function handleError(error) { console.error("GPS Error: ", error); }


// =========================
// UI & SCREEN LOGIC
// =========================

function centerMap() {
    if (userMarker) {
        map.setView(userMarker.getLatLng(), 18);
        showToast("Centered on Location");
    } else {
        showToast("No location yet...");
    }
}

function showLeaderboard() {
    // Update local score in LB
    const currentScore = document.getElementById("myScore").textContent;
    document.getElementById("lb-my-score").textContent = currentScore + " pts";

    document.getElementById("leaderboard-screen").classList.remove("hidden");
}

function hideLeaderboard() {
    document.getElementById("leaderboard-screen").classList.add("hidden");
}

function showSummary() {
    const dist = document.getElementById("distance").textContent;
    const time = document.getElementById("timer").textContent;
    const score = document.getElementById("myScore").textContent;

    document.getElementById("sum-dist").textContent = dist;
    document.getElementById("sum-time").textContent = time;
    document.getElementById("sum-score").textContent = score;

    document.getElementById("summary-screen").classList.remove("hidden");
}

function hideSummary() {
    document.getElementById("summary-screen").classList.add("hidden");
    // Reset stats if needed
    totalDistance = 0;
    document.getElementById("distance").textContent = "0.00";
    document.getElementById("timer").textContent = "00:00";
}

function showToast(msg) {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `<span>🔔</span> ${msg}`;
    container.appendChild(toast);

    // Remove after anim (3s)
    setTimeout(() => {
        toast.remove();
    }, 3000);
}


// Backend Integration

function fetchTerritories() {
    fetch(`${API_URL}/territories`)
        .then(res => res.json())
        .then(data => {
            if (data.territories) {
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
                drawTerritory(data.gridId, '#3b82f6'); // Neon Blue
                fetchTerritories();
                showToast("Zone Captured! +10 pts");
            }
        })
        .catch(err => console.error("Error updating location:", err));
}

function drawTerritory(gridId, color) {
    if (conqueredGrids.has(gridId)) return;

    // Adjust color for neon theme if needed
    // But backend sends hex, so we trust it or override
    let drawColor = color;
    if (color === '#6366f1') drawColor = '#3b82f6'; // Match neon blue

    const [latIdx, lngIdx] = gridId.split(',').map(Number);
    const lat = latIdx / 10000;
    const lng = lngIdx / 10000;

    const bounds = [[lat, lng], [lat + 0.0001, lng + 0.0001]];

    L.rectangle(bounds, {
        color: drawColor,
        weight: 1,
        fillOpacity: 0.4,
        className: 'territory-anim'
    }).addTo(map);
    conqueredGrids.add(gridId);
}

function updateScoreBoard(territories) {
    let myCount = 0;
    let rivalCount = 0;

    territories.forEach(t => {
        if (t.color === '#6366f1' || t.color === '#3b82f6') myCount++;
        else rivalCount++;
    });

    document.getElementById("myScore").textContent = myCount * 10; // 10 pts per zone
    document.getElementById("enemyScore").textContent = rivalCount * 10;
}

// Message Logic
async function loadMessage() {
    try {
        const res = await fetch(`${API_URL}/message`);
        const data = await res.json();
        const msgEl = document.getElementById('gameMessage');
        if (data.content && msgEl) {
            msgEl.textContent = data.content;
        }
    } catch (err) {
        console.error("Error fetching message:", err);
    }
}

// Initialize on Load
window.addEventListener('load', () => {
    initMap();
    loadMessage();
    setInterval(loadMessage, 10000); // 10s refresh
});
