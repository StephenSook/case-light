"""Write the route tables in Assets/Scripts/CaseLightRoute.ts from the two route files in data/.

Usage (from the project folder):
  python3 -I data/make_route_table.py          rewrite the generated block
  python3 -I data/make_route_table.py --check  exit 1 if the block does not match the JSON files

Route 1 comes from case_light_route_osm.json and Route 2 from case_light_route_osm_b.json. Route 1's
part of the block is written exactly as before Route 2 existed (STREETS, CELLS, CANDIDATES); Route 2
follows it under its own names (STREETS_ROUTE_2, CELLS_ROUTE_2, CANDIDATES_ROUTE_2).

Only the lines between the BEGIN and END markers in CaseLightRoute.ts are written. This script is
code, not data: it is not covered by the ODbL (see data/ATTRIBUTION.md).
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROUTE_FILES = [
    (os.path.join(HERE, "case_light_route_osm.json"), ""),
    (os.path.join(HERE, "case_light_route_osm_b.json"), "_ROUTE_2"),
]
TS_PATH = os.path.join(HERE, "..", "Assets", "Scripts", "CaseLightRoute.ts")
BEGIN = "// BEGIN GENERATED ROUTE TABLE (data/make_route_table.py; do not edit by hand)"
END = "// END GENERATED ROUTE TABLE"


def route_lines(d, suffix):
    """One route's table. With suffix "" these are exactly the lines written before Route 2 existed."""
    out = []
    if suffix:
        out.append("")
        out.append(f"/** Route 2 ({d['source']}). */")
    out.append(f"export const STREETS{suffix}: Street[] = [" + ", ".join(f'{{ name: "{s}" }}' for s in d["streets"]) + "]")
    out.append("")
    out.append("/** [slot, street, left number, right number or null, blockStart], in delivery order. */")
    out.append(f"const CELLS{suffix}: [number, number, number, number | null, boolean][] = [")
    for c in d["cells"]:
        right = "null" if c["right"] is None else str(c["right"])
        out.append(f"  [{c['slot']}, {c['street']}, {c['left']}, {right}, {'true' if c['blockStart'] else 'false'}],")
    out.append("]")
    out.append("")
    out.append("/** Bundle pieces in practice order. The hold piece's number does not exist on its street. */")
    out.append(f"const CANDIDATES{suffix}: Candidate[] = [")
    for p in d["pieces"]:
        out.append(f"  {{ street: {p['street']}, number: {p['number']}, hold: {'true' if p['hold'] else 'false'} }},")
    out.append("]")
    return out


def block(routes):
    out = [BEGIN]
    for d, suffix in routes:
        out.extend(route_lines(d, suffix))
    out.append(END)
    return "\n".join(out)


def main():
    routes = [(json.load(open(path)), suffix) for path, suffix in ROUTE_FILES]
    ts = open(TS_PATH).read()
    i, j = ts.find(BEGIN), ts.find(END)
    if i < 0 or j < 0:
        sys.exit("markers not found in CaseLightRoute.ts")
    new = ts[:i] + block(routes) + ts[j + len(END):]
    if "--check" in sys.argv:
        if new != ts:
            print("CaseLightRoute.ts tables do NOT match the route files in data/")
            sys.exit(1)
        for n, (d, _) in enumerate(routes, start=1):
            hold = [p["address"] for p in d["pieces"] if p["hold"]]
            print(f"Route {n}: table matches {os.path.basename(ROUTE_FILES[n - 1][0])}: {len(d['streets'])} streets, {len(d['cells'])} separations, {d['deliveries']} deliveries, {len(d['pieces'])} pieces, hold {hold[0] if hold else '?'}")
        return
    open(TS_PATH, "w").write(new)
    print("tables written")


if __name__ == "__main__":
    main()
