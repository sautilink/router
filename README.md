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
- `assets/router-catalog.json` — countries, providers, router brands, and gateways
- `assets/icons/` — official Router logo derivatives for web, Windows, Android, Apple, and favicons
- `src/index.js` — Cloudflare Worker context API and security headers
- `robots.txt`, `sitemap.xml`, `llms.txt` — crawler and machine-discovery resources
- `sw.js`, `manifest.json` — PWA and offline shell

## Updating the catalog

Add providers and brands only when the name is current and there is a legitimate customer base. Use official support pages where possible. A provider's equipment may vary, so keep multiple likely gateways and do not add default passwords. Directory inclusion is informational and is not an endorsement.

## Router identity assets

`SautiLink Router Logo.png` is the transparent official source and should be used to regenerate application icons. `SautiLink Router Logo.jpg.jpeg` is the white-background source for print or flat-image use. Do not point the web app manifest at either large source file; use the optimized files in `assets/icons/` so installed apps receive the correct size and mask-safe padding.

Validate before deployment:

```sh
jq -e . assets/router-catalog.json
node --check assets/app.js
node --input-type=module --check < src/index.js
git diff --check
```
