/* ======================================================
   PHDU MEDCORE
   CORE APPLICATION
   Version 2.0
====================================================== */

/* ======================================================
   APP STARTUP — PHASE 2 LOCAL-FIRST
====================================================== */

/*
   The splash background and logo already have their approved
   asset URLs in Index.html. They do not need a separate Apps
   Script request during startup.

   Removing this redundant getAssets() round trip allows the
   existing interface to initialize without waiting for the
   backend and prevents an offline startup alert.

   The existing loadAssets(data) function is retained below
   for compatibility with any existing manual use.
*/

console.log(
    "PHDU MedCore startup: using existing local HTML asset references."
);


/* ======================================================
   LOAD SPLASH ASSETS
====================================================== */

function loadAssets(data) {

    const background =
        document.getElementById(
            "background"
        );

    const logo =
        document.getElementById(
            "logoImage"
        );

    if (
        !background ||
        !logo
    ) {

        console.error(
            "PHDU MedCore splash elements were not found."
        );

        return;

    }

    if (!data) {

        console.error(
            "PHDU MedCore asset data was not received."
        );

        return;

    }

    if (
        data.background
    ) {

        background.style.backgroundImage =
            'url("' +
            data.background +
            '")';

    }

    if (
        data.logo
    ) {

        logo.src =
            data.logo;

    }

    /*
       Safari repaint
    */

    document.body.offsetHeight;

}


/* ======================================================
   SPLASH SCREEN
====================================================== */

let medCoreStarting =
    false;

function startMedCore() {

    if (
        medCoreStarting
    ) {

        return;

    }

    const logo =
        document.getElementById(
            "logoImage"
        );

    const splash =
        document.getElementById(
            "splashScreen"
        );

    const menu =
        document.getElementById(
            "moduleMenu"
        );

    if (
        !logo ||
        !splash ||
        !menu
    ) {

        console.error(
            "PHDU MedCore splash elements were not found."
        );

        return;

    }

    medCoreStarting =
        true;

    if (
        navigator.vibrate
    ) {

        navigator.vibrate(
            25
        );

    }

    logo.classList.add(
        "logoTapped"
    );

    setTimeout(
        function () {

            splash.style.display =
                "none";

            menu.classList.remove(
                "hiddenMenu"
            );

            medCoreStarting =
                false;

        },
        250
    );

}


/* ======================================================
   KEYBOARD ACCESS FOR LOGO
====================================================== */

document.addEventListener(
    "keydown",
    function (event) {

        if (
            event.target.id ===
            "logoImage" &&
            (
                event.key ===
                "Enter" ||
                event.key ===
                " "
            )
        ) {

            event.preventDefault();

            startMedCore();

        }

    }
);


/* ======================================================
   MODULE NAVIGATION
====================================================== */

function showPage(pageId) {

    const pages = [

        "moduleMenu",
        "medicationDosesPage",
        "drugDetailsPage"

    ];

    pages.forEach(
        function (id) {

            const page =
                document.getElementById(
                    id
                );

            if (
                page
            ) {

                page.classList.add(
                    "hiddenMenu"
                );

            }

        }
    );

    const target =
        document.getElementById(
            pageId
        );

    if (
        target
    ) {

        target.classList.remove(
            "hiddenMenu"
        );

    } else {

        console.error(
            "PHDU MedCore page was not found:",
            pageId
        );

    }

}


/* ======================================================
   MEDICATION DOSES
====================================================== */

function openMedicationDoses() {

    showPage(
        "medicationDosesPage"
    );

    const search =
        document.getElementById(
            "searchMedication"
        );

    if (
        search
    ) {

        search.value =
            "";

    }

    if (
        typeof loadMedicationList ===
        "function"
    ) {

        loadMedicationList();

    } else {

        console.error(
            "PHDU MedCore error: " +
            "loadMedicationList function was not found."
        );

    }

}


function closeMedicationDoses() {

    showPage(
        "moduleMenu"
    );

}


/* ======================================================
   DRUG DETAILS
====================================================== */

function openDrugDetails() {

    showPage(
        "drugDetailsPage"
    );

}


function closeDrugDetails() {

    closeTemporaryDrugEditor();

    showPage(
        "medicationDosesPage"
    );

}


/* ======================================================
   FUTURE MODULES
====================================================== */


function openIntubationMedications() {

    // Coming Soon

}


function openElectrolytes() {

    // Coming Soon

}


function openIVFPreparations() {

    // Coming Soon

}


function openInfusionCalculator() {

    // Coming Soon

}


/* ======================================================
   TEMPORARY DRUG EDITOR STATE

   The Drug Name remains locked.

   Editable fields:
   B — Classification
   C — Route
   D — Clinical Dosing Guide
====================================================== */

let currentMedCoreEditorRowNumber =
    null;

let currentMedCoreEditorDrug =
    null;

let medCoreDrugEditorSaving =
    false;


/* ======================================================
   TRACK THE CURRENT DRUG ROW

   DrugFunctions.html already provides openDrug(rowNumber).

   This wrapper preserves the existing openDrug function
   and records the row number needed by the editor.
====================================================== */

(function installMedCoreDrugEditorTracker() {

    if (
        typeof window.openDrug !==
        "function"
    ) {

        console.warn(
            "PHDU MedCore editor could not attach to openDrug()."
        );

        return;

    }

    const originalOpenDrug =
        window.openDrug;

    window.openDrug =
        function (rowNumber) {

            const requestedRow =
                Number(
                    rowNumber
                );

            if (
                Number.isInteger(
                    requestedRow
                ) &&
                requestedRow >= 2
            ) {

                currentMedCoreEditorRowNumber =
                    requestedRow;

                currentMedCoreEditorDrug =
                    null;

            }

            closeTemporaryDrugEditor();

            return originalOpenDrug.apply(
                this,
                arguments
            );

        };

})();


/* ======================================================
   OPEN TEMPORARY DRUG EDITOR
====================================================== */

function openTemporaryDrugEditor() {

    const rowNumber =
        Number(
            currentMedCoreEditorRowNumber
        );

    if (
        !Number.isInteger(
            rowNumber
        ) ||
        rowNumber < 2
    ) {

        alert(
            "Unable to identify the selected medication. " +
            "Please return to the medication list and open it again."
        );

        return;

    }

    const overlay =
        document.getElementById(
            "drugEditorOverlay"
        );

    const status =
        document.getElementById(
            "drugEditorStatus"
        );

    const saveButton =
        document.getElementById(
            "saveDrugEditorButton"
        );

    const passwordInput =
        document.getElementById(
            "drugEditorPassword"
        );

    if (
        !overlay
    ) {

        console.error(
            "PHDU MedCore editor overlay was not found."
        );

        return;

    }

    if (
        status
    ) {

        status.textContent =
            "Loading medication details...";

        status.className =
            "drugEditorStatusLoading";

    }

    if (
        saveButton
    ) {

        saveButton.disabled =
            true;

    }

    if (
        passwordInput
    ) {

        passwordInput.value =
            "";

    }

    overlay.classList.remove(
        "hiddenDrugEditor"
    );

    overlay.setAttribute(
        "aria-hidden",
        "false"
    );

    document.body.classList.add(
        "drugEditorOpen"
    );

    google.script.run

        .withSuccessHandler(
            function (drug) {

                if (
                    !drug
                ) {

                    showDrugEditorError(
                        "Medication details were not received."
                    );

                    return;

                }

                currentMedCoreEditorDrug = {

                    rowNumber:
                        Number(
                            drug.rowNumber
                        ),

                    drugName:
                        String(
                            drug.drugName ||
                            ""
                        ),

                    classification:
                        String(
                            drug.classification ||
                            ""
                        ),

                    route:
                        String(
                            drug.route ||
                            ""
                        ),

                    originalEntry:
                        String(
                            drug.originalEntry ||
                            ""
                        )

                };

                setDrugEditorValue(
                    "editDrugName",
                    currentMedCoreEditorDrug
                        .drugName
                );

                setDrugEditorValue(
                    "editClassification",
                    currentMedCoreEditorDrug
                        .classification
                );

                setDrugEditorValue(
                    "editRoute",
                    currentMedCoreEditorDrug
                        .route
                );

                setDrugEditorValue(
                    "editOriginalEntry",
                    currentMedCoreEditorDrug
                        .originalEntry
                );

                if (
                    status
                ) {

                    status.textContent =
                        "";

                    status.className =
                        "";

                }

                if (
                    saveButton
                ) {

                    saveButton.disabled =
                        false;

                }

                const classificationInput =
                    document.getElementById(
                        "editClassification"
                    );

                if (
                    classificationInput
                ) {

                    setTimeout(
                        function () {

                            classificationInput.focus();

                        },
                        100
                    );

                }

            }
        )

        .withFailureHandler(
            function (error) {

                const errorMessage =
                    getMedCoreErrorMessage(
                        error
                    );

                console.error(
                    "PHDU MedCore editor failed to load:",
                    error
                );

                showDrugEditorError(
                    errorMessage
                );

            }
        )

        .getMedCoreDrugDetails(
            rowNumber
        );

}


/* ======================================================
   CLOSE TEMPORARY DRUG EDITOR
====================================================== */

function closeTemporaryDrugEditor() {

    if (
        medCoreDrugEditorSaving
    ) {

        return;

    }

    const overlay =
        document.getElementById(
            "drugEditorOverlay"
        );

    if (
        overlay
    ) {

        overlay.classList.add(
            "hiddenDrugEditor"
        );

        overlay.setAttribute(
            "aria-hidden",
            "true"
        );

    }

    document.body.classList.remove(
        "drugEditorOpen"
    );

    const passwordInput =
        document.getElementById(
            "drugEditorPassword"
        );

    if (
        passwordInput
    ) {

        passwordInput.value =
            "";

    }

    const status =
        document.getElementById(
            "drugEditorStatus"
        );

    if (
        status
    ) {

        status.textContent =
            "";

        status.className =
            "";

    }

}


/* ======================================================
   SAVE TEMPORARY DRUG EDITOR
====================================================== */

function saveTemporaryDrugEditor() {

    if (
        medCoreDrugEditorSaving
    ) {

        return;

    }

    if (
        !currentMedCoreEditorDrug
    ) {

        showDrugEditorError(
            "Medication details have not finished loading."
        );

        return;

    }

    const classificationInput =
        document.getElementById(
            "editClassification"
        );

    const routeInput =
        document.getElementById(
            "editRoute"
        );

    const originalEntryInput =
        document.getElementById(
            "editOriginalEntry"
        );

    const passwordInput =
        document.getElementById(
            "drugEditorPassword"
        );

    const saveButton =
        document.getElementById(
            "saveDrugEditorButton"
        );

    const cancelButton =
        document.getElementById(
            "cancelDrugEditorButton"
        );

    const closeButton =
        document.getElementById(
            "closeDrugEditorButton"
        );

    const status =
        document.getElementById(
            "drugEditorStatus"
        );

    if (
        !classificationInput ||
        !routeInput ||
        !originalEntryInput ||
        !passwordInput
    ) {

        showDrugEditorError(
            "One or more medication editor fields were not found."
        );

        return;

    }

    const classification =
        String(
            classificationInput.value ||
            ""
        ).trim();

    const route =
        String(
            routeInput.value ||
            ""
        ).trim();

    const originalEntry =
        String(
            originalEntryInput.value ||
            ""
        )
            .replace(
                /\r\n/g,
                "\n"
            )
            .replace(
                /\r/g,
                "\n"
            );

    const password =
        String(
            passwordInput.value ||
            ""
        ).trim();

    if (
        !classification
    ) {

        showDrugEditorError(
            "Classification cannot be empty."
        );

        classificationInput.focus();

        return;

    }

    if (
        !route
    ) {

        showDrugEditorError(
            "Route cannot be empty."
        );

        routeInput.focus();

        return;

    }

    if (
        !originalEntry.trim()
    ) {

        showDrugEditorError(
            "Clinical Dosing Guide cannot be empty."
        );

        originalEntryInput.focus();

        return;

    }

    if (
        !password
    ) {

        showDrugEditorError(
            "Enter the editing password."
        );

        passwordInput.focus();

        return;

    }

    const confirmed =
        window.confirm(
            "Save these changes to Drug Master?\n\n" +
            "Medication: " +
            currentMedCoreEditorDrug.drugName +
            "\n\n" +
            "This will update the existing medication row."
        );

    if (
        !confirmed
    ) {

        return;

    }

    medCoreDrugEditorSaving =
        true;

    if (
        saveButton
    ) {

        saveButton.disabled =
            true;

        saveButton.textContent =
            "Saving...";

    }

    if (
        cancelButton
    ) {

        cancelButton.disabled =
            true;

    }

    if (
        closeButton
    ) {

        closeButton.disabled =
            true;

    }

    if (
        status
    ) {

        status.textContent =
            "Saving medication changes...";

        status.className =
            "drugEditorStatusLoading";

    }

    const payload = {

        rowNumber:
            currentMedCoreEditorDrug
                .rowNumber,

        drugName:
            currentMedCoreEditorDrug
                .drugName,

        classification:
            classification,

        route:
            route,

        originalEntry:
            originalEntry,

        password:
            password

    };

    google.script.run

        .withSuccessHandler(
            function (result) {

                medCoreDrugEditorSaving =
                    false;

                restoreDrugEditorButtons();

                if (
                    !result ||
                    result.success !== true
                ) {

                    showDrugEditorError(
                        "The medication could not be updated."
                    );

                    return;

                }

                /*
                   Update the current editor copy.
                */

                currentMedCoreEditorDrug = {

                    rowNumber:
                        Number(
                            result.rowNumber
                        ),

                    drugName:
                        String(
                            result.drugName ||
                            currentMedCoreEditorDrug
                                .drugName
                        ),

                    classification:
                        String(
                            result.classification ||
                            classification
                        ),

                    route:
                        String(
                            result.route ||
                            route
                        ),

                    originalEntry:
                        String(
                            result.originalEntry ||
                            originalEntry
                        )

                };

                /*
                   Update the lightweight client-side index.
                */

                updateLocalDrugIndexAfterEdit(
                    currentMedCoreEditorDrug
                );

                /*
                   Update the visible details page.
                */

                setTextContent(
                    "detailDrugName",
                    currentMedCoreEditorDrug
                        .drugName
                );

                setTextContent(
                    "detailClassification",
                    currentMedCoreEditorDrug
                        .classification ||
                    "-"
                );

                setTextContent(
                    "detailRoute",
                    currentMedCoreEditorDrug
                        .route ||
                    "-"
                );

                if (
                    result.originalEntryChanged ===
                    true
                ) {

                    /*
                       Column D was saved as plain text.
                       Render it immediately without old
                       rich-text ranges.
                    */

                    renderClinicalDosingGuide(
                        currentMedCoreEditorDrug
                            .originalEntry ||
                        "-",
                        []
                    );

                }

                updateDrugCrossReference(
                    currentMedCoreEditorDrug
                        .originalEntry ||
                    "",
                    currentMedCoreEditorDrug
                        .rowNumber
                );

                passwordInput.value =
                    "";

                if (
                    result.noChanges ===
                    true
                ) {

                    alert(
                        "No changes were detected."
                    );

                    closeTemporaryDrugEditor();

                    return;

                }

alert(
    "Medication updated successfully."
);


                closeTemporaryDrugEditor();

            }
        )

        .withFailureHandler(
            function (error) {

                medCoreDrugEditorSaving =
                    false;

                restoreDrugEditorButtons();

                const errorMessage =
                    getMedCoreErrorMessage(
                        error
                    );

                console.error(
                    "PHDU MedCore medication update failed:",
                    error
                );

                showDrugEditorError(
                    errorMessage
                );

                passwordInput.value =
                    "";

                passwordInput.focus();

            }
        )

        .saveMedCoreDrugEdits(
            payload
        );

}


/* ======================================================
   UPDATE LOCAL DRUG INDEX AFTER EDIT
====================================================== */

function updateLocalDrugIndexAfterEdit(
    updatedDrug
) {

    if (
        !updatedDrug ||
        !Array.isArray(
            DRUGS
        )
    ) {

        return;

    }

    const rowNumber =
        Number(
            updatedDrug.rowNumber
        );

    const index =
        DRUGS.findIndex(
            function (drug) {

                return (
                    Number(
                        drug.rowNumber
                    ) ===
                    rowNumber
                );

            }
        );

    if (
        index === -1
    ) {

        return;

    }

    DRUGS[index] = {

        rowNumber:
            rowNumber,

        drugName:
            updatedDrug.drugName,

        classification:
            updatedDrug.classification,

        route:
            updatedDrug.route

    };

}


/* ======================================================
   RESTORE EDITOR BUTTONS
====================================================== */

function restoreDrugEditorButtons() {

    const saveButton =
        document.getElementById(
            "saveDrugEditorButton"
        );

    const cancelButton =
        document.getElementById(
            "cancelDrugEditorButton"
        );

    const closeButton =
        document.getElementById(
            "closeDrugEditorButton"
        );

    if (
        saveButton
    ) {

        saveButton.disabled =
            false;

        saveButton.textContent =
            "Save Changes";

    }

    if (
        cancelButton
    ) {

        cancelButton.disabled =
            false;

    }

    if (
        closeButton
    ) {

        closeButton.disabled =
            false;

    }

}


/* ======================================================
   EDITOR FIELD VALUE
====================================================== */

function setDrugEditorValue(
    elementId,
    value
) {

    const element =
        document.getElementById(
            elementId
        );

    if (
        !element
    ) {

        console.warn(
            "PHDU MedCore editor element was not found:",
            elementId
        );

        return;

    }

    element.value =
        String(
            value == null
                ? ""
                : value
        );

}


/* ======================================================
   EDITOR ERROR MESSAGE
====================================================== */

function showDrugEditorError(
    message
) {

    const status =
        document.getElementById(
            "drugEditorStatus"
        );

    if (
        status
    ) {

        status.textContent =
            String(
                message ||
                "An error occurred."
            );

        status.className =
            "drugEditorStatusError";

    }

}


/* ======================================================
   SAFE ERROR MESSAGE
====================================================== */

function getMedCoreErrorMessage(
    error
) {

    if (
        error &&
        error.message
    ) {

        return String(
            error.message
        );

    }

    return String(
        error ||
        "Unknown error"
    );

}


/* ======================================================
   CLOSE EDITOR BY TAPPING THE DARK BACKGROUND
====================================================== */

document.addEventListener(
    "click",
    function (event) {

        if (
            event.target.id !==
            "drugEditorOverlay"
        ) {

            return;

        }

        closeTemporaryDrugEditor();

    }
);


/* ======================================================
   CLOSE EDITOR WITH ESCAPE KEY
====================================================== */

document.addEventListener(
    "keydown",
    function (event) {

        if (
            event.key !==
            "Escape"
        ) {

            return;

        }

        const overlay =
            document.getElementById(
                "drugEditorOverlay"
            );

        if (
            overlay &&
            !overlay.classList.contains(
                "hiddenDrugEditor"
            )
        ) {

            closeTemporaryDrugEditor();

        }

    }
);


/* ======================================================
   PASSWORD FIELD: ALLOW ONLY ONE NUMBER
====================================================== */

document.addEventListener(
    "input",
    function (event) {

        if (
            event.target.id !==
            "drugEditorPassword"
        ) {

            return;

        }

        event.target.value =
            String(
                event.target.value ||
                ""
            )
                .replace(
                    /\D/g,
                    ""
                )
                .slice(
                    0,
                    1
                );

    }
);

/* ======================================================
   IV INFUSIONS
   PAGE NAVIGATION
   PHDU MEDCORE — NO DRIFT
====================================================== */

function openInfusionCalculations() {

    const moduleMenu =
        document.getElementById(
            "moduleMenu"
        );

    const infusionPage =
        document.getElementById(
            "infusionCalculationsPage"
        );

    if (moduleMenu) {

        moduleMenu.classList.add(
            "hiddenMenu"
        );

    }

    if (infusionPage) {

        infusionPage.classList.remove(
            "hiddenMenu"
        );

        infusionPage.setAttribute(
            "aria-hidden",
            "false"
        );

        infusionPage.scrollTop =
            0;

    }

}


function closeInfusionCalculations() {

    const infusionPage =
        document.getElementById(
            "infusionCalculationsPage"
        );

    const moduleMenu =
        document.getElementById(
            "moduleMenu"
        );

    if (infusionPage) {

        infusionPage.classList.add(
            "hiddenMenu"
        );

        infusionPage.setAttribute(
            "aria-hidden",
            "true"
        );

    }

    if (moduleMenu) {

        moduleMenu.classList.remove(
            "hiddenMenu"
        );

    }

}

/* ======================================================
   IV INFUSIONS
   DATA + SEARCH + PREMIUM DETAIL POPUP
   PHDU MEDCORE — NO DRIFT
====================================================== */

let MEDCORE_INFUSION_DATA = [];
let MEDCORE_INFUSION_DATA_LOADED = false;
let MEDCORE_INFUSION_DATA_LOADING = false;


/* ======================================================
   LOAD IV INFUSION DATA
====================================================== */

function readMedCoreLocalInfusionData(callback) {

    openMedCoreLocalDatabase(function (database) {

        if (!database) {
            callback(null);
            return;
        }

        let request;

        try {
            request = database
                .transaction(MEDCORE_LOCAL_STORE_NAME, "readonly")
                .objectStore(MEDCORE_LOCAL_STORE_NAME)
                .get(MEDCORE_LOCAL_INFUSION_KEY);
        } catch (error) {
            database.close();
            callback(null);
            return;
        }

        request.onsuccess = function () {
            const record = request.result;
            database.close();

            callback(
                record &&
                Array.isArray(record.records) &&
                record.verified === true
                    ? record
                    : null
            );
        };

        request.onerror = function () {
            database.close();
            callback(null);
        };

    });

}

function saveMedCoreLocalInfusionData(records, callback) {

    const done = typeof callback === "function"
        ? callback
        : function () {};

    if (!Array.isArray(records)) {
        done(false);
        return;
    }

    /*
       Stage first. The current verified dataset remains untouched
       until the staged copy has been read back exactly.
    */
    openMedCoreLocalDatabase(function (database) {

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

            transaction.objectStore(MEDCORE_LOCAL_STORE_NAME).put({
                key: MEDCORE_LOCAL_INFUSION_STAGING_KEY,
                records: records,
                count: records.length,
                savedAt: new Date().toISOString(),
                verified: false
            });

            transaction.oncomplete = function () {
                database.close();

                openMedCoreLocalDatabase(function (verifyDatabase) {
                    if (!verifyDatabase) {
                        done(false);
                        return;
                    }

                    let readRequest;
                    try {
                        readRequest = verifyDatabase
                            .transaction(MEDCORE_LOCAL_STORE_NAME, "readonly")
                            .objectStore(MEDCORE_LOCAL_STORE_NAME)
                            .get(MEDCORE_LOCAL_INFUSION_STAGING_KEY);
                    } catch (error) {
                        verifyDatabase.close();
                        done(false);
                        return;
                    }

                    readRequest.onsuccess = function () {
                        const staged = readRequest.result;
                        const exact = !!(
                            staged &&
                            Array.isArray(staged.records) &&
                            staged.records.length === records.length &&
                            JSON.stringify(staged.records) === JSON.stringify(records)
                        );

                        verifyDatabase.close();

                        if (!exact) {
                            done(false);
                            return;
                        }

                        promoteMedCoreInfusionStaging_(records, done);
                    };

                    readRequest.onerror = function () {
                        verifyDatabase.close();
                        done(false);
                    };
                });
            };

            transaction.onerror = function () {
                database.close();
                done(false);
            };

            transaction.onabort = function () {
                database.close();
                done(false);
            };

        } catch (error) {
            database.close();
            done(false);
        }

    });

}

function promoteMedCoreInfusionStaging_(records, callback) {

    openMedCoreLocalDatabase(function (database) {

        if (!database) {
            callback(false);
            return;
        }

        let transaction;

        try {
            transaction = database.transaction(
                MEDCORE_LOCAL_STORE_NAME,
                "readwrite"
            );

            const store = transaction.objectStore(MEDCORE_LOCAL_STORE_NAME);
            store.put({
                key: MEDCORE_LOCAL_INFUSION_KEY,
                records: records,
                count: records.length,
                savedAt: new Date().toISOString(),
                verified: true
            });
            store.delete(MEDCORE_LOCAL_INFUSION_STAGING_KEY);

            transaction.oncomplete = function () {
                database.close();

                readMedCoreLocalInfusionData(function (saved) {
                    const verified = !!(
                        saved &&
                        saved.records.length === records.length &&
                        JSON.stringify(saved.records) === JSON.stringify(records)
                    );
                    callback(verified);
                });
            };

            transaction.onerror = function () {
                database.close();
                callback(false);
            };

            transaction.onabort = function () {
                database.close();
                callback(false);
            };

        } catch (error) {
            database.close();
            callback(false);
        }

    });

}


function loadMedCoreInfusionData() {

    if (MEDCORE_INFUSION_DATA_LOADING) {
        return;
    }

    if (MEDCORE_INFUSION_DATA_LOADED) {
        renderInfusionSearchPrompt();
        return;
    }

    MEDCORE_INFUSION_DATA_LOADING = true;

    const container = document.getElementById("infusionDrugList");

    if (container) {
        container.innerHTML = `
            <div class="infusionSearchPrompt">
                Loading IV infusion medications...
            </div>
        `;
    }

    /*
       Local-first: display the last verified infusion dataset
       immediately, then refresh it from the existing Sheets source.
    */
    readMedCoreLocalInfusionData(function (cachedRecord) {

        if (cachedRecord) {
            MEDCORE_INFUSION_DATA = cachedRecord.records;
            MEDCORE_INFUSION_DATA_LOADED = true;
            MEDCORE_INFUSION_DATA_LOADING = false;
            renderInfusionSearchPrompt();

            if (!navigator.onLine) {
                return;
            }

            refreshMedCoreInfusionData_();
            return;
        }

        if (!navigator.onLine) {
            MEDCORE_INFUSION_DATA_LOADING = false;

            if (container) {
                container.innerHTML = `
                    <div class="infusionSearchPrompt">
                        IV infusion data has not yet been synchronized to this device.
                        Connect to the internet and open this module once to prepare it for offline use.
                    </div>
                `;
            }

            return;
        }

        refreshMedCoreInfusionData_();

    });

}

function refreshMedCoreInfusionData_() {

    google.script.run
        .withSuccessHandler(function (data) {

            if (!Array.isArray(data)) {
                MEDCORE_INFUSION_DATA_LOADING = false;

                if (!MEDCORE_INFUSION_DATA_LOADED) {
                    showMedCoreInfusionLoadError_();
                }
                return;
            }

            saveMedCoreLocalInfusionData(data, function (verified) {

                MEDCORE_INFUSION_DATA = data;
                MEDCORE_INFUSION_DATA_LOADED = true;
                MEDCORE_INFUSION_DATA_LOADING = false;

                if (!verified) {
                    console.warn(
                        "PHDU MedCore received IV infusion data, but local read-back verification failed."
                    );
                }

                renderInfusionSearchPrompt();

            });

        })
        .withFailureHandler(function (error) {

            MEDCORE_INFUSION_DATA_LOADING = false;

            if (!MEDCORE_INFUSION_DATA_LOADED) {
                const container = document.getElementById("infusionDrugList");
                const errorMessage = error && error.message
                    ? error.message
                    : String(error || "Unknown error");

                if (container) {
                    container.innerHTML = `
                        <div class="infusionSearchPrompt">
                            Unable to load IV infusion medications.<br><br>
                            ${escapeHtml(errorMessage)}
                        </div>
                    `;
                }
            }

        })
        .getMedCoreInfusionData();

}

function showMedCoreInfusionLoadError_() {

    const container = document.getElementById("infusionDrugList");

    if (container) {
        container.innerHTML = `
            <div class="infusionSearchPrompt">
                Unable to load IV infusion medications.
            </div>
        `;
    }

}



/* ======================================================
   SEARCH PROMPT
====================================================== */

function renderInfusionSearchPrompt() {

    const container =
        document.getElementById(
            "infusionDrugList"
        );

    if (
        !container
    ) {

        return;

    }

    container.innerHTML = `

        <div class="infusionSearchPrompt">
            🔍 Start typing to search IV infusion medications.
        </div>

    `;

}


/* ======================================================
   SEARCH EVENT
====================================================== */

document.addEventListener(
    "input",
    function (event) {

        if (
            event.target.id !==
            "searchInfusionMedication"
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

        if (
            keyword.length <
            2
        ) {

            renderInfusionSearchPrompt();

            return;

        }

        if (
            !MEDCORE_INFUSION_DATA_LOADED
        ) {

            loadMedCoreInfusionData();

            return;

        }

        searchInfusionMedications(
            keyword
        );

    }
);


/* ======================================================
   SEARCH INFUSION MEDICATIONS
====================================================== */

function searchInfusionMedications(
    keyword
) {

    const normalizedKeyword =
        String(
            keyword ||
            ""
        )
            .trim()
            .toLowerCase();

    const results =
        MEDCORE_INFUSION_DATA
            .filter(
                function (drug) {

                    const drugName =
                        String(
                            drug &&
                            drug.drugName ||
                            ""
                        )
                            .trim()
                            .toLowerCase();

                    return (
                        drugName.includes(
                            normalizedKeyword
                        )
                    );

                }
            );

    renderInfusionSearchResults(
        results
    );

}


/* ======================================================
   RENDER SEARCH RESULTS
====================================================== */

function renderInfusionSearchResults(
    results
) {

    const container =
        document.getElementById(
            "infusionDrugList"
        );

    if (
        !container
    ) {

        return;

    }

    if (
        !Array.isArray(
            results
        ) ||
        results.length === 0
    ) {

        container.innerHTML = `

            <div class="infusionSearchPrompt">
                No IV infusion medication found.
            </div>

        `;

        return;

    }

    let html =
        "";

    results.forEach(
        function (drug, index) {

            const drugName =
                String(
                    drug.drugName ||
                    "Unnamed Drug"
                );

            html += `

                <div
                    class="infusionDrugCard"
                    role="button"
                    tabindex="0"
                    data-infusion-index="${index}">

                    <div class="infusionDrugName">
                        ${escapeHtml(
                            drugName
                        )}
                    </div>

                </div>

            `;

        }
    );

    container.innerHTML =
        html;

}


/* ======================================================
   OPEN RESULT CARD
====================================================== */

document.addEventListener(
    "click",
    function (event) {

        const card =
            event.target.closest(
                ".infusionDrugCard"
            );

        if (
            !card
        ) {

            return;

        }

        const drugName =
            String(
                card
                    .querySelector(
                        ".infusionDrugName"
                    )
                    ?.textContent ||
                ""
            ).trim();

        if (
            !drugName
        ) {

            return;

        }

        openInfusionDetailByName(
            drugName
        );

    }
);


/* ======================================================
   OPEN INFUSION DETAIL BY NAME
====================================================== */

function openInfusionDetailByName(
    drugName
) {

    const normalizedName =
        String(
            drugName ||
            ""
        )
            .trim()
            .toLowerCase();

    const drug =
        MEDCORE_INFUSION_DATA.find(
            function (item) {

                return (
                    String(
                        item.drugName ||
                        ""
                    )
                        .trim()
                        .toLowerCase() ===
                    normalizedName
                );

            }
        );

    if (
        !drug
    ) {

        return;

    }

    renderInfusionDetail(
        drug
    );

}


/* ======================================================
   FORMULA HEADING
====================================================== */

function getInfusionFormulaHeading(
    formula,
    optionCount
) {

    const value =
        String(
            formula ||
            ""
        )
            .trim();

    if (
        optionCount <= 1
    ) {

        return "";

    }

    if (
        /^CVC\s*:/i.test(
            value
        )
    ) {

        return "CVC FORMULA";

    }

    if (
        /^Peripheral\s+Line/i.test(
            value
        )
    ) {

        return "PERIPHERAL LINE FORMULA";

    }

    if (
        /^1\s*:\s*5\b/i.test(
            value
        )
    ) {

        return "1:5 DILUTION FORMULA";

    }

    if (
        /^1\s*:\s*10\b/i.test(
            value
        )
    ) {

        return "1:10 DILUTION FORMULA";

    }

    return "";

}




/* ======================================================
   INFUSION FORMULA DISPLAY

   Centers all formula content:
   - weight x 0.3
   - weight x 0.06
   - wt x 0.03
   - 1:5 DILUTION
   - 1:10 Dilution

   Does NOT affect the FORMULA field label.
====================================================== */

function renderInfusionFormulaValue(value) {

    const lines =
        String(
            value == null
                ? ""
                : value
        )
            .replace(/\r\n/g, "\n")
            .replace(/\r/g, "\n")
            .split("\n");

    return lines
        .map(function (line) {

            const safeLine =
                escapeHtml(
                    line
                );

            if (
                !String(line).trim()
            ) {

                return "";
            }

            return (
                '<div class="infusionFormulaCenteredLine">' +
                safeLine +
                '</div>'
            );

        })
        .join("\n");

}

/* ======================================================
   RENDER INFUSION DETAIL
====================================================== */

function renderInfusionDetail(
    drug
) {

    const overlay =
        document.getElementById(
            "infusionDetailOverlay"
        );

    const nameElement =
        document.getElementById(
            "infusionDetailDrugName"
        );

    const countElement =
        document.getElementById(
            "infusionDetailFormulaCount"
        );

    const body =
        document.getElementById(
            "infusionDetailBody"
        );

    if (
        !overlay ||
        !nameElement ||
        !body
    ) {

        return;

    }

    const options =
        Array.isArray(
            drug.options
        )
            ? drug.options
            : [];

    nameElement.textContent =
        String(
            drug.drugName ||
            "Medication"
        );

    if (
        countElement
    ) {

        countElement.textContent =
            options.length > 1
                ? options.length +
                  " infusion preparations"
                : "";

    }

    let html =
        "";

    options.forEach(
        function (option) {

const heading =
    String(
        option.heading ||
        getInfusionFormulaHeading(
            option.formula,
            options.length
        ) ||
        ""
    );
            html += `

                <div class="infusionFormulaCard">

                    ${
                        heading
                            ? `
                                <div class="infusionFormulaHeading">
                                    ${escapeHtml(
                                        heading
                                    )}
                                </div>
                              `
                            : ""
                    }

                    <div class="infusionField infusionFieldFormula">

                        <div class="infusionFieldLabel">
                            Formula
                        </div>

<div class="infusionFieldValue">
    ${renderInfusionFormulaValue(
        option.formula ||
        "—"
    )}
</div>
                    </div>

                    <div class="infusionField infusionFieldPreparation">

                        <div class="infusionFieldLabel">
                            Preparation / Dose
                        </div>

                        <div class="infusionFieldValue">
                            ${escapeHtml(
                                option.preparationDose ||
                                "—"
                            )}
                        </div>

                    </div>

                    <div class="infusionField infusionFieldVolume">

                        <div class="infusionFieldLabel">
                            Total Volume
                        </div>

                        <div class="infusionFieldValue">
                            ${escapeHtml(
                                option.totalVolume ||
                                "—"
                            )}
                        </div>

                    </div>

                    <div class="infusionField infusionFieldDilution">

                        <div class="infusionFieldLabel">
                            Further Dilution
                        </div>

                        <div class="infusionFieldValue">
                            ${escapeHtml(
                                option.furtherDilution ||
                                "—"
                            )}
                        </div>

                    </div>

                </div>

            `;

        }
    );

    body.innerHTML =
        html;

    overlay.classList.remove(
        "hiddenInfusionDetail"
    );

    overlay.setAttribute(
        "aria-hidden",
        "false"
    );

}


/* ======================================================
   CLOSE INFUSION DETAIL
====================================================== */

function closeInfusionDetail() {

    const overlay =
        document.getElementById(
            "infusionDetailOverlay"
        );

    if (
        !overlay
    ) {

        return;

    }

    overlay.classList.add(
        "hiddenInfusionDetail"
    );

    overlay.setAttribute(
        "aria-hidden",
        "true"
    );

}


/* ======================================================
   LOAD DATA WHEN IV INFUSION PAGE OPENS
====================================================== */

const originalOpenInfusionCalculations =
    window.openInfusionCalculations;

window.openInfusionCalculations =
    function () {

        if (
            typeof originalOpenInfusionCalculations ===
            "function"
        ) {

            originalOpenInfusionCalculations();

        }

        const search =
            document.getElementById(
                "searchInfusionMedication"
            );

        if (
            search
        ) {

            search.value =
                "";

        }

        loadMedCoreInfusionData();

    };


/* ======================================================
   MEDICATION FOR INTUBATION
   STABLE FIXED-ZOOM IMAGE VIEWER
====================================================== */

const INTUBATION_ZOOM_LEVELS = [
    1,
    1.25,
    1.5,
    2,
    2.5,
    3
];

let intubationZoomIndex = 0;


/* ======================================================
   APPLY ZOOM
====================================================== */

function applyIntubationZoom() {

    const poster =
        document.getElementById(
            "intubationMedicationPoster"
        );

    const level =
        document.getElementById(
            "intubationZoomLevel"
        );

    const zoomOutButton =
        document.getElementById(
            "intubationZoomOutButton"
        );

    const zoomInButton =
        document.getElementById(
            "intubationZoomInButton"
        );

    if (!poster) {
        return;
    }

    const zoom =
        INTUBATION_ZOOM_LEVELS[
            intubationZoomIndex
        ];

    poster.style.width =
        (
            zoom * 100
        ) +
        "%";

    poster.style.maxWidth =
        "none";

    if (level) {

        level.textContent =
            Math.round(
                zoom * 100
            ) +
            "%";

    }

    if (zoomOutButton) {

        zoomOutButton.disabled =
            intubationZoomIndex === 0;

    }

    if (zoomInButton) {

        zoomInButton.disabled =
            intubationZoomIndex ===
            INTUBATION_ZOOM_LEVELS.length - 1;

    }

}


/* ======================================================
   ZOOM IN
====================================================== */

function zoomIntubationIn() {

    if (
        intubationZoomIndex >=
        INTUBATION_ZOOM_LEVELS.length - 1
    ) {

        return;

    }

    intubationZoomIndex++;

    applyIntubationZoom();

}


/* ======================================================
   ZOOM OUT
====================================================== */

function zoomIntubationOut() {

    if (
        intubationZoomIndex <= 0
    ) {

        return;

    }

    intubationZoomIndex--;

    applyIntubationZoom();

}


/* ======================================================
   OPEN
====================================================== */

function openIntubationImage() {

    const overlay =
        document.getElementById(
            "intubationImageOverlay"
        );

    const scroller =
        document.getElementById(
            "intubationImageScroller"
        );

    if (!overlay) {
        return;
    }

    intubationZoomIndex = 0;

    overlay.style.display =
        "flex";

    overlay.classList.remove(
        "hiddenIntubationImage"
    );

    overlay.setAttribute(
        "aria-hidden",
        "false"
    );

    applyIntubationZoom();

    if (scroller) {

        scroller.scrollTop = 0;
        scroller.scrollLeft = 0;

    }

}


/* ======================================================
   CLOSE
====================================================== */

function closeIntubationImage() {

    const overlay =
        document.getElementById(
            "intubationImageOverlay"
        );

    if (!overlay) {
        return;
    }

    overlay.style.display =
        "none";

    overlay.classList.add(
        "hiddenIntubationImage"
    );

    overlay.setAttribute(
        "aria-hidden",
        "true"
    );

}

/* ======================================================
   ELECTROLYTE CORRECTION
   EXACT MEDICATION FOR INTUBATION VIEWER BASELINE
====================================================== */

const ELECTROLYTE_ZOOM_LEVELS = [
    1,
    1.25,
    1.5,
    2,
    2.5,
    3
];

let electrolyteZoomIndex = 0;


/* ======================================================
   APPLY ZOOM
====================================================== */

function applyElectrolyteZoom() {

    const poster =
        document.getElementById(
            "electrolyteCorrectionPoster"
        );

    const level =
        document.getElementById(
            "electrolyteZoomLevel"
        );

    const zoomOutButton =
        document.getElementById(
            "electrolyteZoomOutButton"
        );

    const zoomInButton =
        document.getElementById(
            "electrolyteZoomInButton"
        );

    if (!poster) {
        return;
    }

    const zoom =
        ELECTROLYTE_ZOOM_LEVELS[
            electrolyteZoomIndex
        ];

    poster.style.width =
        (
            zoom * 100
        ) +
        "%";

    poster.style.maxWidth =
        "none";

    if (level) {

        level.textContent =
            Math.round(
                zoom * 100
            ) +
            "%";

    }

    if (zoomOutButton) {

        zoomOutButton.disabled =
            electrolyteZoomIndex === 0;

    }

    if (zoomInButton) {

        zoomInButton.disabled =
            electrolyteZoomIndex ===
            ELECTROLYTE_ZOOM_LEVELS.length - 1;

    }

}


/* ======================================================
   ZOOM IN
====================================================== */

function zoomElectrolyteIn() {

    if (
        electrolyteZoomIndex >=
        ELECTROLYTE_ZOOM_LEVELS.length - 1
    ) {

        return;

    }

    electrolyteZoomIndex++;

    applyElectrolyteZoom();

}


/* ======================================================
   ZOOM OUT
====================================================== */

function zoomElectrolyteOut() {

    if (
        electrolyteZoomIndex <= 0
    ) {

        return;

    }

    electrolyteZoomIndex--;

    applyElectrolyteZoom();

}


/* ======================================================
   OPEN
====================================================== */

function openElectrolyteImage() {

    const overlay =
        document.getElementById(
            "electrolyteImageOverlay"
        );

    const scroller =
        document.getElementById(
            "electrolyteImageScroller"
        );

    if (!overlay) {
        return;
    }

    electrolyteZoomIndex = 0;

    overlay.style.display =
        "flex";

    overlay.classList.remove(
        "hiddenElectrolyteImage"
    );

    overlay.setAttribute(
        "aria-hidden",
        "false"
    );

    applyElectrolyteZoom();

    if (scroller) {

        scroller.scrollTop = 0;
        scroller.scrollLeft = 0;

    }

}


/* ======================================================
   CLOSE
====================================================== */

function closeElectrolyteImage() {

    const overlay =
        document.getElementById(
            "electrolyteImageOverlay"
        );

    if (!overlay) {
        return;
    }

    overlay.style.display =
        "none";

    overlay.classList.add(
        "hiddenElectrolyteImage"
    );

    overlay.setAttribute(
        "aria-hidden",
        "true"
    );

}

/* ======================================================
   IVF PREPARATION
   EXACT MEDICATION FOR INTUBATION VIEWER BASELINE
====================================================== */

const IVF_ZOOM_LEVELS = [
    1,
    1.25,
    1.5,
    2,
    2.5,
    3
];

let ivfZoomIndex = 0;


/* ======================================================
   APPLY ZOOM
====================================================== */

function applyIVFZoom() {

    const poster =
        document.getElementById(
            "ivfPreparationPoster"
        );

    const level =
        document.getElementById(
            "ivfZoomLevel"
        );

    const zoomOutButton =
        document.getElementById(
            "ivfZoomOutButton"
        );

    const zoomInButton =
        document.getElementById(
            "ivfZoomInButton"
        );

    if (!poster) {
        return;
    }

    const zoom =
        IVF_ZOOM_LEVELS[
            ivfZoomIndex
        ];

    poster.style.width =
        (
            zoom * 100
        ) +
        "%";

    poster.style.maxWidth =
        "none";

    if (level) {

        level.textContent =
            Math.round(
                zoom * 100
            ) +
            "%";

    }

    if (zoomOutButton) {

        zoomOutButton.disabled =
            ivfZoomIndex === 0;

    }

    if (zoomInButton) {

        zoomInButton.disabled =
            ivfZoomIndex ===
            IVF_ZOOM_LEVELS.length - 1;

    }

}


/* ======================================================
   ZOOM IN
====================================================== */

function zoomIVFIn() {

    if (
        ivfZoomIndex >=
        IVF_ZOOM_LEVELS.length - 1
    ) {

        return;

    }

    ivfZoomIndex++;

    applyIVFZoom();

}


/* ======================================================
   ZOOM OUT
====================================================== */

function zoomIVFOut() {

    if (
        ivfZoomIndex <= 0
    ) {

        return;

    }

    ivfZoomIndex--;

    applyIVFZoom();

}


/* ======================================================
   OPEN
====================================================== */

function openIVFImage() {

    const overlay =
        document.getElementById(
            "ivfImageOverlay"
        );

    const scroller =
        document.getElementById(
            "ivfImageScroller"
        );

    if (!overlay) {
        return;
    }

    ivfZoomIndex = 0;

    overlay.style.display =
        "flex";

    overlay.classList.remove(
        "hiddenIVFImage"
    );

    overlay.setAttribute(
        "aria-hidden",
        "false"
    );

    applyIVFZoom();

    if (scroller) {

        scroller.scrollTop = 0;
        scroller.scrollLeft = 0;

    }

}


/* ======================================================
   CLOSE
====================================================== */

function closeIVFImage() {

    const overlay =
        document.getElementById(
            "ivfImageOverlay"
        );

    if (!overlay) {
        return;
    }

    overlay.style.display =
        "none";

    overlay.classList.add(
        "hiddenIVFImage"
    );

    overlay.setAttribute(
        "aria-hidden",
        "true"
    );

}


/* ======================================================
   EMERGENCY MEDICATIONS
   PATIENT INPUT POPUP
   PHDU MEDCORE — STABLE INPUT LOGIC
====================================================== */


/* ======================================================
   OPEN EMERGENCY MEDICATIONS
====================================================== */

function openEmergencyMedications() {

    const overlay =
        document.getElementById(
            "emergencyMedicationOverlay"
        );

    const weightInput =
        document.getElementById(
            "emergencyWeight"
        );

    const ageInput =
        document.getElementById(
            "emergencyAge"
        );

    const ageUnit =
        document.getElementById(
            "emergencyAgeUnit"
        );

    const status =
        document.getElementById(
            "emergencyMedicationStatus"
        );

    if (!overlay) {

        console.error(
            "PHDU MedCore Emergency Medications overlay was not found."
        );

        return;

    }


    /* Reset old patient data */

    if (weightInput) {
        weightInput.value = "";
    }

    if (ageInput) {
        ageInput.value = "";
    }

    if (ageUnit) {
        ageUnit.value = "years";
    }

    if (status) {
        status.textContent = "";
    }


    /* Open popup */

    overlay.classList.remove(
        "hiddenEmergencyModal"
    );

    overlay.setAttribute(
        "aria-hidden",
        "false"
    );


    /* Focus weight field */

    if (weightInput) {

        setTimeout(
            function () {

                weightInput.focus();

            },
            80
        );

    }

}


/* ======================================================
   CLOSE EMERGENCY MEDICATIONS
====================================================== */

function closeEmergencyMedications() {

    const overlay =
        document.getElementById(
            "emergencyMedicationOverlay"
        );

    if (!overlay) {
        return;
    }

    overlay.classList.add(
        "hiddenEmergencyModal"
    );

    overlay.setAttribute(
        "aria-hidden",
        "true"
    );

}


/* ======================================================
   VALIDATE PATIENT INPUT
====================================================== */

function prepareEmergencyMedicationResults() {

    const weightInput =
        document.getElementById(
            "emergencyWeight"
        );

    const ageInput =
        document.getElementById(
            "emergencyAge"
        );

    const ageUnit =
        document.getElementById(
            "emergencyAgeUnit"
        );

    const status =
        document.getElementById(
            "emergencyMedicationStatus"
        );


    if (
        !weightInput ||
        !ageInput ||
        !ageUnit
    ) {

        if (status) {

            status.textContent =
                "Patient input fields could not be loaded.";

        }

        return;

    }


    const weight =
        Number(
            weightInput.value
        );

    const age =
        Number(
            ageInput.value
        );

    const selectedAgeUnit =
        String(
            ageUnit.value ||
            "years"
        );


    /* ==================================================
       WEIGHT VALIDATION
    =================================================== */

    if (
        !Number.isFinite(weight) ||
        weight <= 0
    ) {

        if (status) {

            status.textContent =
                "Enter a valid patient weight.";

        }

        weightInput.focus();

        return;

    }


    /* ==================================================
       AGE VALIDATION
    =================================================== */

    if (
        !Number.isFinite(age) ||
        age < 0
    ) {

        if (status) {

            status.textContent =
                "Enter a valid patient age.";

        }

        ageInput.focus();

        return;

    }


    /* ==================================================
       CLEAR OLD ERROR
    =================================================== */

    if (status) {

        status.textContent = "";

    }


    /* ==================================================
       TEMPORARY TEST ONLY
       No medication calculations yet.
    =================================================== */

    console.log(
        "PHDU MedCore Emergency Patient:",
        {
            weightKg: weight,
            age: age,
            ageUnit: selectedAgeUnit
        }
    );


    /*
       Clinical calculations will be added
       only after the formula specification
       is verified.
    */

/* ==================================================
   PATIENT DATA ACCEPTED
================================================== */

if (status) {

    status.style.color =
        "#BFFFD2";

    status.textContent =
        "Patient data accepted.";

}


/* ==================================================
   OPEN RESULTS SCREEN
   No clinical calculations yet.
================================================== */

openEmergencyMedicationResults(
    weight,
    age,
    selectedAgeUnit
);

}


/* ======================================================
   EMERGENCY MEDICATIONS
   OPEN RESULTS SCREEN + RENDER CALCULATIONS
====================================================== */

function openEmergencyMedicationResults(
    weight,
    age,
    ageUnit
) {

    const inputOverlay =
        document.getElementById(
            "emergencyMedicationOverlay"
        );

    const resultsOverlay =
        document.getElementById(
            "emergencyResultsOverlay"
        );

    const patientDisplay =
        document.getElementById(
            "emergencyResultsPatient"
        );

    if (!resultsOverlay) {

        console.error(
            "PHDU MedCore Emergency Results overlay was not found."
        );

        return;

    }


    /* ==================================================
       PATIENT INFORMATION
    ================================================== */

    if (patientDisplay) {

        const unitLabel =
            ageUnit === "months"
                ? "months"
                : "years";

        patientDisplay.textContent =
            weight +
            " kg • " +
            age +
            " " +
            unitLabel;

    }


    /* ==================================================
       CALCULATE VERIFIED DATA
    ================================================== */

    const results =
        calculateEmergencyMedicationData(
            weight,
            age,
            ageUnit
        );


    /* ==================================================
       AIRWAY
    ================================================== */


setEmergencyResultValue(
    "resultEttSize",
    roundEmergencyEttSize(
        results.airway.ettSize
    ).toFixed(1) + " mm"
);


setEmergencyResultValue(
    "resultEttLength",
    Number(
        results.airway.ettLength
    ).toFixed(1) + " cm"
);

    /* ==================================================
       RESUSCITATION
    ================================================== */

    setEmergencyResultValue(
        "resultAdenosineInitial",
        results.resuscitation.adenosineInitial + " mg"
    );

    setEmergencyResultValue(
        "resultAdenosineSecond",
        results.resuscitation.adenosineSecond + " mg"
    );

    setEmergencyResultValue(
        "resultAdrenaline",
        results.resuscitation.adrenaline + " mL"
    );

    setEmergencyResultValue(
        "resultAtropine",
        results.resuscitation.atropine + " mg"
    );

    /* ==================================================
   EMERGENCY MEDICATION LIMIT BADGES
================================================== */


/* ADENOSINE INITIAL */

setEmergencyLimitBadge(
    "badgeAdenosineInitial",
    results.resuscitation.adenosineInitialLimitApplied
        ? "MAXIMUM DOSE APPLIED"
        : "",
    "max"
);


/* ADENOSINE SECOND */

setEmergencyLimitBadge(
    "badgeAdenosineSecond",
    results.resuscitation.adenosineSecondLimitApplied
        ? "MAXIMUM DOSE APPLIED"
        : "",
    "max"
);


/* ATROPINE */

let atropineBadgeText = "";
let atropineBadgeType = "max";


if (
    results.resuscitation.atropineMinimumApplied
) {

    atropineBadgeText =
        "MINIMUM DOSE APPLIED";

    atropineBadgeType =
        "min";

} else if (
    results.resuscitation.atropineMaximumApplied
) {

    atropineBadgeText =
        "MAXIMUM DOSE APPLIED";

    atropineBadgeType =
        "max";

}


setEmergencyLimitBadge(
    "badgeAtropine",
    atropineBadgeText,
    atropineBadgeType
);

    setEmergencyResultValue(
        "resultAmiodarone",
        results.resuscitation.amiodarone + " mg"
    );

    setEmergencyResultValue(
        "resultCalciumGluconate",
        results.resuscitation.calciumGluconate + " mL"
    );

    setEmergencyResultValue(
        "resultLidocaine",
        results.resuscitation.lidocaine + " mg"
    );

    setEmergencyResultValue(
        "resultSodiumBicarbonate05",
        results.resuscitation.sodiumBicarbonate05 + " mmol"
    );

    setEmergencyResultValue(
        "resultSodiumBicarbonate1",
        results.resuscitation.sodiumBicarbonate1 + " mmol"
    );


    /* ==================================================
       INDUCTION AGENTS
    ================================================== */

    setEmergencyResultValue(
        "resultEtomidate",
        results.induction.etomidate + " mg"
    );

    setEmergencyResultValue(
        "resultFentanyl",
        results.induction.fentanyl + " mcg"
    );

    setEmergencyResultValue(
        "resultKetamine",
        results.induction.ketamine + " mg"
    );

    setEmergencyResultValue(
        "resultMidazolam",
        results.induction.midazolam + " mg"
    );


    /* ==================================================
       MUSCLE RELAXANTS
    ================================================== */

    setEmergencyResultValue(
        "resultAtracurium",
        results.muscleRelaxants.atracurium + " mg"
    );

    setEmergencyResultValue(
        "resultRocuronium",
        results.muscleRelaxants.rocuronium + " mg"
    );

    setEmergencyResultValue(
        "resultSuccinylcholine",
        results.muscleRelaxants.succinylcholine + " mg"
    );


    /* ==================================================
       DEFIBRILLATION
    ================================================== */

    setEmergencyResultValue(
        "resultDefibrillationFirst",
        results.defibrillation.firstShock + " J"
    );

    setEmergencyResultValue(
        "resultDefibrillationSecond",
        results.defibrillation.secondShock + " J"
    );


    /* ==================================================
       CARDIOVERSION
    ================================================== */

    setEmergencyResultValue(
        "resultCardioversionFirst",
        results.cardioversion.firstShock + " J"
    );

    setEmergencyResultValue(
        "resultCardioversionSecond",
        results.cardioversion.secondShock + " J"
    );


    /* ==================================================
       CLOSE INPUT POPUP
    ================================================== */

    if (inputOverlay) {

        inputOverlay.classList.add(
            "hiddenEmergencyModal"
        );

        inputOverlay.setAttribute(
            "aria-hidden",
            "true"
        );

    }


    /* ==================================================
       OPEN RESULTS SCREEN
    ================================================== */

    resultsOverlay.classList.remove(
        "hiddenEmergencyResults"
    );

    resultsOverlay.setAttribute(
        "aria-hidden",
        "false"
    );

    resultsOverlay.scrollTop = 0;

}


/* ======================================================
   EMERGENCY MEDICATIONS
   SAFE RESULT RENDERER
====================================================== */

function setEmergencyResultValue(
    elementId,
    value
) {

    const element =
        document.getElementById(
            elementId
        );

    if (!element) {

        console.warn(
            "PHDU MedCore emergency result element not found:",
            elementId
        );

        return;

    }

    element.textContent =
        String(
            value == null
                ? "—"
                : value
        );

}

/* ======================================================
   EMERGENCY MEDICATIONS
   CLOSE RESULTS SCREEN
====================================================== */

function closeEmergencyMedicationResults() {

    const resultsOverlay =
        document.getElementById(
            "emergencyResultsOverlay"
        );

    if (!resultsOverlay) {
        return;
    }

    resultsOverlay.classList.add(
        "hiddenEmergencyResults"
    );

    resultsOverlay.setAttribute(
        "aria-hidden",
        "true"
    );

    resultsOverlay.scrollTop = 0;

}



/* ======================================================
   EMERGENCY MEDICATIONS
   CHANGE PATIENT / RECALCULATE
====================================================== */

function changeEmergencyPatient() {

    const resultsOverlay =
        document.getElementById(
            "emergencyResultsOverlay"
        );

    const inputOverlay =
        document.getElementById(
            "emergencyMedicationOverlay"
        );

    const weightInput =
        document.getElementById(
            "emergencyWeight"
        );

    if (resultsOverlay) {

        resultsOverlay.classList.add(
            "hiddenEmergencyResults"
        );

        resultsOverlay.setAttribute(
            "aria-hidden",
            "true"
        );

        resultsOverlay.scrollTop = 0;
    }


    if (inputOverlay) {

        inputOverlay.classList.remove(
            "hiddenEmergencyModal"
        );

        inputOverlay.setAttribute(
            "aria-hidden",
            "false"
        );
    }


    if (weightInput) {

        setTimeout(
            function () {

                weightInput.focus();

            },
            80
        );

    }

}

/* ======================================================

   EMERGENCY MEDICATIONS

   VERIFIED CLINICAL CALCULATION ENGINE

   PHDU MEDCORE

====================================================== */

/* ======================================================

   VERIFIED CONSTANTS

   Source: Approved Pediatric Code Sheet

====================================================== */

const EMERGENCY_MEDICATION_CONFIG = {

    adenosineInitial: {

        dosePerKg: 0.1,

        maxDose: 6

    },

    adenosineSecond: {

        dosePerKg: 0.2,

        maxDose: 12

    },

    adrenaline: {

        dosePerKg: 0.1

    },

    atropine: {

        dosePerKg: 0.02,

        minDose: 0.1,

        maxDose: 0.5

    },

    amiodarone: {

        dosePerKg: 5

    },

    calciumGluconate: {

        dosePerKg: 1

    },

    lidocaine: {

        dosePerKg: 1

    },

    sodiumBicarbonate05: {

        dosePerKg: 0.5

    },

    sodiumBicarbonate1: {

        dosePerKg: 1

    },

    etomidate: {

        dosePerKg: 0.5

    },

    fentanyl: {

        dosePerKg: 1

    },

    ketamine: {

        dosePerKg: 1

    },

    midazolam: {

        dosePerKg: 0.1

    },

    atracurium: {

        dosePerKg: 0.5

    },

    rocuronium: {

        dosePerKg: 1

    },

    succinylcholine: {

        dosePerKg: 1

    },

    defibrillationFirst: {

        dosePerKg: 2

    },

    defibrillationSecond: {

        dosePerKg: 4

    },

    cardioversionFirst: {

        dosePerKg: 0.5

    },

    cardioversionSecond: {

        dosePerKg: 1

    }

};

/* ======================================================

   STANDARD NUMBER CLEANUP

   Removes unnecessary floating-point tails.

   Does NOT introduce clinical dose rounding.

====================================================== */

function cleanEmergencyNumber(value) {

    return Number(

        Number(value).toFixed(6)

    );

}

/* ======================================================

   AGE CONVERSION

   ETT formulas in the verified source use age in years.

====================================================== */

function getEmergencyAgeInYears(

    age,

    ageUnit

) {

    if (ageUnit === "months") {

        return age / 12;

    }

    return age;

}

/* ======================================================

   CALCULATE ALL RESULTS

====================================================== */

function calculateEmergencyMedicationData(

    weight,

    age,

    ageUnit

) {

    const ageYears =

        getEmergencyAgeInYears(

            age,

            ageUnit

        );

    /* ==================================================

       AIRWAY

    =================================================== */

    const ettSize =

        cleanEmergencyNumber(

            4 +

            (

                ageYears / 4

            )

        );

    const ettLength =

        cleanEmergencyNumber(

            12 +

            (

                ageYears / 2

            )

        );

    /* ==================================================

       ADENOSINE

    =================================================== */

    const adenosineInitialCalculated =

        weight *

        EMERGENCY_MEDICATION_CONFIG

            .adenosineInitial

            .dosePerKg;

    const adenosineInitial =

        Math.min(

            adenosineInitialCalculated,

            EMERGENCY_MEDICATION_CONFIG

                .adenosineInitial

                .maxDose

        );

    const adenosineSecondCalculated =

        weight *

        EMERGENCY_MEDICATION_CONFIG

            .adenosineSecond

            .dosePerKg;

    const adenosineSecond =

        Math.min(

            adenosineSecondCalculated,

            EMERGENCY_MEDICATION_CONFIG

                .adenosineSecond

                .maxDose

        );

    /* ==================================================

       ATROPINE

    =================================================== */

    const atropineCalculated =

        weight *

        EMERGENCY_MEDICATION_CONFIG

            .atropine

            .dosePerKg;

    const atropine =

        Math.min(

            Math.max(

                atropineCalculated,

                EMERGENCY_MEDICATION_CONFIG

                    .atropine

                    .minDose

            ),

            EMERGENCY_MEDICATION_CONFIG

                .atropine

                .maxDose

        );

    /* ==================================================

       RETURN VERIFIED RESULTS

    =================================================== */

    return {

        airway: {

            ettSize:

                ettSize,

            ettLength:

                ettLength

        },

        resuscitation: {

            adenosineInitial:

                cleanEmergencyNumber(

                    adenosineInitial

                ),

            adenosineInitialLimitApplied:

                adenosineInitialCalculated >

                EMERGENCY_MEDICATION_CONFIG

                    .adenosineInitial

                    .maxDose,

            adenosineSecond:

                cleanEmergencyNumber(

                    adenosineSecond

                ),

            adenosineSecondLimitApplied:

                adenosineSecondCalculated >

                EMERGENCY_MEDICATION_CONFIG

                    .adenosineSecond

                    .maxDose,

            adrenaline:

                cleanEmergencyNumber(

                    weight *

                    EMERGENCY_MEDICATION_CONFIG

                        .adrenaline

                        .dosePerKg

                ),

            atropine:

                cleanEmergencyNumber(

                    atropine

                ),

            atropineMinimumApplied:

                atropineCalculated <

                EMERGENCY_MEDICATION_CONFIG

                    .atropine

                    .minDose,

            atropineMaximumApplied:

                atropineCalculated >

                EMERGENCY_MEDICATION_CONFIG

                    .atropine

                    .maxDose,

            amiodarone:

                cleanEmergencyNumber(

                    weight *

                    EMERGENCY_MEDICATION_CONFIG

                        .amiodarone

                        .dosePerKg

                ),

            calciumGluconate:

                cleanEmergencyNumber(

                    weight *

                    EMERGENCY_MEDICATION_CONFIG

                        .calciumGluconate

                        .dosePerKg

                ),

            lidocaine:

                cleanEmergencyNumber(

                    weight *

                    EMERGENCY_MEDICATION_CONFIG

                        .lidocaine

                        .dosePerKg

                ),

            sodiumBicarbonate05:

                cleanEmergencyNumber(

                    weight *

                    EMERGENCY_MEDICATION_CONFIG

                        .sodiumBicarbonate05

                        .dosePerKg

                ),

            sodiumBicarbonate1:

                cleanEmergencyNumber(

                    weight *

                    EMERGENCY_MEDICATION_CONFIG

                        .sodiumBicarbonate1

                        .dosePerKg

                )

        },

        induction: {

            etomidate:

                cleanEmergencyNumber(

                    weight *

                    EMERGENCY_MEDICATION_CONFIG

                        .etomidate

                        .dosePerKg

                ),

            fentanyl:

                cleanEmergencyNumber(

                    weight *

                    EMERGENCY_MEDICATION_CONFIG

                        .fentanyl

                        .dosePerKg

                ),

            ketamine:

                cleanEmergencyNumber(

                    weight *

                    EMERGENCY_MEDICATION_CONFIG

                        .ketamine

                        .dosePerKg

                ),

            midazolam:

                cleanEmergencyNumber(

                    weight *

                    EMERGENCY_MEDICATION_CONFIG

                        .midazolam

                        .dosePerKg

                )

        },

        muscleRelaxants: {

            atracurium:

                cleanEmergencyNumber(

                    weight *

                    EMERGENCY_MEDICATION_CONFIG

                        .atracurium

                        .dosePerKg

                ),

            rocuronium:

                cleanEmergencyNumber(

                    weight *

                    EMERGENCY_MEDICATION_CONFIG

                        .rocuronium

                        .dosePerKg

                ),

            succinylcholine:

                cleanEmergencyNumber(

                    weight *

                    EMERGENCY_MEDICATION_CONFIG

                        .succinylcholine

                        .dosePerKg

                )

        },

        defibrillation: {

            firstShock:

                cleanEmergencyNumber(

                    weight *

                    EMERGENCY_MEDICATION_CONFIG

                        .defibrillationFirst

                        .dosePerKg

                ),

            secondShock:

                cleanEmergencyNumber(

                    weight *

                    EMERGENCY_MEDICATION_CONFIG

                        .defibrillationSecond

                        .dosePerKg

                )

        },

        cardioversion: {

            firstShock:

                cleanEmergencyNumber(

                    weight *

                    EMERGENCY_MEDICATION_CONFIG

                        .cardioversionFirst

                        .dosePerKg

                ),

            secondShock:

                cleanEmergencyNumber(

                    weight *

                    EMERGENCY_MEDICATION_CONFIG

                        .cardioversionSecond

                        .dosePerKg

                )

        }

    };

}

/* ======================================================
   EMERGENCY MEDICATIONS
   LIMIT BADGE RENDERER
====================================================== */

function setEmergencyLimitBadge(
    elementId,
    text,
    type
) {

    const badge =
        document.getElementById(
            elementId
        );

    if (!badge) {
        return;
    }


    /* Reset previous badge */

    badge.textContent = "";

    badge.classList.remove(
        "emergencyLimitMax",
        "emergencyLimitMin"
    );


    /* No limit applied */

    if (!text) {

        badge.classList.add(
            "hiddenEmergencyLimitBadge"
        );

        return;

    }


    /* Show badge */

    badge.textContent =
        String(text);

    badge.classList.remove(
        "hiddenEmergencyLimitBadge"
    );


    if (type === "min") {

        badge.classList.add(
            "emergencyLimitMin"
        );

    } else {

        badge.classList.add(
            "emergencyLimitMax"
        );

    }

}

/* ======================================================
   EMERGENCY MEDICATIONS
   ETT SIZE DISPLAY ROUNDING
   Nearest 0.5 mm
====================================================== */

function roundEmergencyEttSize(value) {

    return Math.round(
        Number(value) * 2
    ) / 2;

}

/* ======================================================
   PHDU MEDCORE
   CLINICAL VERIFIERS POPUP
====================================================== */


/* ======================================================
   OPEN CLINICAL VERIFIERS
====================================================== */

function openClinicalVerifierPopup() {

    const overlay =
        document.getElementById(
            "clinicalVerifierOverlay"
        );

    if (!overlay) {

        console.error(
            "PHDU MedCore Clinical Verifier overlay was not found."
        );

        return;

    }


    overlay.classList.remove(
        "hiddenClinicalVerifier"
    );

    overlay.setAttribute(
        "aria-hidden",
        "false"
    );


    /* Always open popup at top */

    overlay.scrollTop = 0;

}


/* ======================================================
   CLOSE CLINICAL VERIFIERS
====================================================== */

function closeClinicalVerifierPopup() {

    const overlay =
        document.getElementById(
            "clinicalVerifierOverlay"
        );

    if (!overlay) {
        return;
    }


    overlay.classList.add(
        "hiddenClinicalVerifier"
    );

    overlay.setAttribute(
        "aria-hidden",
        "true"
    );

    overlay.scrollTop = 0;

}

/* ======================================================
   PHDU MEDCORE
   RETURN TO SPLASH SCREEN
====================================================== */

function returnToSplashScreen() {

    const moduleMenu =
        document.getElementById(
            "moduleMenu"
        );

    const splashScreen =
        document.getElementById(
            "splashScreen"
        );


    if (moduleMenu) {

        moduleMenu.classList.add(
            "hiddenMenu"
        );

    }


    if (splashScreen) {

        splashScreen.style.display =
            "";

    }


    /* Reset splash logo state */

    const logo =
        document.getElementById(
            "logoImage"
        );

    if (logo) {

        logo.classList.remove(
            "logoTapped"
        );

    }


    /* Ensure splash returns to top */

    window.scrollTo(
        0,
        0
    );

}
