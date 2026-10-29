# PHANTOM DRIVE — Open World

A lightweight browser-based 3D driving-career prototype built with HTML, CSS, JavaScript and Three.js.

## Play locally
1. Extract the ZIP file.
2. Open `index.html` in a modern browser with an internet connection.
3. For best results, use a simple local web server or GitHub Pages because the Three.js library is loaded from a CDN.

## Controls
### Keyboard
- `W` / `Arrow Up`: Accelerate
- `S` / `Arrow Down`: Brake / reverse
- `A` / `Arrow Left`: Steer left
- `D` / `Arrow Right`: Steer right
- `Space`: Handbrake
- `C`: Cycle camera
- `Escape`: Pause

### Touchscreen
Use the on-screen steering, accelerator, brake and handbrake controls. The camera button changes view.

## Publish on GitHub Pages
1. Create a new repository on GitHub.
2. Upload `index.html`, `style.css`, `game.js`, and `README.md` (or upload the contents of this folder).
3. Open **Settings → Pages**.
4. Under the build/deployment section, choose **Deploy from a branch**.
5. Select your main branch and the root (`/`) folder, then save.
6. Open the GitHub Pages URL provided by GitHub.

## Current prototype features
- Lightweight 3D city grid and surrounding roads
- Player car with third-person, cockpit and hood camera modes
- Keyboard and touch controls
- Basic acceleration, braking, reverse, steering and handbrake behaviour
- Moving traffic vehicles
- Starter delivery checkpoint and repeatable cash rewards
- Cash and first-job progress saved in browser local storage
- Simple day/night tint cycle and career HUD

## Prototype limitations
This is the first playable foundation, not a finished commercial simulator. The current city uses generated low-poly buildings; traffic AI and vehicle physics are intentionally simple. Advanced collision physics, proper road-following traffic, detailed assets, audio, real fuel/repair systems, and broader career missions can be added in later versions. Three.js and optional Google Fonts require an internet connection in this starter version.
