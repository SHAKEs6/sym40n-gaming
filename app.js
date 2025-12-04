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
