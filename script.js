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

function success(position) {
    const lat = position.coords.latitude;
    const lon = position.coords.longitude;
    const accuracy = position.coords.accuracy;

    document.getElementById("output").innerText =
        `Latitude: ${lat}
Longitude: ${lon}
Accuracy: ±${accuracy} meters`;

    console.log(position.coords);
}

function error(err) {
    document.getElementById("output").innerText =
        `Error: ${err.message}`;
}
