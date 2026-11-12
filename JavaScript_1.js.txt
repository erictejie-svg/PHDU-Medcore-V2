/* ======================================================
   PHDU MEDCORE
   DRUG DATABASE STATE
   Version 2 — Search on Demand
====================================================== */

/*
   The full drug database is not loaded during startup.

   Matching medications will be requested only after
   the user enters at least two letters.
*/

let DRUGS = [];

console.log(
    "PHDU MedCore ready — drug search will load on demand."
);
