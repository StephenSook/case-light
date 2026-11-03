# Owns: writing tests/fixtures/route<N>_reference_order.json: each route's delivery order as the Python reference
#   (research/proto_case_layout/case_layout.py, route_order: USPS M-41 loop per street) computes it from that route's
#   house numbers, for the node test that checks the Lens's tables against it.
# Talks to: case_layout.py (imported from --reference), data/case_light_route_osm*.json (read only).
# Must not: read Assets/Scripts/CaseLightRoute.ts (the TypeScript is what the fixture checks), or anything PRIVATE.
#
# Usage, from lens/CaseLight:
#   python3 tools/export_reference_fixtures.py [--reference DIR]           write both fixtures
#   python3 tools/export_reference_fixtures.py [--reference DIR] --check   exit 1 if a fixture differs
# DIR defaults to ../../research/proto_case_layout (the research folder next to the lens folder). It is not in this
# repository, so CI does not regenerate the fixtures; the node test checks the TypeScript against them on every run.
import hashlib
import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ROUTES = {1: "data/case_light_route_osm.json", 2: "data/case_light_route_osm_b.json"}


def load_reference(ref_dir: Path):
    path = ref_dir / "case_layout.py"
    if not path.is_file():
        raise SystemExit(f"FAIL: {path} not found (pass --reference DIR)")
    spec = importlib.util.spec_from_file_location("case_layout", path)
    mod = importlib.util.module_from_spec(spec)
    sys.modules["case_layout"] = mod
    spec.loader.exec_module(mod)
    return mod, hashlib.sha256(path.read_bytes()).hexdigest()


def fixture_for(route: int, case_layout, ref_sha: str) -> str:
    data_path = ROOT / ROUTES[route]
    d = json.loads(data_path.read_text())
    streets = d["streets"]
    numbers = {i: set() for i in range(len(streets))}
    for c in d["cells"]:
        numbers[c["street"]].add(c["left"])
        if c["right"] is not None:
            numbers[c["street"]].add(c["right"])
    order = []
    for i, name in enumerate(streets):
        for dlv in case_layout.route_order([case_layout.Segment(street=name, numbers=tuple(sorted(numbers[i])))]):
            order.append([i, dlv.number])
    out = {
        "about": "Delivery order computed by the Python reference (case_layout.route_order, M-41 loop: odd side ascending, then even side back) from this route's house numbers. Written by tools/export_reference_fixtures.py.",
        "reference": "research/proto_case_layout/case_layout.py",
        "referenceSha256": ref_sha,
        "data": ROUTES[route],
        "dataSha256": hashlib.sha256(data_path.read_bytes()).hexdigest(),
        "attribution": d["attribution"],
        "streets": streets,
        "deliveries": len(order),
        "order": order,
    }
    return json.dumps(out, indent=1) + "\n"


def _u32(x: float) -> int:
    """JavaScript's `>>> 0` on an integer-valued double."""
    return int(x) % 2**32


def recall_order_js(n: int, pass_number: int) -> list[int]:
    """The Lens's recallOrder (CaseLightRoute.ts), step for step, in IEEE doubles as JavaScript runs it.

    1103515245 * seed goes past 2**53, so JavaScript rounds the product before `>>> 0`. Python floats are the same
    IEEE doubles, so float arithmetic here reproduces the Lens exactly; exact integer arithmetic would not.
    """
    order = list(range(n))
    seed = _u32(1103515245.0 * float(pass_number + 7) + 12345.0)
    for i in range(n - 1, 0, -1):
        seed = _u32(1103515245.0 * float(seed) + 12345.0)
        j = seed % (i + 1)
        order[i], order[j] = order[j], order[i]
    if n > 1 and order == list(range(n)):
        order = order[1:] + order[:1]
    return order


def recall_fixture() -> str:
    orders = {str(n): [recall_order_js(n, p) for p in range(6)] for n in range(2, 13)}
    out = {
        "about": "Recall pass orders as the Lens computes them (recallOrder in CaseLightRoute.ts): a deterministic linear congruential shuffle evaluated in IEEE double precision, as JavaScript does, not the textbook exact 32-bit generator. Written by tools/export_reference_fixtures.py (recall_order_js).",
        "observed": {"n": 8, "pass": 0, "order": [4, 3, 2, 6, 1, 7, 5, 0], "source": "Lens Studio log 2 November, session s1-yn2ho6, CASELIGHT_LOG seq 2 to 11"},
        "exactIntegerOrderMustNotMatch": {"n": 8, "pass": 0, "order": [2, 7, 4, 1, 0, 3, 6, 5]},
        "passes": 6,
        "orders": orders,
    }
    assert out["orders"]["8"][0] == out["observed"]["order"], "reference disagrees with the order the Lens played"
    return json.dumps(out, indent=1) + "\n"


def main() -> int:
    args = sys.argv[1:]
    ref_dir = ROOT.parent.parent / "research" / "proto_case_layout"
    if "--reference" in args:
        ref_dir = Path(args[args.index("--reference") + 1]).resolve()
    case_layout, ref_sha = load_reference(ref_dir)
    bad = 0
    for route in ROUTES:
        text = fixture_for(route, case_layout, ref_sha)
        out = ROOT / "tests" / "fixtures" / f"route{route}_reference_order.json"
        if "--check" in args:
            if not out.is_file() or out.read_text() != text:
                print(f"FAIL: {out.relative_to(ROOT)} differs from what the reference computes")
                bad += 1
            else:
                print(f"{out.relative_to(ROOT)} matches the reference ({json.loads(text)['deliveries']} deliveries)")
        else:
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(text)
            print("wrote", out.relative_to(ROOT), f"({json.loads(text)['deliveries']} deliveries)")
    rtext = recall_fixture()
    rout = ROOT / "tests" / "fixtures" / "recall_orders.json"
    if "--check" in args:
        if not rout.is_file() or rout.read_text() != rtext:
            print(f"FAIL: {rout.relative_to(ROOT)} differs from recall_order_js")
            bad += 1
        else:
            print(f"{rout.relative_to(ROOT)} matches recall_order_js")
    else:
        rout.write_text(rtext)
        print("wrote", rout.relative_to(ROOT))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
