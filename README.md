# My Cookbook Library V3

A phone-first personal cookbook app.

## Included features

- ISBN/EAN barcode scan where the browser supports BarcodeDetector
- Manual ISBN fallback
- Open Library book metadata and cover lookup
- Unlimited cookbook library
- Batch OCR of contents/index pages
- Editable recipe names and page numbers before import
- Full recipe OCR for favourites
- Country, cuisine and free-form tags
- Favourite recipes
- Cooked history and cooked count
- Want-to-cook queue
- 1–5 star ratings
- Personal notes
- Prep and cook times
- Manual recipe entry
- Print / Save as PDF for individual recipes
- Finished-dish photo storage
- Search across books, recipes, ingredients and metadata
- Filters for favourites, full recipes and cooked recipes
- "What can I cook?" ingredient matching
- Serving scaling for ingredient lines with recognisable leading quantities
- Multi-recipe shopping list generation
- JSON backup and restore
- IndexedDB storage for a larger local library
- PWA install support
- Offline app shell after first load

## Important limitation

An ISBN identifies a book but does not contain the book's recipe index. Unless a third-party service has already indexed that title, the app needs you to photograph the contents/index pages once. That creates your own private searchable index without a subscription.

## OCR note

OCR uses Tesseract.js loaded from a CDN. You therefore need an internet connection the first time OCR is used. OCR output should always be checked before saving.

## Hosting

For camera access and app installation on Android, serve these files over HTTPS. GitHub Pages, Netlify and Cloudflare Pages are suitable static hosts.

See INSTALL_S24_ULTRA.md for phone installation.


## V3.1 installability patch

Includes explicit `prefer_related_applications: false`, 144/192/512 px icons, separate `manifest.webmanifest`, explicit icon links and `diagnostics.html` for Android PWA troubleshooting.
