// Owns: the one version string of the Lens.
// Talks to: CaseLightMain (startup print, versionText) and CaseLightCaseLabelsUI (the small version label).
// Must not: hold anything else.

/** Bump this one constant for a new build; the label and the startup print both read it. */
export const CASELIGHT_VERSION = "v0.4"
