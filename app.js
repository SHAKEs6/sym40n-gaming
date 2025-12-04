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
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        background-color: ${type === 'success' ? '#4caf50' : '#f44336'};
        color: white;
        border-radius: 8px;
        z-index: 10000;
        font-weight: bold;
        animation: slideIn 0.3s ease-in-out;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    // Remove after 3 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
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
