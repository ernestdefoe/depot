# Depot: Floxum wave 3, paused 2026-11-19 (resume after Nov 26)

Ernest asked for 100 on Floxum; the Command Center asked for every pre-floxum finding fixed, including the four big rewrites.
Paused on Ernest's word ("Yes, pause rewrites"). This branch (`wip/floxum-wave`) holds the work. `main` stays as released (v1.5.3 + CI commits).
**Nothing from here is on dev, a live forum or Packagist.** Dev was put back on v1.5.3 on 2026-11-19 after the 1.6 build broke signed-in pages there (see "Readers" below).

## Done (19 commits on top of 8a91274, all tests green on SQLite, MySQL and PostgreSQL with a dt_ prefix and the driver confirmed)
- **API resources** (`src/Api/Resource`):
  - `depot-files`:
    - Index, with a searcher in `src/Search` (category, q, compat, mine, watching, queue, featured; sorts) and the page's categories, chips, spotlight, locked teasers and pending count in meta, so the page is still one request.
    - Show by slug.
    - Update, with writable `isApproved`, `isFeatured`, `isPaid`, `isWatching` and `linkDiscussion`, plus the typed details through `FileActions::editable()` and `Service\FileDetails`.
    - Delete.
  - Also: `depot-categories` (admin), `depot-versions`, `depot-reviews` (Create upserts; reply and `isHelpful` writable) and `depot-screenshots`.
  - Custom endpoints left, each for a stated reason:
    - `SaveFileController`: create only, multipart.
    - `SaveVersionController`: multipart.
    - `AddScreenshotsController`: multipart.
    - `LatestController`: public update check, CORS.
    - `OrderCategoriesController`: bulk reorder, returns 204.
    - `DownloadController` and `StylesheetController`.
- **Support discussion** through core's discussion create endpoint (`JsonApi`, as the uploader).
  - Tag rules, approval and other extensions now apply.
  - A refusal is logged with its reasons.
  - Behaviour change: where tags are required, an untagged support discussion is refused.
- **Frontend in TypeScript:**
  - Every file is TS and `allowJs` is off.
  - `FilePage` is split into `components/file/*`, and the forms into `components/form/*`.
  - JSON:API helpers are in `js/src/common/jsonapi.ts`.
  - No function is over 50 lines (`longfuncs.py` is clean).
- **About 25 smaller fixes:**
  - GitHub sync queued (`Job\SyncFile`) with a time budget and a rate-limit stop.
  - Watcher notifications queued (`Job\NotifyWatchers`), and Members-only categories notify again.
  - Download count race (lock plus upsert); fingerprint salt fails closed; daily `depot:prune`.
  - `depot.view` enforced in `ScopeFileVisibility`.
  - Notification lists no longer build cards (no N+1).
  - `$fillable` on the models; Tags and Kiosk bound through `Extend\Conditional` providers.
  - Category three-level guard; compat filter matches `/` and accents; LIKE with `ESCAPE '!'`.
  - Migrations: `->after()` removed, 000014 dropped, 000016 has a real `down()`.
- **Tests:** 70 in all, including `ResourcesTest`, which shows the list, a page and the notification list cost no more queries with 50+ files. Several tests were run against the 1.5.3 code to prove they fail there.

## Last pre-floxum result (run 4, HEAD 4bcd668): 87 if everything is charged, ~97 expected, verdict approved
Still to fix (all small):
- **A.** Editable details are untyped: a PATCH with an array for `install`, `fields` or `requires` returns 500 instead of 422.
  - Where: `FileActions::editable`, `FileDetails`.
  - Fix: `Schema\Str` types, or reject non-strings.
- **B.** Moving a file to another category doesn't recount category totals.
  - Fix: recount in `FileActions::saved` when `wasChanged('category_id')`.
- **C.** Watchers who lose `depot.view` still get new-version emails.
  - Fix: filter `File::audience()` by `depot.view`.
- **D.** Two comments disagree with their code: `ScreenshotResource` (adding screenshots is now `AddScreenshotsController`) and `PruneCommand` ("90 days the trend shows"; the trend is 30).
- **E.** Unused imports in `src/Api/Concerns.php` (`Arr`, `ModelNotFoundException`).
- **F.** The GitHub repository is checked twice on upload (`SaveFileController::source` and `FileDetails`).
- **G.** `groupIds` is sent to visitors in the browse meta categories (`Presenter::category`); only the admin needs it.

Known and waiting:
- `SellerFileUnlock` copies Kiosk's "on sale" rules. Kiosk is adding `Product::scopeSelling`, `scopeOnSale` and `scopeSoldByForum` in its wave release. Switch to them and add `"conflict": {"ernestdefoe/kiosk": "<that version"}`.
- Global `m` in TypeScript: Flarum's typings declare it and webpack doesn't map `mithril`. Probably a Floxum false positive; tell the Command Center if charged.
- Compat LIKE on a JSON column: documented. A companion table is the only other way.

The full findings are in the run-4 JSON. Rerun pre-floxum after A to G and before sending the range to the Command Center.

## Readers first: other code that must change BEFORE Depot 1.6 ships, in this order
1. **Page Builder**:
   - Problem: `js/src/common/sections.ts` `depotData()` reads `GET /api/depot/browse`, which is gone in 1.6.
   - Change: read `GET /api/depot-files` (cards in `data[].attributes`, featured and categories in `meta`), with a `/depot/browse` fallback for older Depot. The snippet is in the shared notes, `depot-1.6-readers.md`.
   - Then Depot adds a conflict on older `ernestdefoe/page-builder`.
2. **Testimonials**:
   - Problem: it reads Depot through `File::scopeVisibleTo` and `GET /api/depot/browse` (its picker).
   - 1.0.5 adds a whereVisibleTo/visibleTo fallback; its next wave release moves the picker off `/api/depot/browse`.
   - Depot's release waits for that version and adds `"conflict": {"ernestdefoe/testimonials": "<that version"}`.
   - **Keep the `File::scopeVisibleTo()` alias for at least one release.** Without it every signed-in page 500'd on dev, about 17:34 to 17:55 UTC on Nov 19.
3. **Announce scripts** (`~/github/scopes/*-announce/depotlink.php`, copied forward):
   - Problem: they build the removed `LinkDiscussionController`.
   - Fix: once 1.6 is on edonline, the next announce must use the JsonApi PATCH replacement in `depot-1.6-readers.md` (proven by `DepotTest::a_discussion_can_be_linked_from_server_code_through_the_api`).
4. **Casefile** calls `File::visibleTo()`. The alias above keeps it working.
5. **Kiosk** public scopes: see above.
Client Area uses `ProductCatalog` and `ProductAccess`, which are unchanged.

Then: the composer conflicts, a fresh `npm ci` + build, ship-check, and the range, pre-floxum score and test results to the Command Center for review. Release and deploy only after approval:
- dev and the showcase via `bin/deploy`;
- ernestdefoe.online by the live rules (no `cache:clear`), then check a real download and the listing pages;
- edonline changelog only.

## Dev testing notes for the resume
- Unreleased code went on dev through a path repository (`local/depot`). Remove it after testing; dev must end on a Packagist release.
- Paid flow without PayPal: Kiosk's admin grant (`POST /api/kiosk/admin/grants`, body `{"data":{"user":"<username>","productId":<id>,"days":1}}`), then end it with `POST /api/kiosk/admin/purchases/<id>/end`. On dev: product 11 sells `kiosk-qa-pack`, and `kioskbuyer` (170) is a non-owner.
- Any test sign-in tokens must be deleted afterwards (they were, on Nov 19).
