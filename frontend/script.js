// Configuration
const API_URL = '/api';

// State
let isTracking = false;
let map, userMarker, userPath;
let pathCoordinates = [];
let watchId;
let timerInterval;
let startTime;
let totalDistance = 0;
let accuracyCircle = null;

let lastUpdate = 0;
let lastLat = null;
let lastLng = null;
let lastTime = null;

// Initialize Map
function initMap() {
    const southWest = L.latLng(-85, -180);
    const northEast = L.latLng(85, 180);
    const bounds = L.latLngBounds(southWest, northEast);

    map = L.map('map', {
        zoomControl: false,
        minZoom: 2,
        maxZoom: 19,
        maxBounds: bounds,
        maxBoundsViscosity: 1.0
    }).setView([40.7128, -74.0060], 15);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19,
        noWrap: true
    }).addTo(map);

    userPath = L.polyline([], {
        color: '#3b82f6',
        weight: 4,
        opacity: 0.8
    }).addTo(map);
}

// Start/Stop Tracking
function toggleTracking() {
    isTracking = !isTracking;
    const mainBtn = document.getElementById("mainBtn");

    if (isTracking) {
        mainBtn.textContent = "Stop Run";
        mainBtn.classList.add("stop");

        startTimer();
        startGPS();
        showToast("Run started");
    } else {
        mainBtn.textContent = "Start Run";
        mainBtn.classList.remove("stop");

        stopTimer();
        stopGPS();
        logRun();
        showSummary();
    }
}

// Timer
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

// GPS
function startGPS() {
    if ("geolocation" in navigator) {
        watchId = navigator.geolocation.watchPosition(
            handlePosition,
            handleError,
            {
                enableHighAccuracy: true,
                maximumAge: 0,
                timeout: 15000
            }
        );
    } else {
        alert("Geolocation is not supported by your browser.");
        toggleTracking();
    }
}

function stopGPS() {
    if (watchId) navigator.geolocation.clearWatch(watchId);

    if (accuracyCircle) {
        map.removeLayer(accuracyCircle);
        accuracyCircle = null;
    }
}

function logRun() {
    const distance = document.getElementById("distance").textContent;
    const time = document.getElementById("timer").textContent;
    const avg_velocity = document.getElementById("speed").textContent;

    fetch(`${API_URL}/log-run`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            distance: distance,
            time: time,
            avg_velocity: avg_velocity
        })
    });
}

function handlePosition(position) {
    const { latitude, longitude, accuracy, speed: gpsSpeed } = position.coords;
    const now = Date.now();

    if (accuracy > 1000) return;
    if (now - lastUpdate < 1000) return;

    lastUpdate = now;

    let currentLat = latitude;
    let currentLng = longitude;

    if (lastLat !== null && lastLng !== null) {
        currentLat = lastLat * 0.7 + latitude * 0.3;
        currentLng = lastLng * 0.7 + longitude * 0.3;
    }

    let speedKmh = gpsSpeed ? gpsSpeed * 3.6 : 0;

    if (!gpsSpeed && lastLat !== null && lastTime !== null) {
        const distKm = getDistanceFromLatLonInKm(lastLat, lastLng, currentLat, currentLng);
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
}

function handleError(error) {
    console.error("GPS Error:", error);
    showToast("GPS error");
}

// Helpers
function getDistanceFromLatLonInKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) *
        Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

// UI
function centerMap() {
    if (userMarker) {
        map.setView(userMarker.getLatLng(), 18);
        showToast("Centered on location");
    } else {
        showToast("No location yet");
    }
}


function showLogs() {
    const logBox = document.getElementById("log-box");
    const logList = document.getElementById("log-list");

    // show/hide the log box
    logBox.classList.toggle("hidden");

    // only fetch if the box is open
    if (logBox.classList.contains("hidden")) {
        return;
    }

    // clear old logs first
    logList.innerHTML = "Loading logs...";

    fetch(`${API_URL}/logs`)
        .then(res => res.json())
        .then(data => {
            const logs = data.logs || [];

            logList.innerHTML = "";

            if (logs.length === 0) {
                logList.textContent = "No logs yet.";
                return;
            }

            logs.forEach(log => {
                const item = document.createElement("div");
                item.className = "log-item";

                item.textContent = log.message || `${log.action}: ${log.details}`;

                logList.appendChild(item);
            });
        })
        .catch(err => {
            console.error("Error loading logs:", err);
            logList.textContent = "Failed to load logs.";
        });
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

    totalDistance = 0;
    pathCoordinates = [];

    if (userPath) userPath.setLatLngs([]);

    document.getElementById("distance").textContent = "0.00";
    document.getElementById("timer").textContent = "00:00";
    document.getElementById("speed").textContent = "0.0";
}

function showToast(msg) {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = "toast";
    toast.innerHTML = `<span>🔔</span> ${msg}`;

    container.appendChild(toast);

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

// Initialize
window.addEventListener('load', () => {
    initMap();
    loadMessage();
    setInterval(loadMessage, 10000);
});