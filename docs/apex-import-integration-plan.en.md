# Plan: APEX CSV Support on “Add Data”

## Goal and scope

Add a local import helper to the “Add Data” page that reads APEX logger files and fills in station fields before the user submits the form.

- CSV files are processed locally in the browser.
- File selection, parsing, preview, and editing must not make backend requests.
- Backend submission is outside the scope of this implementation.
- When the user chooses to import, APEX-mapped station fields are replaced with values from the new import.
- Fields without an APEX mapping and manually entered fish observations must not be overwritten.
- Fish data is still entered manually.
- The full GPS track is used only to derive start/end points and length. It is not stored as a GPX file or sent to the backend.

## Confirmed rules

- `*_trends.csv` is required. `*_faults.csv` and `*_events.csv` are optional and are used only for checks and warnings.
- Files in the same import must belong to the same APEX device.
- A new station starts when `Timer (s)` is `0`, resets to `1` after another value, or clearly decreases. Stations are numbered sequentially from 1 for each import.
- The date and start time come from the first timestamp in the station sequence.
- The start coordinate comes from the row where `Timer (s) = 5`.
- The end coordinate comes from the GPS row with the highest timer value in the sequence.
- `Seconds fished` is the highest `Timer (s)` value in the sequence.
- `Voltage` comes from the nominal voltage in `Waveform`, not the measured `Peak Voltage`.
- `Pulse (DC)` comes from the frequency in Hz in `Waveform`.
- If there are multiple values, use the most common value per station and show a warning when values vary. Ties and invalid values require a manual choice.
- Do not guess pulse values for DC rows without a frequency. Leave the field blank and require a manual value.
- `Display` is the average of `Average Current (A)` for the active station sequence.
- `Transect length` is the sum of GPS distances between consecutive valid points. The estimate is editable and identified as an estimate.
- A new import replaces APEX-mapped values for affected stations; manual fields and fish observations are preserved.
- Dominant river type, weather, water temperature, air temperature, conductivity, and fish data are entered manually.
- Station description remains blank.

## Step-by-step implementation plan

### 1. Build and test a standalone APEX parser

- [x] Create a function that reads trends CSV without UI or backend dependencies.
- [x] Normalize column names and numeric values; report clear errors for invalid CSV, missing required columns, and invalid coordinates.
- [x] Split trends rows into station sequences using the confirmed timer rules.
- [x] Add unit tests for timer resets to 0 and 1, clear timer decreases, missing/invalid columns and rows, coordinates, and waveform values.
- [x] Use the sample data as test input; expect 17 sequence groups from the sample trends file before manual editing.

**Verification before the next step — passed:** all 14 unit tests pass; the uploaded trends file produces 7,704 parsed rows, 17 groups, and no warnings.

### 2. Derive station values from each sequence

- [x] Build a separate transformation from a sequence to a station draft.
- [x] Read date/time from the first row, the start point from `Timer (s) = 5`, the end point from the highest timer value, and seconds fished from the highest timer value.
- [x] If the timer-5 point is missing, use the first valid GPS point at or after timer 5 and show a warning. If no such point exists, leave the coordinate blank and require manual correction.
- [x] Sum the distances between consecutive valid GPS points for transect length; do not smooth or discard points based on GPS accuracy in the first version.
- [x] Parse nominal voltage and Hz from `Waveform`; calculate the most common voltage and pulse values separately.
- [x] Leave pulse blank if the sequence has no interpretable frequency; show a warning and require a manual value.
- [x] Calculate Display as the average of `Average Current (A)` in the sequence.
- [x] Test each field mapping with small, hand-written CSV fixtures, including varying waveforms, tied values, DC, missing timer 5, and missing GPS points.

**Verification before the next step — passed:** 25 tests pass. Sample data produces 17 station drafts; waveform variation produces four voltage/pulse warnings, and the parser reports no invalid input rows.

### 3. Add local file selection and validation

- [x] Add a dedicated “Import APEX data” button to “Add Data”.
- [x] Add a separate “Help” button that opens an explanatory popup without starting an import.
- [x] Create an accessible dialog with short instructions, field mappings, and a representative visual excerpt from `_trends.csv`.
- [x] Mark which excerpt row provides the start point (`Timer (s) = 5`), which provides the end point, and how timer resets separate stations.
- [x] Let users select trends, faults, and events files. Trends is required; faults and events are optional.
- [x] Check file types, expected columns, and whether uploaded APEX files have the same device ID when it can be read from the filename.
- [x] Show understandable errors for unsupported file types, invalid CSV, missing trends files, or files that appear to belong to different devices.
- [x] Use faults/events only for format/device checks and relevant warnings; they must not change station values.
- [x] Add a test that file selection and parsing do not trigger network requests.

**Verification before the next step — passed:** 25 targeted unit tests pass. Tests cover the parser and file set, local file selection without network requests, the accessible help/dialog excerpt, and readable error messages.

### 4. Populate the existing station form locally

- [x] Create one station draft per identified sequence, numbered from 1.
- [x] On import, replace existing values in APEX-mapped fields for affected stations.
- [x] Preserve manual fields, user edits in fields without an APEX mapping, and all fish observations.
- [x] Fill only fields with a defined APEX mapping; leave manual fields and station description blank.
- [x] Keep all generated station fields editable, including station number and calculated values.
- [x] Keep fish/observation rows empty and editable as before.
- [x] Clearly identify estimates and values requiring manual review.
- [x] If an import changes the number of stations in the form, warn before removing stations with manual or fish data.

**Verification before the next step — passed:** the form is populated with imported stations; an integration test checks replacement of APEX fields, preservation of manual fields and fish observations, cancellation, and confirmation before removing stations containing data.

### 5. Verify the complete “Add Data” flow

- [x] Test importing the sample set through the UI and check station count, numbering, date/time, coordinates, seconds, and calculated fields.
- [x] Check that warnings for mixed/missing values are shown and can be corrected in the form.
- [x] Check that users can add, remove, and edit stations after import without breaking numbering.
- [x] Confirm that no backend request is made before form submission.
- [x] Run relevant unit and component tests for the parser and “Add Data” page.

**Verification before completion — passed:** the sample set produces 7,704 trends rows and 17 stations in the form. Tests check date, time, coordinates, seconds fished, transect length, and that no `fetch` calls are made. 37 targeted tests pass, and the frontend build succeeds.

**Note:** The full unit test suite has existing failures in four unrelated areas: `api/postgrest.test.js`, `utils/formatData.test.js`, `lib/user-input/DateInput.test.js`, and `lib/user-input/SpeciesInput.test.js`.

### 6. Remove temporary APEX files before the PR

- [x] Before cleanup, confirm that integration and all relevant tests are complete.
- [x] Remove the temporary APEX upload under `APEX/APEX/`, including raw CSV files, SQLite/fish data, generated map/report files, copied reference tools, and the accompanying `.venv`.
- [x] Keep the integration code and this plan; do not delete other user files.
- [x] Confirm that no APEX uploads or generated APEX data are tracked, staged, or included in the PR.

**Pre-PR verification — passed:** no files remain under `APEX/`, and no APEX files were tracked by Git. After cleanup, the 37 targeted tests pass and the frontend build succeeds.

## Explicitly out of scope for the first version

- Backend submission or persistence.
- Importing or automatically linking fish data.
- Storing the full GPS track in the database or as GPX.
- Automatically filling weather, river type, temperatures, or conductivity.
- Filtering/smoothing the GPS track to correct GPS noise.

## Backend handoff for IT

The frontend does not submit the form. Keep “Publish data” disabled until IT has implemented and verified a storage API contract. The production API is outside this frontend repository.

- Confirm which existing or new backend endpoint will receive the form. Do not assume that the file endpoint in [Upload.md](./Upload.md), which accepts Excel files, also accepts JSON form data.
- Agree on a versioned request/response contract covering river information, station rows, and manually entered fish observations. Use [Station.js](../client/src/models/Station.js), [River.js](../client/src/models/River.js), [Postgres-schema.md](./Postgres-schema.md), and the import mapping as the basis for field names and types.
- Agree on authentication, authorization, CSRF/CORS requirements, and which users are allowed to publish.
- Validate data on the server, including required values, unique station numbers, coordinate bounds, date/time, and relationships between the river, stations, and observations. Client-side validation is not a substitute for server-side validation.
- Persist the river, stations, and observations atomically: an invalid child record must not leave a partially published river. Also define how repeated submissions and double-clicks are handled.
- Return an unambiguous success response with created IDs and structured errors that the frontend can associate with fields. Define how validation errors, authorization errors, conflicts, and temporary server errors are distinguished.
- Send only the final edited form values. Raw APEX CSV files and the full GPS track are not sent; transect length and coordinates in the form are sent as ordinary station values.
- Add contract/integration tests against the backend. Do not enable “Publish data” until persistence, transaction behavior, error display, and repeated submissions have been verified end to end.

## Relevant existing files

- Form: [add-data/+page.svelte](../client/src/routes/add-data/+page.svelte).
- Station fields: [Station.js](../client/src/models/Station.js), [headers.js](../client/src/constants/headers.js), and [Postgres-schema.md](./Postgres-schema.md).

## Implemented changes for the PR

### APEX import and form

- APEX CSV files are read and validated locally in the browser. Trends is required; faults and events are optional. The import checks the CSV format, required columns, and device ID when it can be read from the filename.
- Trends data is split into station sequences. Station drafts populate date, time, start/end coordinates, seconds fished, voltage, pulse, display, and estimated transect length.
- APEX import replaces only APEX-mapped fields. Manual values and fish observations are preserved for stations that remain. The user must confirm before an import removes stations containing data.
- The feature includes a help panel, an illustrative trends table, and visible warnings for values that require manual review.
- “Add Data” has been added to the navigation. The upload page also offers `importmal.xlsx`, and a Norwegian species list is used for fish selection.
- Four display controls appear above the river information. River fields, each station detail, and each fish-observation table can be hidden independently; global controls show/hide all station details or all observation tables. Observation tables have titles that include the station number.
- A light-green “Publish data” button is placed at the bottom right, but remains disabled and explains that backend integration is missing. **PR follow-up:** connect the button to validation and submission of river, station, and fish-observation data to the server/database. Do not enable it until the API contract, error handling, and persistence flow are implemented and verified.

### Map preview and editing

- The map preview shows numbered start/end points and a station table, without fish observations.
- The popup is larger, the table uses the available space, background-page scrolling is locked while it is open, and the mouse wheel over the map zooms the map. Clicking a table row zooms to that station.
- The map and table panels start at equal heights. An accessible, draggable divider changes their proportions; the table scrolls independently when its content does not fit.
- Every table field is editable. Drag-and-drop moves the full station row; saving keeps data and fish observations attached to a stable station key and updates the form order.
- Empty fields are highlighted once station number and boat type are set. Coordinates and station numbers are validated before saving. Popup edits update the form locally and are not sent to the backend.
- The initial imported transect length is calculated by summing distances between consecutive valid GPS points. The GPS track is not retained in client state. When the user changes a start or end coordinate, length is recalculated only as the straight-line distance between those endpoints; no intermediate GPS points are used. Missing or invalid endpoints clear transect length.

### Documentation and verification

- The user manual describes APEX import, warnings, field interpretation, the Cataraft default, editing, and map features: [UserManual.md](./UserManual.md).
- The latest targeted verification for map editing and transect length passed with 40 tests across five test files. ESLint and `npm run build` passed.
- Browser verification confirmed that station rows can be reordered without separating station data from observations, and that transect length changes after coordinate edits. Map wheel zoom and background scroll locking were also checked.
- A full test run is not documented as passing; the earlier full-suite run had the four unrelated failure areas listed above.

### Key implementation files

- APEX parser and validation: [apexImport.js](../client/src/utils/apexImport.js) and [ApexImportPanel.svelte](../client/src/lib/ApexImportPanel.svelte).
- APEX mapping and GPS length: [apexStationDrafts.js](../client/src/utils/apexStationDrafts.js).
- Map draft, coordinate validation, and snapshots: [stationMapPreview.js](../client/src/utils/stationMapPreview.js) and [StationMapPreview.svelte](../client/src/lib/StationMapPreview.svelte).
- Form integration and local state: [add-data/+page.svelte](../client/src/routes/add-data/+page.svelte).
- Popup sizing and scroll lock: [Modal.svelte](../client/src/lib/Modal.svelte).
- Navigation, upload template, and species selection: [Header.svelte](../client/src/lib/Header.svelte), [upload/+page.svelte](../client/src/routes/upload/+page.svelte), [importmal.xlsx](../client/static/importmal.xlsx), and [norwegianFreshwaterFish.js](../client/src/lib/norwegianFreshwaterFish.js).
