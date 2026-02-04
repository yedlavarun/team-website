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

