# Install My Cookbook Library on a Samsung Galaxy S24 Ultra

## Part 1 — Put the app online securely

The app needs an HTTPS web address for camera access and proper PWA installation.

### Easiest beginner route: GitHub Pages

1. Create a free GitHub account if you do not already have one.
2. Create a new repository. A name such as `my-cookbook-library` is fine.
3. Upload all files from this folder to the repository root:
   - index.html
   - app.js
   - styles.css
   - manifest.json
   - service-worker.js
   - icon-192.png
   - icon-512.png
4. In the repository, open **Settings**.
5. Open **Pages**.
6. Under **Build and deployment**, choose **Deploy from a branch**.
7. Select the `main` branch and `/ (root)`, then save.
8. GitHub will provide an HTTPS address for the app.

The app contains no server-side database. Your own cookbook data remains on the device in the browser's IndexedDB unless you export a backup.

## Part 2 — Install on the Galaxy S24 Ultra using Chrome

1. Open **Chrome** on the S24 Ultra.
2. Visit the HTTPS address created above.
3. Tap the **three-dot menu**.
4. Choose **Install app** or **Add to Home screen**, depending on the wording Chrome shows.
5. Confirm **Install**.
6. The Cookbook Library icon will appear on the Apps screen/home screen and launches in its own app window.

## Alternative — Samsung Internet

1. Open the same HTTPS address in **Samsung Internet**.
2. Use the browser's install/Add-to-Home option.
3. Confirm installation on the Apps screen.

## Permissions

When first using barcode scanning or page photographs:
- Allow **Camera** permission when prompted.
- If you previously denied it, open Android **Settings → Apps → Cookbook Library (or your browser) → Permissions → Camera** and allow it.

## First use

1. Open the installed app.
2. Tap **Add book**.
3. Scan the ISBN barcode or type it.
4. Confirm the title and author.
5. Open **Index**.
6. Photograph the contents/index pages.
7. Tap **Read recipe index**.
8. Check the results and save.
9. Repeat for additional books.

For favourite recipes:
1. Open **Full recipe**.
2. Select the cookbook and recipe.
3. Photograph the recipe page(s).
4. Check ingredients/method.
5. Add country, cuisine, tags, notes and an optional finished-dish photo.
6. Save.

## Backups

The library is local to the installed app/browser profile. Use **Backup → Download backup** regularly, especially before clearing browser data, changing phones or uninstalling the app.

## Updating the app

Replace the hosted files with a newer version. The service worker will update the app shell while IndexedDB keeps the cookbook library on the device. Keeping a recent JSON backup is still recommended.
