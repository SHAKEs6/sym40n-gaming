# Copilot Instructions for Sym40n Gaming Website

## Project Overview
This is a **single-page gaming marketing website** (SPA-lite) for Sym40n, a Web3/metaverse gaming platform. The project consists of static HTML, CSS, and vanilla JavaScript with no build system or dependencies.

## Architecture & Key Components

### Core Structure
- **`index.html`** - Single-page layout with hero section, about, features, and contact sections
- **`app.js`** - Minimal JavaScript (377 bytes) handling video carousel logic only
- **`style.css`** - All styling; no CSS preprocessor or framework

### Data Flow: Hero Video Carousel
The hero section cycles through 4 video sources via the `.next-btn` click handler:
1. Button click increments `index` counter in memory
2. `video.src` property dynamically updates with video from `movieList` array
3. When `index === 3`, it resets to `-1` (preparing for 0-based increment on next click)

**Key constraint**: Video paths in `app.js` use `'video/hero-*.mp4'` but HTML references `'videos/hero-1.mp4'` (directory mismatch requires fixing)

## Development Patterns

### Naming Conventions
- **CSS classes**: kebab-case (`.hero-section`, `.next-btn`, `.hero-video`)
- **HTML structure**: Semantic sections + nested divs for layout flexibility
- **Image assets**: WebP preferred for quality images (`.webp`), MP4 for video

### Responsive Design Approach
- Uses `flex` layout heavily (no CSS Grid)
- Viewport meta tag present for mobile support
- Absolute positioning for hero overlay elements (hero-info, gaming-text, next-btn)
- Key breakpoint consideration: Large hero text (120px) may need media queries for mobile

### Common Styling Patterns
- **Color scheme**: Black background (`#000000`), accent yellow (`#edff66`)
- **Glassmorphism**: Header uses `backdrop-filter: blur(10px)` with semi-transparent background
- **Animations**: Transitions on hover (0.3s default)
- **Typography**: Impact font for large headings, Arial fallback

## Asset Management
- **Images**: Located in `/img/` directory (logo.png, about.webp, contact images)
- **Videos**: Located in `/videos/` directory (hero-*.mp4, feature-*.mp4)
- **External fonts**: Google Fonts (Montserrat) via CDN link in `<head>`
- **Icon library**: BoxIcons v2.1.4 for social media icons in footer

## Critical Issues to Know
1. **Video path mismatch**: `app.js` references `'video/'` directory but files are in `'videos/'` (typo in movieList array)
2. **HTML typo**: Line 34 has `class="hero=video"` (should be `hero-video` with hyphen)
3. **Font URL typo**: Google Fonts link has `faily=` instead of `family=`

## When Modifying Code
- Keep `app.js` minimal—this project prioritizes static content with minimal interactivity
- Always update both HTML video paths AND the `movieList` array when adding carousel videos
- Test responsive behavior on mobile—absolute positioning heroes are fragile across viewport sizes
- Validate all image/video paths in both HTML and CSS before deploying

## Typical Workflows
- **Adding new sections**: Follow the existing pattern (semantic `<section>` tag with class, flex layout in CSS)
- **Styling updates**: Edit `style.css` directly; no build step needed
- **Video changes**: Update `movieList` array in `app.js` AND corresponding video elements in HTML
- **Asset replacement**: Maintain existing directory structure (`/img/`, `/videos/`)
