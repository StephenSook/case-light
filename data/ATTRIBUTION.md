# Data attribution

`case_light_route_osm.json` contains data from OpenStreetMap.

- Map data (c) OpenStreetMap contributors: https://www.openstreetmap.org/copyright
- License: Open Data Commons Open Database License (ODbL) 1.0: https://opendatacommons.org/licenses/odbl/1-0/
- Source: an OpenStreetMap API map call for the box -84.600,34.028,-84.578,34.050 (west, south, east, north), near Kennesaw State University, fetched on 2026-11-02 at about 13:35 ET.

## What was changed

- Kept only the house number and street of residential buildings on four streets: Fairways Court, Lee Court, Frey Lake Road and Tributary Court. Buildings tagged with a name, phone, email, leisure, amenity, shop or office were dropped (one: a park at 3506 Lee Court).
- Street names are written the way a carrier's case label shows them (upper case, USPS Publication 28 suffixes): FAIRWAYS CT, LEE CT, FREY LAKE RD, TRIBUTARY CT.
- The 149 house numbers are put in a case order following USPS handbook M-41 224.12 (on each street, the odd side ascending, then the even side descending), two to a case separation.
- One number was added that is not OpenStreetMap data: the hold letter, 3553 FREY LAKE RD. It was chosen because it does not exist on that street in OpenStreetMap or in the county's active address list. The county list was used only for that check and is not included here.

This file is a derivative database of OpenStreetMap and stays under the ODbL. Anyone who publicly uses an adapted version of it must offer that version under the ODbL too.

## What it is not

The house numbers belong to real buildings. They are used only as practice labels on a training case. They are not a USPS carrier route, and the file holds no information about the people who live there: no names, no phone numbers, nothing but a number and a street.

## Code

`make_route_table.py` (which writes the table in `Assets/Scripts/CaseLightRoute.ts` from the JSON) and the rest of the Lens code are not data and are not covered by the ODbL. The JSON was built by `research/proto_case_layout/build_case_light_route.py` in the parent project, which has its own tests.
