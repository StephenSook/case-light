# Owns: reading Case Light's placement log (CASELIGHT_LOG v1 lines) and recomputing each session's "From memory: X of Y this session" and each recall pass's "Came back: N" from the placement lines alone, and each Case check's "Case check: N of 2 found" from its pinch lines.
# Talks to: a Lens Studio log file or stdin (the lines CaseLightMain prints; their format is in Assets/Scripts/CaseLightLog.ts). Python 3 standard library only.
# Must not: write anything, call the network, or trust the printed score: it is checked against the placements, never copied.
"""Summarize Case Light sessions from a Lens Studio log and check the on-screen score against the placements.

Usage:
  python3 devpost/tools/summarize_session.py LOGFILE [--offset BYTES] [--session ID]
  python3 devpost/tools/summarize_session.py < LOGFILE

Keeps only lines containing "CASELIGHT_LOG v1" (anywhere in the line, so Lens Studio's own prefix is
fine), groups them by session, and recomputes the score from the placement lines:
  from memory = right recall placements with memory=1; placed = all right recall placements.
A route switch starts the count again (the Lens resets its score there). At every recall pass end
the printed score card text is compared with the recomputed one, and the printed "Came back: N" with
the number of misses (miss or refused-hold) in that pass. Each comparison prints MATCH or MISMATCH.
Case check lines (event=case-check-start, event=case-check, event=case-check-end) are not
placements and never count toward the score; at each Case check end the printed "found" and the card
line "Case check: N of 2 found" are compared with the found pinches logged since its start (MATCH or
MISMATCH), and the wrong pinches with the printed rejected count.
A demo replay session (id prefix "r") is labelled DEMO REPLAY: its lines come from replaying a
recorded run, so they are checked the same way but never count as live play.

Exit status: 0 when every comparison matches, 1 on any MISMATCH or when no CASELIGHT_LOG v1 line
is found, 2 on a usage or file error. Read a session from its start (an --offset taken before the
Lens started), or its counts will not match.
"""
import argparse
import re
import sys

PREFIX = "CASELIGHT_LOG v1"
SCORE_TEMPLATE = "From memory: {x} of {y} this session"
FIELD = re.compile(r'(\w+)=("(?:[^"\\]|\\.)*"|\S*)')


def parse_fields(rest):
    """key=value pairs; quoted values are unescaped."""
    out = {}
    for key, raw in FIELD.findall(rest):
        if raw.startswith('"') and raw.endswith('"') and len(raw) >= 2:
            raw = re.sub(r"\\(.)", r"\1", raw[1:-1])
        out[key] = raw
    return out


def read_lines(args):
    if args.logfile:
        try:
            with open(args.logfile, "rb") as f:
                if args.offset:
                    f.seek(args.offset)
                data = f.read()
        except OSError as e:
            print(f"cannot read {args.logfile}: {e}", file=sys.stderr)
            sys.exit(2)
        text = data.decode("utf-8", errors="replace")
    else:
        text = sys.stdin.read()
    records = []
    for line in text.splitlines():
        i = line.find(PREFIX)
        if i < 0:
            continue
        rest = line[i + len(PREFIX):]
        f = parse_fields(rest)
        if "session" not in f or "seq" not in f:
            continue
        records.append(f)
    return records


def is_replay(session):
    """Demo replay sessions carry the id prefix "r" (live sessions "s"), see Assets/Scripts/CaseLightDemo.ts."""
    return re.match(r"r\d+-", session) is not None


def numbers(text):
    return [int(n) for n in re.findall(r"\d+", text or "")]


def summarize(session, recs):
    """Print one session's summary. Returns (comparisons, mismatches)."""
    recs = sorted(recs, key=lambda r: int(r.get("seq", "0")))
    # The same line read twice (a log that echoes printed lines again) counts once.
    unique, seen, repeats = [], set(), 0
    for r in recs:
        key = tuple(sorted(r.items()))
        if key in seen:
            repeats += 1
            continue
        seen.add(key)
        unique.append(r)
    recs = unique
    if repeats:
        print(f"session {session}: {repeats} repeated line(s) ignored")
    seqs = [int(r["seq"]) for r in recs]
    contiguous = seqs == list(range(seqs[0], seqs[0] + len(seqs)))
    routes = sorted({r.get("route", "?") for r in recs})
    placements = [r for r in recs if "result" in r and "event" not in r]
    checks = [r for r in recs if r.get("event") == "case-check"]
    kind = " [DEMO REPLAY of a recorded run, not live play]" if is_replay(session) else ""
    print(f"session {session}{kind}: {len(recs)} lines (seq {seqs[0]}..{seqs[-1]}{'' if contiguous else ', with gaps'}), {len(placements)} placement attempts, {len(checks)} Case check pinches, route {', '.join(routes)}")
    unaided = total = 0
    pass_misses = 0
    comparisons = mismatches = 0
    last_score = None
    check_found = check_wrong = 0
    for r in recs:
        event = r.get("event")
        mode = r.get("mode")
        if event == "route-switch":
            unaided = total = 0
            print(f"  seq {r['seq']}: route {r.get('from', '?')} -> {r.get('route', '?')}, count starts again")
        elif event == "pass-start":
            pass_misses = 0
        elif event == "pass-end":
            score = r.get("score", "")
            came_back = r.get("cameback", "")
            if mode != "recall" or not score:
                print(f"  pass {r.get('pass', '?')} ({mode}) ended: {r.get('placed', '?')} placed, no score card")
                continue
            last_score = score
            recomputed = SCORE_TEMPLATE.format(x=unaided, y=total)
            shown = numbers(score)
            ok_score = len(shown) >= 2 and shown[0] == unaided and shown[1] == total
            shown_back = numbers(came_back)
            ok_back = len(shown_back) >= 1 and shown_back[0] == pass_misses
            comparisons += 2
            mismatches += (0 if ok_score else 1) + (0 if ok_back else 1)
            print(f"  pass {r.get('pass', '?')} (recall) end: on screen \"{score}\"; from placements \"{recomputed}\" -> {'MATCH' if ok_score else 'MISMATCH'}")
            print(f"  pass {r.get('pass', '?')} (recall) end: on screen \"{came_back}\"; misses in the pass {pass_misses} -> {'MATCH' if ok_back else 'MISMATCH'}")
        elif event == "case-check-start":
            check_found = check_wrong = 0
            print(f"  seq {r['seq']}: Case check after pass {r.get('pass', '?')}, {r.get('letters', '?')} letters in wrong cells {r.get('cells', '?')}")
        elif event == "case-check":
            if r.get("result") == "found":
                check_found += 1
            elif r.get("result") == "wrong":
                check_wrong += 1
        elif event == "case-check-end":
            card = r.get("card", "")
            shown = numbers(card)
            ok_card = len(shown) >= 2 and shown[0] == check_found and r.get("found") == str(check_found) and shown[1] == int(r.get("of", "-1") or -1)
            ok_rej = r.get("rejected") == str(check_wrong)
            comparisons += 2
            mismatches += (0 if ok_card else 1) + (0 if ok_rej else 1)
            print(f"  seq {r['seq']}: Case check ended ({r.get('ended', '?')}): on screen \"{card}\"; found pinches {check_found} -> {'MATCH' if ok_card else 'MISMATCH'}")
            print(f"  seq {r['seq']}: Case check rejected {r.get('rejected', '?')}; wrong pinches {check_wrong} -> {'MATCH' if ok_rej else 'MISMATCH'}")
        elif "result" in r and event is None:
            result = r["result"]
            if mode == "recall" and result == "correct":
                total += 1
                if r.get("memory") == "1":
                    unaided += 1
            elif mode == "recall" and result in ("miss", "refused-hold"):
                pass_misses += 1
    print(f"  recomputed from placements: {SCORE_TEMPLATE.format(x=unaided, y=total)}")
    print(f"  last score card shown: {last_score if last_score is not None else '(no recall pass ended)'}")
    return comparisons, mismatches


def main():
    ap = argparse.ArgumentParser(description="Recompute Case Light's \"From memory: X of Y this session\" from CASELIGHT_LOG v1 placement lines and check it against the score card text the Lens printed.")
    ap.add_argument("logfile", nargs="?", help="Lens Studio log file (default: read stdin)")
    ap.add_argument("--offset", type=int, default=0, help="start reading the file at this byte offset")
    ap.add_argument("--session", help="only this session id")
    args = ap.parse_args()
    records = read_lines(args)
    if args.session:
        records = [r for r in records if r.get("session") == args.session]
    if not records:
        print("no CASELIGHT_LOG v1 lines found")
        sys.exit(1)
    sessions = {}
    for r in records:
        sessions.setdefault(r["session"], []).append(r)
    total_cmp = total_bad = 0
    for session, recs in sessions.items():
        c, b = summarize(session, recs)
        total_cmp += c
        total_bad += b
    verdict = "MISMATCH" if total_bad else "MATCH"
    replays = sum(1 for s in sessions if is_replay(s))
    print(f"{len(sessions)} session(s) ({replays} demo replay), {total_cmp} comparison(s), {total_bad} mismatch(es): {verdict}")
    sys.exit(1 if total_bad else 0)


if __name__ == "__main__":
    main()
