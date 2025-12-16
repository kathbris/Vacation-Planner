
# Vacation Planner — 2025

A simple, single-page web app for staff to mark vacation days and export a PDF to submit to their manager.

## Features
- Choose any months to display (defaults to **June, July, August**).
- Canadian holidays highlighted automatically (federal + Alberta-specific by default).
- Click on any date to mark/unmark vacation.
- Live totals per month and overall. Options to exclude weekends and holidays from the totals.
- Export to **PDF** with a cover header (employee & manager names).

## Getting started
1. Open `index.html` in a modern browser (Chrome, Edge, Firefox, Safari).
2. Fill in your **name** and **manager**.
3. Choose your **region** and months, then click **Build calendar**.
4. Click dates to mark vacation. Use **Clear marks** to reset.
5. Click **Export PDF** to download a PDF snapshot.

> Note: The holiday dataset shipped here is for **2025**. If you need other years or provinces, update `holidays-2025.json` accordingly.

## Tech
- Plain **HTML/CSS/JavaScript**.
- PDF generation using **html2canvas** + **jsPDF** via CDN.

## Customize
- Add or edit holidays in `holidays-2025.json`.
- To change default months or styling, edit `app.js` and `styles.css`.

