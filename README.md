# UK Rail Digital Landscape — Current State

Interactive local service-landscape map generated from:

`/Users/mila/Downloads/UK_Rail_Digital_Landscape_CURRENT_STATE_EXPANDED.xlsx`

This expanded Excel workbook supersedes the earlier Pass 1 / Pass 2 files. The previous dataset is not merged into the app output.

## Run

Open the standalone browser file directly:

`dist/uk-rail-digital-ecosystem-current-state.html`

The editable source page can also be opened directly:

`index.html`

It loads `data/rail-ecosystem-data.js`, a generated JavaScript data module derived from `data/rail-ecosystem.json`, so it does not depend on browser `file://` JSON fetch behaviour.

Or regenerate and serve the development version:

```bash
/Users/mila/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 scripts/preprocess.py
/Users/mila/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -m http.server 8000
```

Open:

`http://localhost:8000`

## Build Standalone HTML

After regenerating `data/rail-ecosystem.json`, rebuild the single browser-openable file:

```bash
/Users/mila/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 scripts/build_standalone.py
```

## Workbook Interpretation

The processor inspects every worksheet and preserves non-empty worksheet rows in `data/workbook-raw-sheets.json`.

Primary sources:

- `Master Inventory`: authoritative digital-property records, URLs, ownership labels, property type, audience, evidence, confidence and verification status.
- `Significant Sites`: audited passenger-facing service records, passenger needs, functionality, journey stages, transactional/account fields and relationship notes.
- `Capability Inventory`: authoritative capability list, passenger needs, journey stages, provider references, prevalence, transaction/account/provider status and evidence.
- `Journey Stage Map`: cross-check of capability-to-journey relationships.
- `External Hand-offs` and `Fragmented Journeys`: explicit transitions between services, domains, organisations and responsibility boundaries.
- `Shared Service Map`: shared platforms and supplier/service relationships.
- `SME Validation`, `SME Validation Required`, `Legacy & Unclear`: validation gaps and uncertain records.
- `TOC Comparison`, `National vs TOC Gaps`, `Shared vs Unique`, `Duplication Audit`: comparison, prevalence and duplication evidence.
- `Verification Log`, `Changes from Pass 1 + 2`, `Expanded Summary`: verification expansion history.

## Data Model

The JSON is relational rather than one flat table:

- Organisation
- Brand / service label
- Digital property / service
- Capability
- Passenger need
- Passenger journey stage
- External hand-off

Generated IDs are stable slugs derived from workbook row order and source labels. Display text, URLs, evidence, dates, confidence and verification fields are preserved.

## Transformations

- The workbook's `Brand / service` field is preserved exactly. It is also counted as a brand/service label because the workbook does not contain a separate formal brand taxonomy.
- Service families are derived from workbook text in capability, need, purpose, website type and relationship fields. This grouping is for navigation only.
- A capability can belong to more than one service family when the workbook wording supports more than one family.
- Journey stages are parsed from workbook stage labels, numeric references and `1-11` ranges.
- Direct service-to-capability links are created from `Significant Sites` functionality text. Exact matches are treated as confirmed; softer text matches are retained as `Needs verification`.
- Capability Inventory provider lists are preserved as provider references unless they can be tied to a precise digital property.
- Digital properties without a direct capability or journey-stage relationship are retained in the Audit layer rather than deleted.

## Prevalence

The app uses the workbook's own `Common / specialist / unique` and `Shared vs Unique` classifications:

- Universal / near-universal
- Common
- Specialist
- Unique
- Unclassified

Where the `TOC Comparison` matrix contains a matching capability, the app also shows `available TOCs / audited TOCs`. These counts describe the current audit only and are not recommendations.

## Missing Data And Uncertainty

The app keeps distinct states:

- `Verified`
- `Partially verified`
- `SME validation required`
- `Not found in audit`
- `Unclassified`

The processor does not convert unknowns into confirmed absences. Detail panels show only fields with captured values, so empty workbook fields are not visually promoted into evidence.

## Visualisation Structure

The page has one dominant visual: a passenger-journey by service-family landscape matrix.

Modes:

- `Overview`: journey stages, service families, major capability groups, counts and prevalence.
- `Explore`: expands more capabilities and digital offerings.
- `Full landscape`: expands the full landscape and all audit records for validation/export.

The interface uses progressive disclosure:

- The first screen shows orientation counts, a concise explanation, and neutral current-state signals.
- The passenger journey stage navigator can focus one stage while keeping the full journey context visible.
- Capability cards show prevalence, offering counts, provider-type breakdowns and evidence-derived signals before listing individual services.
- Expanded service lists sort national/shared services first, then TOCs, external providers and specialist/unclear records by default.
- Filters are collapsed behind a compact control; active filters appear as removable chips.
- Search highlights matches in context rather than replacing the landscape with a detached results list.
- `Highlight complexity` emphasises concentrations of offerings, hand-offs, external dependencies and validation flags without implying a recommendation.
- `Show exceptions` narrows the view to specialist, unusual, external, separate-portal or validation-relevant items.
- `Focus on this capability` and journey-stage focus support workshop discussion while preserving a clear return to the full landscape.
- `- / + / Fit / Reset` zoom controls affect only the journey landscape canvas, not the application chrome.
- `Presentation view` hides secondary controls and metadata for screen-sharing.

The evidence drawer is organised into:

- `What is it?`
- `What does it enable?`
- `Where does it appear?`
- `How is it delivered?`
- `Evidence`

## PDF Export

The page includes:

- `Export current view as PDF`
- `Export full landscape as PDF`

PDF export uses the vendored browser-side `html2canvas` and `jsPDF` libraries in `vendor/`. The standalone HTML embeds both libraries, so export works when the HTML file is opened directly.

Export behaviour:

- Captures the complete landscape element, not just the visible viewport.
- Preserves active filters, search highlighting, visible mode and expanded/collapsed state for current-view export.
- Full-landscape export temporarily renders the complete expanded map, paginates it as A3 landscape PDF pages, then restores the previous mode.
- Hides interactive-only controls inside the export area.
- Includes an export header with view, export date and data date, plus page footers.

## Coverage Test

`scripts/preprocess.py` writes programmatic coverage results into `data/rail-ecosystem.json` and `DATA_QUALITY_REPORT.md`.

Current target:

- Digital properties unmapped: `0`
- Capabilities unmapped: `0`
- Passenger needs unmapped: `0`

Records without explicit journey or capability relationships remain represented in the audit inventory and are flagged as such in the data-quality report.
