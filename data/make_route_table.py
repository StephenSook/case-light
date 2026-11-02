"""Write the route table in Assets/Scripts/CaseLightRoute.ts from data/case_light_route_osm.json.

Usage (from the project folder):
  python3 -I data/make_route_table.py          rewrite the generated block
  python3 -I data/make_route_table.py --check  exit 1 if the block does not match the JSON

Only the lines between the BEGIN and END markers in CaseLightRoute.ts are written. This script is
code, not data: it is not covered by the ODbL (see data/ATTRIBUTION.md).
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
JSON_PATH = os.path.join(HERE, "case_light_route_osm.json")
TS_PATH = os.path.join(HERE, "..", "Assets", "Scripts", "CaseLightRoute.ts")
BEGIN = "// BEGIN GENERATED ROUTE TABLE (data/make_route_table.py; do not edit by hand)"
END = "// END GENERATED ROUTE TABLE"


def block(d):
    out = [BEGIN]
    out.append("export const STREETS: Street[] = [" + ", ".join(f'{{ name: "{s}" }}' for s in d["streets"]) + "]")
    out.append("")
    out.append("/** [slot, street, left number, right number or null, blockStart], in delivery order. */")
    out.append("const CELLS: [number, number, number, number | null, boolean][] = [")
    for c in d["cells"]:
        right = "null" if c["right"] is None else str(c["right"])
        out.append(f"  [{c['slot']}, {c['street']}, {c['left']}, {right}, {'true' if c['blockStart'] else 'false'}],")
    out.append("]")
    out.append("")
    out.append("/** Bundle pieces in practice order. The hold piece's number does not exist on its street. */")
    out.append("const CANDIDATES: Candidate[] = [")
    for p in d["pieces"]:
        out.append(f"  {{ street: {p['street']}, number: {p['number']}, hold: {'true' if p['hold'] else 'false'} }},")
    out.append("]")
    out.append(END)
    return "\n".join(out)


def main():
    d = json.load(open(JSON_PATH))
    ts = open(TS_PATH).read()
    i, j = ts.find(BEGIN), ts.find(END)
    if i < 0 or j < 0:
        sys.exit("markers not found in CaseLightRoute.ts")
    new = ts[:i] + block(d) + ts[j + len(END):]
    if "--check" in sys.argv:
        if new != ts:
            print("CaseLightRoute.ts table does NOT match data/case_light_route_osm.json")
            sys.exit(1)
        print(f"CaseLightRoute.ts table matches the JSON: {len(d['cells'])} separations, {d['deliveries']} deliveries, {len(d['pieces'])} pieces")
        return
    open(TS_PATH, "w").write(new)
    print("table written")


if __name__ == "__main__":
    main()
