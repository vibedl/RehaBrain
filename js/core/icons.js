// Strich-Symbole statt Emojis – einheitlich, druckgrafisch, gut erkennbar
const S = (inner) =>
  `<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;

export const ICONS = {
  reaktion: S('<circle cx="24" cy="26" r="15"/><path d="M24 26V17M20 5h8M24 5v6"/>'),
  suchbild: S('<circle cx="21" cy="21" r="12"/><path d="M30 30l11 11"/>'),
  zahlen: S('<path d="M10 14l5-4v28M24 16a6 6 0 0 1 12 0c0 7-12 12-12 22h12"/>'),
  wege: S('<rect x="6" y="6" width="14" height="14"/><rect x="28" y="6" width="14" height="14"/><rect x="6" y="28" width="14" height="14"/><rect x="28" y="28" width="14" height="14"/><path d="M13 13L35 35" stroke-dasharray="3 5"/>'),
  sortieren: S('<rect x="6" y="10" width="16" height="22" rx="2"/><rect x="26" y="16" width="16" height="22" rx="2"/><path d="M14 38v4M34 6v6"/>'),
  memory: S('<rect x="5" y="9" width="17" height="25" rx="2"/><rect x="26" y="14" width="17" height="25" rx="2"/><path d="M13.5 17v9M34.5 22v9"/>'),
  hoeher: S('<path d="M16 40V8M8 16l8-8 8 8M32 8v32M24 32l8 8 8-8"/>'),
  schnipp: S('<rect x="8" y="14" width="16" height="24" rx="2"/><rect x="24" y="10" width="16" height="24" rx="2"/><path d="M4 6l5 4M44 42l-5-4"/>'),
  geteilt: S('<rect x="5" y="10" width="14" height="28" rx="4"/><circle cx="12" cy="20" r="3"/><circle cx="12" cy="30" r="3"/><path d="M24 8v32" stroke-dasharray="3 5"/><path d="M31 18a5 5 0 0 1 10 0c0 5-10 9-10 16h10"/>'),
  durchstreichen: S('<circle cx="12" cy="12" r="6"/><rect x="30" y="6" width="12" height="12" rx="1"/><circle cx="12" cy="36" r="6"/><circle cx="36" cy="36" r="6"/><path d="M4 44L20 28M28 44l16-16"/>'),
  blicksprung: S('<circle cx="24" cy="24" r="3"/><circle cx="39" cy="12" r="5"/><path d="M28 21l7-6M4 24h6M9 19l-5 5 5 5"/>'),
  figuren: S('<path d="M6 8h8v24h8v8H6z"/><path d="M28 20l12 6"/><path d="M36 20l4 6-7 2"/><path d="M28 34h16v-8h-8v-8h-8z"/>'),
  einkaufen: S('<path d="M4 8h6l5 22h24l4-15H13"/><circle cx="18" cy="38" r="3"/><circle cx="35" cy="38" r="3"/>'),
  turm: S('<path d="M6 40h36M12 40V14M24 40V14M36 40V14M6 34h12M8 28h8M28 34h16"/>'),
  regeln: S('<rect x="5" y="8" width="16" height="23" rx="2"/><rect x="27" y="17" width="16" height="23" rx="2"/><circle cx="13" cy="19.5" r="4"/><path d="M35 23l4 7h-8z"/><path d="M20 38c4 3 9 3 12 0M30 36l2 2-2 3"/>'),
  ablauf: S('<path d="M18 12h24M18 24h24M18 36h24"/><circle cx="8" cy="12" r="3"/><circle cx="8" cy="24" r="3"/><circle cx="8" cy="36" r="3"/>'),
  maumau: S('<rect x="6" y="12" width="16" height="24" rx="2"/><rect x="26" y="12" width="16" height="24" rx="2"/><path d="M14 20v8M30 24h8M34 20v8"/><path d="M20 6h8M24 40v4"/>'),
  siebzehnundvier: S('<rect x="6" y="10" width="16" height="24" rx="2"/><rect x="18" y="14" width="16" height="24" rx="2"/><path d="M38 12v10M34 17h8M24 22l6 8M30 22l-6 8"/>'),
  einkaufsliste: S('<path d="M12 6h24v36H12z"/><path d="M18 16h12M18 24h12M18 32h8"/><path d="M34 34l4 4 6-8"/>'),
  gesichter: S('<circle cx="24" cy="18" r="9"/><path d="M8 42c2-9 8-13 16-13s14 4 16 13"/><path d="M20 17h.01M28 17h.01M20 22q4 3 8 0"/>'),
  alltag: S('<circle cx="24" cy="24" r="17"/><path d="M24 13v11l7 5"/><path d="M24 7v3M24 38v3M7 24h3M38 24h3"/>'),
  einstufung: S('<path d="M6 40h36"/><path d="M10 40V30h8v10M20 40V22h8v18M30 40V12h8v28"/><path d="M8 20l8-8 6 4 12-10"/>'),
  bericht: S('<path d="M12 5h17l9 9v29H12z"/><path d="M29 5v9h9"/><path d="M17 36l5-6 4 3 7-9"/><path d="M17 20h8"/>'),
  patience: S('<rect x="5" y="6" width="12" height="17" rx="2"/><rect x="31" y="6" width="12" height="17" rx="2"/><path d="M8 28h12v14H8zM8 32h12M24 28h12v14H24zM24 32h12M24 36h12"/><path d="M20 14h8M25 11l3 3-3 3"/>'),
  skatschule: S('<rect x="10" y="18" width="18" height="26" rx="2"/><path d="M19 26v10M15 31h8"/><path d="M24 6l18 7-18 7-18-7z"/><path d="M36 16v9"/>'),
  skat: S('<rect x="5" y="12" width="15" height="23" rx="2" transform="rotate(-12 12 24)"/><rect x="17" y="8" width="15" height="23" rx="2"/><rect x="29" y="12" width="15" height="23" rx="2" transform="rotate(12 36 24)"/><path d="M16 42h16"/>'),
  romme: S('<rect x="5" y="8" width="13" height="19" rx="2"/><rect x="17.5" y="6" width="13" height="19" rx="2"/><rect x="30" y="8" width="13" height="19" rx="2"/><path d="M6 36h36M6 42h36M18 36v6M30 36v6"/>'),
  sechsundsechzig: S('<rect x="6" y="8" width="15" height="22" rx="2"/><rect x="18" y="12" width="15" height="22" rx="2" transform="rotate(12 25 23)"/><path d="M10 42h28"/>'),
  wachsam: S('<rect x="10" y="16" width="22" height="16" rx="2"/><circle cx="34" cy="24" r="4"/><path d="M6 38h36"/>'),
  wachheit: S('<circle cx="24" cy="24" r="15"/><circle cx="24" cy="24" r="5"/><path d="M24 3v6M24 39v6M3 24h6M39 24h6"/>'),
  umschalten: S('<rect x="5" y="10" width="16" height="28" rx="2"/><rect x="27" y="10" width="16" height="28" rx="2"/><path d="M21 16l6-6 6 6M27 34l-6 6-6-6"/>'),
  woerter: S('<path d="M8 18h8l10-8v28l-10-8H8z"/><path d="M33 17a9 9 0 0 1 0 14M38 12a16 16 0 0 1 0 24"/>'),
  geschichte: S('<path d="M24 12c-5-4-12-4-18-2v28c6-2 13-2 18 2 5-4 12-4 18-2V10c-6-2-13-2-18 2z"/><path d="M24 12v28"/>'),
  randsicht: S('<circle cx="24" cy="24" r="6"/><circle cx="24" cy="24" r="17" stroke-dasharray="4 5"/><path d="M24 3v6M24 39v6M3 24h6M39 24h6"/>'),
  suchen: S('<circle cx="20" cy="20" r="12"/><path d="M29 29l12 12"/><path d="M14 20h12M20 14v12" stroke-dasharray="2 4"/>'),
  zielen: S('<circle cx="24" cy="24" r="16"/><circle cx="24" cy="24" r="7"/><path d="M24 4v6M24 38v6M4 24h6M38 24h6"/>'),
  nachfahren: S('<circle cx="10" cy="38" r="3" fill="currentColor" stroke="none"/><path d="M10 38C16 20 20 14 24 24S34 40 38 22" stroke-dasharray="1 7"/><circle cx="38" cy="22" r="3"/>'),
  verbinden: S('<circle cx="9" cy="12" r="4"/><circle cx="30" cy="8" r="4"/><circle cx="40" cy="30" r="4"/><circle cx="16" cy="40" r="4"/><path d="M12 15l15-6M33 11l6 16M37 33L19 39"/>'),
  rhythmus: S('<circle cx="24" cy="24" r="8"/><circle cx="24" cy="24" r="16" stroke-dasharray="3 5"/><path d="M24 2v6M24 40v6"/>'),
  greifen: S('<rect x="16" y="6" width="16" height="16" rx="2"/><path d="M12 30h10v10H12zM26 30h10v10H26z" /><path d="M24 22v6M20 28l-3-1M28 28l3-1"/>'),
  post: S('<rect x="6" y="10" width="36" height="28" rx="2"/><path d="M6 12l18 16 18-16"/><path d="M24 30v8M18 34h12"/>'),
  daten: S('<rect x="5" y="8" width="16" height="32" rx="2"/><path d="M27 18h16M27 26h16M27 34h10"/>'),
  tagesplan: S('<circle cx="24" cy="26" r="16"/><path d="M24 16v10l7 5"/><path d="M16 6h16M12 12l3 3M36 12l-3 3"/>'),
  telefon: S('<path d="M10 8c0 18 12 30 30 30l4-9-11-4-4 5c-6-3-10-7-13-13l5-4-4-11z"/>'),
  bestellung: S('<path d="M4 8h6l5 22h24l4-15H13"/><circle cx="18" cy="38" r="3"/><circle cx="35" cy="38" r="3"/><path d="M22 20l4 4 8-8"/>'),
  leistungsprofil: S('<path d="M24 6l14 8v20l-14 8-14-8V14z"/><path d="M24 6v18M24 24L10 14M24 24l14-10M24 24v18M24 24L10 34M24 24l14 10"/><circle cx="24" cy="24" r="3" fill="currentColor"/>'),
  therapie: S('<circle cx="24" cy="16" r="8"/><path d="M12 40c0-8 5-13 12-13s12 5 12 13"/><path d="M18 24l3 4 4-6"/>'),
  plan: S('<rect x="9" y="6" width="30" height="36" rx="2"/><path d="M16 16h16M16 24h16M16 32h10"/><path d="M30 4v6M18 4v6"/>'),
  teilen: S('<circle cx="10" cy="24" r="5"/><circle cx="36" cy="10" r="5"/><circle cx="36" cy="38" r="5"/><path d="M14.5 21.5L31.5 13M14.5 26.5L31.5 35"/>'),
  einstellungen: S('<path d="M8 12h32M8 24h32M8 36h32"/><circle cx="16" cy="12" r="4" fill="var(--card)"/><circle cx="32" cy="24" r="4" fill="var(--card)"/><circle cx="20" cy="36" r="4" fill="var(--card)"/>'),
  vorlesen: S('<path d="M8 19v10h8l10 8V11l-10 8z"/><path d="M33 17a9 9 0 0 1 0 14M38 12a16 16 0 0 1 0 24"/>'),
  verlauf: S('<path d="M6 40h36M10 32l9-10 7 6 14-16"/>'),
  weiter: S('<path d="M18 10l14 14-14 14"/>'),
  zurueck: S('<path d="M28 10L14 24l14 14"/>'),
  schliessen: S('<path d="M12 12l24 24M36 12L12 36"/>'),
};

export const icon = (name) => {
  const span = document.createElement("span");
  span.className = "ico";
  span.innerHTML = ICONS[name] ?? "";
  return span;
};
