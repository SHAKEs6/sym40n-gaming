// ============================================
// SYM40N GAMING - DATA PERSISTENCE & UTILITIES
// ============================================

// ==================
// Data Management
// ==================

const DataManager = {
    // User Management
    saveUser: function(email, userData) {
        let users = JSON.parse(localStorage.getItem('users') || '{}');
        users[email] = userData;
        localStorage.setItem('users', JSON.stringify(users));
        return true;
    },

    getUser: function(email) {
        let users = JSON.parse(localStorage.getItem('users') || '{}');
        return users[email] || null;
    },

    getAllUsers: function() {
        return JSON.parse(localStorage.getItem('users') || '{}');
    },

    // Session Management
    setSession: function(email, userName) {
        localStorage.setItem('currentUser', email);
        localStorage.setItem('currentUserName', userName);
        localStorage.setItem('sessionStart', new Date().toISOString());
        // Add to active sessions
        try {
            let sessions = JSON.parse(localStorage.getItem('activeSessions') || '{}');
            sessions[email] = {
                email: email,
                userName: userName,
                sessionStart: new Date().toISOString(),
                lastActive: new Date().toISOString()
            };
            localStorage.setItem('activeSessions', JSON.stringify(sessions));
        } catch (e) {
            console.warn('Failed to save active session', e);
        }
        return true;
    },

    getSession: function() {
        return {
            email: localStorage.getItem('currentUser'),
            userName: localStorage.getItem('currentUserName'),
            sessionStart: localStorage.getItem('sessionStart')
        };
    },

    clearSession: function() {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('currentUserName');
        localStorage.removeItem('sessionStart');
        // Remove from active sessions
        try {
            const email = localStorage.getItem('currentUser');
            let sessions = JSON.parse(localStorage.getItem('activeSessions') || '{}');
            if (email && sessions[email]) {
                delete sessions[email];
                localStorage.setItem('activeSessions', JSON.stringify(sessions));
            }
        } catch (e) {
            console.warn('Failed to remove active session', e);
        }
        return true;
    },

    isLoggedIn: function() {
        return !!localStorage.getItem('currentUser');
    },

    // Download Management
    saveDownload: function(gameName, downloadData) {
        let downloads = JSON.parse(localStorage.getItem('gameDownloads') || '{}');
        downloads[gameName] = {
            ...downloadData,
            downloadedAt: new Date().toISOString()
        };
        localStorage.setItem('gameDownloads', JSON.stringify(downloads));
        return true;
    },

    getDownloads: function() {
        return JSON.parse(localStorage.getItem('gameDownloads') || '{}');
    },

    getDownloadCount: function() {
        return Object.keys(this.getDownloads()).length;
    },

    // Contact Messages
    saveMessage: function(name, email, message) {
        let messages = JSON.parse(localStorage.getItem('contactMessages') || '[]');
        messages.push({
            name: name,
            email: email,
            message: message,
            submittedAt: new Date().toISOString()
        });
        localStorage.setItem('contactMessages', JSON.stringify(messages));
        return true;
    },

    getMessages: function() {
        return JSON.parse(localStorage.getItem('contactMessages') || '[]');
    }
};

// Session helpers
DataManager.getActiveSessions = function() {
    return JSON.parse(localStorage.getItem('activeSessions') || '{}');
};

DataManager.getActiveSessionCount = function() {
    return Object.keys(this.getActiveSessions()).length;
};

DataManager.touchSession = function(email) {
    try {
        let sessions = JSON.parse(localStorage.getItem('activeSessions') || '{}');
        if (sessions[email]) {
            sessions[email].lastActive = new Date().toISOString();
            localStorage.setItem('activeSessions', JSON.stringify(sessions));
            return true;
        }
    } catch (e) { console.warn(e); }
    return false;
};

// Notifications
DataManager.addNotification = function(message, type = 'info') {
    try {
        let notes = JSON.parse(localStorage.getItem('notifications') || '[]');
        const note = {
            id: 'n_' + Date.now(),
            message: message,
            type: type,
            createdAt: new Date().toISOString(),
            read: false
        };
        notes.unshift(note);
        localStorage.setItem('notifications', JSON.stringify(notes));
        return note;
    } catch (e) { console.warn('addNotification failed', e); return null; }
};

DataManager.getNotifications = function() {
    return JSON.parse(localStorage.getItem('notifications') || '[]');
};

DataManager.markNotificationRead = function(id) {
    try {
        let notes = JSON.parse(localStorage.getItem('notifications') || '[]');
        notes = notes.map(n => n.id === id ? {...n, read: true} : n);
        localStorage.setItem('notifications', JSON.stringify(notes));
        return true;
    } catch (e) { console.warn(e); return false; }
};

// Announcements
DataManager.setAnnouncement = function(message) {
    try {
        const note = {
            id: 'a_' + Date.now(),
            message: message,
            createdAt: new Date().toISOString()
        };
        localStorage.setItem('siteAnnouncement', JSON.stringify(note));
        // also add to notifications for admin history
        this.addNotification('Announcement sent: ' + (message.length > 60 ? message.slice(0,60) + '…' : message), 'info');
        return note;
    } catch (e) { console.warn(e); return null; }
};

DataManager.getAnnouncement = function() {
    return JSON.parse(localStorage.getItem('siteAnnouncement') || 'null');
};

// Music management
DataManager.addMusic = function(title, url) {
    try {
        let mus = JSON.parse(localStorage.getItem('siteMusic') || '[]');
        const entry = { id: 'm_' + Date.now(), title: title, url: url, addedAt: new Date().toISOString() };
        mus.push(entry);
        localStorage.setItem('siteMusic', JSON.stringify(mus));
        this.addNotification('New music added: ' + title, 'info');
        return entry;
    } catch (e) { console.warn(e); return null; }
};

DataManager.getMusic = function() {
    return JSON.parse(localStorage.getItem('siteMusic') || '[]');
};

DataManager.removeMusic = function(id) {
    try {
        let mus = JSON.parse(localStorage.getItem('siteMusic') || '[]');
        mus = mus.filter(m => m.id !== id);
        localStorage.setItem('siteMusic', JSON.stringify(mus));
        this.addNotification('Music removed', 'info');
        return true;
    } catch (e) { console.warn(e); return false; }
};

// Show announcement to users on page load if unseen
document.addEventListener('DOMContentLoaded', function() {
    try {
        const ann = DataManager.getAnnouncement();
        if (!ann) return;
        const lastSeen = localStorage.getItem('lastSeenAnnouncement');
        if (lastSeen !== ann.id) {
            // show persistent banner and a notification
            showAnnouncementBanner(ann);
            showNotification('Announcement: ' + ann.message, 'info');
            // mark as seen for this client
            localStorage.setItem('lastSeenAnnouncement', ann.id);
        } else {
            // still render banner (optional) if you want
            renderAnnouncementBanner(ann);
        }
    } catch (e) { console.warn('announcement check failed', e); }
});

function renderAnnouncementBanner(ann) {
    try {
        if (!ann) return;
        let banner = document.getElementById('site-announcement-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'site-announcement-banner';
            banner.style.cssText = 'position:fixed; top:60px; left:0; right:0; background:linear-gradient(90deg,#222,#111); color:#edff66; padding:12px 18px; text-align:center; z-index:9999; font-weight:700;';
            document.body.appendChild(banner);
        }
        banner.textContent = ann.message;
    } catch (e) { console.warn(e); }
}

function showAnnouncementBanner(ann) {
    renderAnnouncementBanner(ann);
    // Auto-hide after 20s
    setTimeout(() => {
        const b = document.getElementById('site-announcement-banner');
        if (b) b.remove();
    }, 20000);
}

// Music player UI injected on every page
document.addEventListener('DOMContentLoaded', function() {
    try {
        const musicList = DataManager.getMusic();
        if (!musicList || musicList.length === 0) return;

        // Create player container
        let player = document.getElementById('site-music-player');
        if (!player) {
            player = document.createElement('div');
            player.id = 'site-music-player';
            player.style.cssText = 'position:fixed; bottom:16px; right:16px; background:rgba(0,0,0,0.7); color:white; padding:8px 12px; border-radius:10px; z-index:9999; display:flex; gap:8px; align-items:center;';
            document.body.appendChild(player);
        }

        const audio = document.createElement('audio');
        audio.id = 'site-audio';
        audio.controls = false;
        audio.style.display = 'none';
        player.appendChild(audio);

        const titleEl = document.createElement('div');
        titleEl.id = 'music-title';
        titleEl.style.maxWidth = '220px';
        titleEl.style.overflow = 'hidden';
        titleEl.style.textOverflow = 'ellipsis';
        player.appendChild(titleEl);

        const prevBtn = document.createElement('button'); prevBtn.textContent = '⏮';
        const playBtn = document.createElement('button'); playBtn.textContent = '⏯';
        const nextBtn = document.createElement('button'); nextBtn.textContent = '⏭';
        [prevBtn, playBtn, nextBtn].forEach(b => { b.style.background='transparent'; b.style.border='none'; b.style.color='white'; b.style.cursor='pointer'; player.appendChild(b); });

        let idx = Number(sessionStorage.getItem('site-music-idx') || 0);
        function loadTrack(i) {
            if (!musicList || musicList.length === 0) return;
            idx = ((i % musicList.length) + musicList.length) % musicList.length;
            const t = musicList[idx];
            audio.src = t.url;
            titleEl.textContent = t.title;
            sessionStorage.setItem('site-music-idx', String(idx));
        }

        prevBtn.onclick = () => { loadTrack(idx-1); audio.play().catch(()=>{}); };
        nextBtn.onclick = () => { loadTrack(idx+1); audio.play().catch(()=>{}); };
        playBtn.onclick = () => { if (audio.paused) audio.play().catch(()=>{}); else audio.pause(); };

        audio.onended = () => { loadTrack(idx+1); audio.play().catch(()=>{}); };

        loadTrack(idx);
    } catch (e) { console.warn('music player init failed', e); }
});

// --- Broadcast polling: checks repo broadcast.json for play/pause commands ---
const BROADCAST_RAW_URL = 'https://raw.githubusercontent.com/SHAKEs6/sym40n-gaming/main/broadcast.json';
let lastBroadcastTimestamp = sessionStorage.getItem('lastBroadcastTS') || null;

function startBroadcastPolling(intervalMs = 5000) {
    // require audio element presence
    const audio = document.getElementById('site-audio');
    if (!audio) return;

    async function poll() {
        try {
            const res = await fetch(BROADCAST_RAW_URL + '?_=' + Date.now(), {cache: 'no-store'});
            if (!res.ok) return; // no broadcast file yet
            const txt = await res.text();
            if (!txt) return;
            let b;
            try { b = JSON.parse(txt); } catch (e) { return; }
            if (!b || !b.timestamp) return;
            if (b.timestamp === lastBroadcastTimestamp) return; // no change
            lastBroadcastTimestamp = b.timestamp;
            sessionStorage.setItem('lastBroadcastTS', lastBroadcastTimestamp);
            handleBroadcast(b);
        } catch (e) {
            // ignore network errors
            //console.warn('broadcast poll error', e);
        }
    }

    // initial poll
    poll();
    return setInterval(poll, intervalMs);
}

function handleBroadcast(b) {
    try {
        const audio = document.getElementById('site-audio');
        if (!audio) return;
        const consent = localStorage.getItem('site-audio-consent') === '1';
        if (b.action === 'play' && b.trackUrl) {
            // set src and attempt play only if user consented
            audio.src = b.trackUrl;
            const titleEl = document.getElementById('music-title');
            if (titleEl) titleEl.textContent = b.title || 'Broadcast Track';
            if (consent) {
                audio.play().catch(() => {});
            } else {
                // show a small toast prompting user to enable audio
                showNotification('Live broadcast available — enable audio to listen', 'info');
            }
        } else if (b.action === 'pause') {
            audio.pause && audio.pause();
        }
    } catch (e) { console.warn('handleBroadcast error', e); }
}

// Ensure polling starts once DOM is ready and player exists
document.addEventListener('DOMContentLoaded', function() {
    // Add small consent UI if not consented yet
    try {
        if (!localStorage.getItem('site-audio-consent')) {
            const consentBar = document.createElement('div');
            consentBar.id = 'audio-consent-bar';
            consentBar.style.cssText = 'position:fixed;bottom:80px;right:16px;background:rgba(0,0,0,0.8);color:white;padding:10px;border-radius:8px;z-index:10001;display:flex;gap:8px;align-items:center;';
            consentBar.innerHTML = '<div style="font-weight:700;">Enable audio playback?</div>';
            const btn = document.createElement('button'); btn.textContent = 'Enable';
            btn.style.cssText = 'background:#edff66;border:none;padding:6px 10px;border-radius:6px;cursor:pointer;font-weight:700;';
            btn.onclick = () => { localStorage.setItem('site-audio-consent','1'); consentBar.remove(); showNotification('Audio enabled — broadcasts will play automatically', 'success'); };
            const btn2 = document.createElement('button'); btn2.textContent='Close'; btn2.style.cssText='background:transparent;border:1px solid #666;color:white;padding:6px 10px;border-radius:6px;cursor:pointer;'; btn2.onclick=()=>consentBar.remove();
            consentBar.appendChild(btn); consentBar.appendChild(btn2);
            document.body.appendChild(consentBar);
        }
    } catch(e){}

    // start polling once audio element exists (may have been injected earlier)
    const check = setInterval(()=>{
        if (document.getElementById('site-audio')) { clearInterval(check); startBroadcastPolling(5000); }
    }, 500);
});

// Seasonal decorations: apply class to body when admin toggles seasonal mode
function applySeasonalDecor() {
    try {
        const enabled = localStorage.getItem('seasonalDecor') === '1';
        if (enabled) document.body.classList.add('seasonal-on');
        else document.body.classList.remove('seasonal-on');
    } catch (e) { console.warn('applySeasonalDecor error', e); }
}

// Apply on load and watch for changes (in case admin toggles in another tab)
document.addEventListener('DOMContentLoaded', function() { applySeasonalDecor(); });
window.addEventListener('storage', function(e) {
    if (e.key === 'seasonalDecor') applySeasonalDecor();
});


// ==================
// Auto-Login Check
// ==================

document.addEventListener('DOMContentLoaded', function() {
    // Auto-check if user is logged in
    if (DataManager.isLoggedIn()) {
        const session = DataManager.getSession();
        console.log('User session active:', session.email);
    }

    // Track page visit
    const pageVisit = {
        page: window.location.pathname,
        visitedAt: new Date().toISOString()
    };
    let visits = JSON.parse(localStorage.getItem('pageVisits') || '[]');
    visits.push(pageVisit);
    localStorage.setItem('pageVisits', JSON.stringify(visits));
});

// Ensure there's a global showAdminLogin fallback (for pages other than login.html)
if (typeof window.showAdminLogin !== 'function') {
    window.showAdminLogin = function() {
        const adminPassword = prompt('Enter Admin Password:');
        if (adminPassword === 'admin@2025') {
            localStorage.setItem('adminToken', Date.now());
            window.location.href = 'admin.html';
        } else if (adminPassword !== null) {
            alert('Invalid admin password!');
        }
    };
}

// Mobile/touch admin trigger: detect 3 quick taps anywhere on the screen
(function setupMobileAdminTrigger() {
    let touchCount = 0;
    let touchTimer = null;
    function reset() { touchCount = 0; if (touchTimer) { clearTimeout(touchTimer); touchTimer = null; } }

    document.addEventListener('touchend', function(e) {
        // Only enable on narrow screens (mobile)
        if (window.innerWidth > 768) return;
        touchCount++;
        if (touchTimer) clearTimeout(touchTimer);
        touchTimer = setTimeout(() => reset(), 700);
        if (touchCount === 3) {
            reset();
            // show admin login prompt
            try { window.showAdminLogin(); } catch (err) { console.warn('admin login failed', err); }
        }
    }, { passive: true });
})();

// Social links: replace footer anchors with configured links from localStorage
function applySocialLinks() {
    try {
        const links = JSON.parse(localStorage.getItem('socialLinks') || '{}');
        if (!links) return;
        // mapping of classes to keys
        const mapping = {
            'social-youtube': 'youtube',
            'social-google': 'google',
            'social-github': 'github',
            'social-twitter': 'twitter'
        };
        Object.keys(mapping).forEach(cls => {
            const key = mapping[cls];
            const el = document.querySelector('a.' + cls);
            if (el) {
                const url = links[key] || el.getAttribute('data-default') || '#';
                el.setAttribute('href', url);
                el.setAttribute('target', '_blank');
                el.setAttribute('rel', 'noopener noreferrer');
            }
        });
    } catch (e) { console.warn('applySocialLinks error', e); }
}

document.addEventListener('DOMContentLoaded', applySocialLinks);
window.addEventListener('storage', function(e) { if (e.key === 'socialLinks') applySocialLinks(); });

// Hero video carousel: cycles through local videos when the NEXT button is clicked
document.addEventListener('DOMContentLoaded', function() {
    try {
        const videoEl = document.querySelector('.hero-video');
        const nextBtn = document.querySelector('.next-btn');
        if (!videoEl || !nextBtn) return;

        const movieList = [
            'videos/hero-1.mp4',
            'videos/hero-2.mp4',
            'videos/hero-3.mp4',
            'videos/hero-4.mp4'
        ];

        const sourceEl = videoEl.querySelector('source');
        const currentSrc = (sourceEl && sourceEl.getAttribute('src')) || videoEl.currentSrc || '';
        const currentFile = currentSrc.split('/').pop();
        let index = movieList.findIndex(m => m.endsWith(currentFile));
        if (index === -1) index = 0;

        nextBtn.addEventListener('click', function () {
            index = (index + 1) % movieList.length;
            if (sourceEl) {
                sourceEl.setAttribute('src', movieList[index]);
            } else {
                // fallback: replace video src directly
                videoEl.setAttribute('src', movieList[index]);
            }
            // reload video element and attempt play
            try { videoEl.load(); } catch (e) {}
            videoEl.play && videoEl.play().catch(() => {});
        });
    } catch (err) {
        console.warn('Hero carousel initialization failed', err);
    }
});

// ==================
// Utility Functions
// ==================

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

function validatePassword(password) {
    return password.length >= 6;
}

function showNotification(message, type = 'success') {
    // Create notification element
    // Persist notification
    try { DataManager.addNotification(message, type); } catch (e) {}

    // Create or reuse notification area
    let area = document.getElementById('notification-area');
    if (!area) {
        area = document.createElement('div');
        area.id = 'notification-area';
        area.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index:10000; display:flex; flex-direction:column; gap:10px; max-width:320px;';
        document.body.appendChild(area);
    }

    const el = document.createElement('div');
    el.style.cssText = `padding:12px 16px; border-radius:8px; color:white; font-weight:700; box-shadow:0 6px 18px rgba(0,0,0,0.4);`;
    el.textContent = message;
    if (type === 'success') el.style.backgroundColor = '#4caf50';
    else if (type === 'error') el.style.backgroundColor = '#f44336';
    else el.style.backgroundColor = '#333';

    // Add dismiss button
    const dismiss = document.createElement('button');
    dismiss.textContent = '✕';
    dismiss.style.cssText = 'margin-left:10px;background:transparent;border:none;color:white;font-weight:700;cursor:pointer;float:right';
    dismiss.onclick = () => el.remove();
    el.appendChild(dismiss);

    area.prepend(el);

    // Auto-remove after 6s (unless admin wants to keep)
    setTimeout(() => el.remove(), 6000);
}

// Add animation styles
if (!document.getElementById('notification-styles')) {
    const style = document.createElement('style');
    style.id = 'notification-styles';
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(400px);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(400px);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
}
