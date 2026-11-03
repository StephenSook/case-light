// Owns: unit tests for Assets/Scripts/CaseLightLog.ts: the CASELIGHT_LOG v1 line format, quoting, the cell tokens, the session id and the capped buffer.
// Talks to: Assets/Scripts/CaseLightLog.ts (pure, no imports), node:test, node:assert.
// Must not: load any scene code; it parses the lines with its own small parser, not the module's.

import { test } from "node:test"
import assert from "node:assert/strict"
import {
  LOG_PREFIX,
  LOG_CAP,
  logValue,
  placedToken,
  rightToken,
  formatPlacement,
  formatPassStart,
  formatPassEnd,
  formatRouteSwitch,
  randomToken,
  sessionId,
  LogBuffer,
} from "../Assets/Scripts/CaseLightLog.ts"

/** key=value pairs after the prefix; a value is bare or double-quoted with backslash escapes. */
function parse(line) {
  assert.ok(line.startsWith("CASELIGHT_LOG v1 "), line)
  const out = {}
  const re = /([a-z]+)=("((?:[^"\\]|\\.)*)"|[^ ]*)/g
  let m
  while ((m = re.exec(line.slice("CASELIGHT_LOG v1 ".length))) !== null) {
    assert.equal(m[1] in out, false, `key ${m[1]} repeated`)
    out[m[1]] = m[3] !== undefined ? m[3].replace(/\\(.)/g, "$1") : m[2]
  }
  return out
}

const HEAD = { seq: 7, session: "s1-k3x9q2", route: 2, pass: 3, mode: "recall" }

test("prefix and cap", () => {
  assert.equal(LOG_PREFIX, "CASELIGHT_LOG v1")
  assert.equal(LOG_CAP, 400)
})

test("values: bare without spaces or quotes, quoted and escaped otherwise", () => {
  assert.equal(logValue("correct"), "correct")
  assert.equal(logValue(5), "5")
  assert.equal(logValue("1460 TRIBUTARY CT"), '"1460 TRIBUTARY CT"')
  assert.equal(logValue(""), '""')
  assert.equal(logValue('a"b'), '"a\\"b"')
  assert.equal(logValue("a\\b"), '"a\\\\b"')
})

test("cell tokens: a separation number, HOLD for the HOLD block, OFF for no cell", () => {
  assert.equal(placedToken(-1, false), "OFF")
  assert.equal(placedToken(37, true), "HOLD")
  assert.equal(placedToken(75, false), "75")
  assert.equal(rightToken(-2), "HOLD")
  assert.equal(rightToken(76), "76")
})

test("a placement line, field by field, in order", () => {
  const line = formatPlacement({ ...HEAD, piece: 4, address: "1460 TRIBUTARY CT", placed: "75", right: "76", result: "miss", memory: false })
  assert.equal(line, 'CASELIGHT_LOG v1 seq=7 session=s1-k3x9q2 route=2 pass=3 mode=recall piece=4 address="1460 TRIBUTARY CT" placed=75 right=76 result=miss memory=0')
  assert.deepEqual(parse(line), {
    seq: "7", session: "s1-k3x9q2", route: "2", pass: "3", mode: "recall",
    piece: "4", address: "1460 TRIBUTARY CT", placed: "75", right: "76", result: "miss", memory: "0",
  })
  assert.equal(parse(formatPlacement({ ...HEAD, piece: 5, address: "3053 SHIRLEY DR", placed: "HOLD", right: "HOLD", result: "correct", memory: true })).memory, "1")
})

test("pass start, pass end and route switch lines", () => {
  assert.equal(formatPassStart(HEAD, 8), "CASELIGHT_LOG v1 seq=7 session=s1-k3x9q2 route=2 pass=3 mode=recall event=pass-start pieces=8")
  const end = parse(formatPassEnd(HEAD, 8, "From memory: 7 of 8 this session", "Came back: 1"))
  assert.equal(end.event, "pass-end")
  assert.equal(end.placed, "8")
  assert.equal(end.score, "From memory: 7 of 8 this session")
  assert.equal(end.cameback, "Came back: 1")
  const practiceEnd = parse(formatPassEnd({ ...HEAD, mode: "practice" }, 8, "", ""))
  assert.equal(practiceEnd.score, "")
  assert.equal(practiceEnd.cameback, "")
  assert.equal(formatRouteSwitch({ ...HEAD, mode: "idle" }, 1), "CASELIGHT_LOG v1 seq=7 session=s1-k3x9q2 route=2 pass=3 mode=idle event=route-switch from=1")
})

test("an escaped address survives the round trip", () => {
  const tricky = 'A "B" \\ C'
  const line = formatPlacement({ ...HEAD, piece: 0, address: tricky, placed: "OFF", right: "9", result: "off-case", memory: false })
  assert.equal(parse(line).address, tricky)
})

test("session id: a counter and a random token, nothing else", () => {
  assert.equal(sessionId(1, "k3x9q2"), "s1-k3x9q2")
  assert.equal(randomToken(() => 0), "aaaaaa")
  assert.equal(randomToken(() => 0.999999), "999999")
  assert.equal(randomToken(() => 1), "999999")
  assert.equal(randomToken(() => 0.5, 3), "sss")
  assert.match(randomToken(Math.random), /^[a-z0-9]{6}$/)
})

test("the buffer keeps the newest lines up to its cap", () => {
  const b = new LogBuffer(3)
  for (const s of ["a", "b", "c", "d", "e"]) b.push(s)
  assert.deepEqual(b.lines, ["c", "d", "e"])
  assert.equal(b.count, 3)
  const one = new LogBuffer(0)
  one.push("x")
  one.push("y")
  assert.deepEqual(one.lines, ["y"])
  assert.equal(new LogBuffer().count, 0)
})
