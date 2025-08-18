# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a static website for Congruent Tech UG, a German company offering iOS/macOS development, SEO services, ERP solutions, and AI tool development. The site is hosted on GitHub Pages and built with Jekyll.

## Architecture

### Site Structure
- **Root level**: German version (default)
- **/en/**: English version with full content
- **/assets/**: Static resources (CSS, JS, images, SVG icons)
- **Multilingual content**: Organized by language prefix

### Jekyll Setup
- **Source files**: Markdown files with Jekyll front matter
- **Layouts**: `_layouts/default.html` and `_layouts/insight.html`
- **Includes**: Reusable components in `_includes/`
- **Build process**: GitHub Actions automatically builds and deploys
- **Generated files**: `_site/` directory (ignored by git)

### Key Components
- **Jekyll layouts**: Handle page structure and templating
- **Semantic CSS**: Organized design system with custom variables
- **TailwindCSS**: Loaded via CDN for utility classes (transitioning to custom CSS)
- **Interactive elements**: Vanilla JavaScript for slideshow, mobile menu
- **Content organization**: 
  - Services pages (AI, general services)
  - Insights/blog (Python, shell, AI topics)
  - Legal pages (Impressum, Datenschutz)

### CSS Architecture
- `assets/css/01-foundation/`: Variables, typography, reset styles
- `assets/css/02-layout/`: Site structure and responsive layout
- `assets/css/03-components/`: Component-specific styles
- `assets/css/main.css`: Central import file for all styles
- `assets/css/colors.css`: Legacy color definitions (being phased out)
- `assets/css/insight.css`: GitHub-flavored markdown styles

### JavaScript Modules
- `slideshow.js`: Auto-rotating hero slides with navigation dots
- `menuButton.js`: Mobile hamburger menu toggle
- `debug-box.js`: Development utilities

## Development Workflow

### Jekyll Development
- Run `bundle install` to install dependencies
- Run `bundle exec jekyll serve` for local development
- Edit markdown files in root and `/en/` directories
- Layouts and includes in `_layouts/` and `_includes/`
- Assets in `/assets/` directory

### Content Structure
- Pages use Jekyll layouts (`default`, `insight`, or `404`)
- Markdown files have YAML front matter with metadata
- Permalinks defined in front matter control URL structure
- Semantic CSS classes with custom design system variables
- TailwindCSS classes for utility styling (being gradually replaced)
- Google Analytics integration with cookie consent
- SVG icons for branding and navigation

### Design System
- **Design Philosophy**: German engineering precision with minimal aesthetics
- **Color Palette**: Congruent blue (#1D4ED8), German yellow (#FFB900), craftsmanship brown
- **Typography**: Roboto (headings), Nunito (body), SF Mono (code)
- **Evolution**: Documented in `.ai-site-design-evolution.md`

### Deployment
- **GitHub Actions**: Automatic build and deployment on push to master
- **GitHub Pages**: Serves the built site
- **No manual compilation**: GitHub Actions handles Jekyll build
- **Source control**: Only source files are committed, not `_site/`

### Common Tasks
- **Edit content**: Modify markdown files directly
- **Add new pages**: Create markdown files with proper front matter
- **Update layouts**: Edit files in `_layouts/` and `_includes/`
- **Modify styles**: Edit CSS files in semantic folder structure
- **Add images/assets**: Place in appropriate `/assets/` subdirectory
- **Design evolution**: Document changes in `.ai-site-design-evolution.md`

### CSS Development
- **Main entry**: Import all styles through `assets/css/main.css`
- **Foundation changes**: Edit variables, typography, reset in `01-foundation/`
- **Layout changes**: Modify site structure in `02-layout/`
- **Component changes**: Update component styles in `03-components/`
- **Preserve appearance**: Maintain current visual design during refactoring

## Content Guidelines

### Multilingual Support
- German content at root level
- English content under `/en/` prefix
- Maintain parallel structure between languages
- Use permalinks in front matter to control URLs

### SEO Considerations
- Proper meta tags and titles in layouts
- Structured markup for technical content
- Jekyll automatically generates XML sitemap
- Focus on technical tutorials and insights

### Brand Elements
- Congruent Tech logo and colors
- Berlin location emphasized
- Professional technical focus
- Stack Overflow integration for credibility