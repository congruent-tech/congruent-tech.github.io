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
- **TailwindCSS**: Loaded via CDN for styling
- **Interactive elements**: Vanilla JavaScript for slideshow, mobile menu
- **Content organization**: 
  - Services pages (AI, general services)
  - Insights/blog (Python, shell, AI topics)
  - Legal pages (Impressum, Datenschutz)

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
- Pages use Jekyll layouts (`default` or `insight`)
- Markdown files have YAML front matter with metadata
- Permalinks defined in front matter control URL structure
- TailwindCSS classes for responsive design
- Google Analytics integration with cookie consent
- SVG icons for branding and navigation

### Deployment
- **GitHub Actions**: Automatic build and deployment on push to master
- **GitHub Pages**: Serves the built site
- **No manual compilation**: GitHub Actions handles Jekyll build
- **Source control**: Only source files are committed, not `_site/`

### Common Tasks
- **Edit content**: Modify markdown files directly
- **Add new pages**: Create markdown files with proper front matter
- **Update layouts**: Edit files in `_layouts/` and `_includes/`
- **Add images/assets**: Place in appropriate `/assets/` subdirectory

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