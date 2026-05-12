// Configuration
const API_URL = 'http://localhost:3000/api';

// State
var isTracking = false;
var map, userMarker, userPath;
var pathCoordinates = [];
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
}

function toggleTracking() {
    if (isTracking) {
        stopTracking();
    } else {
        startTracking();
    }
}

function startTracking() {
    isTracking = true;

    const mainBtn = document.getElementById("mainBtn");

    mainBtn.textContent = "Stop Run";
    mainBtn.classList.add("stop");

    startTimer();
    startGPS();

    showToast("Run started!", "success");
}

function stopTracking() {
    isTracking = false;

    const mainBtn = document.getElementById("mainBtn");

    mainBtn.textContent = "Start Run";
    mainBtn.classList.remove("stop");

    stopTimer();
    stopGPS();
    showSummary();
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

    // 1. Ignore bad GPS accuracy
    if (accuracy > 30) {
        console.log("Ignored inaccurate GPS:", accuracy);
        return;
    }

    // 2. Throttle updates
    if (now - lastUpdate < 1000) return;
    lastUpdate = now;

    // 3. If we already have a point, check real movement
    if (lastLat !== null && lastLng !== null) {
        const movedDistanceKm = getDistanceFromLatLonInKm(
            lastLat,
            lastLng,
            latitude,
            longitude
        );

        const movedDistanceMeters = movedDistanceKm * 1000;

        // Ignore tiny fake GPS movement
        if (movedDistanceMeters < 5) {
            console.log("Ignored GPS drift:", movedDistanceMeters);
            return;
        }
    }

    let currentLat = latitude;
    let currentLng = longitude;

    // 4. Optional smoothing only after confirming real movement
    if (lastLat !== null && lastLng !== null) {
        currentLat = lastLat * 0.7 + latitude * 0.3;
        currentLng = lastLng * 0.7 + longitude * 0.3;
    }

    // 5. Speed
    let speedKmh = gpsSpeed ? gpsSpeed * 3.6 : 0;

    if (!gpsSpeed && lastLat !== null && lastTime !== null) {
        const distKm = getDistanceFromLatLonInKm(
            lastLat,
            lastLng,
            currentLat,
            currentLng
        );

        const timeDiffHours = (now - lastTime) / 1000 / 3600;

        if (timeDiffHours > 0) {
            speedKmh = distKm / timeDiffHours;
        }
    }

    if (speedKmh > 100) speedKmh = 0;

    document.getElementById("speed").textContent = speedKmh.toFixed(1);

    lastLat = currentLat;
    lastLng = currentLng;
    lastTime = now;

    const latLng = [currentLat, currentLng];

    if (!accuracyCircle) {
        accuracyCircle = L.circle(latLng, {
            radius: accuracy,
            color: "#3b82f6",
            fillColor: "#3b82f6",
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
            color: "white",
            fillColor: "#3b82f6",
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
    window.location.href = 'dashboard.html#leaderboard';
}

function hideLeaderboard() {
    document.getElementById("leaderboard-screen").classList.add("hidden");
}

function showSummary() {
    const dist = document.getElementById("distance").textContent;
    const time = document.getElementById("timer").textContent;

    document.getElementById("sum-dist").textContent = dist;
    document.getElementById("sum-time").textContent = time;

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

// ── Save run to Dashboard (requires user to be logged in) ───────────────────
async function saveRunToDashboard() {
    const msgEl  = document.getElementById('save-run-msg');
    const btn    = document.getElementById('save-run-btn');
    const token  = localStorage.getItem('cw_token');

    if (!token) {
        msgEl.style.color = '#ef4444';
        msgEl.textContent = '⚠️ Log in from the Dashboard first to save runs.';
        return;
    }

    // Collect run stats
    const distText = document.getElementById('distance').textContent;
    const timeText = document.getElementById('timer').textContent;
    const distance = parseFloat(distText) || 0;

    if (distance < 0.01) {
        msgEl.style.color = '#ef4444';
        msgEl.textContent = '⚠️ No distance recorded — start a run first!';
        return;
    }

    // Parse timer mm:ss → minutes
    const [mm, ss]   = timeText.split(':').map(Number);
    const duration   = mm + Math.round(ss / 60);
    const avgSpeed   = duration > 0 ? (distance / (duration / 60)) : 0;
    const calories   = Math.round(distance * 60 + avgSpeed * 5); // rough estimate

    btn.disabled     = true;
    msgEl.textContent = 'Saving…';

    try {
        const res = await fetch(`${API_URL}/sessions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ distance, avgSpeed, duration, calories })
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Save failed');

        msgEl.style.color  = '#22d3ee';
        msgEl.textContent  = `✅ Run saved! +${data.xpGained} XP earned`;
        btn.textContent    = '✔ Saved';

    } catch (err) {
        msgEl.style.color  = '#ef4444';
        msgEl.textContent  = `❌ ${err.message}`;
        btn.disabled       = false;
    }
}

// Initialize on Load
window.addEventListener('load', () => {
    initMap();
    loadMessage();
    setInterval(loadMessage, 10000); // 10s refresh
});
