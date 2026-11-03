# Data attribution

`case_light_route_osm.json` (Route 1) and `case_light_route_osm_b.json` (Route 2) contain data from OpenStreetMap.

- Map data (c) OpenStreetMap contributors: https://www.openstreetmap.org/copyright
- License: Open Data Commons Open Database License (ODbL) 1.0: https://opendatacommons.org/licenses/odbl/1-0/
- Source, Route 1: an OpenStreetMap API map call for the box -84.600,34.028,-84.578,34.050 (west, south, east, north), near Kennesaw State University, fetched on 2026-11-02 at about 13:35 ET.
- Source, Route 2: an OpenStreetMap API map call for the box -84.622,34.028,-84.600,34.050 (west, south, east, north), about 2 km further west near downtown Kennesaw, fetched on 2026-11-02 at about 14:28 ET.

## What was changed (Route 1)

- Kept only the house number and street of residential buildings on four streets: Fairways Court, Lee Court, Frey Lake Road and Tributary Court. Buildings tagged with a name, phone, email, leisure, amenity, shop or office were dropped (one: a park at 3506 Lee Court).
- Street names are written the way a carrier's case label shows them (upper case, USPS Publication 28 suffixes): FAIRWAYS CT, LEE CT, FREY LAKE RD, TRIBUTARY CT.
- The 149 house numbers are put in a case order following USPS handbook M-41 224.12 (on each street, the odd side ascending, then the even side descending), two to a case separation.
- One number was added that is not OpenStreetMap data: the hold letter, 3553 FREY LAKE RD. It was chosen because it does not exist on that street in OpenStreetMap or in the county's active address list. The county list was used only for that check and is not included here.

## What was changed (Route 2)

- Kept only the house number and street of residential buildings on eight streets: Irvin Court, Shirley Drive, Pine Hill Drive, Duvall Place, Douglas Lane, Mcgarity Lane, Jebs Court and Terry Lane Northwest. No building was dropped for a name, phone, email, leisure, amenity, shop or office tag.
- Street names are written the way a carrier's case label shows them: IRVIN CT, SHIRLEY DR, PINE HILL DR, DUVALL PL, DOUGLAS LN, MCGARITY LN, JEBS CT, TERRY LN NW.
- The 146 house numbers are put in the same M-41 224.12 case order, two to a separation; a street with an odd count ends on a one-number separation (slots 45, 52, 74 and 78) instead of sharing a separation with the next street.
- The 12 practice pieces sit on the same slots and sides as Route 1's.
- One number was added that is not OpenStreetMap data: the hold letter, 3053 SHIRLEY DR, chosen because it does not exist on that street in OpenStreetMap or in the county's active address list. As for Route 1, the county list was used only for that check and is not included here.

These files are derivative databases of OpenStreetMap and stay under the ODbL. Anyone who publicly uses an adapted version of them must offer that version under the ODbL too.

## What it is not

The house numbers belong to real buildings. They are used only as practice labels on a training case. They are not USPS carrier routes, and the files hold no information about the people who live there: no names, no phone numbers, nothing but a number and a street.

## Code

`make_route_table.py` (which writes both route tables in `Assets/Scripts/CaseLightRoute.ts` from the JSON files) and the rest of the Lens code are not data and are not covered by the ODbL. The JSON files were built by `research/proto_case_layout/build_case_light_routes.py` in the parent project, which has its own tests.
