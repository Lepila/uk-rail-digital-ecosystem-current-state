# UK Rail Digital Landscape Data-Quality Report

Generated: 2026-09-09T18:29:30Z
Source workbook: `/Users/mila/Downloads/UK_Rail_Digital_Landscape_CURRENT_STATE_EXPANDED.xlsx`

## Data Replacement

- Old dataset removed/replaced: YES
- New expanded Excel successfully imported: YES
- Previous Pass 1 / Pass 2 JSON was not merged into the generated dataset.

## Programmatic Coverage

- Excel digital properties: 245
- Imported into application: 245
- Represented in interface paths: 245
- Unmapped digital properties: 0
- Digital properties without workbook journey mapping: 113
- Digital properties without direct capability relationship: 160
- Excel capabilities: 92
- Capabilities represented: 92
- Unmapped capabilities: 0
- Capabilities without journey mapping: 0
- Passenger needs represented: 92

## Data Quality Counts

- Verified: 230
- Partially verified: 3
- SME validation required: 58
- Unclassified: 0

## Missing Fields

- `masterInventory`: Verification enrichment: 230/245; Notes: 205/245; Verification evidence URL: 187/245; Parent website: 89/245; Relationship / shared platform: 63/245
- `orgPropertyMap`: Key relationship notes: 22/89
- `significantSites`: Verification enrichment: 140/140; Notes: 132/140; Verification evidence URL: 98/140
- `capabilityInventory`: Verification enrichment: 83/92; Verification evidence URL: 74/92; Notes: 35/92
- `journeyStageMap`: Verification enrichment: 92/92; Verification evidence URL: 83/92; 1 Discover / decide to travel: 82/92; 10 Post journey / after-sales: 75/92; 8 On train: 73/92; 3 Choose fare / ticket: 71/92; 6 Travel to station: 71/92; 9 Disruption / recover: 69/92; 11 Ongoing relationship: 67/92; 2 Plan: 64/92; 4 Buy: 64/92; 7 At station: 59/92; 5 Prepare: 38/92
- `nationalVsTocGaps`: Current-state note: 19/27
- `smeValidation`: Evidence / starting point: 8/22
- `evidenceRegister`: Additional notes: 129/267
- `externalHandoffs`: Notes: 38/42
- `verificationLog`: Notes: 51/54

## Duplicate / Contradiction Checks

- No duplicate Master Inventory URLs found.
- No duplicate capability labels found after normalisation.
- The workbook has no formal contradiction field; duplicate URLs, duplicate labels and unmatched provider references are flagged rather than silently resolved.

## Provider References Not Precisely Matched

- Unmatched provider references: 366
  - `Avanti` for `Destination and route inspiration`
  - `EMR` for `Destination and route inspiration`
  - `GWR` for `Destination and route inspiration`
  - `GTR brands` for `Destination and route inspiration`
  - `SWR` for `Destination and route inspiration`
  - `TPE` for `Destination and route inspiration`
  - `LNR` for `Destination and route inspiration`
  - `WMR` for `Destination and route inspiration`
  - `TfW` for `Destination and route inspiration`
  - `Avanti` for `Network / route maps`
  - `Chiltern` for `Network / route maps`
  - `EMR` for `Network / route maps`
  - `GTR brands` for `Network / route maps`
  - `SWR` for `Network / route maps`
  - `TPE` for `Network / route maps`
  - `LNR` for `Network / route maps`
  - `WMR` for `Network / route maps`
  - `TfW` for `Network / route maps`
  - `National Rail/Days Out Guide` for `Offers, 2FOR1 and attraction promotions`
  - `Avanti` for `Offers, 2FOR1 and attraction promotions`
  - `EMR` for `Offers, 2FOR1 and attraction promotions`
  - `GTR brands` for `Offers, 2FOR1 and attraction promotions`
  - `SWR` for `Offers, 2FOR1 and attraction promotions`
  - `TPE` for `Offers, 2FOR1 and attraction promotions`
  - `LNR` for `Offers, 2FOR1 and attraction promotions`
  - `WMR` for `Offers, 2FOR1 and attraction promotions`
  - `TfW` for `Offers, 2FOR1 and attraction promotions`
  - `ACP Rail` for `International visitor rail-pass information`
  - `Interrail` for `International visitor rail-pass information`
  - `Avanti` for `Journey planning`
  - `Chiltern` for `Journey planning`
  - `EMR` for `Journey planning`
  - `GWR` for `Journey planning`
  - `GTR brands (Thameslink/Southern/Great Northern/Gatwick Express)` for `Journey planning`
  - `SWR` for `Journey planning`
  - `TPE` for `Journey planning`
  - `TfW Rail` for `Journey planning`
  - `other retailers` for `Journey planning`
  - `selected TOC and retailer journey planners` for `Via / avoid route options`
  - `most TOC retail engines` for `Compare journey alternatives`
  - `independent retailers` for `Compare journey alternatives`
  - `Avanti` for `Live departures and arrivals`
  - `Chiltern` for `Live departures and arrivals`
  - `EMR` for `Live departures and arrivals`
  - `GWR` for `Live departures and arrivals`
  - `GTR brands (Thameslink/Southern/Great Northern/Gatwick Express)` for `Live departures and arrivals`
  - `SWR` for `Live departures and arrivals`
  - `TPE` for `Live departures and arrivals`
  - `TfW Rail` for `Live departures and arrivals`
  - `most operator sites/apps` for `Live service details / calling points`
  - `Avanti` for `Current disruption information`
  - `Chiltern` for `Current disruption information`
  - `EMR` for `Current disruption information`
  - `GWR` for `Current disruption information`
  - `GTR brands (Thameslink/Southern/Great Northern/Gatwick Express)` for `Current disruption information`
  - `SWR` for `Current disruption information`
  - `TPE` for `Current disruption information`
  - `TfW Rail` for `Current disruption information`
  - `Avanti` for `Planned engineering works / future service changes`
  - `Chiltern` for `Planned engineering works / future service changes`
  - `EMR` for `Planned engineering works / future service changes`
  - `GWR` for `Planned engineering works / future service changes`
  - `GTR brands (Thameslink/Southern/Great Northern/Gatwick Express)` for `Planned engineering works / future service changes`
  - `SWR` for `Planned engineering works / future service changes`
  - `TPE` for `Planned engineering works / future service changes`
  - `TfW Rail` for `Planned engineering works / future service changes`
  - `National Rail interactive route map` for `Live network / route status map`
  - `Greater Anglia live train service map` for `Live network / route status map`
  - `GTR live map` for `Live network / route status map`
  - `EMR live network map` for `Live network / route status map`
  - `TfW live map` for `Live network / route status map`
  - `selected TOCs` for `Live network / route status map`
  - `GWR live carriage capacity` for `Crowding / capacity information`
  - `Chiltern Train Capacity` for `Crowding / capacity information`
  - `Greater Anglia Find Less Busy Trains` for `Crowding / capacity information`
  - `Southeastern SeatFinder` for `Crowding / capacity information`
  - `SWR How busy is my train?` for `Crowding / capacity information`
  - `LNR/WMR How busy is my train?` for `Crowding / capacity information`
  - `TfW expected crowding` for `Crowding / capacity information`
  - `National Rail app` for `Save favourite stations / journeys`

## SME Validation And Uncertainty

- Evidence gap records: 46
- `not found`, `unknown`, `unclear`, `not applicable` and `needs verification` are kept as distinct states.
- Blank fields remain blank in JSON and display as `Not captured in audit` in detail panels.

## Visualisation Coverage

- Every Master Inventory digital property is available through the Audit inventory layer.
- Every Capability Inventory capability is available through the matrix or Audit capability layer.
- Capabilities without a workbook journey stage are retained for audit review instead of being deleted.
- Digital properties without direct capability evidence are retained in the audit inventory and marked by missing relationship counts.
