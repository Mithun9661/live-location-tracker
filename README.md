# LiveTrack

LiveTrack is a consent-based real-time location-sharing app. An authenticated owner creates a 24-hour sharing link. The recipient sees a clear permission screen and chooses when to start or stop sharing. Updates appear live on an OpenStreetMap map.

## Features

- Explicit opt-in and stop-sharing controls
- Secure, time-limited sharing links
- Real-time updates with Socket.IO
- Responsive dashboard and live Leaflet map
- Accuracy radius and last-updated status
- Login rate limiting, HTTP-only cookie, input validation, and security headers
- Render-ready health check and Blueprint

## Run locally

Requirements: Node.js 18 or newer.

```bash
npm install
APP_USERNAME=admin APP_PASSWORD=your-password SESSION_SECRET=your-long-random-secret npm start
```

Open `http://localhost:6589`.

On Windows PowerShell:

```powershell
$env:APP_USERNAME="admin"
$env:APP_PASSWORD="your-password"
$env:SESSION_SECRET="your-long-random-secret"
npm start
```

## Environment variables

| Name | Required | Purpose |
|---|---:|---|
| `APP_USERNAME` | Production | Dashboard username |
| `APP_PASSWORD` | Production | Dashboard password |
| `SESSION_SECRET` | Production | Long random value used for login sessions |
| `PUBLIC_BASE_URL` | Optional | Public app URL used in generated share links |
| `PORT` | Automatic on Render | HTTP port |

## Privacy notes

- The sharing page plainly explains that location is being shared.
- Browser permission is required before any coordinates are sent.
- Closing the page or pressing **Stop sharing** stops future updates.
- Active sessions are held in memory and expire within 24 hours. A server restart clears them.

## Deploy to Render

Push the project to GitHub, then create a Render Blueprint from the repository. `render.yaml` configures the service. Set `APP_PASSWORD` in Render when prompted; Render generates `SESSION_SECRET` automatically.
