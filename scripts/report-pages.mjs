// `npm run report:pages`: prints report.html to a Letter PDF with Chromium and counts the pages (target 10–15).
import { chromium } from "@playwright/test";
import path from "node:path";

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`file://${path.resolve("report.html")}`);
const pdf = await page.pdf({ format: "Letter", printBackground: true, preferCSSPageSize: true });
await browser.close();
const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
console.log(`report.html prints to ${pages} Letter pages (target 10–15).`);
