/* PHDU MedCore V2 offline application shell. */
"use strict";

var SHELL_CACHE = "phdu-medcore-shell-v1";
var ASSET_CACHE = "phdu-medcore-assets-v1";
var SHELL_FILES = [
  "./",
  "./index.html",
  "./config.js",
  "./bridge.js",
  "./JavaScript_1.js",
  "./JavaScript_2.js",
  "./JavaScript_3.js",
  "./pwa-register.js",
  "./manifest.webmanifest"
];
var EXTERNAL_ASSETS = [
  "https://raw.githubusercontent.com/pediatrichighdependency-debug/phdu-medcore-assets/main/Electrolyte%20Corrections.jpeg",
  "https://raw.githubusercontent.com/pediatrichighdependency-debug/phdu-medcore-assets/main/IVF%20Preparation.jpg",
  "https://raw.githubusercontent.com/pediatrichighdependency-debug/phdu-medcore-assets/main/PHDU-MedCore-Home-Screen-Icon.png",
  "https://raw.githubusercontent.com/pediatrichighdependency-debug/phdu-medcore-assets/main/background.jpeg",
  "https://raw.githubusercontent.com/pediatrichighdependency-debug/phdu-medcore-assets/main/clinical-verifier-badge.png",
  "https://raw.githubusercontent.com/pediatrichighdependency-debug/phdu-medcore-assets/main/intubation-medications%20%282%29.jpeg",
  "https://raw.githubusercontent.com/pediatrichighdependency-debug/phdu-medcore-assets/main/logo.jpeg"
];

self.addEventListener("install", function (event) {
  event.waitUntil((async function () {
    var shell = await caches.open(SHELL_CACHE);
    await shell.addAll(SHELL_FILES);

    var assets = await caches.open(ASSET_CACHE);
    await Promise.all(EXTERNAL_ASSETS.map(async function (url) {
      try {
        var response = await fetch(url, { mode: "no-cors", cache: "reload" });
        if (response && (response.type === "opaque" || response.ok)) {
          await assets.put(url, response);
        }
      } catch (error) {
        /* A single unavailable image must not block shell installation. */
      }
    }));

    await self.skipWaiting();
  })());
});

self.addEventListener("activate", function (event) {
  event.waitUntil((async function () {
    var names = await caches.keys();
    await Promise.all(names.map(function (name) {
      if (name.indexOf("phdu-medcore-") === 0 &&
          name !== SHELL_CACHE && name !== ASSET_CACHE) {
        return caches.delete(name);
      }
    }));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", function (event) {
  var request = event.request;
  if (request.method !== "GET") return;

  var url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    event.respondWith((async function () {
      var cache = await caches.open(ASSET_CACHE);
      var cached = await cache.match(request, { ignoreVary: true });
      if (cached) return cached;

      try {
        var response = await fetch(request);
        if (response && (response.ok || response.type === "opaque")) {
          cache.put(request, response.clone()).catch(function () {});
        }
        return response;
      } catch (error) {
        return new Response("", { status: 504, statusText: "Offline asset unavailable" });
      }
    })());
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith((async function () {
      var cache = await caches.open(SHELL_CACHE);
      try {
        var response = await fetch(request);
        if (response && response.ok) {
          cache.put("./index.html", response.clone()).catch(function () {});
        }
        return response;
      } catch (error) {
        return (await cache.match(request)) ||
          (await cache.match("./index.html")) ||
          new Response("PHDU MedCore offline shell is not cached on this device yet.", {
            status: 503,
            headers: { "Content-Type": "text/plain; charset=utf-8" }
          });
      }
    })());
    return;
  }

  event.respondWith((async function () {
    var cache = await caches.open(SHELL_CACHE);
    var cached = await cache.match(request);
    if (cached) {
      fetch(request).then(function (response) {
        if (response && response.ok) cache.put(request, response.clone());
      }).catch(function () {});
      return cached;
    }
    try {
      var response = await fetch(request);
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    } catch (error) {
      return new Response("", { status: 504, statusText: "Offline resource unavailable" });
    }
  })());
});
