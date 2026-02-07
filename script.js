var isTracking = false;

// Function to toggle activity tracking (Red/Green indicator and button text)

function toggleTracking() {
    isTracking = !isTracking;
    const mainBtn = document.getElementById("mainBtn");
    if (isTracking) {
        mainBtn.textContent = "Stop Activity";
        document.getElementById("check_for_activity").style.background = "var(--success)";
        document.getElementById("check_for_activity").style.boxShadow = "0 0 8px var(--success)";
    } else {
        mainBtn.textContent = "Start Activity";
        document.getElementById("check_for_activity").style.background = "var(--failed)";
        document.getElementById("check_for_activity").style.boxShadow = "0 0 8px var(--failed)";
    }
}

function getLocation() {
    if (!navigator.geolocation) {
        document.getElementById("output").innerText =
            "Geolocation is not supported by your browser.";
        return;
    }

    navigator.geolocation.getCurrentPosition(
        success,
        error,
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}


watchId = navigator.geolocation.watchPosition(
    (position) => {
        console.log("UPDATE @", new Date().toLocaleTimeString());
        console.log(position.coords.latitude, position.coords.longitude);
    },
    (error) => console.error(error),
    { enableHighAccuracy: true }
);

var tracking = false;

function startTracking() {
    if (!("geolocation" in navigator)) {
        console.log("Geolocation not supported");
        return;
    }

    watchId = navigator.geolocation.watchPosition(
        (position) => {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            const acc = position.coords.accuracy;
            const speed = position.coords.speed; // m/s (may be null)

            console.log("Lat:", lat);
            console.log("Lon:", lon);
            console.log("Accuracy:", acc, "meters");
            console.log("Speed:", speed);

            // Example: update UI
            document.getElementById("lat").textContent = lat;
            document.getElementById("lon").textContent = lon;
        },
        (error) => {
            console.error("GPS error:", error.message);
        },
        {
            enableHighAccuracy: true,
            maximumAge: 1000,   // use cached position for 1s
            timeout: 5000
        }
    );
}

function stopTracking() {
    if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
    }
}


