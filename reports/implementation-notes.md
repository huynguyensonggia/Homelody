# Homelody landing page — 20/10/2026

Public links are centralized in `assets/js/config.js` under `HOMELODY_CONFIG.links`.
Zalo booking uses **0935 983 263**; phone calls use **0773 558 945**.
Instagram, Facebook, TikTok and the Google Maps place URL use the supplied addresses.

## Content still required

- `GRABFOOD_URL` and `SHOPEEFOOD_URL`: exact restaurant listings. Empty values produce accessible disabled controls without a fabricated destination.
- Four verified venue photos: koi pond, piano, veranda seating, upstairs. Only the verified entrance/garden photo currently renders. The bento layout supports the future additions; no missing-photo placeholders render.
- Brunch: the confirmed menu workbook states that savory brunch is not currently available. The category is configured and automatically hidden until real products are supplied.
- Existing product named “bánh”: confirmation of its exact name and description is required. Display capitalization is normalized; no cake type, ingredients or price were invented. Confirmed corrections can be entered in `productDisplayOverrides` in the same config.

## Editing and assets

- Main page: `index.html`.
- Existing products/modal/menu state: `assets/js/main.js`.
- Public links, mobile ordering and tracking: `assets/js/landing.js`.
- Landing adjustments: `assets/css/landing.css`; original styles and motion remain editable.
- Run `python scripts/build-assets.py` after editing CSS. The page serves generated `assets/css/site.min.css`.
- Fonts are self-hosted Vietnamese/Latin WOFF2 subsets. SIL OFL licenses are in `assets/fonts/`.
- Used photos have WebP copies; original assets remain intact.
- Platform logo SVG artwork and license are in `assets/icons/`.

## Click tracking

Valid links push `{ event, position, link_url }` to `window.dataLayer` and emit `homelody:track` on `window`.
Events: `zalo_booking_click`, `grabfood_click`, `shopeefood_click`, `directions_click`, `call_click`.
Positions include `header`, `hero`, `menu`, `contact`, `sticky_mobile` and `footer`.
This supplies tracking hooks; it does not add a third-party analytics account or transmit events without an existing consumer.

## Verification

`landing-checks.json` records browser checks. Viewport screenshots cover 1440, 1024, 768 and 375px.
All 41 browser checks passed. Rerun with `node scripts/check-landing.cjs`; set `CHROME_BIN` if the local Chromium executable differs.
Final mobile Lighthouse measurement: **Performance 91, Accessibility 100, Best Practices 100, SEO 100**, LCP 3.3s, CLS approximately 0.001.
Lighthouse HTML/JSON reports use the mobile preset against the local static server. These are laboratory measurements, not a guarantee of production field performance.
Delivery navigation cannot be verified until restaurant URLs are supplied. Live Supabase content and real iOS/Android devices were not available to these checks.
