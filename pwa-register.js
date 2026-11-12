(function () {
    "use strict";
    if ("serviceWorker" in navigator && window.isSecureContext) {
        window.addEventListener("load", function () {
            navigator.serviceWorker.register("./sw.js", { scope: "./" })
                .then(function (registration) {
                    console.log("PHDU MedCore offline shell registered.", registration.scope);
                })
                .catch(function (error) {
                    console.error("PHDU MedCore offline shell registration failed:", error);
                });
        });
    }
}());
