# Phase 1 — changes and validation (30 September 2026)

## Status — updated after Phase 2
Phase 1 local checks passed and Phase 2 was implemented afterward. Physical-device cloud recovery remains an acceptance gate. The historical deployment blocker below was resolved by exporting the generated bundle contract; the backend is now deployed to staging. See PHASE_2_VALIDATION.md for current results, including successful stronger-compression stress testing. Earlier failed checks below are retained as history, not the current deployment status.

## Changes and how to test

| Requested change | What changed | How to test |
|---|---|---|
| Deleted items and rooms | Report, summary and email use the final checklist. Removal is autosaved; deletion IDs prevent older rows being restored. | Delete an item and a room, return to Review, open the report and reload. Neither name should occur; total rooms/items must decrease. Keep a different unrated item and confirm it remains as Not Rated. |
| Duplicate checklist entries | Case/whitespace-insensitive merging retains notes and all photo IDs. Conflicting ratings retain their history and use the most severe rating for the single summary bucket. Existing rating history is printed. | Merge two Paint Condition entries with different notes/photos/ratings. There must be one row, both notes and both photo IDs. Repeat for Light Fixtures. |
| Correct summary | Shared rated-item logic replaces checkbox counting. Good includes Very Good and Good; Fair and Issues have separate buckets. Fair / Issues evidence follows the cover summary. Notes are prompted but optional. | Rate one Fair and one Issue, skip their note prompts, add any otherwise-required evidence, continue. Good + Fair + Issues must equal Rated. Both findings must appear with notes/photos when supplied. |
| Optional room features | Carpet, wallpaper/wall covering and ceiling fan excluded when constructing default rooms, not deleted from inspections where deliberately retained. Manual Add Custom Item remains available. | Create each property type and inspect every room. Search these names, then add one manually in a room and confirm it is retained. |
| Portrait cover | Capture dialog with a 3:4 guide; live guide when browser camera streams are supported, system-camera fallback otherwise. Repositionable crop confirmation before accepting the cover. Portrait report layout without stretching. | Use a landscape capture, move the horizontal crop slider and accept. Output should be 3:4. Native system camera fallback requires device confirmation; its system view cannot receive the browser overlay. |
| Photo quality/PDF size | Capture downscales both dimensions proportionally to a longest edge of 2000px, JPEG approximately 0.78. Orientation-normalised native capture/browser image decoding. Side-by-side evidence embeds original JPEG detail separately from the page image. Automatic stronger compression passes and a size confirmation before saving/sharing/emailing. | Capture at least 30 detailed photos. Inspect the final size confirmation, confirm it is at most 40 MB, and zoom into actual scratches/stains/cracks. Original cloud evidence is not replaced by export compression. |
| Draft recovery | Removed IndexedDB dependency and usage. Only metadata and small signatures are stored locally. Per-inspection serial saves, immediate compressed-photo upload, pending/error indicators, online retry, cloud-photo restoration, resume name/start time/photo count, confirmed discard. Draft retained until PDF cloud save succeeds. | Wait for Backed Up, refresh or force-close, reopen and Resume. Confirm notes, ratings, position and every image. Test airplane mode, capture, see pending/error, reconnect and wait for upload. Do not close while pending: memory-only offline photos cannot survive process termination. |

## Checks performed

- **PASS — browser checklist fixture:** delete an item and a room, merge duplicate notes, retain a Not Rated item. Result: 1 room, 3 total items, 2 rated = 0 Good + 1 Fair + 1 Issue, two findings.
- **PASS — default templates:** apartment, townhouse, villa and office room lists checked for duplicate names and default carpet/wallpaper/ceiling fan.
- **PASS — browser capture/crop fixture:** landscape 2400 × 1600 input showed the portrait crop step and sliders. Accepted output 1000 × 1333 (3:4 within pixel rounding).
- **PASS — compression fixture:** 3200 × 2400 becomes 2000 × 1500.
- **PASS — 32-photo synthetic report:** final PDF 1,820,070 bytes (1.74 MB). Local metadata approximately 10 KB, with no photo data URLs. Synthetic scratch illustration, not a real-device sharpness acceptance test.
- **PASS — mocked cloud upload:** inspection/room/item tags recorded; pending photo transitions to backed_up only after storage confirmation.
- **PASS — mocked cloud refresh recovery:** property name, Fair rating, retained note and photo ID/display URL restored after a real browser reload.
- **PASS — mocked network failure/retry:** forced upload HTTP 503 produced error status; an online event retried and transitioned to backed_up.
- **PASS — frontend type check and production build.**
- **PASS — backend type check and bundle compilation.**
- **NOT PASSED — real native force-close/cloud recovery:** not exercised against a live authenticated account or physical device.
- **NOT PASSED — high-entropy 32-photo stress:** an additional random-noise fixture exhausted the browser sandbox. Export was subsequently changed to clone only one report section at a time, but this extreme fixture requires a repeat and device memory assessment. The smaller 32-photo result above must not be treated as proof for every report.
- **NOT PASSED — automatic over-40-MB second pass and real scratch sharpness:** implementation present, no accepted real-device result yet. An extreme report that still exceeds the limit after all passes is blocked from sharing with an explicit error; it is not silently truncated.
- **DEFERRED — all Phase 2 acceptance checks:** optional meters/reference, legal/Arabic wording, sequential numbering/blank-page fixes, public hash/QR verification.

## Deployment blocker

The existing backend and project documentation require named `createApp(edgespark)` with injected platform services. Both registry CLI versions 0.0.22 and 0.0.23 compile it but their deploy validator demands a default **Hono instance**. Actual CLI source inspection confirmed this; a default-exported factory would not solve it. `edgespark pull types` also fails because the platform does not return the requested declarations. The existing backend contract was preserved rather than replacing authentication/storage wiring with a guessed incompatible handler. Original CLI version restored.

Database additions were applied through the platform SQL tool: `inspections.extra_data` and the indexed `inspection_photo_backups` manifest. New manifest routes are implemented but **not deployed**. Existing photo upload/download endpoints remain supported as a compatibility fallback; actual authenticated end-to-end confirmation is still required. Platform support must resolve the deployment-contract mismatch before Phase 1 can be signed off.

## Important limitations / migration

Old photos that exist only in the previous IndexedDB database are not read or migrated, because this request prohibits IndexedDB. Already-cloud-backed legacy photos are recoverable using their paths. Do not promise recovery of old local-only photos after this change; migration needs an explicit user decision.

Notes and ratings are saved to small local metadata on every change and queued for cloud save. Offline photos are intentionally in-memory only, with a visible warning. Force-closing before successful upload necessarily loses their binary data; the retained placeholder reports that loss rather than silently hiding it.
