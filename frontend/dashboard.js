/* ═══════════════════════════════════════════════════════
   CARDIO WARS — Dashboard Logic
   Auth flow, stat loading, chart rendering, leaderboard
═══════════════════════════════════════════════════════ */

const API = 'http://localhost:3000/api';

// ─── State ────────────────────────────────────────────────────────────────────
let currentUser = null;
let activityChart = null;
let currentLeaderboard = 'xp';

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('cw_token');
    if (token) {
        // Already logged in — verify token and boot app
        bootstrapApp();
    }

    // Live XP preview on workout form inputs
    ['w-distance', 'w-speed'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener('input', updateXPPreview);
    });

    updateGreeting();
});

// ─── Auth ─────────────────────────────────────────────────────────────────────

function showAuthTab(tab) {
    document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
    document.getElementById('register-form').classList.toggle('hidden', tab !== 'register');
    document.getElementById('tab-login').classList.toggle('active', tab === 'login');
    document.getElementById('tab-register').classList.toggle('active', tab === 'register');
    clearErrors();
}

function clearErrors() {
    ['login-error', 'reg-error', 'workout-error', 'workout-success'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.classList.add('hidden'); el.textContent = ''; }
    });
}

async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    const errorEl = document.getElementById('login-error');
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    setLoading(btn, true);
    try {
        const res  = await fetch(`${API}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Login failed');

        localStorage.setItem('cw_token', data.token);
        localStorage.setItem('cw_user', JSON.stringify(data.user));
        currentUser = data.user;
        await bootstrapApp();

    } catch (err) {
        showError(errorEl, err.message);
    } finally {
        setLoading(btn, false);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const btn      = document.getElementById('register-btn');
    const errorEl  = document.getElementById('reg-error');
    const username = document.getElementById('reg-username').value.trim();
    const email    = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;

    setLoading(btn, true);
    try {
        const res  = await fetch(`${API}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, email, password })
        });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Registration failed');

        localStorage.setItem('cw_token', data.token);
        localStorage.setItem('cw_user', JSON.stringify(data.user));
        currentUser = data.user;
        await bootstrapApp();

    } catch (err) {
        showError(errorEl, err.message);
    } finally {
        setLoading(btn, false);
    }
}

function logout() {
    localStorage.removeItem('cw_token');
    localStorage.removeItem('cw_user');
    currentUser = null;
    document.getElementById('app').classList.add('hidden');
    document.getElementById('auth-overlay').classList.remove('hidden');
    clearErrors();
}

// ─── Bootstrap App ────────────────────────────────────────────────────────────

async function bootstrapApp() {
    try {
        const profile = await authFetch(`${API}/auth/me`);
        currentUser = profile.user;
        localStorage.setItem('cw_user', JSON.stringify(currentUser));
    } catch {
        // Token invalid — force re-login
        logout();
        return;
    }

    document.getElementById('auth-overlay').classList.add('hidden');
    document.getElementById('app').classList.remove('hidden');

    populateSidebar();
    await loadDashboard();
}

function populateSidebar() {
    const u = currentUser;
    if (!u) return;
    const initials = u.username ? u.username[0].toUpperCase() : '?';
    document.getElementById('sidebar-username').textContent = u.username || 'Warrior';
    document.getElementById('sidebar-level').textContent    = `Lvl ${u.level || 1}`;
    document.getElementById('sidebar-avatar').textContent   = initials;
    document.getElementById('mobile-avatar').textContent    = initials;
}

// ─── Page Navigation ──────────────────────────────────────────────────────────

async function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

    const pageEl = document.getElementById(`page-${page}`);
    const navEl  = document.getElementById(`nav-${page}`);
    if (pageEl) pageEl.classList.add('active');
    if (navEl)  navEl.classList.add('active');

    // Lazy-load page data
    if (page === 'dashboard')   await loadDashboard();
    if (page === 'leaderboard') await loadLeaderboard(currentLeaderboard);
    if (page === 'profile')     loadProfile();

    // Close sidebar on mobile
    document.querySelector('.sidebar').classList.remove('open');
}

function toggleSidebar() {
    document.querySelector('.sidebar').classList.toggle('open');
}

function openMap() {
    window.location.href = 'index.html';
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

async function loadDashboard() {
    try {
        const [statsData, sessionsData] = await Promise.all([
            authFetch(`${API}/sessions/stats`),
            authFetch(`${API}/sessions?limit=10`)
        ]);

        renderStats(statsData.stats);
        renderSessions(sessionsData.sessions);
        renderChart(sessionsData.sessions);
    } catch (err) {
        console.error('Dashboard load error:', err);
    }
}

function renderStats(stats) {
    if (!stats) return;
    animateNumber('stat-distance', stats.total_distance || 0, 1);
    animateNumber('stat-speed',    stats.avg_speed      || 0, 1);
    animateNumber('stat-calories', stats.calories_burned || 0, 0);
    animateNumber('stat-workouts', stats.workout_count  || 0, 0);

    // XP / Level bar
    const xp    = stats.xp    || currentUser?.xp    || 0;
    const level = stats.level || currentUser?.level  || 1;
    const xpInLevel   = xp % 500;
    const xpForNext   = 500;
    const pct         = Math.min((xpInLevel / xpForNext) * 100, 100);

    document.getElementById('xp-level').textContent   = level;
    document.getElementById('xp-current').textContent = xp;
    document.getElementById('xp-next').textContent    = level * 500;
    document.getElementById('xp-fill').style.width    = `${pct}%`;

    // Streak
    const streak = stats.streak || currentUser?.streak || 0;
    document.getElementById('streak-count').textContent = streak;
}

function renderSessions(sessions) {
    const container = document.getElementById('sessions-list');
    if (!sessions || sessions.length === 0) {
        container.innerHTML = '<div class="empty-state">No workouts yet. Get moving! 🏃</div>';
        return;
    }

    container.innerHTML = sessions.map(s => {
        const xp    = Math.round(s.distance * 10 + s.avg_speed * 2);
        const date  = new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return `
        <div class="session-item">
            <div class="session-meta">
                <span class="session-date">${date}</span>
                <div class="session-stats">
                    <span class="session-stat">📏 ${(+s.distance).toFixed(1)} km</span>
                    <span class="session-stat">⚡ ${(+s.avg_speed).toFixed(1)} km/h</span>
                    <span class="session-stat">⏱ ${s.duration} min</span>
                    <span class="session-stat">🔥 ${Math.round(+s.calories)} cal</span>
                </div>
            </div>
            <span class="session-xp">+${xp} XP</span>
        </div>`;
    }).join('');
}

function renderChart(sessions) {
    const ctx = document.getElementById('activityChart');
    if (!ctx) return;

    // Take last 7, reverse so oldest is first
    const recent = [...(sessions || [])].slice(0, 7).reverse();
    const labels = recent.map(s =>
        new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    );
    const distances = recent.map(s => +(+s.distance).toFixed(1));
    const calories  = recent.map(s => Math.round(+s.calories));

    if (activityChart) activityChart.destroy();

    activityChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: 'Distance (km)',
                    data: distances,
                    backgroundColor: 'rgba(99,102,241,0.5)',
                    borderColor: '#6366f1',
                    borderWidth: 2,
                    borderRadius: 6,
                    yAxisID: 'y',
                },
                {
                    label: 'Calories',
                    data: calories,
                    type: 'line',
                    borderColor: '#22d3ee',
                    backgroundColor: 'rgba(34,211,238,0.1)',
                    borderWidth: 2,
                    tension: 0.4,
                    pointBackgroundColor: '#22d3ee',
                    pointRadius: 4,
                    fill: true,
                    yAxisID: 'y1',
                }
            ]
        },
        options: {
            responsive: true,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    labels: { color: '#94a3b8', font: { family: 'Inter', size: 12 } }
                },
                tooltip: {
                    backgroundColor: '#12141a',
                    borderColor: 'rgba(255,255,255,0.07)',
                    borderWidth: 1,
                    titleColor: '#f1f5f9',
                    bodyColor: '#94a3b8',
                }
            },
            scales: {
                x: {
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } }
                },
                y: {
                    position: 'left',
                    grid: { color: 'rgba(255,255,255,0.04)' },
                    ticks: { color: '#64748b', font: { family: 'Inter', size: 11 } }
                },
                y1: {
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    ticks: { color: '#22d3ee', font: { family: 'Inter', size: 11 } }
                }
            }
        }
    });
}

// ─── Log Workout ──────────────────────────────────────────────────────────────

function updateXPPreview() {
    const dist  = parseFloat(document.getElementById('w-distance').value) || 0;
    const speed = parseFloat(document.getElementById('w-speed').value) || 0;
    if (dist > 0 || speed > 0) {
        const xp = Math.round(dist * 10 + speed * 2);
        document.getElementById('xp-preview-value').textContent = xp;
        document.getElementById('xp-preview').classList.remove('hidden');
    } else {
        document.getElementById('xp-preview').classList.add('hidden');
    }
}

async function handleLogWorkout(e) {
    e.preventDefault();
    const btn       = document.getElementById('workout-btn');
    const errorEl   = document.getElementById('workout-error');
    const successEl = document.getElementById('workout-success');

    const distance = parseFloat(document.getElementById('w-distance').value);
    const avgSpeed = parseFloat(document.getElementById('w-speed').value);
    const duration = parseInt(document.getElementById('w-duration').value);
    const calories = parseFloat(document.getElementById('w-calories').value);

    clearErrors();
    setLoading(btn, true);

    try {
        const data = await authFetch(`${API}/sessions`, {
            method: 'POST',
            body: JSON.stringify({ distance, avgSpeed, duration, calories })
        });

        successEl.textContent = `✅ Workout saved! You earned +${data.xpGained} XP`;
        successEl.classList.remove('hidden');
        document.getElementById('workout-form').reset();
        document.getElementById('xp-preview').classList.add('hidden');

        // Refresh sidebar level after XP gain
        setTimeout(async () => {
            const profile = await authFetch(`${API}/auth/me`);
            currentUser = profile.user;
            populateSidebar();
        }, 500);

    } catch (err) {
        showError(errorEl, err.message);
    } finally {
        setLoading(btn, false);
    }
}

// ─── Leaderboard ──────────────────────────────────────────────────────────────

async function loadLeaderboard(type = 'xp') {
    currentLeaderboard = type;
    const container = document.getElementById('leaderboard-list');
    container.innerHTML = '<div class="loading-spinner">Loading warriors...</div>';

    try {
        const url = type === 'territory'
            ? `${API}/leaderboard/territory`
            : `${API}/leaderboard`;
        const data = await authFetch(url);
        renderLeaderboard(data.leaderboard || [], type);
    } catch (err) {
        container.innerHTML = '<div class="empty-state">Failed to load leaderboard.</div>';
    }
}

function renderLeaderboard(entries, type) {
    const container = document.getElementById('leaderboard-list');
    if (!entries.length) {
        container.innerHTML = '<div class="empty-state">No warriors ranked yet. Be the first! 🏆</div>';
        return;
    }

    const rankEmoji = ['🥇','🥈','🥉'];

    container.innerHTML = entries.map((e, i) => {
        const rank    = rankEmoji[i] || `#${i + 1}`;
        const cls     = i < 3 ? `top-${i + 1}` : '';
        const color   = e.color || '#6366f1';
        const initial = e.username ? e.username[0].toUpperCase() : '?';
        const score   = type === 'territory' ? e.territory_count : e.xp;
        const scoreLabel = type === 'territory' ? 'territories' : 'XP';
        const sub = type === 'territory'
            ? `Level ${e.level || 1}`
            : `${(+(e.total_distance || 0)).toFixed(1)} km · ${e.workout_count || 0} workouts`;

        return `
        <div class="lb-item ${cls}">
            <div class="lb-rank">${rank}</div>
            <div class="lb-avatar" style="background:${color}">${initial}</div>
            <div class="lb-info">
                <div class="lb-name">${e.username}</div>
                <div class="lb-sub">${sub}</div>
            </div>
            <div>
                <div class="lb-score">${score}</div>
                <div class="lb-score-label">${scoreLabel}</div>
            </div>
        </div>`;
    }).join('');
}

function switchLeaderboard(type) {
    document.getElementById('lb-xp-btn').classList.toggle('active', type === 'xp');
    document.getElementById('lb-territory-btn').classList.toggle('active', type === 'territory');
    loadLeaderboard(type);
}

// ─── Profile ──────────────────────────────────────────────────────────────────

function loadProfile() {
    const u = currentUser;
    if (!u) return;

    const initial = u.username ? u.username[0].toUpperCase() : '?';
    document.getElementById('profile-avatar').textContent   = initial;
    document.getElementById('profile-username').textContent = u.username || '—';
    document.getElementById('profile-email').textContent    = u.email    || '—';
    document.getElementById('profile-level').textContent    = `Level ${u.level || 1}`;
    document.getElementById('profile-xp').textContent      = `${u.xp || 0} XP`;
    document.getElementById('profile-streak').textContent   = `🔥 ${u.streak || 0} streak`;

    document.getElementById('profile-stats-grid').innerHTML = `
        <div class="stat-card">
            <div class="stat-icon">📏</div>
            <div class="stat-value">${(+(u.total_distance || 0)).toFixed(1)}</div>
            <div class="stat-label">Total km</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">⚡</div>
            <div class="stat-value">${(+(u.avg_speed || 0)).toFixed(1)}</div>
            <div class="stat-label">Avg Speed</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">🔥</div>
            <div class="stat-value">${Math.round(u.calories_burned || 0)}</div>
            <div class="stat-label">Calories</div>
        </div>
        <div class="stat-card">
            <div class="stat-icon">🏅</div>
            <div class="stat-value">${u.workout_count || 0}</div>
            <div class="stat-label">Workouts</div>
        </div>
    `;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Authenticated fetch — always sends JWT from localStorage.
 * Throws on non-2xx responses.
 */
async function authFetch(url, options = {}) {
    const token = localStorage.getItem('cw_token');
    const res = await fetch(url, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...(options.headers || {})
        }
    });

    if (res.status === 401 || res.status === 403) {
        logout();
        throw new Error('Session expired. Please log in again.');
    }

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
}

function setLoading(btn, loading) {
    btn.disabled = loading;
    btn.querySelector('span').textContent = loading ? 'Loading…' : btn.dataset.label || btn.querySelector('span').textContent;
    if (!btn.dataset.label && !loading) return;
    if (loading) btn.dataset.label = btn.querySelector('span').textContent;
}

function showError(el, msg) {
    el.textContent = msg;
    el.classList.remove('hidden');
}

function updateGreeting() {
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const el = document.getElementById('greeting');
    if (el && currentUser) el.textContent = `${greet}, ${currentUser.username}! 💪`;
    else if (el) el.textContent = `${greet}, Warrior! 💪`;
}

/**
 * Smooth number counter animation.
 */
function animateNumber(elementId, target, decimals = 0) {
    const el = document.getElementById(elementId);
    if (!el) return;
    const start    = parseFloat(el.textContent) || 0;
    const duration = 800;
    const startTs  = performance.now();

    function step(ts) {
        const progress = Math.min((ts - startTs) / duration, 1);
        const ease     = 1 - Math.pow(1 - progress, 3); // ease-out cubic
        const current  = start + (target - start) * ease;
        el.textContent = current.toFixed(decimals);
        if (progress < 1) requestAnimationFrame(step);
    }

    requestAnimationFrame(step);
}
