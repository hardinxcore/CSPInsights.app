# Security Policy

## Architecture

CSP Insights is a **client-side only** application. All data processing happens locally in the user's browser. No data is transmitted to any server.

- Data is stored in the browser's IndexedDB
- No backend, no API calls, no telemetry
- Clearing browser data removes all stored information

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public issue
2. Email the maintainer directly or use [GitHub's private vulnerability reporting](../../security/advisories/new)
3. Include a description of the vulnerability and steps to reproduce

We will acknowledge your report within 48 hours and work on a fix promptly.

## Scope

Since this is a fully client-side application, the main security concerns are:
- XSS vulnerabilities in data rendering
- Malicious CSV/file content handling
- Dependencies with known vulnerabilities
