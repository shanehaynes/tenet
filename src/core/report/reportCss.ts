import { ACCENT, COLORS, INK, MUTED, RULE_LINE } from "./palette";

// Styles for ReportDocument (architecture §10): a plain CSS string, not Tailwind, so the standalone export
// looks the same as the app and prints on Letter paper. Every class is prefixed tr- to stay out of the app's way.

export const reportCss = `
.tr-report { color: ${INK}; font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; font-size: 15px; line-height: 1.5; max-width: 980px; margin: 0 auto; }
.tr-report h1 { font-size: 28px; line-height: 1.2; margin: 0 0 4px; letter-spacing: -0.01em; }
.tr-report h2 { font-size: 19px; margin: 40px 0 12px; padding-top: 12px; border-top: 1px solid ${RULE_LINE}; }
.tr-report h3 { font-size: 15px; margin: 0 0 6px; }
.tr-meta, .tr-small, .tr-caption, .tr-lede-small { color: ${MUTED}; font-size: 13px; }
.tr-lede { font-size: 17px; }
.tr-live { display: inline-block; margin-top: 8px; padding: 4px 10px; border-radius: 999px; background: #eef2ff; color: ${ACCENT}; font-size: 13px; }
.tr-strip { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 8px; margin: 20px 0 8px; }
.tr-tile { border: 1px solid ${RULE_LINE}; border-radius: 10px; padding: 10px 12px; background: #ffffff; }
.tr-tile-wide { grid-column: span 2; }
.tr-tile-value { font-size: 18px; font-weight: 650; font-variant-numeric: tabular-nums; }
.tr-tile-label { font-size: 12px; color: ${MUTED}; }
.tr-tone-bad .tr-tile-value { color: ${COLORS.bad}; }
.tr-tone-bent .tr-tile-value { color: ${COLORS.bent}; }
.tr-tone-accent .tr-tile-value { color: ${ACCENT}; }
.tr-figure { margin: 12px 0; }
.tr-figure svg { display: block; max-width: 100%; height: auto; }
.tr-caption { margin-top: 6px; }
.tr-map svg { max-width: 640px; }
.tr-chart svg { max-width: 760px; }
.tr-card { border: 1px solid ${RULE_LINE}; border-radius: 12px; padding: 16px 18px; margin: 14px 0; background: #ffffff; break-inside: avoid; scroll-margin-top: 110px; }
.tr-card:target { box-shadow: 0 0 0 3px #c7d2fe; }
.tr-card-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 6px; }
.tr-index { font-weight: 650; }
.tr-type, .tr-test { font-size: 12px; padding: 1px 8px; border-radius: 999px; background: #f4f4f5; color: #3f3f46; }
.tr-verdict { margin-left: auto; font-size: 12px; font-weight: 650; padding: 1px 10px; border: 1.5px solid; border-radius: 999px; }
.tr-statement { font-weight: 550; margin: 4px 0; }
.tr-source { font-size: 14px; color: #52525b; font-style: italic; margin: 0 0 8px; }
.tr-source-label { font-style: normal; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: ${MUTED}; margin-right: 8px; }
.tr-report [id] { scroll-margin-top: 110px; }
.tr-report .tr-jump + h2 { border-top: 0; margin-top: 18px; padding-top: 0; }
.tr-jump { position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; gap: 6px; padding: 10px 0; margin: 14px 0 0; background: rgba(255, 255, 255, 0.96); border-bottom: 1px solid ${RULE_LINE}; }
.tr-jump a { font-size: 13px; padding: 3px 11px; border-radius: 999px; background: #f4f4f5; color: #3f3f46; text-decoration: none; white-space: nowrap; }
.tr-jump a:hover, .tr-jump a:focus-visible { background: #e0e7ff; color: ${ACCENT}; }
.tr-findings { list-style: none; margin: 8px 0 16px; padding: 6px 16px; border: 1px solid ${RULE_LINE}; border-radius: 12px; background: #fcfcfd; }
.tr-findings li { margin: 8px 0; padding: 2px 0 2px 12px; border-left: 3px solid ${ACCENT}; font-size: 15px; }
.tr-findings a { font-weight: 650; color: inherit; text-decoration: none; }
.tr-findings a:hover { text-decoration: underline; text-underline-offset: 2px; }
.tr-find-stmt { display: block; color: ${MUTED}; font-size: 13px; font-style: italic; }
.tr-runline { color: ${MUTED}; font-size: 13px; margin: 2px 0 0; font-variant-numeric: tabular-nums; }
.tr-key { display: flex; flex-wrap: wrap; gap: 4px 16px; margin: 6px 0 10px; font-size: 12px; color: ${MUTED}; }
.tr-key i { display: inline-block; width: 10px; height: 10px; border-radius: 999px; margin-right: 6px; vertical-align: -1px; box-sizing: border-box; }
.tr-key i.tr-key-hollow { background: #ffffff; border: 2px solid; }
.tr-key i.tr-key-arc { width: 16px; height: 0; border-radius: 0; border-top: 2px solid; vertical-align: 3px; }
.tr-group { display: flex; align-items: baseline; gap: 8px; font-size: 16px; margin: 26px 0 2px; }
.tr-count { font-size: 12px; font-weight: 600; color: ${MUTED}; background: #f4f4f5; border-radius: 999px; padding: 0 8px; }
.tr-group-note { font-size: 13px; color: ${MUTED}; margin: 0 0 4px; }
.tr-card-bad { border-left: 4px solid ${COLORS.bad}; }
.tr-card-bent { border-left: 4px solid ${COLORS.bent}; }
.tr-fold-chart { margin: 8px 0 0; font-size: 13px; color: #3f3f46; }
.tr-fold-chart > summary { cursor: pointer; }
.tr-fold-hint { margin-left: 10px; color: ${ACCENT}; font-size: 12px; }
.tr-fold-chart[open] .tr-fold-hint { display: none; }
.tr-fold { margin: 40px 0 0; padding-top: 12px; border-top: 1px solid ${RULE_LINE}; }
.tr-fold > summary { cursor: pointer; list-style: none; display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; }
.tr-fold > summary::-webkit-details-marker { display: none; }
.tr-fold > summary::before { content: "▸"; color: ${MUTED}; width: 12px; }
.tr-fold[open] > summary::before { content: "▾"; }
.tr-report .tr-fold > summary h2 { display: inline; margin: 0; padding: 0; border: 0; }
.tr-fold-meta { color: ${MUTED}; font-size: 13px; font-variant-numeric: tabular-nums; }
.tr-fold > :not(summary) { margin-left: 16px; }
.tr-dl { display: grid; grid-template-columns: 150px 1fr; gap: 6px 14px; margin: 8px 0; font-size: 14px; }
.tr-dl dt { color: ${MUTED}; font-size: 13px; }
.tr-dl dd { margin: 0; }
.tr-chip { font-size: 12px; font-weight: 650; padding: 1px 8px; border: 1.5px solid; border-radius: 999px; white-space: nowrap; }
.tr-evidence { margin-top: 10px; }
.tr-quote { margin: 0; padding: 8px 12px; border-left: 3px solid ${ACCENT}; background: #f8fafc; font-size: 14px; }
.tr-unverified { border-left-style: dotted; border-left-color: ${COLORS.unclear}; }
.tr-flag { color: ${COLORS.unclear}; font-size: 12px; font-weight: 600; }
.tr-link { margin-top: 6px; background: none; border: 0; padding: 0; color: ${ACCENT}; font: inherit; font-size: 13px; cursor: pointer; text-decoration: underline; text-underline-offset: 2px; }
.tr-clickable { cursor: pointer; }
.tr-note { font-size: 13px; color: #3f3f46; background: #f4f4f5; border-radius: 8px; padding: 6px 10px; }
.tr-warning { font-size: 13px; color: ${COLORS.bent}; background: #fffbeb; border-radius: 8px; padding: 6px 10px; margin: 8px 0 0; }
.tr-probs span { margin-right: 10px; font-variant-numeric: tabular-nums; }
.tr-defect { border-left: 3px solid ${ACCENT}; padding: 4px 0 4px 14px; margin: 18px 0; break-inside: avoid; }
.tr-table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 13px; }
.tr-table th, .tr-table td { text-align: left; padding: 7px 8px; border-bottom: 1px solid ${RULE_LINE}; vertical-align: top; }
.tr-table th { font-weight: 600; color: #3f3f46; }
.tr-compact th, .tr-compact td { padding: 5px 8px; }
.tr-num td:not(:first-child), .tr-num th:not(:first-child) { text-align: right; font-variant-numeric: tabular-nums; }
.tr-transcript { margin-top: 6px; font-size: 13px; }
.tr-transcript summary { cursor: pointer; color: ${ACCENT}; }
.tr-msg { white-space: pre-wrap; margin: 6px 0; }
.tr-appendix { margin: 14px 0; }
.tr-appendix h3 { font-size: 13px; font-weight: 600; }
.tr-msg-assistant { background: #f8fafc; padding: 6px 8px; border-radius: 6px; }
.tr-actions { margin: 6px 0 0; padding-left: 20px; font-size: 12px; }
.tr-action { margin: 4px 0; }
.tr-action.tr-refused { color: #991b1b; }
.tr-arg { display: block; white-space: pre-wrap; overflow-wrap: anywhere; margin-left: 8px; }
.tr-result { display: block; color: #64748b; overflow-wrap: anywhere; margin-left: 8px; }
@media print {
  .tr-report { max-width: none; font-size: 11pt; }
  .tr-report h2 { break-after: avoid; }
  .tr-link, .tr-live, .tr-jump, .tr-fold-hint { display: none; }
  .tr-dl { grid-template-columns: 120px 1fr; }
  .tr-card, .tr-tile { border-color: #d4d4d8; }
}
`;
