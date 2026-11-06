/** What each place means, in the install dialog's words; every screen that names a place uses these. */
export const placeDefinitions = {
  core: "On every machine, always on, backed up.",
  pack: "On when you turn the pack on. The pack is backed up; its files download again.",
  uploadedPack: "On when you turn the pack on. Saved in your library, so nothing downloads.",
  machine: "Installed here, never backed up.",
  later: "Bookmarked. Nothing installed.",
} as const;
