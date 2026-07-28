# Threat Model

## Assets

- original PDF bytes;
- signatures and initials;
- form values;
- inserted images;
- completed PDF;
- user trust in the privacy promise.

## Threats

- accidental upload through analytics or error reporting;
- malicious PDF parser exploits;
- embedded PDF actions;
- document data retained in browser storage;
- object URLs retained after use;
- exported PDF containing unexpected active content;
- misleading whiteout presented as redaction;
- third-party script access to editor memory or DOM;
- denial of service from extremely large PDFs.

## Required mitigations

- local-only architecture;
- dependency review and updates;
- CSP and third-party script restrictions;
- explicit cleanup;
- size and complexity limits;
- no secure-redaction claims;
- privacy-focused automated tests;
- clear error handling for unsupported files.
