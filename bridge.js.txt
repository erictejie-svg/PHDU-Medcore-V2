/*
 * PHDU MedCore V2 — Google Apps Script bridge for the static shell.
 * Uses cross-origin HTML form POST + postMessage; no CORS fetch dependency.
 * Server-side methods are restricted by the allowlist in Code.gs.
 */
(function () {
    "use strict";

    var pendingTimeoutMs = 90000;
    var requestCounter = 0;

    function makeRequestId() {
        requestCounter += 1;
        return "mc-" + Date.now() + "-" + requestCounter + "-" +
            Math.random().toString(36).slice(2);
    }

    function getApiUrl() {
        var url = String(window.MEDCORE_API_URL || "").trim();
        if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec(?:\?.*)?$/.test(url)) {
            throw new Error(
                "Configure MEDCORE_API_URL in config.js with your deployed Apps Script /exec URL."
            );
        }
        return url;
    }

    function invoke(method, args, handlers) {
        var apiUrl;
        try {
            apiUrl = getApiUrl();
        } catch (error) {
            if (handlers.failure) handlers.failure(error);
            else console.error(error);
            return;
        }

        var requestId = makeRequestId();
        var iframe = document.createElement("iframe");
        var form = document.createElement("form");
        var payload = {
            requestId: requestId,
            method: method,
            args: Array.prototype.slice.call(args || [])
        };

        iframe.name = "medcore_api_" + requestId;
        iframe.setAttribute("aria-hidden", "true");
        iframe.style.display = "none";

        form.method = "POST";
        form.action = apiUrl;
        form.target = iframe.name;
        form.acceptCharset = "UTF-8";
        form.style.display = "none";

        var input = document.createElement("input");
        input.type = "hidden";
        input.name = "payload";
        input.value = JSON.stringify(payload);
        form.appendChild(input);

        var finished = false;
        var timeoutId;

        function cleanup() {
            window.removeEventListener("message", onMessage, false);
            if (timeoutId) window.clearTimeout(timeoutId);
            if (form.parentNode) form.parentNode.removeChild(form);
            if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        }

        function fail(error) {
            if (finished) return;
            finished = true;
            cleanup();
            if (handlers.failure) handlers.failure(error);
            else console.error("PHDU MedCore API error:", error);
        }

        function onMessage(event) {
            if (event.source !== iframe.contentWindow) return;
            var message = event.data;
            if (!message || message.type !== "PHDU_MEDCORE_API_RESPONSE" ||
                message.requestId !== requestId) return;

            if (finished) return;
            finished = true;
            cleanup();

            if (message.success === true) {
                if (handlers.success) handlers.success(message.value);
            } else {
                var error = new Error(String(message.value || "Apps Script request failed."));
                if (handlers.failure) handlers.failure(error);
                else console.error(error);
            }
        }

        window.addEventListener("message", onMessage, false);
        document.body.appendChild(iframe);
        document.body.appendChild(form);

        timeoutId = window.setTimeout(function () {
            fail(new Error("Apps Script request timed out. Check the connection and deployment URL."));
        }, pendingTimeoutMs);

        try {
            form.submit();
        } catch (error) {
            fail(error);
        }
    }

    function createRunner(handlers) {
        return new Proxy({}, {
            get: function (target, property) {
                if (property === "withSuccessHandler") {
                    return function (callback) {
                        return createRunner({
                            success: typeof callback === "function" ? callback : handlers.success,
                            failure: handlers.failure
                        });
                    };
                }
                if (property === "withFailureHandler") {
                    return function (callback) {
                        return createRunner({
                            success: handlers.success,
                            failure: typeof callback === "function" ? callback : handlers.failure
                        });
                    };
                }
                if (property === "withUserObject") {
                    return function () { return createRunner(handlers); };
                }
                if (property === "toString") {
                    return function () { return "[PHDU MedCore Apps Script bridge]"; };
                }
                if (typeof property !== "string") return undefined;

                return function () {
                    invoke(property, arguments, handlers);
                };
            }
        });
    }

    window.google = window.google || {};
    window.google.script = window.google.script || {};
    window.google.script.run = createRunner({
        success: null,
        failure: null
    });

    window.MedCoreBridge = {
        isConfigured: function () {
            try { getApiUrl(); return true; } catch (error) { return false; }
        }
    };
}());
