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

## Hosted AI: Cloudflare Workers AI (no local server)

WORLDWIRE uses Cloudflare Workers AI for optional AI briefings. Models run on Cloudflare's infrastructure; no laptop, VPS, or self-hosted FreeLLMAPI process is required.

One-time setup:
1. Open Cloudflare Dashboard → Workers & Pages → Pages → `worldwire`.
2. Open Settings → Bindings → Production → Add → Workers AI.
3. Set the variable/binding name to exactly `AI`.
4. Save, then trigger a new production deployment (the binding only becomes available after redeployment).
5. Repeat for Preview only if you want AI briefings on preview deployments.

The `/api/brief` Pages Function calls `@cf/zai-org/glm-4.7-flash` through `env.AI.run()`. Cloudflare documents this model among models available on Workers Free. Workers AI currently includes 10,000 Neurons/day on Free; model use consumes that shared daily allocation and calls fail when the allocation is exhausted. Limits and model availability can change. See https://developers.cloudflare.com/workers-ai/platform/pricing/ and https://developers.cloudflare.com/workers-ai/configuration/bindings/.

No AI provider API key needs to be added to GitHub or browser code. Keep the binding server-side. FreeLLMAPI is no longer required for this deployment.

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
