# Thadingyut Wish Lanterns

A festival page from Fluxion Technology and Zeno Property. Visitors write a wish, choose a lantern color, and release it into a shared night sky over Bagan. New wishes rise with a burst of fireworks for everyone who has the page open.

## How it works

| Part | What it does |
|---|---|
| `public/` | The website (HTML, CSS, JS, logos). No build step. |
| `api/wishes/index.js` | `GET` latest wishes, `POST` a new wish |
| `api/wishes/[id].js` | `DELETE` a wish (author or moderator) |
| `api/admin-check.js` | Checks the moderator key |
| `lib/store.js` | Upstash Redis client and shared helpers |

- Wishes are stored in **Upstash Redis** (added from the Vercel Marketplace).
- The page checks for new wishes every 8 seconds. It only downloads the list when something changed.
- The person who made a wish can remove it from the same browser.
- Moderators can remove any wish (see "Moderation" below).
- Limits: 150 characters per wish, 40 for the name, 4 wishes per minute per visitor, 5,000 wishes in total.

## Deploy to Vercel

1. **Push this folder to a Git repo** (GitHub, GitLab or Bitbucket).
2. In Vercel, click **Add New > Project** and import the repo.
   - Framework Preset: **Other**
   - Build and Output settings: leave as default (`vercel.json` sets the output folder to `public`).
3. **Add the database:** open the project, go to **Storage** (or **Marketplace**), choose **Upstash for Redis**, create a database, and connect it to this project. A region close to your users (for example Singapore) is a good choice. This adds `KV_REST_API_URL` and `KV_REST_API_TOKEN` for you.
4. **Add environment variables** in **Settings > Environment Variables**:
   - `ADMIN_KEY`: a long random key for moderators (at least 16 characters). You can create one with `openssl rand -base64 24`.
   - `RATE_LIMIT_SALT`: any random text.
   - Optional: `BLOCKED_WORDS`, `RATE_LIMIT_PER_MINUTE`, `MAX_WISHES` (see `.env.example`).
5. **Redeploy** so the new variables take effect.
6. Optional: add your own domain in **Settings > Domains**.

### Run locally

```bash
npm install
npm i -g vercel
vercel link
vercel env pull .env.local
vercel dev
```

Then open http://localhost:3000.

## Moderation

1. Open the site with `#admin` at the end, for example `https://your-site.vercel.app/#admin`.
2. Enter the `ADMIN_KEY`. Moderation stays on only in that browser tab.
3. Click any lantern and choose **Remove wish**.

To change the key, update `ADMIN_KEY` in Vercel and redeploy.

## Security notes

- No secrets in the code. All keys come from environment variables.
- All input is checked on the server (length, allowed colors, control characters removed).
- Wish text is always shown as plain text, never as HTML.
- Visitor IPs are hashed with a salt for rate limiting and are never stored as plain text.
- Strict security headers, including a Content Security Policy, are set in `vercel.json`.
- Delete tokens and the moderator key are compared in constant time.

## Before you launch

- **Personal data:** Sender names are stored. Please check with your Data Protection lead before opening the page to the public.
- **Abuse:** The page is public, so add a `BLOCKED_WORDS` list and choose who will moderate during the festival.
- **Cost:** The Upstash free plan should be enough for a festival page. Check your usage in the Upstash dashboard during the event.
