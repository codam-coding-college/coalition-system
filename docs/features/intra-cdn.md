# Intra CDN Proxy

## Why a proxy is needed

Files on Intra's CDN (`cdn.intra.42.fr`), such as profile pictures, can only be downloaded with a valid Intra API v2 access token in an `Authorization: Bearer <access_token>` header. A request without a valid token gets `403 Forbidden`.

This means a browser cannot load these files directly. An `<img src="https://cdn.intra.42.fr/...">` tag cannot send an `Authorization` header, and the application's access token must never be handed to the browser.

Instead, the browser asks the coalition system for the image. The server downloads it from the CDN with its own access token and streams it back. The routes that do this are in `src/routes/cdn.ts`.

```
Browser                    Coalition system                       Intra CDN
   │  GET /cdn/users/123/picture  │                                    │
   │─────────────────────────────>│  GET <IntraUser.image>             │
   │                              │  Authorization: Bearer <token>     │
   │                              │───────────────────────────────────>│
   │                              │<───────────────────────────────────│
   │<─────────────────────────────│  image bytes (streamed)            │
```

## How the token is attached

The proxy routes call `api.download(url)` on the shared Fast42 client, which requires `@codam/fast42` 3.2.0 or later. `download()`:

- sends the same client-credentials access token that the sync and the other API calls use,
- re-authenticates once if the CDN rejects the token (the CDN answers `403` with a `WWW-Authenticate: Bearer` challenge instead of `401`),
- retries `429` and `5xx` responses like any other GET request,
- refuses any URL that is not on `https://cdn.intra.42.fr`, so the token cannot leak to another host,
- does not count against the API key's rate limit, so CDN downloads skip Fast42's rate limiter.

`download()` returns the raw `Response`. The routes stream its body to the client with `Readable.fromWeb(...)`. Images are not buffered in memory and not stored on disk.

## Routes

Both routes require a logged-in session, enforced by the `checkIfAuthenticated` middleware (see [authentication.md](authentication.md)). A request without a session gets `401 Unauthorized`, not a redirect to `/login`. A redirect would be useless for an `<img>` tag, and it would save the image URL as the page to return to after logging in.

The routes are registered only after the initial Intra sync has finished, because they need the initialized Fast42 client. Before that, every request gets the 503 "syncing" page anyway.

### `GET /cdn/users/:userId/picture`

Returns the profile picture of an `IntraUser`. `:userId` is the Intra user ID, which is also the `IntraUser.id` and `CodamUser.id`.

The route looks up the user in the database and downloads the URL stored in `IntraUser.image`. That is the `large` version of the user's picture, saved during the user sync in `src/sync/users.ts`. The client only sends an ID, so it cannot make the server fetch an arbitrary URL.

| Status | When |
|--------|------|
| 200 | The image, streamed from the CDN |
| 400 | `:userId` is not a number |
| 404 | No `IntraUser` with this ID, or the user has no profile picture |
| 500 | The CDN download failed |

### `GET /cdn/proxy?url=<cdn url>`

A general proxy for any CDN file whose URL you already have. Use it when the image does not belong to a user in the database, for example a user returned live from the Intra API. The `url` query parameter must be URL-encoded and point to `cdn.intra.42.fr`.

| Status | When |
|--------|------|
| 200 | The file, streamed from the CDN |
| 400 | The `url` parameter is missing |
| 403 | The URL's host is not `cdn.intra.42.fr` |
| 500 | The CDN download failed |

### Response headers

Both routes pass the CDN's `Content-Type` through (falling back to `image/jpeg`) and its `Content-Length`. They set `Cache-Control: public, max-age=604800`, so browsers cache an image for 7 days. The URL `/cdn/users/:userId/picture` is the same for a user's old and new picture. If a user changes their picture on Intra, browsers that cached the old one keep showing it for up to a week.

## Displaying CDN images

Never put a CDN URL (such as `IntraUser.image`) directly in an `src` attribute. Point it at one of the proxy routes instead.

**In Nunjucks templates**, use the user's ID:

```html
<img loading="lazy" src="/cdn/users/{{ ranking.user.id }}/picture" class="user-picture rounded-circle" height="32" />
```

All profile pictures on the student-facing pages use this pattern: home, coalition (rankings, assistants and staff), rankings, profile and results.

**In client-side JavaScript**, when you only have the CDN URL, encode it and pass it to the general proxy:

```js
img.src = '/cdn/proxy?url=' + encodeURIComponent(cdnUrl);
```

The API Searcher table (`static/js/apisearcher-table.js`) has a data format for this. A column declared with `data-format="image-cdn"` renders its value as an image through `/cdn/proxy` and shows "No image" when the value is empty. The admin users page (`templates/admin/users.njk`) uses it for the photo column. The plain `image` data format still loads the URL directly, so do not use it for CDN URLs.

Prefer `/cdn/users/:userId/picture` whenever the user exists in the database. Use `/cdn/proxy` only when you have nothing but a URL.

## Fetching CDN files on the server

Server-side code that needs a CDN file must use `api.download(url)` too. A plain `fetch()` of a CDN URL, or passing the URL to another library that fetches it, sends no token and gets `403 Forbidden`.

Relevant source files: `src/routes/cdn.ts`, `static/js/apisearcher-table.js`
