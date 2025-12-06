# SYM40N Gaming Platform

A modern, full-stack gaming platform with dynamic music system, real-time communication, and admin controls.

## 🚀 Project Structure

```
sym40n-gaming/
├── backend/
│   ├── server.js          # Express backend server with Socket.io
│   ├── data/              # User data, config, subscriptions
│   └── package.json       # Backend dependencies
├── app.js                 # Frontend application logic with Music Manager
├── index.html             # Main landing page
├── style.css              # Global styles
├── music/                 # Music files (polo.mp3 - polo20.mp3)
├── videos/                # Hero video files
├── img/                   # Image assets
├── package.json           # Root package.json
└── Procfile              # Deployment configuration
```

## ✨ Key Features

### Frontend
- **Responsive Design**: Mobile-first approach with full responsiveness
- **Music Control System**: Dynamic music player with volume control
- **Hero Video Carousel**: Click "NEXT" button to switch between 4 hero videos
- **Real-time Communication**: WebSocket integration via Socket.io
- **Admin Controls**: Triple-tap on mobile to access admin panel
- **Data Persistence**: LocalStorage for user sessions and preferences

### Backend
- **Express Server**: Serves both frontend and API
- **Music Management**: API endpoints for listing and uploading music
- **File Upload**: Multer integration for music file uploads
- **WebSocket (Socket.io)**: Real-time updates for music playback
- **Authentication**: Admin authentication with bcrypt password hashing
- **Push Notifications**: Web Push API support
- **CORS Support**: Cross-origin resource sharing enabled

## 📋 Prerequisites

- Node.js 14+ 
- npm or yarn
- Modern web browser with Web Audio support

## 🔧 Installation & Setup

### 1. Clone/Extract Project
```bash
cd sym40n-gaming
```

### 2. Install Dependencies
```bash
npm install
# This automatically installs backend dependencies via postinstall script
```

### 3. Start the Server
```bash
npm start
# Server will start on http://localhost:3000
```

The server will output:
```
╔════════════════════════════════════════╗
║  SYM40N Gaming Backend Server          ║
║  Port: 3000                              ║
║  Environment: development               ║
║  Music Files: 21                         ║
╚════════════════════════════════════════╝

Server is ready at http://localhost:3000
WebSocket endpoint: ws://localhost:3000
Music API: GET http://localhost:3000/api/music-files
```

### 4. Access the Application
- **Frontend**: http://localhost:3000
- **API Docs**: See API Routes section below

## 🎵 Music System

### How It Works
The music system is **non-static** and loads dynamically from the server:

1. **Frontend Music Manager** (`app.js`):
   - Fetches music file list from `/api/music-files`
   - Creates player UI with play/pause controls
   - Manages playback queue
   - Handles volume and persistence

2. **Backend Music API**:
   - Serves music files from `/music` directory
   - Provides JSON list of available tracks
   - Supports file upload for admins
   - Real-time playback control via WebSocket

### Music Controls
- **Toggle Button**: Click 🎵 icon in header to play/pause
- **Volume Slider**: Hover over music button to adjust volume
- **Keyboard Shortcut**: Press SPACEBAR to toggle playback
- **Auto-Continue**: Plays next track automatically when current ends

### Admin Music Upload
```bash
# POST /admin/upload-music
# Requires: x-admin-pass header or admin session
curl -X POST \
  -H "x-admin-pass: admin@2025" \
  -F "music=@/path/to/song.mp3" \
  http://localhost:3000/admin/upload-music
```

## 🔐 Admin Panel

### Access Admin Panel
1. **Desktop**: Ctrl+Shift+A or via login.html
2. **Mobile**: Triple-tap anywhere on screen
3. **Password**: Default is `admin@2025` (change via `ADMIN_PASS` env variable)

### Admin Features
- 🎵 Upload new music files
- 🎮 Manage game configurations
- 📢 Send push notifications
- 🎨 Set decorations/themes
- 🔔 Broadcast messages to all users

## 📡 API Routes

### Music Management
```
GET    /api/music-files           # List all music files
POST   /admin/upload-music        # Upload new music file
DELETE /admin/remove-music/:file  # Delete music file
```

### Playback Control
```
POST   /admin/play-music          # Broadcast music to all clients
POST   /admin/set-decoration      # Set UI decoration/theme
POST   /admin/notify              # Send notification to all clients
```

### Authentication
```
POST   /auth/login                # User login
POST   /auth/logout               # User logout
```

### Utilities
```
GET    /api/health                # Server health check
GET    /vapidPublicKey            # Get public key for push notifications
POST   /subscribe                 # Subscribe to push notifications
```

## 🔄 WebSocket Events

### Server → Client
- `config`: Sends current configuration
- `play-music`: Broadcasts music playback command
- `decoration`: Sends decoration/theme updates
- `notification`: Sends notification messages

### Client → Server
- `status`: Send client status (optional)
- `disconnect`: Automatic on client disconnect

## 📦 Environment Variables

Create a `.env` file or set these environment variables:

```env
PORT=3000                              # Server port
NODE_ENV=development                   # development|production
ADMIN_PASS=admin@2025                  # Admin password
SESSION_SECRET=sym40n-secret-key       # Session encryption key
```

## 🚢 Deployment

### Render.com (Recommended)
1. Push code to GitHub
2. Connect to Render.com
3. Create Web Service with:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. Set environment variables in dashboard

### Heroku
```bash
# Install Heroku CLI
# Log in and create app
heroku login
heroku create your-app-name

# Set environment variables
heroku config:set ADMIN_PASS=your-secure-password
heroku config:set SESSION_SECRET=your-secure-secret

# Deploy
git push heroku main
```

### Vercel (Frontend Only)
The frontend can be deployed to Vercel, but the backend (Node.js) requires a different service.

## 📱 Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

**Note**: Audio playback may require user interaction first (click/tap).

## 🛠️ Development Tips

### Adding New Music
1. Place `.mp3`, `.ogg`, `.wav`, or `.m4a` files in `/music` folder
2. Server automatically discovers them on startup
3. Or use admin upload endpoint

### Customizing Hero Videos
Edit `app.js` `initHeroCarousel()` function to add/remove video paths.

### Modifying Styles
Edit `style.css` - changes apply immediately on page refresh.

### Database/Users
User data is stored in `backend/data/users.json`. Modify structure as needed.

## 🐛 Troubleshooting

### Audio Not Playing
1. Check browser console for errors
2. Ensure audio files exist in `/music` directory
3. Grant audio permission to browser
4. Check CORS settings if hosted on different domain

### Server Not Starting
1. Verify Node.js is installed: `node --version`
2. Check port 3000 is not in use: `lsof -i :3000`
3. Install dependencies: `npm install`
4. Check error logs in console

### Music Files Not Loading
1. Verify files are in `/music` folder
2. Check file permissions (should be readable)
3. Test API: `curl http://localhost:3000/api/music-files`
4. Check server logs for errors

### WebSocket Connection Issues
1. Ensure `socket.io-client` is loaded
2. Check CORS configuration in `server.js`
3. Verify firewall allows WebSocket (port 3000)

## 📝 License

All rights reserved © SHAKES 2025

## 📞 Support

For issues or questions:
1. Check the console for error messages
2. Review server logs
3. Inspect network requests in browser DevTools
4. Verify all dependencies are installed

## 🎯 Next Steps

1. Upload music files to `/music` directory
2. Customize admin password
3. Configure deployment environment
4. Test all features locally
5. Deploy to production

---

**Version**: 1.0.0  
**Last Updated**: December 6, 2025  
**Status**: Production Ready
