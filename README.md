# CSP Insights

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Live App](https://img.shields.io/badge/Live-cspinsights.app-6366f1)](https://cspinsights.app)

**A free, local-first billing reconciliation and pricing management toolkit for Microsoft CSP Direct (Tier 1) partners.**

> Your data never leaves your browser. No backend, no account, no cloud uploads.

**[Try it now at cspinsights.app](https://cspinsights.app)**

---

## Why CSP Insights?

Managing Microsoft CSP operations means wrestling with massive reconciliation CSVs and complex price lists every month. CSP Insights gives you immediate visual clarity and powerful tools — without backend servers or third-party data processing.

## Features

### Billing Analysis
- **Drag & drop** Partner Center reconciliation CSV files (including `.csv.gz`)
- **Visual dashboard** with revenue breakdown by customer, product, and period
- **Azure FinOps** — drill down into costs per resource, service category, and customer
- **NCE Insights** — subscription types, renewal tracking, cancellation windows
- **Margin management** — set global or per-customer margins
- **Period comparison** — compare months side-by-side, detect upsells, churn, and seat changes (SeatRadar)
- **Customer tagging** — organize and filter customers with custom tags
- **Anomaly detection** — flag refunds, cancellations, and negative charges
- **Invoice generation** — branded PDF invoices with your logo and company details
- **Excel export** — export filtered data with calculated margins

### Pricing Catalog
- **Browse** the full Microsoft CSP price list with fast virtual scrolling
- **Search & filter** by product, currency, term duration, and segment
- **Favorites** — bookmark frequently used products
- **Margin visibility** — see your margin per product at a glance
- **Version comparison** — load two price lists and spot price changes
- **Shopping cart & quotes** — build a cart and export professional PDF quotes

### Data Management
- **Snapshots** — save and restore billing data and pricing catalogs
- **Backup & restore** — export/import all your data
- **Settings** — configure company details, logo, IBAN, and default margins
- **Dark mode**
- **Demo mode** — try the app with sample data before uploading your own

### Privacy & Security
- **100% client-side** — all processing happens in your browser
- **IndexedDB storage** — data persists locally between sessions
- **No telemetry** — no analytics, no tracking, no data collection
- Clearing your browser data removes everything

## Getting Started

### Use the hosted version

Visit **[cspinsights.app](https://cspinsights.app)** — no installation needed.

### Run locally

```bash
git clone https://github.com/hardinxcore/CSPInsights.app.git
cd CSPInsights
npm install
npm run dev
```

Requires Node.js 18+ and npm.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 19, TypeScript |
| Build | Vite |
| State | Zustand (with IndexedDB persistence) |
| Performance | Web Workers, @tanstack/react-virtual |
| PDF | jsPDF, @react-pdf/renderer |
| Charts | Recharts |
| CSV Parsing | PapaParse |
| Styling | Vanilla CSS with Glassmorphism design |

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Security

See [SECURITY.md](SECURITY.md) for our security policy and how to report vulnerabilities.

## License

[MIT](LICENSE)

---

*Disclaimer: This tool is not affiliated with or endorsed by Microsoft. Always verify critical billing data against the official Partner Center portal.*
