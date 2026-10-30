# WORLDWIRE

A location-aware global news discovery dashboard. Frontend: Cloudflare Pages. Server endpoints: Pages Functions. News discovery: GDELT DOC API. Optional AI briefing: any OpenAI-compatible gateway, including self-hosted FreeLLMAPI.

## Capabilities in this build

- Country, language, trending and world discovery modes.
- Geolocation permission is requested only after a visitor taps **Detect Country**. Manual country selection remains available.
- Server-side news endpoint at `/api/news`: validates parameters, caps requests at 50 articles, removes duplicate titles and returns publisher URLs and metadata.
- Optional AI briefing endpoint at `/api/brief`. It summarizes supplied headlines and must not be treated as fact verification.
- Leaflet map with OpenStreetMap tiles and responsive dashboard.

## Deployment

This repository is connected to Cloudflare Pages. The `functions/` directory adds Pages Functions automatically on the next production deployment. Pushes to `main` trigger a deployment. Check Cloudflare Pages → Deployments to confirm the production commit and build status.

## FreeLLMAPI integration (optional)

FreeLLMAPI is a separate self-hosted OpenAI-compatible gateway. It is **not** hosted by GitHub and does not run merely because its repository is linked. See its official setup: https://github.com/tashfeenahmed/freellmapi

In Cloudflare Pages → Settings → Variables and Secrets, configure:
- `FREE_LLM_API_BASE`: reachable base URL of your FreeLLMAPI instance, without trailing slash.
- `FREE_LLM_API_KEY`: unified FreeLLMAPI key. Store as a secret. Never put it in frontend JavaScript or commit it to GitHub.

Then the dashboard's **AI ANALYSIS** action calls `/api/brief`. That endpoint forwards up to eight headlines to `/v1/chat/completions` using model `auto`.

FreeLLMAPI is documented as a self-hosted, single-user gateway. Do not expose an unauthenticated instance publicly. Provider availability, free-tier limits and terms vary. It needs a continuously reachable host; GitHub Pages/repository hosting does not run it. A home PC can be used for testing but is not a reliable 24/7 production host.

## News data and editorial limitations

- GDELT is a discovery index, not a guarantee of complete country coverage.
- GDELT source-country metadata identifies publisher origin, not necessarily the event location.
- Language/country filters can return fewer than 50 results; the 50-result limit is a cap, not a promise of 50 unique events.
- Trending currently uses GDELT's relevance/hybrid sort, not measured social virality or independently calculated coverage velocity.
- Headlines are not full article text. The system does not bypass paywalls or republish full copyrighted articles.
- No story is labelled independently verified. A real verification system needs corroboration across independent publishers and primary sources.
- Map markers must only be added when a reliable event location is available. Publisher country must not be used as a substitute for event coordinates.

## Privacy

Location is opt-in. The browser uses coordinates transiently to infer the visitor's country; country selection is available without location permission. The app should not retain precise coordinates.
