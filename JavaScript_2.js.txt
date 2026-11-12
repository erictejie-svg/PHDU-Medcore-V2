/* ======================================================
   PHDU MEDCORE
   DRUG FUNCTIONS
   Version 3.3 — CLINICAL READABILITY + CROSS-REFERENCE
   LOCKED — NO DRIFT
====================================================== */


/* ======================================================
   SEARCH SETTINGS
====================================================== */

const SEARCH_MIN_LENGTH = 2;
const MAX_RESULTS = 20;

const DRUG_DETAILS_CACHE = {};

let DRUG_INDEX_LOADED = false;
let DRUG_INDEX_LOADING = false;
let DRUG_INDEX_SYNCING = false;
let DRUG_INDEX_HAS_LOCAL_CACHE = false;
let pendingSearchKeyword = "";

/* ======================================================
   LIGHTWEIGHT OFFLINE SEARCH CACHE

   Stores only the existing lightweight medication index.
   Full clinical dosing guides are not downloaded here.
====================================================== */

const MEDCORE_LOCAL_DB_NAME =
    "PHDU_MEDCORE_LOCAL";

const MEDCORE_LOCAL_DB_VERSION =
    1;

const MEDCORE_LOCAL_STORE_NAME =
    "appCache";

const MEDCORE_LOCAL_INDEX_KEY =
    "medicationSearchIndex";

/* ======================================================
   PHASE 3 — COMPLETE MEDICATION DETAIL CACHE
====================================================== */

const MEDCORE_LOCAL_DETAIL_PREFIX =
    "medicationDetail:";

const MEDCORE_LOCAL_DETAIL_SYNC_KEY =
    "medicationDetailsSync";

const MEDCORE_LOCAL_INFUSION_KEY =
    "ivInfusionData";

const MEDCORE_LOCAL_INFUSION_STAGING_KEY =
    "ivInfusionData:staging";

const MEDCORE_DETAIL_BATCH_SIZE =
    8;

let MEDCORE_DETAILS_SYNCING = false;


function openMedCoreLocalDatabase(callback) {

    if (!window.indexedDB) {

        callback(null);
        return;

    }

    let request;

    try {

        request = window.indexedDB.open(
            MEDCORE_LOCAL_DB_NAME,
            MEDCORE_LOCAL_DB_VERSION
        );

    } catch (error) {

        console.warn(
            "PHDU MedCore local storage is unavailable:",
            error
        );

        callback(null);
        return;

    }

    request.onupgradeneeded = function (event) {

        const database = event.target.result;

        if (!database.objectStoreNames.contains(MEDCORE_LOCAL_STORE_NAME)) {

            database.createObjectStore(
                MEDCORE_LOCAL_STORE_NAME,
                { keyPath: "key" }
            );

        }

    };

    request.onsuccess = function () {

        callback(request.result);

    };

    request.onerror = function () {

        console.warn(
            "PHDU MedCore could not open local medication storage.",
            request.error
        );

        callback(null);

    };

    request.onblocked = function () {

        console.warn(
            "PHDU MedCore local storage upgrade is blocked."
        );

        callback(null);

    };

}

function isValidMedCoreDrugIndex(data) {

    if (!Array.isArray(data) || data.length === 0) {

        return false;

    }

    for (let index = 0; index < data.length; index++) {

        const item = data[index];

        if (
            !item ||
            !Number.isInteger(Number(item.rowNumber)) ||
            Number(item.rowNumber) < 2 ||
            !String(item.drugName || "").trim()
        ) {

            return false;

        }

    }

    return true;

}

function readMedCoreLocalDrugIndex(callback) {

    openMedCoreLocalDatabase(function (database) {

        if (!database) {

            callback(null);
            return;

        }

        let request;

        try {

            request = database
                .transaction(
                    MEDCORE_LOCAL_STORE_NAME,
                    "readonly"
                )
                .objectStore(
                    MEDCORE_LOCAL_STORE_NAME
                )
                .get(
                    MEDCORE_LOCAL_INDEX_KEY
                );

        } catch (error) {

            database.close();
            callback(null);
            return;

        }

        request.onsuccess = function () {

            const record = request.result;
            database.close();

            if (
                record &&
                isValidMedCoreDrugIndex(record.records) &&
                (
                    record.count == null ||
                    Number(record.count) === record.records.length
                )
            ) {

                callback(record);

            } else {

                callback(null);

            }

        };

        request.onerror = function () {

            database.close();
            callback(null);

        };

    });

}

function saveMedCoreLocalDrugIndex(records, version, callback) {

    const done = typeof callback === "function"
        ? callback
        : function () {};

    if (!isValidMedCoreDrugIndex(records)) {

        console.warn(
            "PHDU MedCore did not cache an invalid medication index."
        );

        done({ saved: false, verified: false, reason: "invalid-index" });
        return;

    }

    openMedCoreLocalDatabase(function (database) {

        if (!database) {

            console.warn(
                "PHDU MedCore IndexedDB is unavailable; offline medication search cannot be guaranteed in this browser context."
            );

            done({ saved: false, verified: false, reason: "database-unavailable" });
            return;

        }

        let transaction;
        let transactionFinished = false;

        try {

            transaction = database.transaction(
                MEDCORE_LOCAL_STORE_NAME,
                "readwrite"
            );

            transaction.objectStore(
                MEDCORE_LOCAL_STORE_NAME
            ).put({

                key: MEDCORE_LOCAL_INDEX_KEY,
                records: records,
                version: version || "",
                savedAt: new Date().toISOString(),
                count: records.length

            });

            transaction.oncomplete = function () {

                transactionFinished = true;
                database.close();

                /* Verify the committed data with a separate read transaction. */
                readMedCoreLocalDrugIndex(function (savedRecord) {

                    const verified = !!(
                        savedRecord &&
                        savedRecord.records &&
                        savedRecord.records.length === records.length &&
                        String(savedRecord.version || "") === String(version || "")
                    );

                    if (verified) {

                        console.log(
                            "PHDU MedCore OFFLINE CACHE VERIFIED:",
                            savedRecord.count,
                            "medications; version:",
                            savedRecord.version || "unversioned"
                        );

                    } else {

                        console.error(
                            "PHDU MedCore IndexedDB write completed but read-back verification failed."
                        );

                    }

                    done({
                        saved: true,
                        verified: verified,
                        count: savedRecord && savedRecord.records
                            ? savedRecord.records.length
                            : 0,
                        version: savedRecord ? savedRecord.version || "" : ""
                    });

                });

            };

            transaction.onerror = function () {

                if (transactionFinished) return;
                transactionFinished = true;
                database.close();

                console.error(
                    "PHDU MedCore could not save the local medication index:",
                    transaction.error
                );

                done({ saved: false, verified: false, reason: "transaction-error" });

            };

            transaction.onabort = function () {

                if (transactionFinished) return;
                transactionFinished = true;
                database.close();

                console.error(
                    "PHDU MedCore local medication cache transaction was aborted:",
                    transaction.error
                );

                done({ saved: false, verified: false, reason: "transaction-aborted" });

            };

        } catch (error) {

            database.close();

            console.error(
                "PHDU MedCore local medication cache was not saved:",
                error
            );

            done({ saved: false, verified: false, reason: "write-exception" });

        }

    });

}

/* ======================================================
   HTML SAFETY
====================================================== */

function escapeHtml(value) {

    return String(
        value == null
            ? ""
            : value
    )
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


/* ======================================================
   MEDICATION PAGE
====================================================== */

function loadMedicationList() {

    const container =
        document.getElementById(
            "drugList"
        );

    if (!container) {

        return;

    }

    if (!DRUG_INDEX_LOADED) {

        showDrugIndexLoading();

        loadMedCoreDrugIndex();

        return;

    }

    showDrugSearchPrompt();

}


/* ======================================================
   SEARCH PROMPT
====================================================== */

function showDrugSearchPrompt() {

    const container =
        document.getElementById(
            "drugList"
        );

    if (!container) {

        return;

    }

    container.innerHTML = `

        <div style="
            text-align:center;
            color:#9fdcff;
            font-size:34px;
            font-weight:700;
            padding:80px 20px;
            line-height:1.6;
        ">

            🔍 Start typing to search medications.<br><br>

            Type at least
            <b>${SEARCH_MIN_LENGTH}</b>
            letters.

        </div>

    `;

}


/* ======================================================
   INDEX LOADING STATE
====================================================== */

function showDrugIndexLoading() {

    const container =
        document.getElementById(
            "drugList"
        );

    if (!container) {

        return;

    }

    container.innerHTML = `

        <div style="
            text-align:center;
            color:#9fdcff;
            font-size:32px;
            font-weight:700;
            padding:70px 20px;
            line-height:1.5;
        ">

            Loading medication index...

        </div>

    `;

}


/* ======================================================
   PHASE 3 — COMPLETE MEDICATION DETAIL OFFLINE CACHE
====================================================== */

function getMedCoreLocalDrugDetail(rowNumber, callback) {

    openMedCoreLocalDatabase(function(database) {

        if (!database) {
            callback(null);
            return;
        }

        let transaction;
        let request;

        try {
            transaction = database.transaction(
                MEDCORE_LOCAL_STORE_NAME,
                "readonly"
            );

            request = transaction
                .objectStore(MEDCORE_LOCAL_STORE_NAME)
                .get(
                    MEDCORE_LOCAL_DETAIL_PREFIX +
                    String(Number(rowNumber))
                );

        } catch (error) {
            database.close();
            callback(null);
            return;
        }

        request.onsuccess = function() {

            const record = request.result || null;
            database.close();

            if (
                record &&
                record.detail &&
                Number(record.detail.rowNumber) === Number(rowNumber) &&
                typeof record.detail.originalEntry === "string" &&
                Array.isArray(record.detail.originalEntryRuns)
            ) {
                callback(record.detail);
            } else {
                callback(null);
            }

        };

        request.onerror = function() {
            database.close();
            callback(null);
        };

    });

}


function saveMedCoreLocalSingleDrugDetail(detail, callback) {

    const done = typeof callback === "function"
        ? callback
        : function() {};

    if (
        !detail ||
        !Number.isInteger(Number(detail.rowNumber)) ||
        Number(detail.rowNumber) < 2 ||
        !String(detail.drugName || "").trim() ||
        typeof detail.originalEntry !== "string" ||
        !Array.isArray(detail.originalEntryRuns)
    ) {
        done(false);
        return;
    }

    openMedCoreLocalDatabase(function(database) {

        if (!database) {
            done(false);
            return;
        }

        let transaction;

        try {
            transaction = database.transaction(
                MEDCORE_LOCAL_STORE_NAME,
                "readwrite"
            );

            transaction
                .objectStore(MEDCORE_LOCAL_STORE_NAME)
                .put({
                    key:
                        MEDCORE_LOCAL_DETAIL_PREFIX +
                        String(Number(detail.rowNumber)),
                    detail: detail,
                    version: "",
                    savedAt: new Date().toISOString()
                });

        } catch (error) {
            database.close();
            done(false);
            return;
        }

        transaction.oncomplete = function() {

            database.close();

            getMedCoreLocalDrugDetail(
                detail.rowNumber,
                function(savedDetail) {

                    done(
                        !!savedDetail &&
                        savedDetail.drugName === detail.drugName &&
                        savedDetail.originalEntry === detail.originalEntry &&
                        JSON.stringify(savedDetail.originalEntryRuns) ===
                            JSON.stringify(detail.originalEntryRuns)
                    );

                }
            );

        };

        transaction.onerror = function() {
            database.close();
            done(false);
        };

        transaction.onabort = function() {
            database.close();
            done(false);
        };

    });

}


function readMedCoreDetailSyncState(callback) {

    openMedCoreLocalDatabase(function(database) {

        if (!database) {
            callback(null);
            return;
        }

        let transaction;
        let request;

        try {
            transaction = database.transaction(
                MEDCORE_LOCAL_STORE_NAME,
                "readonly"
            );

            request = transaction
                .objectStore(MEDCORE_LOCAL_STORE_NAME)
                .get(MEDCORE_LOCAL_DETAIL_SYNC_KEY);

        } catch (error) {
            database.close();
            callback(null);
            return;
        }

        request.onsuccess = function() {
            const record = request.result || null;
            database.close();
            callback(record);
        };

        request.onerror = function() {
            database.close();
            callback(null);
        };

    });

}


function saveMedCoreDetailBatch(
    details,
    version,
    nextIndex,
    totalCount,
    callback
) {

    const done = typeof callback === "function"
        ? callback
        : function() {};

    if (
        !Array.isArray(details) ||
        details.length < 1 ||
        details.length > MEDCORE_DETAIL_BATCH_SIZE ||
        !Number.isInteger(nextIndex) ||
        !Number.isInteger(totalCount) ||
        nextIndex < 0 ||
        nextIndex > totalCount
    ) {
        done(false);
        return;
    }

    const validDetails = details.every(function(detail) {

        return (
            detail &&
            Number.isInteger(Number(detail.rowNumber)) &&
            Number(detail.rowNumber) >= 2 &&
            String(detail.drugName || "").trim() !== "" &&
            typeof detail.originalEntry === "string" &&
            Array.isArray(detail.originalEntryRuns)
        );

    });

    if (!validDetails) {
        console.error(
            "PHDU MedCore rejected an invalid medication-detail batch."
        );
        done(false);
        return;
    }

    openMedCoreLocalDatabase(function(database) {

        if (!database) {
            done(false);
            return;
        }

        let transaction;

        try {

            transaction = database.transaction(
                MEDCORE_LOCAL_STORE_NAME,
                "readwrite"
            );

            const store =
                transaction.objectStore(
                    MEDCORE_LOCAL_STORE_NAME
                );

            details.forEach(function(detail) {

                store.put({

                    key:
                        MEDCORE_LOCAL_DETAIL_PREFIX +
                        String(Number(detail.rowNumber)),

                    detail:
                        detail,

                    version:
                        String(version || ""),

                    savedAt:
                        new Date().toISOString()

                });

            });

            store.put({

                key:
                    MEDCORE_LOCAL_DETAIL_SYNC_KEY,

                version:
                    String(version || ""),

                nextIndex:
                    nextIndex,

                totalCount:
                    totalCount,

                completed:
                    nextIndex >= totalCount,

                updatedAt:
                    new Date().toISOString()

            });

        } catch (error) {

            database.close();
            done(false);
            return;

        }

        transaction.oncomplete = function() {

            database.close();

            verifyMedCoreDetailBatch(
                details,
                version,
                nextIndex,
                totalCount,
                done
            );

        };

        transaction.onerror = function() {
            database.close();
            done(false);
        };

        transaction.onabort = function() {
            database.close();
            done(false);
        };

    });

}


function verifyMedCoreDetailBatch(
    details,
    version,
    nextIndex,
    totalCount,
    callback
) {

    openMedCoreLocalDatabase(function(database) {

        if (!database) {
            callback(false);
            return;
        }

        let transaction;

        try {

            transaction = database.transaction(
                MEDCORE_LOCAL_STORE_NAME,
                "readonly"
            );

            const store =
                transaction.objectStore(
                    MEDCORE_LOCAL_STORE_NAME
                );

            const verifiedRecords = [];
            let syncState = null;

            details.forEach(function(detail) {

                const request = store.get(
                    MEDCORE_LOCAL_DETAIL_PREFIX +
                    String(Number(detail.rowNumber))
                );

                request.onsuccess = function() {
                    verifiedRecords.push(
                        request.result || null
                    );
                };

            });

            const stateRequest =
                store.get(
                    MEDCORE_LOCAL_DETAIL_SYNC_KEY
                );

            stateRequest.onsuccess = function() {
                syncState = stateRequest.result || null;
            };

            transaction.oncomplete = function() {

                database.close();

                const recordsVerified =
                    verifiedRecords.length === details.length &&
                    verifiedRecords.every(function(record, index) {

                        const expected = details[index];

                        return (
                            record &&
                            record.detail &&
                            Number(record.detail.rowNumber) ===
                                Number(expected.rowNumber) &&
                            record.detail.drugName === expected.drugName &&
                            record.detail.classification === expected.classification &&
                            record.detail.route === expected.route &&
                            record.detail.originalEntry === expected.originalEntry &&
                            JSON.stringify(record.detail.originalEntryRuns) ===
                                JSON.stringify(expected.originalEntryRuns) &&
                            String(record.version || "") ===
                                String(version || "")
                        );

                    });

                const stateVerified = (
                    syncState &&
                    String(syncState.version || "") ===
                        String(version || "") &&
                    Number(syncState.nextIndex) === nextIndex &&
                    Number(syncState.totalCount) === totalCount &&
                    syncState.completed === (nextIndex >= totalCount)
                );

                callback(
                    !!(recordsVerified && stateVerified)
                );

            };

            transaction.onerror = function() {
                database.close();
                callback(false);
            };

        } catch (error) {

            database.close();
            callback(false);

        }

    });

}


function startMedCoreCompleteDrugDetailSync(version) {

    if (
        MEDCORE_DETAILS_SYNCING ||
        !Array.isArray(DRUGS) ||
        DRUGS.length === 0
    ) {
        return;
    }

    MEDCORE_DETAILS_SYNCING = true;

    const syncVersion =
        String(version || "");

    readMedCoreDetailSyncState(function(state) {

        let cursor = 0;

        if (
            state &&
            String(state.version || "") === syncVersion &&
            Number(state.totalCount) === DRUGS.length &&
            Number.isInteger(Number(state.nextIndex))
        ) {
            cursor = Math.max(
                0,
                Math.min(
                    DRUGS.length,
                    Number(state.nextIndex)
                )
            );
        }

        if (
            state &&
            String(state.version || "") === syncVersion &&
            Number(state.totalCount) === DRUGS.length &&
            state.completed === true &&
            cursor === DRUGS.length
        ) {
            MEDCORE_DETAILS_SYNCING = false;

            console.log(
                "PHDU MedCore complete medication-detail cache is already verified:",
                DRUGS.length,
                "medications."
            );

            return;
        }

        function requestNextBatch() {

            if (cursor >= DRUGS.length) {

                MEDCORE_DETAILS_SYNCING = false;

                console.log(
                    "PHDU MedCore complete medication-detail synchronization verified:",
                    DRUGS.length,
                    "medications."
                );

                return;

            }

            const batch =
                DRUGS.slice(
                    cursor,
                    cursor + MEDCORE_DETAIL_BATCH_SIZE
                );

            const rowNumbers =
                batch.map(function(item) {
                    return Number(item.rowNumber);
                });

            google.script.run

                .withSuccessHandler(function(details) {

                    if (
                        !Array.isArray(details) ||
                        details.length !== rowNumbers.length
                    ) {

                        MEDCORE_DETAILS_SYNCING = false;

                        console.error(
                            "PHDU MedCore received an incomplete medication-detail batch. The last verified batch remains intact."
                        );

                        return;

                    }

                    const nextCursor =
                        cursor + rowNumbers.length;

                    saveMedCoreDetailBatch(
                        details,
                        syncVersion,
                        nextCursor,
                        DRUGS.length,
                        function(verified) {

                            if (!verified) {

                                MEDCORE_DETAILS_SYNCING = false;

                                console.error(
                                    "PHDU MedCore medication-detail batch failed IndexedDB read-back verification. Synchronization paused."
                                );

                                return;

                            }

                            cursor = nextCursor;

                            requestNextBatch();

                        }
                    );

                })

                .withFailureHandler(function(error) {

                    MEDCORE_DETAILS_SYNCING = false;

                    console.warn(
                        "PHDU MedCore medication-detail synchronization paused. Previously verified batches remain saved and can resume.",
                        error
                    );

                })

                .getMedCoreDrugDetailsBatch(
                    rowNumbers
                );

        }

        requestNextBatch();

    });

}


/* ======================================================
   LOAD LIGHTWEIGHT DRUG INDEX
====================================================== */

function loadMedCoreDrugIndex() {

    if (DRUG_INDEX_LOADED) {

        applyPendingDrugSearch();

        if (!DRUG_INDEX_SYNCING) {

            synchronizeMedCoreDrugIndex();

        }

        return;

    }

    if (DRUG_INDEX_LOADING) {

        return;

    }

    DRUG_INDEX_LOADING = true;

    readMedCoreLocalDrugIndex(function (cachedRecord) {

        if (cachedRecord) {

            DRUGS = cachedRecord.records;
            DRUG_INDEX_LOADED = true;
            DRUG_INDEX_HAS_LOCAL_CACHE = true;
            DRUG_INDEX_LOADING = false;

            console.log(
                "PHDU MedCore local medication index loaded:",
                DRUGS.length,
                "medications"
            );

            applyPendingDrugSearch();

            synchronizeMedCoreDrugIndex(
                cachedRecord.version || ""
            );

            return;

        }

        /* Keep the loading guard active until the first server response. */

        synchronizeMedCoreDrugIndex("");

    });

}


/* ======================================================
   BACKGROUND INDEX VERSION CHECK AND SYNCHRONIZATION
====================================================== */

function synchronizeMedCoreDrugIndex(localVersion) {

    if (DRUG_INDEX_SYNCING) {

        return;

    }

    DRUG_INDEX_SYNCING = true;

    google.script.run

        .withSuccessHandler(function (serverVersion) {

            const normalizedServerVersion =
                String(serverVersion || "");

            if (
                localVersion &&
                normalizedServerVersion &&
                localVersion === normalizedServerVersion
            ) {

                DRUG_INDEX_SYNCING = false;

                console.log(
                    "PHDU MedCore medication index is current."
                );

                startMedCoreCompleteDrugDetailSync(
                    normalizedServerVersion
                );

                return;

            }

            if (DRUG_INDEX_HAS_LOCAL_CACHE) {

                clearAndRefreshMedCoreDrugIndex(
                    normalizedServerVersion
                );

            } else {

                fetchMedCoreDrugIndex(
                    normalizedServerVersion
                );

            }

        })

        .withFailureHandler(function (error) {

            console.warn(
                "PHDU MedCore could not check the medication index version:",
                error
            );

            if (DRUG_INDEX_HAS_LOCAL_CACHE) {

                DRUG_INDEX_SYNCING = false;
                return;

            }

            /* First-use fallback: retain the existing index endpoint. */

            fetchMedCoreDrugIndex("");

        })

        .getMedCoreDrugIndexVersion();

}


function clearAndRefreshMedCoreDrugIndex(version) {

    google.script.run

        .withSuccessHandler(function () {

            fetchMedCoreDrugIndex(version);

        })

        .withFailureHandler(function (error) {

            console.warn(
                "PHDU MedCore could not clear the server index cache:",
                error
            );

            DRUG_INDEX_SYNCING = false;

        })

        .clearMedCoreDrugIndexCache();

}


function fetchMedCoreDrugIndex(version) {

    google.script.run

        .withSuccessHandler(function (data) {

            if (!isValidMedCoreDrugIndex(data)) {

                console.error(
                    "PHDU MedCore received an incomplete or invalid medication index. The last valid local index was retained."
                );

                DRUG_INDEX_SYNCING = false;

                if (!DRUG_INDEX_LOADED) {

                    showMedCoreDrugIndexLoadError(
                        "The medication index could not be validated."
                    );

                }

                return;

            }

            DRUGS = data;
            DRUG_INDEX_LOADED = true;
            DRUG_INDEX_HAS_LOCAL_CACHE = true;
            DRUG_INDEX_LOADING = false;
            DRUG_INDEX_SYNCING = false;

            console.log(
                "PHDU MedCore INDEX LOADED FROM SERVER:",
                DRUGS.length,
                "medications"
            );

            /*
               Do not report offline synchronization as complete until
               IndexedDB confirms that the index was committed and can
               be read back. Search remains available from memory meanwhile.
            */
            saveMedCoreLocalDrugIndex(
                data,
                version,
                function (cacheResult) {

                    if (cacheResult && cacheResult.verified) {

                        console.log(
                            "PHDU MedCore OFFLINE CACHE SAVED SUCCESSFULLY AND VERIFIED."
                        );

                        startMedCoreCompleteDrugDetailSync(
                            version
                        );

                    } else {

                        console.warn(
                            "PHDU MedCore is usable online, but persistent offline search was NOT verified.",
                            cacheResult ? cacheResult.reason : "unknown-cache-error"
                        );

                    }

                }
            );

            applyPendingDrugSearch();

        })

        .withFailureHandler(function (error) {

            DRUG_INDEX_SYNCING = false;
            DRUG_INDEX_LOADING = false;

            console.error(
                "PHDU MedCore drug index failed to load:",
                error
            );

            if (DRUG_INDEX_LOADED) {

                /* Keep the last valid local index available. */
                return;

            }

            const errorMessage =
                error && error.message
                    ? error.message
                    : String(
                        error ||
                        "Unknown error"
                    );

            showMedCoreDrugIndexLoadError(
                errorMessage
            );

        })

        .getMedCoreDrugIndex();

}


function showMedCoreDrugIndexLoadError(errorMessage) {

    const container =
        document.getElementById(
            "drugList"
        );

    if (!container) {

        return;

    }

    container.innerHTML = `

        <div style="
            text-align:center;
            color:#ffffff;
            font-size:30px;
            padding:70px 20px;
            line-height:1.5;
        ">

            Unable to load medication index.<br><br>

            <span style="
                color:#9fdcff;
                font-size:24px;
            ">

                ${escapeHtml(errorMessage)}

            </span>

        </div>

    `;

}


/* ======================================================
   LIVE SEARCH
====================================================== */

document.addEventListener(
    "input",
    function (event) {

        if (
            event.target.id !==
            "searchMedication"
        ) {

            return;

        }

        const keyword =
            String(
                event.target.value ||
                ""
            )
                .trim()
                .toLowerCase();

        pendingSearchKeyword =
            keyword;

        if (
            keyword.length <
            SEARCH_MIN_LENGTH
        ) {

            showDrugSearchPrompt();

            return;

        }

        if (!DRUG_INDEX_LOADED) {

            showDrugIndexLoading();

            loadMedCoreDrugIndex();

            return;

        }

        searchDrugIndex(
            keyword
        );

    }
);


/* ======================================================
   APPLY PENDING SEARCH AFTER INDEX LOAD
====================================================== */

function applyPendingDrugSearch() {

    const search =
        document.getElementById(
            "searchMedication"
        );

    const keyword =
        search
            ? String(
                search.value ||
                ""
            )
                .trim()
                .toLowerCase()
            : pendingSearchKeyword;

    pendingSearchKeyword =
        keyword;

    if (
        keyword.length >=
        SEARCH_MIN_LENGTH
    ) {

        searchDrugIndex(
            keyword
        );

    } else {

        showDrugSearchPrompt();

    }

}


/* ======================================================
   SEARCH LIGHTWEIGHT INDEX LOCALLY
====================================================== */

function searchDrugIndex(keyword) {

    const normalizedKeyword =
        String(
            keyword ||
            ""
        )
            .trim()
            .toLowerCase();

    if (
        normalizedKeyword.length <
        SEARCH_MIN_LENGTH
    ) {

        showDrugSearchPrompt();

        return;

    }

    const exactMatches = [];
    const startsWithMatches = [];
    const wordStartMatches = [];
    const containsMatches = [];

    for (
        let index = 0;
        index < DRUGS.length;
        index++
    ) {

        const drug =
            DRUGS[index];

        const drugName =
            String(
                drug.drugName ||
                ""
            )
                .trim()
                .toLowerCase();

        if (!drugName) {

            continue;

        }

        if (
            drugName ===
            normalizedKeyword
        ) {

            exactMatches.push(
                drug
            );

            continue;

        }

        if (
            drugName.startsWith(
                normalizedKeyword
            )
        ) {

            startsWithMatches.push(
                drug
            );

            continue;

        }

        const words =
            drugName.split(
                /[\s,+/()–—-]+/
            );

        const hasWordStart =
            words.some(function (word) {

                return word.startsWith(
                    normalizedKeyword
                );

            });

        if (hasWordStart) {

            wordStartMatches.push(
                drug
            );

            continue;

        }

        if (
            drugName.includes(
                normalizedKeyword
            )
        ) {

            containsMatches.push(
                drug
            );

        }

    }

    if (
        exactMatches.length >
        0
    ) {

        renderDrugSearchResults(
            exactMatches
        );

        return;

    }

    const results =
        startsWithMatches
            .concat(
                wordStartMatches
            )
            .concat(
                containsMatches
            )
            .slice(
                0,
                MAX_RESULTS
            );

    renderDrugSearchResults(
        results
    );

}


/* ======================================================
   RENDER SEARCH RESULTS
====================================================== */

function renderDrugSearchResults(results) {

    const container =
        document.getElementById(
            "drugList"
        );

    if (!container) {

        return;

    }

    if (
        !Array.isArray(results) ||
        results.length === 0
    ) {

        container.innerHTML = `

            <div style="
                text-align:center;
                color:#ffffff;
                font-size:34px;
                padding:70px 20px;
            ">

                No medication found.

            </div>

        `;

        return;

    }

    let html = "";

    results.forEach(function (drug) {

        const rowNumber =
            Number(
                drug.rowNumber
            );

        html += `

            <div class="drugCard"
                 role="button"
                 tabindex="0"
                 data-row-number="${rowNumber}">

                <div class="drugName">

                    ${escapeHtml(
                        drug.drugName ||
                        "Unnamed Drug"
                    )}

                </div>

                <div class="drugCategory">

                    ${escapeHtml(
                        drug.classification ||
                        "Classification not specified"
                    )}

                </div>

                <div class="drugRoute">

                    ${escapeHtml(
                        drug.route ||
                        "Route not specified"
                    )}

                </div>

            </div>

        `;

    });

    if (
        results.length ===
        MAX_RESULTS
    ) {

        html += `

            <div style="
                text-align:center;
                color:#9fdcff;
                font-size:28px;
                padding:20px;
                line-height:1.5;
            ">

                Showing first ${MAX_RESULTS} results.<br>

                Continue typing to narrow your search.

            </div>

        `;

    }

    container.innerHTML =
        html;

}


/* ======================================================
   OPEN DRUG FROM RESULT CARD
====================================================== */

document.addEventListener(
    "click",
    function (event) {

        const card =
            event.target.closest(
                ".drugCard"
            );

        if (!card) {

            return;

        }

        openDrug(
            Number(
                card.dataset.rowNumber
            )
        );

    }
);


document.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key !== "Enter" &&
            event.key !== " "
        ) {

            return;

        }

        const card =
            event.target.closest(
                ".drugCard"
            );

        if (!card) {

            return;

        }

        event.preventDefault();

        openDrug(
            Number(
                card.dataset.rowNumber
            )
        );

    }
);


/* ======================================================
   CROSS-REFERENCE EVENTS
====================================================== */

document.addEventListener(
    "click",
    function (event) {

        const card =
            event.target.closest(
                "#drugCrossReference"
            );

        if (!card) {

            return;

        }

        openCrossReferencedDrug(
            card
        );

    }
);


document.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key !== "Enter" &&
            event.key !== " "
        ) {

            return;

        }

        const card =
            event.target.closest(
                "#drugCrossReference"
            );

        if (!card) {

            return;

        }

        event.preventDefault();

        openCrossReferencedDrug(
            card
        );

    }
);


/* ======================================================
   DRUG DETAILS
====================================================== */

function openDrug(rowNumber) {

    const requestedRow =
        Number(rowNumber);

    const indexDrug =
        DRUGS.find(function(item) {

            return (
                Number(item.rowNumber) ===
                requestedRow
            );

        });

    if (!indexDrug) {

        console.error(
            "PHDU MedCore drug was not found:",
            requestedRow
        );

        return;

    }

    hideDrugCrossReference();

    const medicationPage =
        document.getElementById(
            "medicationDosesPage"
        );

    const detailsPage =
        document.getElementById(
            "drugDetailsPage"
        );

    if (medicationPage) {
        medicationPage.classList.add("hiddenMenu");
    }

    if (detailsPage) {
        detailsPage.classList.remove("hiddenMenu");
        detailsPage.scrollTop = 0;
    }

    setTextContent(
        "detailDrugName",
        indexDrug.drugName || "Unnamed Drug"
    );

    setTextContent(
        "detailClassification",
        indexDrug.classification || "-"
    );

    setTextContent(
        "detailRoute",
        indexDrug.route || "-"
    );

    setTextContent(
        "detailOriginalEntry",
        "Loading Clinical Dosing Guide..."
    );

    function displayDrugDetails(drug) {

        if (!drug) {

            setTextContent(
                "detailOriginalEntry",
                "-"
            );

            hideDrugCrossReference();
            return;

        }

        setTextContent(
            "detailDrugName",
            drug.drugName ||
            indexDrug.drugName ||
            "Unnamed Drug"
        );

        setTextContent(
            "detailClassification",
            drug.classification || "-"
        );

        setTextContent(
            "detailRoute",
            drug.route || "-"
        );

        renderClinicalDosingGuide(
            drug.originalEntry || "-",
            drug.originalEntryRuns || []
        );

        updateDrugCrossReference(
            drug.originalEntry || "",
            requestedRow
        );

    }

    /*
       Local-first retrieval. A verified local record can be
       displayed without any Google Apps Script request.
    */

    getMedCoreLocalDrugDetail(
        requestedRow,
        function(cachedDrug) {

            if (cachedDrug) {

                displayDrugDetails(cachedDrug);
                return;

            }

            /*
               Preserve the existing online fallback for a
               record not yet synchronized to this device.
            */

            google.script.run

                .withSuccessHandler(function(drug) {

                    if (!drug) {
                        displayDrugDetails(null);
                        return;
                    }

                    displayDrugDetails(drug);

                    saveMedCoreLocalSingleDrugDetail(
                        drug,
                        function(verified) {

                            if (!verified) {

                                console.warn(
                                    "PHDU MedCore displayed this medication online, but its local detail cache was not verified."
                                );

                            }

                        }
                    );

                })

                .withFailureHandler(function(error) {

                    console.error(
                        "PHDU MedCore drug details failed to load:",
                        error
                    );

                    hideDrugCrossReference();

                    const errorMessage =
                        error && error.message
                            ? error.message
                            : String(
                                error ||
                                "Unknown error"
                            );

                    setTextContent(
                        "detailOriginalEntry",
                        "Unable to load the Clinical Dosing Guide. This medication is not yet available in the offline cache.\n\n" +
                        errorMessage
                    );

                })

                .getMedCoreDrugDetails(
                    requestedRow
                );

        }
    );

}


/* ======================================================
   CROSS-REFERENCE NAME NORMALIZATION
====================================================== */

function normalizeCrossReferenceDrugName(value) {

    return String(
        value == null
            ? ""
            : value
    )
        .normalize("NFKC")
        .trim()
        .toLowerCase()

        /* Remove terminal punctuation. */

        .replace(
            /[.;:,]+$/g,
            ""
        )

        /* Normalize ampersand and the word "and". */

        .replace(
            /\s+and\s+/g,
            "+"
        )
        .replace(
            /\s*&\s*/g,
            "+"
        )

        /* Normalize slashes and combination dashes. */

        .replace(
            /\s*\/\s*/g,
            "+"
        )
        .replace(
            /\s*[‐-‒–—]\s*/g,
            "+"
        )

        /* Normalize plus signs. */

        .replace(
            /\s*\+\s*/g,
            "+"
        )

        /* Remove brackets that do not affect the name. */

        .replace(
            /[()[\]{}]/g,
            " "
        )

        /* Collapse remaining spaces. */

        .replace(
            /\s+/g,
            " "
        )
        .trim();

}


/* ======================================================
   NORMALIZED REFERENCE PARTS
====================================================== */

function getCrossReferenceParts(value) {

    return normalizeCrossReferenceDrugName(
        value
    )
        .split("+")
        .map(function (part) {

            return part.trim();

        })
        .filter(function (part) {

            return part !== "";

        });

}


/* ======================================================
   EXTRACT REFERENCED DRUG NAME
====================================================== */

function extractReferencedDrugName(text) {

    const source =
        String(
            text == null
                ? ""
                : text
        )
            .trim();

    if (!source) {

        return "";

    }

    const match =
        /^See\s+([^\r\n]+?)(?:[.;:])?(?:\r?\n|$)/i
            .exec(
                source
            );

    if (!match) {

        return "";

    }

    return String(
        match[1] ||
        ""
    )
        .replace(
            /[.;:,]+$/g,
            ""
        )
        .trim();

}


/* ======================================================
   FIND REFERENCED DRUG

   Matching order:
   1. Exact normalized name
   2. Exact combination components
   3. Same components in a different order
   4. Safe unique containment
   5. Safe unique all-component match
====================================================== */

function findReferencedDrug(
    referencedName,
    currentRowNumber
) {

    if (
        !Array.isArray(DRUGS) ||
        DRUGS.length === 0
    ) {

        return null;

    }

    const normalizedReference =
        normalizeCrossReferenceDrugName(
            referencedName
        );

    if (!normalizedReference) {

        return null;

    }

    const availableDrugs =
        DRUGS.filter(function (drug) {

            const rowNumber =
                Number(
                    drug &&
                    drug.rowNumber
                );

            return (
                Number.isInteger(rowNumber) &&
                rowNumber >= 2 &&
                rowNumber !==
                Number(currentRowNumber)
            );

        });


    /* ==================================================
       1. EXACT NORMALIZED NAME
    ================================================== */

    const exactMatch =
        availableDrugs.find(function (drug) {

            return (
                normalizeCrossReferenceDrugName(
                    drug.drugName ||
                    ""
                ) === normalizedReference
            );

        });

    if (exactMatch) {

        return exactMatch;

    }


    /* ==================================================
       2. EXACT COMPONENTS IN SAME ORDER
    ================================================== */

    const referenceParts =
        getCrossReferenceParts(
            referencedName
        );

    if (
        referenceParts.length >
        1
    ) {

        const sameOrderMatches =
            availableDrugs.filter(function (drug) {

                const drugParts =
                    getCrossReferenceParts(
                        drug.drugName ||
                        ""
                    );

                if (
                    drugParts.length !==
                    referenceParts.length
                ) {

                    return false;

                }

                return referenceParts.every(
                    function (part, index) {

                        return (
                            drugParts[index] ===
                            part
                        );

                    }
                );

            });

        if (
            sameOrderMatches.length ===
            1
        ) {

            return sameOrderMatches[0];

        }


        /* ==============================================
           3. SAME COMPONENTS IN DIFFERENT ORDER
        ============================================== */

        const sortedReferenceParts =
            referenceParts
                .slice()
                .sort()
                .join("|");

        const componentMatches =
            availableDrugs.filter(function (drug) {

                const drugParts =
                    getCrossReferenceParts(
                        drug.drugName ||
                        ""
                    );

                if (
                    drugParts.length !==
                    referenceParts.length
                ) {

                    return false;

                }

                return (
                    drugParts
                        .slice()
                        .sort()
                        .join("|") ===
                    sortedReferenceParts
                );

            });

        if (
            componentMatches.length ===
            1
        ) {

            return componentMatches[0];

        }

    }


    /* ==================================================
       4. SAFE UNIQUE CONTAINMENT MATCH
    ================================================== */

    const containmentMatches =
        availableDrugs.filter(function (drug) {

            const normalizedDrugName =
                normalizeCrossReferenceDrugName(
                    drug.drugName ||
                    ""
                );

            if (
                !normalizedDrugName
            ) {

                return false;

            }

            return (
                normalizedDrugName.includes(
                    normalizedReference
                ) ||
                normalizedReference.includes(
                    normalizedDrugName
                )
            );

        });

    if (
        containmentMatches.length ===
        1
    ) {

        return containmentMatches[0];

    }


    /* ==================================================
       5. SAFE ALL-COMPONENT MATCH
    ================================================== */

    if (
        referenceParts.length >
        1
    ) {

        const allComponentMatches =
            availableDrugs.filter(function (drug) {

                const normalizedDrugName =
                    normalizeCrossReferenceDrugName(
                        drug.drugName ||
                        ""
                    );

                return referenceParts.every(
                    function (part) {

                        return (
                            normalizedDrugName.includes(
                                part
                            )
                        );

                    }
                );

            });

        if (
            allComponentMatches.length ===
            1
        ) {

            return allComponentMatches[0];

        }

    }

    return null;

}


/* ======================================================
   UPDATE CROSS-REFERENCE CARD
====================================================== */

function updateDrugCrossReference(
    originalEntry,
    currentRowNumber
) {

    hideDrugCrossReference();

    const referencedName =
        extractReferencedDrugName(
            originalEntry
        );

    if (!referencedName) {

        return;

    }

    const referencedDrug =
        findReferencedDrug(
            referencedName,
            currentRowNumber
        );

    if (!referencedDrug) {

        console.warn(
            "PHDU MedCore referenced medication was not found:",
            referencedName
        );

        return;

    }

    const rowNumber =
        Number(
            referencedDrug.rowNumber
        );

    if (
        !Number.isInteger(rowNumber) ||
        rowNumber < 2
    ) {

        return;

    }

    const card =
        document.getElementById(
            "drugCrossReference"
        );

    const drugNameElement =
        document.getElementById(
            "crossReferenceDrugName"
        );

    if (
        !card ||
        !drugNameElement
    ) {

        console.warn(
            "PHDU MedCore cross-reference HTML elements were not found."
        );

        return;

    }

    const displayedName =
        String(
            referencedDrug.drugName ||
            referencedName
        ).trim();

    drugNameElement.textContent =
        displayedName;

    card.dataset.rowNumber =
        String(
            rowNumber
        );

    card.classList.remove(
        "hiddenCrossReference"
    );

    card.setAttribute(
        "aria-hidden",
        "false"
    );

    card.setAttribute(
        "aria-label",
        "Open referenced medication " +
        displayedName
    );

}


/* ======================================================
   HIDE CROSS-REFERENCE CARD
====================================================== */

function hideDrugCrossReference() {

    const card =
        document.getElementById(
            "drugCrossReference"
        );

    const drugNameElement =
        document.getElementById(
            "crossReferenceDrugName"
        );

    if (card) {

        card.classList.add(
            "hiddenCrossReference"
        );

        card.setAttribute(
            "aria-hidden",
            "true"
        );

        card.removeAttribute(
            "data-row-number"
        );

    }

    if (drugNameElement) {

        drugNameElement.textContent =
            "Medication Name";

    }

}


/* ======================================================
   OPEN CROSS-REFERENCED DRUG
====================================================== */

function openCrossReferencedDrug(card) {

    const targetCard =
        card ||
        document.getElementById(
            "drugCrossReference"
        );

    if (!targetCard) {

        return;

    }

    const rowNumber =
        Number(
            targetCard.dataset.rowNumber
        );

    if (
        !Number.isInteger(rowNumber) ||
        rowNumber < 2
    ) {

        console.warn(
            "PHDU MedCore cross-reference row number is invalid."
        );

        return;

    }

    if (navigator.vibrate) {

        navigator.vibrate(
            20
        );

    }

    openDrug(
        rowNumber
    );

}


/* ======================================================
   PARENTHESIS DEPTH
====================================================== */

function getParenthesisDepthAtPosition(
    text,
    position
) {

    const source =
        String(
            text == null
                ? ""
                : text
        );

    const safePosition =
        Math.max(
            0,
            Math.min(
                source.length,
                Number(position) || 0
            )
        );

    let depth = 0;

    for (
        let index = 0;
        index < safePosition;
        index++
    ) {

        const character =
            source.charAt(
                index
            );

        if (
            character ===
            "("
        ) {

            depth++;

        } else if (
            character === ")" &&
            depth > 0
        ) {

            depth--;

        }

    }

    return depth;

}


/* ======================================================
   CHECK WHETHER POSITION IS INSIDE PARENTHESES
====================================================== */

function isInsideParentheses(
    text,
    position
) {

    return (
        getParenthesisDepthAtPosition(
            text,
            position
        ) > 0
    );

}


/* ======================================================
   GET FIRST INLINE NON-SPACE POSITION
====================================================== */

function getNextVisibleInlinePosition(
    text,
    position
) {

    const source =
        String(
            text == null
                ? ""
                : text
        );

    let index =
        Math.max(
            0,
            Number(position) || 0
        );

    while (
        index < source.length &&
        (
            source.charAt(index) === " " ||
            source.charAt(index) === "\t"
        )
    ) {

        index++;

    }

    return index;

}


/* ======================================================
   CHECK WHETHER MATCH IS A TREATMENT DURATION
====================================================== */

function isTreatmentDurationGroup(
    source,
    matchIndex,
    matchedText
) {

    const text =
        String(
            source == null
                ? ""
                : source
        );

    const groupText =
        String(
            matchedText == null
                ? ""
                : matchedText
        );

    if (
        /\bkg\b/i.test(
            groupText
        )
    ) {

        return false;

    }

    const before =
        text.substring(
            Math.max(
                0,
                Number(matchIndex) - 100
            ),
            Number(matchIndex)
        );

    const trimmedBefore =
        before.replace(
            /\s+$/g,
            ""
        );

    if (
        /(?:\bin|\bfor|\bover|\bduring|\bwithin|\bafter|\bbefore|\bthen|\bevery|\bcontinue|\bcontinued|\bcontinues|\bgiven\s+for|\badministered\s+for|\btreat\s+for|\btreatment\s+for)\s*$/i
            .test(
                trimmedBefore
            )
    ) {

        return true;

    }

    if (
        /(?:increase|increased|adjust|adjusted|titrate|titrated|review|reviewed|reduce|reduced|decrease|decreased)\s+every\s*$/i
            .test(
                trimmedBefore
            )
    ) {

        return true;

    }

    if (
        /every\s+\d+(?:\.\d+)?\s*(?:hours?|hrs?|days?|weeks?)\s*$/i
            .test(
                trimmedBefore
            )
    ) {

        return true;

    }

    if (
        /\d+(?:\.\d+)?\s*(?:hourly|daily|weekly)\s*$/i
            .test(
                trimmedBefore
            )
    ) {

        return true;

    }

    if (
        /\b\d+(?:\.\d+)?\s*(?:H|hr|hrs)\s*$/i
            .test(
                trimmedBefore
            )
    ) {

        return true;

    }

    if (
        /(?:treatment|course|duration|therapy|prophylaxis)\b[^.;:\n]{0,40}[-–:]?\s*$/i
            .test(
                trimmedBefore
            )
    ) {

        return true;

    }

    if (
        !/^\s*(?:<|>|≤|≥)/.test(
            groupText
        ) &&
        /\b(?:days?|weeks?)\b/i.test(
            groupText
        )
    ) {

        const characterBefore =
            text.charAt(
                Math.max(
                    0,
                    Number(matchIndex) - 1
                )
            );

        if (
            characterBefore !== "\n"
        ) {

            return true;

        }

    }

    return false;

}


/* ======================================================
   REGISTER VISUAL BREAK
====================================================== */

function registerClinicalVisualBreak(
    breakMap,
    source,
    position,
    level,
    allowInsideParentheses
) {

    if (
        !(breakMap instanceof Map)
    ) {

        return;

    }

    const safePosition =
        Number(
            position
        );

    if (
        !Number.isInteger(
            safePosition
        ) ||
        safePosition <= 0 ||
        safePosition >= source.length
    ) {

        return;

    }

    if (
        allowInsideParentheses !== true &&
        isInsideParentheses(
            source,
            safePosition
        )
    ) {

        return;

    }

    const precedingCharacter =
        source.charAt(
            safePosition - 1
        );

    if (
        precedingCharacter === ">" ||
        precedingCharacter === "<" ||
        precedingCharacter === "≥" ||
        precedingCharacter === "≤"
    ) {

        return;

    }

    const normalizedLevel =
        Number(level) >= 2
            ? 2
            : 1;

    const existingLevel =
        breakMap.get(
            safePosition
        ) || 0;

    if (
        normalizedLevel >
        existingLevel
    ) {

        breakMap.set(
            safePosition,
            normalizedLevel
        );

    }

}


/* ======================================================
   FIND CLINICAL VISUAL BREAKS
====================================================== */

function findClinicalVisualBreaks(text) {

    const source =
        String(
            text == null
                ? ""
                : text
        );

    const breaks =
        new Map();

    if (!source) {

        return breaks;

    }


    /* ==================================================
       MAJOR CLINICAL SECTIONS
    ================================================== */

    const majorSectionRegex =
        /\b(?:Adult|Pediatric|Paediatric|Neonate|Neonatal|Child|Children|Treatment|Treatment dose|Prophylaxis|Post-exposure prophylaxis|Pre-exposure prophylaxis|Status|Haemodialysis|Hemodialysis|Indications|Target anti-Xa|Anti-Xa|Cardiac arrest|Anaphylaxis|Asthma|Malaria|Ventilator circuit|Septic shock|Shock|Resuscitation|Sedation|Analgesia|Pulseless VF or VT|ICU|PICU|NICU|Age|Note|Notes|Warning|Caution|Papilloma|Parathyroid carcinoma)\s*:/gi;

    let match;

    while (
        (
            match =
                majorSectionRegex.exec(
                    source
                )
        ) !== null
    ) {

        registerClinicalVisualBreak(
            breaks,
            source,
            match.index,
            2,
            false
        );

        if (!match[0].length) {

            majorSectionRegex.lastIndex++;

        }

    }


    /* ==================================================
       ROUTE AND DOSE SUBSECTIONS
    ================================================== */

    const routeSectionRegex =
        /\b(?:Intravenous infusion|Intravenous|Oral|Intramuscular|Subcutaneous|Nebulised|Nebulized|Rectal|Topical|Inhalation|Infusion|Loading dose|Maintenance dose|Maintenance)\s*:/gi;

    while (
        (
            match =
                routeSectionRegex.exec(
                    source
                )
        ) !== null
    ) {

        registerClinicalVisualBreak(
            breaks,
            source,
            match.index,
            1,
            false
        );

        if (!match[0].length) {

            routeSectionRegex.lastIndex++;

        }

    }


    /* ==================================================
       AGE AND WEIGHT GROUPS
    ================================================== */

    const ageWeightGroupRegex =
        /(?:<|>|≤|≥)?\s*\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?\s*(?:days?|weeks?|months?|years?|kg)\b(?:\s*[-–]\s*\d+(?:\.\d+)?\s*(?:days?|weeks?|months?|years?))?/gi;

    while (
        (
            match =
                ageWeightGroupRegex.exec(
                    source
                )
        ) !== null
    ) {

        const precedingText =
            source.substring(
                Math.max(
                    0,
                    match.index - 14
                ),
                match.index
            );

        if (
            /(?:mg|mcg|μg|g|mL|ml|IU|units?)\s*\/\s*$/i
                .test(
                    precedingText
                )
        ) {

            continue;

        }

        if (
            isTreatmentDurationGroup(
                source,
                match.index,
                match[0]
            )
        ) {

            continue;

        }

        registerClinicalVisualBreak(
            breaks,
            source,
            match.index,
            1,
            false
        );

        if (!match[0].length) {

            ageWeightGroupRegex.lastIndex++;

        }

    }


    /* ==================================================
       SELECTIVE SEMICOLON SPACING
    ================================================== */

    const semicolonSectionRegex =
        /;\s*(?=(?:Adult|Pediatric|Paediatric|Neonate|Neonatal|Child|Children|Treatment|Prophylaxis|Status|Haemodialysis|Hemodialysis|Indications|Cardiac arrest|Anaphylaxis|Asthma|Malaria|Ventilator circuit|Pulseless VF or VT|ICU|PICU|NICU|Age|Note|Notes|Warning|Caution|Papilloma|Parathyroid carcinoma|Intravenous infusion|Intravenous|Oral|Intramuscular|Subcutaneous|Nebulised|Nebulized|Rectal|Topical|Inhalation|Infusion|Loading dose|Maintenance dose|Maintenance|Increase|Then|Repeat|Followed by|Continue|Reduce|Decrease|Higher doses|Consider|Taper|Monitor|Give|Administer|Infuse|Inject|Apply|Use)\b)/gi;

    while (
        (
            match =
                semicolonSectionRegex.exec(
                    source
                )
        ) !== null
    ) {

        const nextPosition =
            getNextVisibleInlinePosition(
                source,
                match.index +
                match[0].length
            );

        registerClinicalVisualBreak(
            breaks,
            source,
            nextPosition,
            1,
            true
        );

        if (!match[0].length) {

            semicolonSectionRegex.lastIndex++;

        }

    }


    /* ==================================================
       IMPORTANT INSTRUCTION CHANGES
    ================================================== */

    const instructionRegex =
        /(^|[.]\s+|\n\s*)(Increase\b|Then\b|Repeat\b|Followed by\b|Continue\b|Reduce\b|Decrease\b|Higher doses\b|Target anti-Xa\b|Into arterial line\b|At start of\b|Give\b|Administer\b|Monitor\b|Wait\b|Consider\b|Use\b|Apply\b|Infuse\b|Inject\b|Taper\b)/gim;

    while (
        (
            match =
                instructionRegex.exec(
                    source
                )
        ) !== null
    ) {

        const instructionText =
            match[2] ||
            "";

        const position =
            match.index +
            Math.max(
                0,
                match[0].lastIndexOf(
                    instructionText
                )
            );

        registerClinicalVisualBreak(
            breaks,
            source,
            position,
            1,
            false
        );

        if (!match[0].length) {

            instructionRegex.lastIndex++;

        }

    }


    /* ==================================================
       COMMA BEFORE TRUE AGE/WEIGHT GROUP
    ================================================== */

    const commaGroupRegex =
        /,\s*(?=(?:<|>|≤|≥)?\s*\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?\s*(?:days?|weeks?|months?|years?|kg)\b)/gi;

    while (
        (
            match =
                commaGroupRegex.exec(
                    source
                )
        ) !== null
    ) {

        const nextPosition =
            getNextVisibleInlinePosition(
                source,
                match.index +
                match[0].length
            );

        const groupMatch =
            source.substring(
                nextPosition
            ).match(
                /^(?:<|>|≤|≥)?\s*\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?\s*(?:days?|weeks?|months?|years?|kg)\b/i
            );

        if (
            groupMatch &&
            isTreatmentDurationGroup(
                source,
                nextPosition,
                groupMatch[0]
            )
        ) {

            continue;

        }

        registerClinicalVisualBreak(
            breaks,
            source,
            nextPosition,
            1,
            false
        );

        if (!match[0].length) {

            commaGroupRegex.lastIndex++;

        }

    }


    /* ==================================================
       PERIOD BEFORE MAJOR OR ROUTE SECTION
    ================================================== */

    const periodSectionRegex =
        /\.\s*(?=(?:Adult|Pediatric|Paediatric|Neonate|Neonatal|Child|Children|Treatment|Prophylaxis|Status|Haemodialysis|Hemodialysis|Indications|Target anti-Xa|Anti-Xa|Cardiac arrest|Anaphylaxis|Asthma|Malaria|Ventilator circuit|Septic shock|Shock|Resuscitation|Sedation|Analgesia|Pulseless VF or VT|ICU|PICU|NICU|Age|Note|Notes|Warning|Caution|Papilloma|Parathyroid carcinoma|Intravenous infusion|Intravenous|Oral|Intramuscular|Subcutaneous|Nebulised|Nebulized|Rectal|Topical|Inhalation|Infusion|Loading dose|Maintenance dose|Maintenance)\s*:)/gi;

    while (
        (
            match =
                periodSectionRegex.exec(
                    source
                )
        ) !== null
    ) {

        const nextPosition =
            getNextVisibleInlinePosition(
                source,
                match.index +
                match[0].length
            );

        registerClinicalVisualBreak(
            breaks,
            source,
            nextPosition,
            1,
            false
        );

        if (!match[0].length) {

            periodSectionRegex.lastIndex++;

        }

    }


    /* ==================================================
       PERIOD BEFORE TRUE AGE/WEIGHT GROUP
    ================================================== */

    const periodAgeWeightRegex =
        /\.\s*(?=(?:<|>|≤|≥)?\s*\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?\s*(?:days?|weeks?|months?|years?|kg)\b)/gi;

    while (
        (
            match =
                periodAgeWeightRegex.exec(
                    source
                )
        ) !== null
    ) {

        const nextPosition =
            getNextVisibleInlinePosition(
                source,
                match.index +
                match[0].length
            );

        const groupMatch =
            source.substring(
                nextPosition
            ).match(
                /^(?:<|>|≤|≥)?\s*\d+(?:\.\d+)?(?:\s*[-–]\s*\d+(?:\.\d+)?)?\s*(?:days?|weeks?|months?|years?|kg)\b/i
            );

        if (
            groupMatch &&
            isTreatmentDurationGroup(
                source,
                nextPosition,
                groupMatch[0]
            )
        ) {

            continue;

        }

        registerClinicalVisualBreak(
            breaks,
            source,
            nextPosition,
            1,
            false
        );

        if (!match[0].length) {

            periodAgeWeightRegex.lastIndex++;

        }

    }

    return breaks;

}


/* ======================================================
   APPEND VISUAL BREAK
====================================================== */

function appendClinicalVisualBreak(
    element,
    source,
    position,
    level
) {

    if (
        !element ||
        position <= 0
    ) {

        return;

    }

    const normalizedLevel =
        Number(level) >= 2
            ? 2
            : 1;

    const precedingText =
        source.substring(
            Math.max(
                0,
                position - 10
            ),
            position
        );

    if (
        /\n[ \t]*\n[ \t]*$/.test(
            precedingText
        )
    ) {

        return;

    }

    if (
        /\n[ \t]*$/.test(
            precedingText
        )
    ) {

        if (
            normalizedLevel ===
            2
        ) {

            element.appendChild(
                document.createElement(
                    "br"
                )
            );

        }

        return;

    }

    element.appendChild(
        document.createElement(
            "br"
        )
    );

    if (
        normalizedLevel ===
        2
    ) {

        element.appendChild(
            document.createElement(
                "br"
            )
        );

    }

}



/* ======================================================
   DYNAMIC CLINICAL COLOR SETTINGS
====================================================== */

const MEDCORE_CLINICAL_COLORS = {

    adult:
        "#005BBB",

    pediatric:
        "#008A3B",

    alert:
        "#D00000"

};




/* ======================================================

   ADULT HIGHLIGHT RANGES

   Rules:

   1. The standalone word "Adult" is always blue.

   2. If Adult is followed by a non-weight-based dose,

      highlight Adult + dose in blue.

      Example:

      Adult 500mg

      Adult 0.5-1 mg

   3. If the dose contains /kg, highlight only Adult.

      The weight-based dose remains black.

      Example:

      Adult 50mg/kg

      Adult 10mcg/kg/min

      Adult NOT/kg 500mg/kg

   4. If Adult starts a long description, highlight only

      the word Adult.

====================================================== */

function findAdultDoseRanges(text) {

    const source =

        String(

            text == null

                ? ""

                : text

        );

    const ranges = [];

    if (!source) {

        return ranges;

    }

    const adultRegex =

        /\bAdult\b/gi;

    let match;

    while (

        (

            match =

                adultRegex.exec(

                    source

                )

        ) !== null

    ) {

        const start =

            match.index;

        const adultWordEnd =

            start +

            match[0].length;

        let end =

            adultWordEnd;

        const afterAdult =

            source.substring(

                adultWordEnd

            );

        /*

           Matches an immediate dose after Adult.

           Examples:

           Adult 500mg

           Adult 0.5-1 mg

           Adult 50mg/kg

           Adult 10mcg/kg/min

           Adult NOT/kg 500mg/kg

        */

        const immediateDoseMatch =

            afterAdult.match(

                /^\s*(?:[:,]\s*)?(?:(?:NOT\s*\/\s*kg)\s*:?\s*)?(?:\d+(?:\.\d+)?|\.\d+)(?:\s*[-–—]\s*(?:\d+(?:\.\d+)?|\.\d+))?\s*(?:micrograms?|mcg|μg|milligrams?|mg|grams?|gram|g|kilograms?|kg|milliliters?|millilitres?|mL|ml|liters?|litres?|L|mmol|mEq|meq|IU|iu|units?)(?:\s*\/\s*(?:kg|day|dose|hour|hr|min|minute|week|wk|m2|m²))?(?:\s*\/\s*(?:min|minute|hr|hour|day))?/i

            );

        if (

            immediateDoseMatch &&

            immediateDoseMatch[0]

        ) {

            const matchedDoseText =

                immediateDoseMatch[0];

            /*

               Any Adult statement containing /kg keeps

               only the word Adult blue.

            */

            const containsWeightBasedDose =

                /\/\s*kg\b/i.test(

                    matchedDoseText

                );

            if (

                !containsWeightBasedDose

            ) {

                end +=

                    matchedDoseText.length;

                while (

                    end > adultWordEnd &&

                    (

                        source.charAt(

                            end - 1

                        ) === " " ||

                        source.charAt(

                            end - 1

                        ) === "\t"

                    )

                ) {

                    end--;

                }

            }

        }

        ranges.push({

            start:

                start,

            end:

                end

        });

        if (!match[0].length) {

            adultRegex.lastIndex++;

        }

    }

    return ranges;

}



/* ======================================================
   PEDIATRIC WORD HIGHLIGHT RANGES

   Rules

   Pediatric
   Paediatric
   Neonate
   Neonatal

   Only the WORD is highlighted green.

   The dose remains black.

====================================================== */

function findPediatricWordRanges(text) {

    const source =
        String(
            text == null
                ? ""
                : text
        );

    const ranges = [];

    if (!source) {

        return ranges;

    }

    const regex =
        /\b(?:Pediatric|Paediatric|Neonate|Neonatal)\b/gi;

    let match;

    while (
        (
            match =
                regex.exec(
                    source
                )
        ) !== null
    ) {

        ranges.push({

            start:
                match.index,

            end:
                match.index +
                match[0].length

        });

        if (!match[0].length) {

            regex.lastIndex++;

        }

    }

    return ranges;

}




/* ======================================================
   ADULT STATEMENT CONTEXT

   Purpose:

   Weight-based doses normally become green.

   EXCEPTION:
   If a weight-based dose belongs to an Adult statement,
   it remains black.

   Examples:

   Adult 50mg/kg
   -> Adult = blue
   -> 50mg/kg = black

   Adult NOT/kg 500mg/kg
   -> Adult = blue
   -> 500mg/kg = black

   2mg/kg (adult 80mg)
   -> 2mg/kg = green
   -> adult 80mg = blue
====================================================== */

function findAdultStatementRanges(text) {

    const source =
        String(
            text == null
                ? ""
                : text
        );

    const ranges = [];

    if (!source) {

        return ranges;

    }

    const adultRegex =
        /\bAdult\b/gi;

    let match;

    while (
        (
            match =
                adultRegex.exec(
                    source
                )
        ) !== null
    ) {

        const start =
            match.index;

        let end =
            source.length;

        /*
           End the Adult context at the first true
           statement separator.
        */

        const possibleEnds = [

            source.indexOf(
                ";",
                start
            ),

            source.indexOf(
                ".",
                start
            ),

            source.indexOf(
                "\n",
                start
            )

        ].filter(function (position) {

            return (
                position !== -1 &&
                position > start
            );

        });

        if (
            possibleEnds.length > 0
        ) {

            end =
                Math.min.apply(
                    null,
                    possibleEnds
                );

        }

        /*
           Do not allow one Adult statement to swallow
           a later Pediatric / Paediatric / Neonate
           section.
        */

        const afterAdult =
            source.substring(
                start +
                match[0].length,
                end
            );

        const nextAgeGroup =
            /\b(?:Pediatric|Paediatric|Neonate|Neonatal|Adult)\b/i
                .exec(
                    afterAdult
                );

        if (nextAgeGroup) {

            end =
                start +
                match[0].length +
                nextAgeGroup.index;

        }

        ranges.push({

            start:
                start,

            end:
                end

        });

        if (!match[0].length) {

            adultRegex.lastIndex++;

        }

    }

    return ranges;

}




/* ======================================================
   WEIGHT-BASED DOSE RANGES

   Examples:

   5mg/kg
   5mcg/kg/hr
   5mcg/kg/min
   0.1mL/kg
   20units/kg/day
   1-2mmol/kg

   These become green only when they are not inside an
   Adult, Pediatric, Paediatric, Neonate, or Neonatal
   statement.
====================================================== */

function findWeightBasedDoseRanges(
    text,
    adultStatementRanges
) {


    const source =
        String(
            text == null
                ? ""
                : text
        );

    const ranges = [];

    if (!source) {

        return ranges;

    }

    const doseRegex =
        /(?:\d+(?:\.\d+)?|\.\d+)(?:\s*[-–—]\s*(?:\d+(?:\.\d+)?|\.\d+))?\s*(?:micrograms?|mcg|μg|milligrams?|mg|grams?|gram|g|milliliters?|millilitres?|mL|ml|mmol|mEq|meq|IU|iu|units?)\s*\/\s*kg\b(?:\s*\/\s*(?:min|minute|minutes|hr|hour|hours|day|dose|week|wk))?/gi;

    let match;

    while (
        (
            match =
                doseRegex.exec(
                    source
                )
        ) !== null
    ) {

        const start =
            match.index;

const insideAdultStatement =
    isPositionInsideClinicalRanges(
        start,
        adultStatementRanges
    );



if (
    !insideAdultStatement
) {




            ranges.push({

                start:
                    start,

                end:
                    start +
                    match[0].length

            });

        }

        if (!match[0].length) {

            doseRegex.lastIndex++;

        }

    }

    return ranges;

}



/* ======================================================
   CHECK WHETHER A POSITION IS INSIDE A RANGE
====================================================== */

function isPositionInsideClinicalRanges(
    position,
    ranges
) {

    if (
        !Array.isArray(
            ranges
        )
    ) {

        return false;

    }

    return ranges.some(
        function (range) {

            return (
                position >=
                Number(
                    range.start
                ) &&
                position <
                Number(
                    range.end
                )
            );

        }
    );

}


/* ======================================================
   MAXIMUM-DOSE ALERT RANGES

   PHDU MedCore rule:

   Max / maximum statements are clinical alerts.

   Highlight the alert phrase in RED + BOLD.

   Examples:
   max 10mg
   maximum 10mg
   max dose 10mg
   maximum dose 10mg/kg
   maximum daily dose 40mg
   max: 5mcg/kg/min
====================================================== */

function findMaximumDoseRanges(text) {

    const source =
        String(
            text == null
                ? ""
                : text
        );

    const ranges = [];

    if (!source) {

        return ranges;

    }

    const regex =
        /\b(?:max|maximum)\b(?:\s+(?:total|daily|single|individual|recommended|dose|dosage|per\s+dose)){0,5}\s*:?\s*(?:\d+(?:\.\d+)?|\.\d+)(?:\s*[-–—]\s*(?:\d+(?:\.\d+)?|\.\d+))?\s*(?:micrograms?|mcg|μg|milligrams?|mg|grams?|gram|g|kilograms?|kg|milliliters?|millilitres?|mL|ml|liters?|litres?|L|mmol|mEq|meq|IU|iu|units?)(?:\s*\/\s*(?:kg|day|dose|hour|hr|min|minute|minutes|week|wk|m2|m²))?(?:\s*\/\s*(?:min|minute|minutes|hr|hour|hours|day))?/gi;

    let match;

    while (
        (
            match =
                regex.exec(
                    source
                )
        ) !== null
    ) {

        ranges.push({

            start:
                match.index,

            end:
                match.index +
                match[0].length

        });

        if (!match[0].length) {

            regex.lastIndex++;

        }

    }

    return ranges;

}



/* ======================================================
   CLINICAL ALERT WORD RANGES

   Highlight alert words in RED + BOLD.

   Only the alert wording itself is highlighted.
   The remaining sentence stays black.

====================================================== */

function findClinicalAlertWordRanges(text) {

    const source =
        String(
            text == null
                ? ""
                : text
        );

    const ranges = [];

    if (!source) {

        return ranges;

    }

    const regex =
        /\b(?:avoid|avoided|warning|warnings|caution|contraindicated|contraindication|never|fatal|toxic|toxicity|overdose|do\s+not|do\s+NOT|not\s+recommended)\b/gi;

    let match;

    while (
        (
            match =
                regex.exec(
                    source
                )
        ) !== null
    ) {

        ranges.push({

            start:
                match.index,

            end:
                match.index +
                match[0].length

        });

        if (!match[0].length) {

            regex.lastIndex++;

        }

    }

    return ranges;

}




/* ======================================================
   RENDER CLINICAL DOSING GUIDE
====================================================== */

function renderClinicalDosingGuide(
    text,
    styleRuns
) {

    const element =
        document.getElementById(
            "detailOriginalEntry"
        );

    if (!element) {

        console.warn(
            "PHDU MedCore element was not found:",
            "detailOriginalEntry"
        );

        return;

    }

    const source =
        String(
            text == null
                ? ""
                : text
        );

    element.replaceChildren();

    if (!source) {

        element.textContent =
            "-";

        return;

    }

    const normalizedRuns =
        Array.isArray(styleRuns)
            ? styleRuns
                .map(function (run) {

                    return {

                        start:
                            Math.max(
                                0,
                                Number(
                                    run.start
                                ) || 0
                            ),

                        end:
                            Math.min(
                                source.length,
                                Number(
                                    run.end
                                ) || 0
                            ),

                        color:
                            typeof run.color ===
                            "string"
                                ? run.color
                                : "",

                        bold:
                            run.bold === true,

                        italic:
                            run.italic === true,

                        underline:
                            run.underline === true

                    };

                })
                .filter(function (run) {

                    return (
                        run.end >
                        run.start
                    );

                })
            : [];

const adultDoseRanges =
    findAdultDoseRanges(
        source
    );


const pediatricWordRanges =
    findPediatricWordRanges(
        source
    );


const adultStatementRanges =
    findAdultStatementRanges(
        source
    );

const weightBasedDoseRanges =
    findWeightBasedDoseRanges(
        source,
        adultStatementRanges
    );




    const maximumDoseRanges =
        findMaximumDoseRanges(
            source
        );


const clinicalAlertWordRanges =
    findClinicalAlertWordRanges(
        source
    );


    const visualBreaks =
        findClinicalVisualBreaks(
            source
        );

    const boundaries =
        new Set([
            0,
            source.length
        ]);

    normalizedRuns.forEach(function (run) {

        boundaries.add(
            run.start
        );

        boundaries.add(
            run.end
        );

    });

    adultDoseRanges.forEach(function (range) {

    boundaries.add(
        range.start
    );

    boundaries.add(
        range.end
    );

});


pediatricWordRanges.forEach(function (range) {

    boundaries.add(
        range.start
    );

    boundaries.add(
        range.end
    );

});

weightBasedDoseRanges.forEach(function (range) {

    boundaries.add(
        range.start
    );

    boundaries.add(
        range.end
    );

});

maximumDoseRanges.forEach(function (range) {

    boundaries.add(
        range.start
    );

    boundaries.add(
        range.end
    );

});

clinicalAlertWordRanges.forEach(function (range) {

    boundaries.add(
        range.start
    );

    boundaries.add(
        range.end
    );

});


    visualBreaks.forEach(function (
        level,
        position
    ) {

        boundaries.add(
            position
        );

    });

    const orderedBoundaries =
        Array.from(
            boundaries
        )
            .filter(function (position) {

                return (
                    position >= 0 &&
                    position <= source.length
                );

            })
            .sort(function (a, b) {

                return a - b;

            });

    for (
        let index = 0;
        index <
        orderedBoundaries.length - 1;
        index++
    ) {

        const start =
            orderedBoundaries[index];

        const end =
            orderedBoundaries[
                index + 1
            ];

        if (
            end <= start
        ) {

            continue;

        }

        if (
            visualBreaks.has(
                start
            )
        ) {

            appendClinicalVisualBreak(
                element,
                source,
                start,
                visualBreaks.get(
                    start
                )
            );

        }

        const segmentText =
            source.substring(
                start,
                end
            );

        const existingStyle =
            normalizedRuns.find(function (run) {

                return (
                    start >= run.start &&
                    start < run.end
                );

            }) || null;


const isAdultDose =
    isPositionInsideClinicalRanges(
        start,
        adultDoseRanges
    );

const isPediatricWord =
    isPositionInsideClinicalRanges(
        start,
        pediatricWordRanges
    );

    const isWeightBasedDose =
    isPositionInsideClinicalRanges(
        start,
        weightBasedDoseRanges
    );




        const isMaximumDose =
            maximumDoseRanges.some(function (range) {

                return (
                    start >= range.start &&
                    start < range.end
                );

            });

            const isClinicalAlert =
    isPositionInsideClinicalRanges(
        start,
        clinicalAlertWordRanges
    );

if (
    !existingStyle &&
    !isAdultDose &&
    !isPediatricWord &&
    !isWeightBasedDose &&
    !isMaximumDose &&
    !isClinicalAlert
) {
            element.appendChild(
                document.createTextNode(
                    segmentText
                )
            );

            continue;

        }

        const span =
            document.createElement(
                "span"
            );

        span.textContent =
            segmentText;

/* ======================================================
   PRESERVE ONLY NON-COLOR RICH-TEXT STYLES

   Dynamic PHDU MedCore rules now control text color.

   Existing spreadsheet bold / italic / underline can
   remain, but spreadsheet foreground colors are ignored.
====================================================== */

if (existingStyle) {

    if (
        existingStyle.bold
    ) {

        span.style.fontWeight =
            "900";

    }

    if (
        existingStyle.italic
    ) {

        span.style.fontStyle =
            "italic";

    }

    if (
        existingStyle.underline
    ) {

        span.style.textDecoration =
            "underline";

    }

}




if (isAdultDose) {

    span.style.color =
        MEDCORE_CLINICAL_COLORS.adult;

    span.style.fontWeight =
        "900";

}

if (isPediatricWord) {

    span.style.color =
        MEDCORE_CLINICAL_COLORS.pediatric;

    span.style.fontWeight =
        "900";

}

if (isWeightBasedDose) {

    span.style.color =
        MEDCORE_CLINICAL_COLORS.pediatric;

    span.style.fontWeight =
        "900";

}


if (isClinicalAlert) {

    span.style.color =
        MEDCORE_CLINICAL_COLORS.alert;

    span.style.fontWeight =
        "900";

}


        if (isMaximumDose) {

            span.style.color =
                "#D00000";

            span.style.fontWeight =
                "900";

        }

        element.appendChild(
            span
        );

    }

}


/* ======================================================
   SAFE TEXT ASSIGNMENT
====================================================== */

function setTextContent(
    elementId,
    value
) {

    const element =
        document.getElementById(
            elementId
        );

    if (!element) {

        console.warn(
            "PHDU MedCore element was not found:",
            elementId
        );

        return;

    }

    element.textContent =
        String(
            value == null
                ? ""
                : value
        );

}


/* ======================================================
   CLOSE DETAILS
====================================================== */

function closeDrugDetails() {

    hideDrugCrossReference();

    const detailsPage =
        document.getElementById(
            "drugDetailsPage"
        );

    const medicationPage =
        document.getElementById(
            "medicationDosesPage"
        );

    if (detailsPage) {

        detailsPage.classList.add(
            "hiddenMenu"
        );

    }

    if (medicationPage) {

        medicationPage.classList.remove(
            "hiddenMenu"
        );

    }

}
