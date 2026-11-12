# PHDU MedCore V2 — GitHub Pages Offline Shell

## What is included

This folder is a static copy of the existing PHDU MedCore interface, with the existing three JavaScript script blocks kept in their original execution order. It adds:

- A service-worker-managed application shell.
- Cache-first handling for approved external image assets.
- A small bridge that forwards existing `google.script.run` calls to the existing Apps Script backend.
- A server-side allowlist for the eight existing backend methods used by this frontend.
- Local-first IndexedDB caching for IV Infusion data using the existing `appCache` object store.

Google Apps Script remains the backend. Google Sheets and Google Docs remain the sources of truth. No spreadsheet structure or clinical content is changed.

## Required setup

1. Deploy the updated `Code.gs` from the supplied Apps Script source as a **Web App**.
2. Keep the deployment identity/access policy consistent with the existing authorized application. The current manifest specifies anonymous access; review that setting carefully before deployment.
3. Copy the deployed Web App URL ending in `/exec`.
4. Open `config.js` and replace the placeholder value of `window.MEDCORE_API_URL` with that exact `/exec` URL.
5. Publish the contents of this folder to the root of a GitHub Pages repository (or a repository subpath where Pages is enabled).
6. Open the GitHub Pages HTTPS URL while online. Allow the service worker to install and the image assets to cache.
7. Open Medication Doses and allow the medication index and all medication-detail batches to finish synchronizing.
8. Open IV Infusion Calculations once while online. The complete returned IV Infusion dataset is stored and read-back verified in IndexedDB.
9. Open each existing poster/image once while online if any of its source URLs are not included in the precache list.
10. Close and reopen the installed/site application, then test airplane mode.

## Important operational notes

- The first online visit is required to install the application shell.
- The first successful medication synchronization is required before medication guides are available offline.
- IV Infusion data must be synchronized once while online.
- The app's existing medication editor remains an online operation. It is routed through a cross-origin form POST bridge; validate this on the deployed environment before relying on edits.
- Google Apps Script web-app deployments may redirect to a Google-hosted response origin. The bridge uses a hidden form target and `postMessage` with both the exact iframe source and a per-request identifier. This must be tested on the deployed URL and target mobile browsers.
- Browser storage can be cleared by the user or evicted by the operating system. Offline availability is therefore device/browser-specific, not a permanent backup.
- Service Worker support requires a secure context (GitHub Pages HTTPS). Safari storage and installed-web-app behavior vary by iOS version.
- External links still require internet access unless their destination content is separately cached.
- Static validation does not prove deployment, API bridge, installation, or airplane-mode success.

## Files

- `index.html` — existing UI and styles, with static script references.
- `JavaScript_1.js`, `JavaScript_2.js`, `JavaScript_3.js` — original script blocks, kept separate and in original order.
- `config.js` — Apps Script `/exec` endpoint configuration.
- `bridge.js` — compatibility shim for existing `google.script.run` calls.
- `sw.js` — offline shell and asset caching.
- `pwa-register.js` — service-worker registration.
- `manifest.webmanifest` — install metadata.

## Deployment validation checklist

- [ ] Apps Script deployment accepts the API POST request.
- [ ] `getMedCoreDrugIndexVersion` returns through the bridge.
- [ ] `getMedCoreDrugIndex` returns the complete index.
- [ ] `getMedCoreDrugDetailsBatch` returns complete batches.
- [ ] `getMedCoreDrugDetails` returns an uncached detail.
- [ ] `getMedCoreInfusionData` returns the infusion dataset.
- [ ] `clearMedCoreDrugIndexCache` works.
- [ ] `saveMedCoreDrugEdits` works only when intentionally tested with an authorized test record.
- [ ] Service worker installs and controls the GitHub Pages origin.
- [ ] Shell reopens in airplane mode after initial visit.
- [ ] Medication guides open in airplane mode after full sync.
- [ ] IV Infusions open in airplane mode after initial sync.
- [ ] Posters and images load in airplane mode.
- [ ] iOS Safari and Android browser tests pass.

Do not mark the application fully offline-validated until these deployment and physical-device tests are completed.
