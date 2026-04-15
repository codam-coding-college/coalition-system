# Canvas

## Overview

The canvas feature generates server-side rendered **1920×1080 PNG images** intended for display on physical screens around the campus (e.g. TVs in the hallway or common areas). These are not interactive web pages — they are static images that refresh each time they are fetched.

The canvas routes require **no authentication** and are excluded from the login middleware. Any HTTP client can fetch them.

## Endpoints

### `GET /canvas/rankings`

Displays the coalition leaderboard and individual rankings.

**Left panel — Coalition Leaderboard:**
- All coalitions ranked by current season score
- Each coalition shown with its cover image (or color fallback) as background
- Coalition name, current score, and top contributor (with profile picture) per coalition

**Right panel — Individual Rankings:**
- One entry per enabled cross-coalition ranking
- Shows the #1 user(s) in each ranking with their profile picture, login, and score
- If multiple users are tied for #1, up to 5 are shown with a gradient background combining their coalition colors

**Bottom bar:**
- Season progress bar (filled based on elapsed time in the current season)
- Text showing days/hours remaining, or time until next season if no active season
- Bonus point status indicator when the final-week bonus run is active

**Left overlay (black sidebar):**
- Campus logo
- QR code linking to the coalition system homepage

### `GET /canvas/activity`

Displays recent notable contributions.

**Left panel:** Same coalition leaderboard as above.

**Right panel — Recent Big Contributions:**
- The 7 most recent high-value score entries
- Excludes typically low-value types (e.g. logtime, idle_logout) to focus on notable achievements
- Each entry shows: coalition color, user profile picture, login, point amount, time since awarded, and the score reason

### `GET /canvas`

Redirects to `/canvas/rankings`. Implemented for backwards compatibility with existing screens set to the old `/canvas` URL.

## Technical Details

The images are generated using the `canvas` npm package, which provides a Node.js implementation of the HTML5 Canvas API.

Fonts registered for rendering:
- Bebas Neue (titles and large numbers)
- Museo Sans 500 and 700 (body text)

Images are streamed directly as PNG (`canvas.createPNGStream().pipe(res)`) — they are not cached on disk. Each request re-renders the image with live data from the database.

Relevant source file: `src/routes/canvas.ts`
