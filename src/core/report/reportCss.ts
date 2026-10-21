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
.tr-card { border: 1px solid ${RULE_LINE}; border-radius: 12px; padding: 16px 18px; margin: 14px 0; background: #ffffff; break-inside: avoid; scroll-margin-top: 80px; }
.tr-card:target { box-shadow: 0 0 0 3px #c7d2fe; }
.tr-card-head { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; margin-bottom: 6px; }
.tr-index { font-weight: 650; }
.tr-type, .tr-test { font-size: 12px; padding: 1px 8px; border-radius: 999px; background: #f4f4f5; color: #3f3f46; }
.tr-verdict { margin-left: auto; font-size: 12px; font-weight: 650; padding: 1px 10px; border: 1.5px solid; border-radius: 999px; }
.tr-statement { font-weight: 550; margin: 4px 0; }
.tr-source { font-size: 13px; color: ${MUTED}; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; margin: 0 0 8px; }
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
.tr-msg-assistant { background: #f8fafc; padding: 6px 8px; border-radius: 6px; }
@media print {
  .tr-report { max-width: none; font-size: 11pt; }
  .tr-report h2 { break-after: avoid; }
  .tr-link, .tr-live { display: none; }
  .tr-card, .tr-tile { border-color: #d4d4d8; }
}
`;
