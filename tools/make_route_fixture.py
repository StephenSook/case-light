# Owns: writing the LEAF tests' own copy of the two route data files (Assets/Scripts/Leaf/CaseLightRouteFixture.ts)
#   straight from data/*.json, so the route scenarios never read the product's tables.
# Talks to: data/case_light_route_osm.json, data/case_light_route_osm_b.json (read only).
# Must not: read Assets/Scripts/CaseLightRoute.ts, or anything outside data/.
#
# Usage, from lens/CaseLight:
#   python3 tools/make_route_fixture.py           write the fixture
#   python3 tools/make_route_fixture.py --check   exit 1 if the fixture differs from what this script writes
import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "Assets/Scripts/Leaf/CaseLightRouteFixture.ts"
FILES = {1: "data/case_light_route_osm.json", 2: "data/case_light_route_osm_b.json"}


def render() -> str:
    lines = []
    lines.append("// Owns: the tester's copy of the two route data files (streets, the 75 cell labels, the letters, the hold number, the attribution), written straight from data/*.json by the tester's own script, for the route LEAF scenarios.")
    lines.append("// Talks to: nothing (pure data); read by CaseLightRouteSupport.")
    lines.append("// Must not: be generated from or checked against the product's CaseLightRoute.ts (it is the independent expectation).")
    lines.append("")
    lines.append("/**")
    for r, f in FILES.items():
        sha = hashlib.sha256((ROOT / f).read_bytes()).hexdigest()
        lines.append(f" * Route {r}: {f}, SHA-256 {sha}.")
    lines.append(" */")
    lines.append("")
    lines.append("export interface FixtureCell {\n  slot: number\n  street: number\n  left: number\n  right: number | null\n}")
    lines.append("export interface FixturePiece {\n  address: string\n  hold: boolean\n  slot: number\n  side: number\n}")
    lines.append("export interface FixtureRoute {\n  streets: string[]\n  cells: FixtureCell[]\n  pieces: FixturePiece[]\n  holdNumber: number\n  attribution: string\n}")
    lines.append("")
    lines.append("export const ROUTE_FIXTURE: {[route: number]: FixtureRoute} = {")
    for r, f in FILES.items():
        d = json.loads((ROOT / f).read_text())
        cells = ", ".join(f"{{slot: {c['slot']}, street: {c['street']}, left: {c['left']}, right: {'null' if c['right'] is None else c['right']}}}" for c in d["cells"])
        pieces = ", ".join(f"{{address: {json.dumps(p['address'])}, hold: {'true' if p['hold'] else 'false'}, slot: {p.get('slot', -2)}, side: {p.get('side', -1)}}}" for p in d["pieces"])
        lines.append(f"  {r}: {{")
        lines.append(f"    streets: {json.dumps(d['streets'])},")
        lines.append(f"    cells: [{cells}],")
        lines.append(f"    pieces: [{pieces}],")
        lines.append(f"    holdNumber: {d['holdNumber']},")
        lines.append(f"    attribution: {json.dumps(d['attribution'])},")
        lines.append("  },")
    lines.append("}")
    return "\n".join(lines) + "\n"


def main() -> int:
    text = render()
    if "--check" in sys.argv[1:]:
        if OUT.read_text() != text:
            print(f"FAIL: {OUT.relative_to(ROOT)} differs from what tools/make_route_fixture.py writes")
            return 1
        print(f"{OUT.relative_to(ROOT)} matches both route files")
        return 0
    OUT.write_text(text)
    print("wrote", OUT.relative_to(ROOT))
    return 0


if __name__ == "__main__":
    sys.exit(main())
