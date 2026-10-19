# SautiLink Router

SautiLink Router is a privacy-focused setup gateway for local router login pages, provider-supplied equipment, mesh systems, and official management apps.

## How recommendations work

The browser can usually identify a broad device class and may expose a general connection type. It cannot reliably expose the Wi-Fi SSID or exact router model. The application therefore combines:

1. a country code supplied by the Cloudflare edge without returning the visitor's IP address;
2. browser-provided device and connection hints;
3. the provider or router brand confirmed by the visitor; and
4. a curated catalog of likely local gateways and official setup routes.

Recommendations are presented as likely routes, never as confirmed hardware detection.

## Project structure

- `index.html` — semantic page content and structured data
- `assets/app.css` — responsive SautiLink UI
- `assets/app.js` — device hints, search, filtering, and recommendations
- `assets/router-theme.js` — saved theme selection before the page renders
- `assets/router-catalog.json` — countries, providers, router brands, and gateways
- `assets/router-setup-hero*.webp` — responsive decorative router illustration
- `assets/icons/` — official Router logo derivatives for web, Windows, Android, Apple, and favicons
- `src/index.js` — Cloudflare Worker context API and security headers
- `robots.txt`, `sitemap.xml`, `llms.txt` — crawler and machine-discovery resources
- `sw.js`, `manifest.json` — PWA and offline shell
- `tests/router-ui.test.mjs` — interface behavior checks, also run by CI

## Interface

The public interface uses Inter, the official Router logo, light neutral surfaces and a saved light or dark theme choice. Keep the setup assistant prominent, controls readable on phones, and search usable with a keyboard. Catalog controls should show an honest loading or unavailable state until their data is ready.

Styles and scripts are external to respect the existing content security policy. When replacing a cached interface asset, update its versioned page reference and service-worker cache entry together.

## Public animated icons

The public page uses the same AnimateIcons Huge artwork and motion runtime as SautiLink's main interface, with the shared catalog's documented Lucide utility fallbacks for hardware symbols. The local package, source provenance, icon names, hashes and licenses are included in `assets/public-icons/`; no icon CDN or new network request is required.

Every decorative icon contains real SVG artwork and has `aria-hidden="true"` and `focusable="false"`. Static page icons remain visible when the animation scripts are unavailable. Search suggestions, quick picks, directory cards and route actions clone inert inline SVG templates, keeping the same fallback for dynamic content. Provider names, recommendations, gateway destinations and the existing keyboard controls remain owned by `assets/app.js`.

Motion is enabled only under `body[data-public-icons]`. The shared adapter adds short hover, focus and introductory animations, respects reduced motion, and stops motion offscreen or when the page is hidden. The original public controls keep their own labels and events.

When updating the icon package, keep `index.html`, the versioned CSS/JS references, the service-worker cache name and its shell entries in sync. Wrangler's `.wrangler/` directory is excluded from both Git and published static assets; CLI cache and temporary files must never be deployed.

## Built-in country dropdowns

Both country controls use the shared `assets/public-select.js` and `assets/public-select.css` presentation layer. Their original native selects, options, empty values and change handlers remain the source of truth; the country catalog and recommendation logic are unchanged. The shared module follows rebuilt options, programmatic values and disabled/loading states, and the page keeps native fields visible if the module does not load.

The country menus search both country names and codes, support keyboard navigation and Escape, and use Router's light/dark field styling with the existing animated icons. The provider/router search keeps its existing custom combobox. Load the shared dropdown script after the page script and icon runtime, and version its files and service-worker cache entries together.

## Updating the catalog

Add providers and brands only when the name is current and there is a legitimate customer base. Use official support pages where possible. A provider's equipment may vary, so keep multiple likely gateways and do not add default passwords. Directory inclusion is informational and is not an endorsement.

## Router identity assets

`SautiLink Router Logo.png` is the transparent official source and should be used to regenerate application icons. `SautiLink Router Logo.jpg.jpeg` is the white-background source for print or flat-image use. Do not point the web app manifest at either large source file; use the optimized files in `assets/icons/` so installed apps receive the correct size and mask-safe padding.

Validate before deployment:

```sh
jq -e . assets/router-catalog.json
node --check assets/app.js
node --check assets/router-theme.js
node --check assets/public-icons/icons.js
node --check assets/public-icons/adapter.js
node --check assets/public-select.js
node --test tests/router-ui.test.mjs
node --input-type=module --check < src/index.js
git diff --check
```
