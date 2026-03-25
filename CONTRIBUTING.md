# Contributing to CSP Insights

Thanks for your interest in contributing to CSP Insights! We welcome contributions from the community.

## How to Contribute

### Reporting Bugs
- Open an [issue](../../issues) with a clear description of the bug
- Include steps to reproduce, expected behavior, and actual behavior
- Mention your browser and OS

### Suggesting Features
- Open an [issue](../../issues) with the `feature request` label
- Describe the use case and how it would benefit CSP partners

### Submitting Code
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Make your changes
4. Run `npm run build` to ensure no build errors
5. Commit your changes (`git commit -m 'Add my feature'`)
6. Push to the branch (`git push origin feature/my-feature`)
7. Open a Pull Request

## Development Setup

```bash
git clone <your-fork-url>
cd CSPInsights
npm install
npm run dev
```

## Guidelines

- Keep the app **local-first** — no server-side data processing
- Follow existing code patterns and structure
- Test with both light and dark mode
- Ensure large CSV files (10k+ rows) still perform well

## Code of Conduct

Be respectful and constructive. We're all here to make CSP management easier.
