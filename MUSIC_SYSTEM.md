# Music System Documentation

## Overview

The SYM40N Gaming Platform features a **non-static, dynamic music system** that loads and manages music playback in real-time.

## Architecture

### Frontend Music Manager (`app.js`)

The `MusicManager` object handles all client-side music functionality:

```javascript
const MusicManager = {
    tracks: [],           // Array of track objects
    currentIndex: 0,      // Current playing track
    isPlaying: false,     // Playback state
    audioElement: null,   // HTML5 audio element
    apiUrl: 'http://localhost:3000'
}
```

#### Key Methods

| Method | Purpose |
|--------|---------|
| `init()` | Initialize system and load tracks from server |
| `loadTracks()` | Fetch music file list from backend API |
| `setupUI()` | Create music control buttons and volume slider |
| `attachEventListeners()` | Bind audio events (play, pause, ended) |
| `connectWebSocket()` | Establish Socket.io connection |
| `play(index)` | Play specific track by index |
| `playNext()` | Advance to next track |
| `playPrev()` | Go to previous track |
| `togglePlayPause()` | Toggle playback state |

### Backend Server (`backend/server.js`)

Express server with music management APIs and WebSocket support.

#### Music API Endpoints

**GET `/api/music-files`**
- Returns list of available music files
- Response:
```json
{
  "ok": true,
  "files": ["polo.mp3", "polo1.mp3", "polo2.mp3", ...],
  "count": 21
}
```

**POST `/admin/upload-music`**
- Upload new music file
- Requires admin authentication
- Returns file URL

**DELETE `/admin/remove-music/:filename`**
- Remove music file from server
- Requires admin authentication

**POST `/admin/play-music`**
- Broadcast music playback to all connected clients
- Payload:
```json
{
  "filename": "polo.mp3"
}
```

## Data Flow

### 1. Initialization (Page Load)
```
User visits index.html
    ↓
app.js loads
    ↓
MusicManager.init() called on DOMContentLoaded
    ↓
Fetch /api/music-files
    ↓
Server returns track list
    ↓
setupUI() creates player controls
    ↓
connectWebSocket() establishes Socket.io connection
    ↓
Player ready for interaction
```

### 2. User Plays Music
```
User clicks music button
    ↓
togglePlayPause() called
    ↓
Load current track URL
    ↓
audioElement.play()
    ↓
Browser requests /music/filename
    ↓
Server streams file
    ↓
Audio plays in browser
```

### 3. Admin Broadcasts Music
```
Admin calls POST /admin/play-music
    ↓
Server saves to config
    ↓
Server emits 'play-music' via Socket.io
    ↓
All connected clients receive event
    ↓
MusicManager updates src and plays
```

## Files Structure

### Music Directory (`/music`)

Contains MP3/OGG/WAV files:
```
music/
├── polo.mp3          # Track 0
├── polo1.mp3         # Track 1
├── polo2.mp3         # Track 2
├── ...
└── polo20.mp3        # Track 20
```

Total: 21 music files included

### Configuration Files

**`backend/data/server-config.json`** - Server state
```json
{
  "decoration": null,
  "currentMusic": null,
  "vapidKeys": {
    "publicKey": "...",
    "privateKey": "..."
  }
}
```

## User Interface

### Music Control Widget

Located in header (`<div class="music-control">`):

```
┌─────────────────────┐
│ 🎵 ────────[▼]     │  ← Music button + volume slider
└─────────────────────┘
```

**Features:**
- Click icon to play/pause
- Hover to reveal volume slider
- Shows playing/paused state
- Keyboard shortcut: SPACEBAR

### HTML Audio Element

`<audio id="bg-music" preload="auto" crossorigin="anonymous"></audio>`

Attributes:
- `preload="auto"` - Load metadata
- `crossorigin="anonymous"` - CORS for streaming
- No `controls` - Custom UI instead

## Error Handling

### Fallback System

If server is unreachable, MusicManager uses local fallback:

```javascript
loadLocalFallback() {
    // Hardcoded track list
    for (let i = 0; i <= 20; i++) {
        this.tracks.push({
            url: `/music/polo${i === 0 ? '' : i}.mp3`
        });
    }
}
```

### Browser Autoplay Restrictions

Modern browsers block autoplay audio without user interaction:

```javascript
audioElement.play()
    .catch(err => {
        console.log('Autoplay blocked:', err);
        showNotification('Click to enable audio playback', 'info');
    });
```

**User must click** the play button first to unlock audio.

## WebSocket Integration

### Connection Flow
```
MusicManager.connectWebSocket()
    ↓
const socket = io(apiUrl)
    ↓
socket.on('connect')
    ↓
Ready for events
```

### Events Handled

**'play-music'** - Broadcast from admin
```javascript
socket.on('play-music', (data) => {
    audioElement.src = data.url;
    audioElement.play();
});
```

**'config'** - Server sends current state
```javascript
socket.on('config', (config) => {
    // Update UI based on config
});
```

## Performance Optimization

### Caching
- Volume setting cached in `localStorage.musicVolume`
- Current track index in `sessionStorage`
- Prevents re-loading on page refresh

### Lazy Loading
- Tracks loaded only when needed
- File metadata preloaded with `preload="auto"`
- Volume slider created on hover

### Resource Efficiency
- Single audio element reused for all tracks
- No player duplicates or memory leaks
- Clean event listener cleanup

## Customization

### Adding New Tracks

1. **Place file in `/music` folder:**
```bash
cp your-song.mp3 music/
```

2. **Access via API:**
```bash
curl http://localhost:3000/api/music-files
```

3. **Play immediately:**
```bash
curl -X POST http://localhost:3000/admin/play-music \
  -H "x-admin-pass: admin@2025" \
  -d '{"filename":"your-song.mp3"}'
```

### Changing Music Player Position

Edit `style.css`:
```css
.music-control {
    /* Customize position and styling */
    position: fixed;
    top: 20px;
    right: 20px;
}
```

### Volume Range

Modify in `index.html`:
```html
<input type="range" id="volume-slider" 
       min="0" max="100" value="50">
```

## Security Considerations

1. **Admin Authentication**
   - Required for file uploads
   - Password in `ADMIN_PASS` env var
   - Change in production!

2. **File Validation**
   - Only audio formats allowed (.mp3, .ogg, .wav, .m4a)
   - Filename sanitization prevents directory traversal

3. **CORS Protection**
   - Audio files only served to same-origin by default
   - `crossorigin="anonymous"` for cross-origin requests

## Troubleshooting

| Issue | Solution |
|-------|----------|
| No music files listed | Check `/music` folder exists with audio files |
| Autoplay blocked | Click play button first, then browser will allow |
| WebSocket not connecting | Ensure backend running, check firewall |
| Volume not saving | Check localStorage enabled in browser |
| Wrong track playing | Verify file names in `/music` directory |

## Testing

### Manual Testing Checklist

- [ ] Server starts without errors
- [ ] `/api/music-files` returns track list
- [ ] Music button is visible in header
- [ ] Click music button starts playback
- [ ] Volume slider adjusts volume
- [ ] Space bar toggles playback
- [ ] Tracks auto-advance when finished
- [ ] WebSocket connection established (check Network tab)
- [ ] Volume persists on page reload
- [ ] Mobile: Three-tap admin login works

### API Testing

```bash
# Get available music
curl http://localhost:3000/api/music-files

# Upload music (admin only)
curl -X POST \
  -H "x-admin-pass: admin@2025" \
  -F "music=@/path/to/song.mp3" \
  http://localhost:3000/admin/upload-music

# Broadcast music to all clients
curl -X POST \
  -H "x-admin-pass: admin@2025" \
  -H "Content-Type: application/json" \
  -d '{"filename":"polo.mp3"}' \
  http://localhost:3000/admin/play-music
```

## Version History

- **v1.0.0** (Dec 6, 2025) - Initial release with full music system
  - 21 pre-loaded music files
  - Dynamic track loading
  - WebSocket real-time control
  - Admin broadcast capability
  - Volume persistence

## Future Enhancements

- [ ] Playlist creation
- [ ] Audio visualizer
- [ ] Equalizer controls
- [ ] Song info display (artist, duration)
- [ ] Shuffle/repeat modes
- [ ] Music history tracking
- [ ] User favorites
- [ ] Queue management

---

For more information, see `SETUP.md` or check server logs.
