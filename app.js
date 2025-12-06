// ============================================
// SYM40N GAMING - FRONTEND APPLICATION
// ============================================

// ==================
// Music System (Non-Static)
// ==================

const MusicManager = {
    tracks: [],
    currentIndex: 0,
    isPlaying: false,
    audioElement: null,
    apiUrl: 'http://localhost:3000',
    shuffleMode: false,
    shuffledIndices: [],
    sharedAudioElement: null,

    // Initialize music system
    init: async function() {
        try {
            // Check if audio element already exists in DOM (shared across pages)
            this.audioElement = document.getElementById('bg-music');
            if (!this.audioElement) {
                this.audioElement = document.createElement('audio');
                this.audioElement.id = 'bg-music';
                this.audioElement.crossOrigin = 'anonymous';
                this.audioElement.preload = 'auto';
                this.audioElement.setAttribute('webkit-playsinline', 'true');
                this.audioElement.setAttribute('playsinline', 'true');
                document.body.appendChild(this.audioElement);
            }

            // Fetch music files from server
            await this.loadTracks();
            
            // Auto-enable shuffle mode by default (unless explicitly disabled)
            const savedShuffleMode = localStorage.getItem('shuffleMode');
            if (savedShuffleMode === null) {
                // First time - enable shuffle by default
                this.shuffleMode = true;
                localStorage.setItem('shuffleMode', 'true');
            } else {
                // Restore previous shuffle setting
                this.shuffleMode = savedShuffleMode === 'true';
            }
            
            // Restore playback state from sessionStorage
            const savedCurrentIndex = sessionStorage.getItem('currentTrackIndex');
            const savedIsPlaying = sessionStorage.getItem('isPlaying') === 'true';
            const savedCurrentTime = parseFloat(sessionStorage.getItem('currentTime')) || 0;
            
            if (savedCurrentIndex !== null) {
                this.currentIndex = parseInt(savedCurrentIndex);
            }
            
            // Setup UI before restoring playback
            this.setupUI();
            this.attachEventListeners();
            this.connectWebSocket();
            
            // Restore shuffle indices if in shuffle mode
            if (this.shuffleMode) {
                const savedShuffleIndices = sessionStorage.getItem('shuffledIndices');
                if (savedShuffleIndices) {
                    this.shuffledIndices = JSON.parse(savedShuffleIndices);
                } else {
                    // Generate new shuffle order for this session
                    this.generateShuffleOrder();
                }
            } else {
                // Even if shuffle is off, still generate order for potential future use
                this.generateShuffleOrder();
            }
            
            // Restore music playback
            if (savedIsPlaying) {
                this.play(this.currentIndex, false); // Don't reset time yet
                if (savedCurrentTime > 0) {
                    this.audioElement.currentTime = savedCurrentTime;
                }
            } else {
                // Still load the track but don't play
                this.loadTrack(this.currentIndex);
            }
        } catch (error) {
            console.error('Music Manager Init Error:', error);
            this.loadLocalFallback();
            this.setupUI();
            this.attachEventListeners();
        }
    },

    // Auto-start music playback
    autoStartMusic: function() {
        if (!this.tracks.length) {
            console.warn('No tracks available to play');
            return;
        }
        
        // Always play music when browser is opened
        const wasPlayingBefore = sessionStorage.getItem('isPlaying') === 'true';
        
        if (wasPlayingBefore) {
            // Already restored and playing in init()
            return;
        }
        
        // First time or new session - start playing with shuffle enabled
        // Shuffle is already enabled by default in init()
        this.play(0);
        localStorage.setItem('musicEnabled', 'true');
        console.log('🎵 Starting music playback (Shuffle Auto-Enabled)');
    },

    // Generate shuffle order
    generateShuffleOrder: function() {
        this.shuffledIndices = Array.from({length: this.tracks.length}, (_, i) => i);
        // Fisher-Yates shuffle
        for (let i = this.shuffledIndices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.shuffledIndices[i], this.shuffledIndices[j]] = [this.shuffledIndices[j], this.shuffledIndices[i]];
        }
        sessionStorage.setItem('shuffledIndices', JSON.stringify(this.shuffledIndices));
    },

    // Load track without playing
    loadTrack: function(index) {
        if (!this.tracks.length) return;
        
        this.currentIndex = index % this.tracks.length;
        const track = this.tracks[this.currentIndex];
        
        if (this.audioElement && track) {
            this.audioElement.src = track.url;
            this.audioElement.type = 'audio/mpeg';
            this.audioElement.load();
            console.log(`Loaded track: ${track.title}`);
        }
    },
    loadTracks: async function() {
        try {
            const response = await fetch(`${this.apiUrl}/api/music-files`);
            if (!response.ok) throw new Error('Failed to fetch music files');
            
            const data = await response.json();
            if (data.files && Array.isArray(data.files)) {
                this.tracks = data.files.map((filename, idx) => ({
                    id: idx,
                    title: filename.replace(/\.[^/.]+$/, ''),
                    filename: filename,
                    url: `/music/${filename}`
                }));
                console.log(`Loaded ${this.tracks.length} music tracks`);
            }
        } catch (error) {
            console.warn('Could not load music from server:', error);
            this.loadLocalFallback();
        }
    },

    // Fallback to hardcoded local music
    loadLocalFallback: function() {
        this.tracks = [];
        for (let i = 0; i <= 20; i++) {
            const filename = i === 0 ? 'polo.mp3' : `polo${i}.mp3`;
            this.tracks.push({
                id: i,
                title: `Track ${i === 0 ? '' : i}`.trim(),
                filename: filename,
                url: `/music/${filename}`
            });
        }
        console.log('Using fallback music tracks');
    },

    // Setup music control UI
    setupUI: function() {
        const musicBtn = document.getElementById('music-toggle');
        const volumeSlider = document.getElementById('volume-slider');

        if (musicBtn) {
            musicBtn.addEventListener('click', () => this.togglePlayPause());
        }

        if (volumeSlider && this.audioElement) {
            volumeSlider.addEventListener('change', (e) => {
                this.audioElement.volume = e.target.value / 100;
                localStorage.setItem('musicVolume', e.target.value);
            });
            // Restore saved volume
            const savedVolume = localStorage.getItem('musicVolume') || 50;
            volumeSlider.value = savedVolume;
            this.audioElement.volume = savedVolume / 100;
        }
    },

    // Attach audio event listeners
    attachEventListeners: function() {
        if (!this.audioElement) return;

        this.audioElement.addEventListener('play', () => {
            this.isPlaying = true;
            this.updateButtonState();
        });

        this.audioElement.addEventListener('pause', () => {
            this.isPlaying = false;
            this.updateButtonState();
        });

        this.audioElement.addEventListener('ended', () => {
            this.playNext();
        });

        // Handle autoplay restrictions
        this.audioElement.addEventListener('error', (e) => {
            console.error('Audio error:', e);
            this.showNotification('Audio playback error', 'error');
        });
    },

    // WebSocket connection for real-time music control
    connectWebSocket: function() {
        try {
            if (typeof io === 'undefined') {
                console.warn('Socket.io not available');
                return;
            }

            const socket = io(this.apiUrl);

            socket.on('connect', () => {
                console.log('Connected to backend via WebSocket');
            });

            socket.on('play-music', (data) => {
                console.log('Received play command:', data);
                if (data.url) {
                    this.audioElement.src = data.url;
                    this.audioElement.play().catch(err => {
                        console.log('Autoplay blocked:', err);
                        this.showNotification('Click to enable audio playback', 'info');
                    });
                }
            });

            socket.on('config', (config) => {
                console.log('Received config:', config);
            });

            socket.on('disconnect', () => {
                console.log('Disconnected from backend');
            });
        } catch (error) {
            console.warn('WebSocket connection failed:', error);
        }
    },

    // Play specific track
    play: function(index, shouldReset = true) {
        if (!this.tracks.length) return;
        
        // Determine actual index based on shuffle mode
        let actualIndex = index;
        if (this.shuffleMode && this.shuffledIndices.length > 0) {
            actualIndex = this.shuffledIndices[index % this.shuffledIndices.length];
        } else {
            actualIndex = index % this.tracks.length;
        }
        
        this.currentIndex = actualIndex;
        const track = this.tracks[this.currentIndex];
        
        if (this.audioElement && track) {
            this.audioElement.src = track.url;
            this.audioElement.type = 'audio/mpeg';
            
            if (shouldReset) {
                this.audioElement.currentTime = 0;
            }
            this.audioElement.load();
            
            const playPromise = this.audioElement.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    this.isPlaying = true;
                    this.updateButtonState();
                    this.savePlaybackState();
                    console.log(`▶️ Playing: ${track.title}`);
                }).catch(err => {
                    console.log('Autoplay blocked:', err.name, err.message);
                    if (err.name === 'NotAllowedError') {
                        localStorage.setItem('musicPendingPlay', 'true');
                        this.showNotification('Tap anywhere to enable music', 'info');
                    }
                });
            }
        }
    },

    // Save playback state to sessionStorage
    savePlaybackState: function() {
        if (this.audioElement) {
            sessionStorage.setItem('currentTrackIndex', this.currentIndex.toString());
            sessionStorage.setItem('isPlaying', this.isPlaying.toString());
            sessionStorage.setItem('currentTime', this.audioElement.currentTime.toString());
        }
    },

    // Toggle shuffle mode
    toggleShuffle: function() {
        this.shuffleMode = !this.shuffleMode;
        localStorage.setItem('shuffleMode', this.shuffleMode.toString());
        
        if (this.shuffleMode) {
            this.generateShuffleOrder();
            console.log('🔀 Shuffle mode ON');
            this.showNotification('Shuffle mode enabled', 'success');
        } else {
            console.log('🔀 Shuffle mode OFF');
            this.showNotification('Shuffle mode disabled', 'success');
        }
        
        // Update shuffle button state if it exists
        const shuffleBtn = document.getElementById('shuffle-btn');
        if (shuffleBtn) {
            shuffleBtn.classList.toggle('active', this.shuffleMode);
        }
    },
    playNext: function() {
        if (!this.tracks.length) return;
        const nextIndex = this.currentIndex + 1;
        this.play(nextIndex);
    },

    // Play previous track
    playPrev: function() {
        if (!this.tracks.length) return;
        this.play(this.currentIndex - 1);
    },

    // Toggle play/pause and save preference
    togglePlayPause: function() {
        if (!this.audioElement) return;

        if (this.audioElement.src === '') {
            this.play(0); // Start playing first track if none loaded
        } else if (this.audioElement.paused) {
            const playPromise = this.audioElement.play();
            if (playPromise !== undefined) {
                playPromise.then(() => {
                    this.savePlaybackState();
                }).catch(err => {
                    console.log('Play action blocked:', err);
                    this.showNotification('Click anywhere to enable audio', 'info');
                });
            }
        } else {
            this.audioElement.pause();
            this.savePlaybackState();
        }
    },

    // Update UI button state
    updateButtonState: function() {
        const musicBtn = document.getElementById('music-toggle');
        if (musicBtn) {
            if (this.isPlaying) {
                musicBtn.classList.add('playing');
            } else {
                musicBtn.classList.remove('playing');
            }
        }
    },

    // Show notification
    showNotification: function(message, type = 'info') {
        // Just log for now, will be replaced by global showNotification
        console.log(`[${type}] ${message}`);
    }
};

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
    let area = document.getElementById('notification-area');
    if (!area) {
        area = document.createElement('div');
        area.id = 'notification-area';
        area.style.cssText = 'position: fixed; top: 80px; right: 20px; z-index: 10000; display: flex; flex-direction: column; gap: 10px; max-width: 320px;';
        document.body.appendChild(area);
    }

    const el = document.createElement('div');
    el.style.cssText = `padding: 12px 16px; border-radius: 8px; color: white; font-weight: 700; box-shadow: 0 6px 18px rgba(0, 0, 0, 0.4); animation: slideIn 0.3s ease;`;
    el.textContent = message;

    if (type === 'success') el.style.backgroundColor = '#4caf50';
    else if (type === 'error') el.style.backgroundColor = '#f44336';
    else if (type === 'warning') el.style.backgroundColor = '#ff9800';
    else el.style.backgroundColor = '#333';

    area.prepend(el);
    setTimeout(() => el.remove(), 5000);
}

function scrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth' });
    }
}

// ==================
// Hero Video Carousel
// ==================

function initHeroCarousel() {
    try {
        const videoEl = document.getElementById('hero-video');
        const nextBtn = document.getElementById('next-video-btn');

        if (!videoEl || !nextBtn) return;

        const movieList = [
            'videos/hero-1.mp4',
            'videos/hero-2.mp4',
            'videos/hero-3.mp4',
            'videos/hero-4.mp4'
        ];

        let currentIndex = 0;

        nextBtn.addEventListener('click', function() {
            currentIndex = (currentIndex + 1) % movieList.length;
            const newSrc = movieList[currentIndex];
            
            // Update video source
            videoEl.src = newSrc;
            videoEl.type = 'video/mp4';
            videoEl.load();
            
            // Reset playback position
            videoEl.currentTime = 0;
            
            const playPromise = videoEl.play();
            if (playPromise !== undefined) {
                playPromise.catch(err => {
                    console.log('Video play blocked:', err.name);
                });
            }
        });
    } catch (error) {
        console.error('Hero carousel error:', error);
    }
}

// ==================
// Page Load Initialization
// ==================

document.addEventListener('DOMContentLoaded', async function() {
    // Initialize hero carousel
    initHeroCarousel();

    // Initialize music system
    await MusicManager.init();

    // Enable music on first user interaction (browser autoplay policy, especially Android)
    const enableMusicOnFirstInteraction = () => {
        if (MusicManager.tracks.length > 0) {
            // Check if we have pending playback from autoplay block
            if (localStorage.getItem('musicPendingPlay') === 'true' || (MusicManager.audioElement && MusicManager.audioElement.paused)) {
                MusicManager.play(MusicManager.currentIndex);
                localStorage.setItem('musicEnabled', 'true');
                localStorage.removeItem('musicPendingPlay');
                console.log('🎵 Music enabled on user interaction');
            }
        }
        // Remove listeners after first interaction
        document.removeEventListener('click', enableMusicOnFirstInteraction);
        document.removeEventListener('keydown', enableMusicOnFirstInteraction);
        document.removeEventListener('touchstart', enableMusicOnFirstInteraction);
    };

    document.addEventListener('click', enableMusicOnFirstInteraction);
    document.addEventListener('keydown', enableMusicOnFirstInteraction);
    document.addEventListener('touchstart', enableMusicOnFirstInteraction);

    // Add keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if (e.code === 'Space') {
            // Space to toggle music
            if (e.target === document.body) {
                e.preventDefault();
                MusicManager.togglePlayPause();
            }
        }
    });

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

    // Show notification if new to site
    if (!localStorage.getItem('siteVisited')) {
        showNotification('Welcome to SYM40N Gaming!', 'success');
        localStorage.setItem('siteVisited', 'true');
    }

    // Add animation styles if not present
    if (!document.getElementById('app-styles')) {
        const style = document.createElement('style');
        style.id = 'app-styles';
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

            @keyframes fadeIn {
                from {
                    opacity: 0;
                }
                to {
                    opacity: 1;
                }
            }

            audio {
                max-width: 100%;
            }
        `;
        document.head.appendChild(style);
    }
});

// ==================
// Admin Functions
// ==================

window.showAdminLogin = function() {
    const adminPassword = prompt('Enter Admin Password:');
    if (adminPassword && adminPassword === 'admin@2025') {
        localStorage.setItem('adminToken', Date.now());
        window.location.href = 'admin.html';
    } else if (adminPassword !== null) {
        showNotification('Invalid admin password!', 'error');
    }
};

// Mobile admin trigger: triple-tap to show admin login
(function setupMobileAdminTrigger() {
    let tapTimestamps = [];
    const TRIPLE_TAP_WINDOW = 1200;

    document.addEventListener('touchend', function(e) {
        const now = Date.now();
        tapTimestamps.push(now);

        if (tapTimestamps.length > 3) tapTimestamps.shift();

        if (tapTimestamps.length === 3 && (tapTimestamps[2] - tapTimestamps[0] <= TRIPLE_TAP_WINDOW)) {
            tapTimestamps = [];
            window.showAdminLogin();
        }

        setTimeout(() => { tapTimestamps = []; }, TRIPLE_TAP_WINDOW + 100);
    }, { passive: true });
})();

// ==================
// Export for other pages
// ==================

window.DataManager = DataManager;
window.MusicManager = MusicManager;
window.showNotification = showNotification;
window.scrollToSection = scrollToSection;
window.validateEmail = validateEmail;
window.validatePassword = validatePassword;
