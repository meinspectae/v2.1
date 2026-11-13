# Phase 2 — report quality and acceptance results

Date: 30 September 2026

## Changes and how to test

| Change | How to test |
|---|---|
| Optional electricity, water and gas/cooling readings and photos, using the same immediate cloud-photo backup | Leave all meters empty: no section. Enter one reading or take one photo: only that meter prints. Refresh after backup and confirm the photo returns. |
| Optional Move-in reference step: PDF attachment, keys/cards baseline, pre-existing and explicitly identified new defects | Skip: no comparison section. Enter baseline counts and defects: compare with current Keys/Access Cards. Attach a PDF, reopen it with Open PDF after saving, then remove it. Attachment content is not automatically interpreted. |
| One editable English/Arabic legal text source, marked Pending legal review; consistent signed timestamped visible-condition wording; 2021 citation | Read the declaration before signing and in the export. Both languages contain the same seven disclaimer topics including Privacy. No affirmative claim of legally binding effect or signature equivalence remains. |
| Physical PDF page numbering and room/item-aware breaks | Export and inspect all pages: numbers must run 1 to N once each. No page should contain only its footer. Large rooms have continued sections and evidence remains side by side. |
| Noto Naskh Arabic, RTL runs without letter spacing, embedded Arabic PDF font | Open the exported disclaimer and declaration at 150–200% zoom. Inspect joined headings and all seven clauses. |
| Full SHA-256 content hash and version-specific report ID, QR and clickable short link; server registers actual final PDF hash | Finalise while online, then open the link without signing in. Select the original PDF: Verified. Change any byte: Not verified. Paste printed content hash: record match only. Re-download the same version: retrieve the exact registered PDF, not a new rendering. |

## Verification approach

The printed hash is computed from canonical report content before adding the hash/QR, including notes, evidence references, signatures and both legal texts. The server independently hashes the uploaded final PDF. Public verification accepts either the printed content hash (record identity only) or a locally calculated PDF hash (exact file match). PDF bytes stay on the verifier's device. The explanation appears on the public page. Original registered PDFs use private immutable-copy paths, never presigned PUT targets. Public responses contain no property, party, photo or signature data.

## Results actually observed

- PASS: deleted item/room and duplicate merge browser fixture: 1 room, 3 total, 2 rated = 0 Good + 1 Fair + 1 Issue, both findings retained.
- PASS: default room templates exclude carpet, wallpaper and ceiling fans and contain no duplicate item names.
- PASS: optional sections omitted when empty, appear with supplied values, disappear when cleared.
- PASS: 7 English + 7 Arabic clauses; computed RTL direction and Noto Naskh font; exported disclaimer and declaration visually inspected with joined Arabic headings.
- PASS: a changed general note changes the full 64-character content hash.
- PASS: 32-photo synthetic scratch report: 1,256,652 bytes (1.20 MiB), embedded evidence dimensions 2000 × 1500. Metadata contains no photo bytes.
- PASS: 32 distinct high-entropy 2000 × 1500 images: stronger compression was triggered automatically; final 40,477,895 bytes (38.60 MiB), below the 40 MiB application cap. The fixture used object URLs to represent already-backed-up evidence; retaining all huge base64 strings had previously exhausted the sandbox. Production now replaces successful uploads' in-memory data URLs with renewable cloud display URLs.
- PASS: PDF parser confirmed 13 sequential pages, no repeated numbers, a content image on every page, and embedded NotoNaskhArabic font. Exported last page visually checked.
- PASS: QR decoded directly from the rendered last-page image and contained the expected report-version link.
- PASS: public staging verification endpoint with an explicitly seeded test registration: matching content hash and PDF hash return Verified; modified hash returns Not verified. Real public-page PDF selector displayed Verified using that fixture, without login.
- Test registration was disabled after verification. It remains as `qa-verification-test` with non-matching sentinel hashes because the database tool forbids DELETE. It has no real report or personal data.
- PASS: frontend type check/production build and backend type check/build/staging deployment.

## Remaining acceptance checks — not claimed as passed

- Real authenticated camera capture → cloud upload → physical device force-close → Resume, including the new meter photos. Mocked refresh/retry passed in Phase 1, not a physical iOS/Android close test.
- Human assessment of actual scratch/stain/crack sharpness after the stronger export compression; synthetic detail and image dimensions are not a substitute.
- Authenticated end-to-end previous-report PDF attachment and finalisation registration against real storage. Public verification was tested with a seeded registration, not a falsely claimed full inspector workflow.
- Production QR navigation after publishing the new public route; the encoded app.meinspect.com route is not live until publication. Native packages also need their normal release process.
- Legal wording and Arabic translation require legal review.

## Limits

Offline photos are memory-only by explicit requirement. Closing before the upload completes loses those unbacked-up bytes; the app warns clearly and keeps a missing-photo placeholder. Previously IndexedDB-only photos are not migrated because IndexedDB is prohibited. Extremely large reports that remain above 40 MiB after all compression passes are not shared; no evidence is silently discarded.
