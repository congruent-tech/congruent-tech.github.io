/**
 * Congruent Tech SEO Analysis Suite
 * Advanced JavaScript-based website analysis tools
 * @version 1.0.0
 * @author Congruent Tech UG
 */

class SEOAnalyzer {
    constructor() {
        this.results = {};
        this.warnings = [];
        this.errors = [];
        this.suggestions = [];
    }

    /**
     * Comprehensive SEO analysis of current page
     */
    async analyzePage() {
        console.log('🔍 Starting SEO Analysis...');
        
        this.results = {
            timestamp: new Date().toISOString(),
            url: window.location.href,
            title: this.analyzeTitle(),
            meta: this.analyzeMeta(),
            headings: this.analyzeHeadings(),
            content: this.analyzeContent(),
            images: this.analyzeImages(),
            links: this.analyzeLinks(),
            schema: this.analyzeStructuredData(),
            performance: await this.analyzePerformance(),
            accessibility: this.analyzeAccessibility(),
            mobile: this.analyzeMobileReadiness(),
            aiReadiness: this.analyzeAIReadiness(),
            score: 0
        };

        this.calculateOverallScore();
        this.generateSuggestions();
        
        console.log('✅ SEO Analysis Complete');
        return this.results;
    }

    /**
     * Analyze page title optimization
     */
    analyzeTitle() {
        const title = document.title;
        const analysis = {
            text: title,
            length: title.length,
            score: 0,
            issues: []
        };

        // Title length optimization
        if (title.length === 0) {
            analysis.issues.push('Missing page title');
            this.errors.push('Page title is missing');
        } else if (title.length < 30) {
            analysis.issues.push('Title too short (< 30 characters)');
            analysis.score += 50;
        } else if (title.length > 60) {
            analysis.issues.push('Title too long (> 60 characters)');
            analysis.score += 70;
        } else {
            analysis.score += 100;
        }

        // Title uniqueness and keywords
        if (title.toLowerCase().includes('untitled') || title.toLowerCase().includes('new page')) {
            analysis.issues.push('Generic title detected');
            analysis.score = Math.max(0, analysis.score - 30);
        }

        return analysis;
    }

    /**
     * Analyze meta tags
     */
    analyzeMeta() {
        const metaTags = document.querySelectorAll('meta');
        const analysis = {
            description: null,
            keywords: null,
            viewport: null,
            robots: null,
            canonical: null,
            openGraph: {},
            twitterCard: {},
            score: 0,
            issues: []
        };

        metaTags.forEach(meta => {
            const name = meta.getAttribute('name');
            const property = meta.getAttribute('property');
            const content = meta.getAttribute('content');

            if (name === 'description') {
                analysis.description = {
                    content,
                    length: content.length,
                    score: this.scoreMetaDescription(content)
                };
            } else if (name === 'keywords') {
                analysis.keywords = content;
            } else if (name === 'viewport') {
                analysis.viewport = content;
            } else if (name === 'robots') {
                analysis.robots = content;
            } else if (property && property.startsWith('og:')) {
                analysis.openGraph[property.replace('og:', '')] = content;
            } else if (name && name.startsWith('twitter:')) {
                analysis.twitterCard[name.replace('twitter:', '')] = content;
            }
        });

        // Check canonical link
        const canonical = document.querySelector('link[rel="canonical"]');
        if (canonical) {
            analysis.canonical = canonical.getAttribute('href');
        }

        // Score meta description
        if (!analysis.description) {
            analysis.issues.push('Missing meta description');
            this.errors.push('Meta description is missing');
        } else {
            analysis.score += analysis.description.score;
        }

        // Score viewport
        if (!analysis.viewport) {
            analysis.issues.push('Missing viewport meta tag');
            this.warnings.push('Viewport meta tag is missing');
        } else if (analysis.viewport.includes('width=device-width')) {
            analysis.score += 20;
        }

        return analysis;
    }

    /**
     * Score meta description
     */
    scoreMetaDescription(description) {
        if (!description) return 0;
        
        const length = description.length;
        if (length < 120) return 50;
        if (length > 160) return 70;
        return 100;
    }

    /**
     * Analyze heading structure
     */
    analyzeHeadings() {
        const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        const analysis = {
            structure: [],
            h1Count: 0,
            score: 0,
            issues: []
        };

        headings.forEach(heading => {
            const level = parseInt(heading.tagName.charAt(1));
            const text = heading.textContent.trim();
            
            analysis.structure.push({
                level,
                text,
                length: text.length
            });

            if (level === 1) {
                analysis.h1Count++;
            }
        });

        // H1 analysis
        if (analysis.h1Count === 0) {
            analysis.issues.push('Missing H1 tag');
            this.errors.push('H1 tag is missing');
        } else if (analysis.h1Count > 1) {
            analysis.issues.push('Multiple H1 tags found');
            this.warnings.push('Multiple H1 tags detected');
            analysis.score += 50;
        } else {
            analysis.score += 100;
        }

        // Heading hierarchy
        let previousLevel = 0;
        let hierarchyValid = true;
        
        analysis.structure.forEach(heading => {
            if (heading.level > previousLevel + 1 && previousLevel !== 0) {
                hierarchyValid = false;
            }
            previousLevel = heading.level;
        });

        if (!hierarchyValid) {
            analysis.issues.push('Invalid heading hierarchy');
            this.warnings.push('Heading hierarchy is not properly structured');
        } else {
            analysis.score += 50;
        }

        return analysis;
    }

    /**
     * Analyze content optimization
     */
    analyzeContent() {
        const textContent = document.body.textContent || '';
        const wordCount = textContent.trim().split(/\s+/).length;
        
        const analysis = {
            wordCount,
            readabilityScore: this.calculateReadability(textContent),
            score: 0,
            issues: []
        };

        // Word count scoring
        if (wordCount < 300) {
            analysis.issues.push('Content too short (< 300 words)');
            analysis.score += 30;
        } else if (wordCount > 2000) {
            analysis.score += 90;
        } else {
            analysis.score += 70;
        }

        return analysis;
    }

    /**
     * Simple readability calculation
     */
    calculateReadability(text) {
        const sentences = text.split(/[.!?]+/).length;
        const words = text.trim().split(/\s+/).length;
        const avgWordsPerSentence = words / sentences;
        
        // Simple scoring based on average sentence length
        if (avgWordsPerSentence < 15) return 90;
        if (avgWordsPerSentence < 20) return 80;
        if (avgWordsPerSentence < 25) return 70;
        return 60;
    }

    /**
     * Analyze images
     */
    analyzeImages() {
        const images = document.querySelectorAll('img');
        const analysis = {
            total: images.length,
            withAlt: 0,
            withoutAlt: 0,
            score: 0,
            issues: []
        };

        images.forEach(img => {
            const alt = img.getAttribute('alt');
            if (alt && alt.trim()) {
                analysis.withAlt++;
            } else {
                analysis.withoutAlt++;
            }
        });

        if (analysis.withoutAlt > 0) {
            analysis.issues.push(`${analysis.withoutAlt} images missing alt text`);
            this.warnings.push(`${analysis.withoutAlt} images missing alt text`);
        }

        if (analysis.total > 0) {
            analysis.score = (analysis.withAlt / analysis.total) * 100;
        } else {
            analysis.score = 100;
        }

        return analysis;
    }

    /**
     * Analyze links
     */
    analyzeLinks() {
        const links = document.querySelectorAll('a[href]');
        const analysis = {
            total: links.length,
            internal: 0,
            external: 0,
            nofollow: 0,
            score: 0,
            issues: []
        };

        const currentDomain = window.location.hostname;

        links.forEach(link => {
            const href = link.getAttribute('href');
            const rel = link.getAttribute('rel');
            
            if (href.startsWith('http')) {
                const linkDomain = new URL(href).hostname;
                if (linkDomain === currentDomain) {
                    analysis.internal++;
                } else {
                    analysis.external++;
                }
            } else {
                analysis.internal++;
            }

            if (rel && rel.includes('nofollow')) {
                analysis.nofollow++;
            }
        });

        analysis.score = analysis.total > 0 ? 100 : 50;
        return analysis;
    }

    /**
     * Analyze structured data
     */
    analyzeStructuredData() {
        const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
        const analysis = {
            jsonLd: [],
            microdata: this.findMicrodata(),
            score: 0,
            issues: []
        };

        jsonLdScripts.forEach(script => {
            try {
                const data = JSON.parse(script.textContent);
                analysis.jsonLd.push(data);
            } catch (e) {
                analysis.issues.push('Invalid JSON-LD detected');
                this.errors.push('Invalid JSON-LD structure');
            }
        });

        if (analysis.jsonLd.length === 0 && analysis.microdata.length === 0) {
            analysis.issues.push('No structured data found');
            this.warnings.push('No structured data found');
            analysis.score = 0;
        } else {
            analysis.score = 100;
        }

        return analysis;
    }

    /**
     * Find microdata
     */
    findMicrodata() {
        const elements = document.querySelectorAll('[itemscope]');
        return Array.from(elements).map(el => ({
            type: el.getAttribute('itemtype'),
            properties: this.extractMicrodataProperties(el)
        }));
    }

    /**
     * Extract microdata properties
     */
    extractMicrodataProperties(element) {
        const properties = {};
        const propElements = element.querySelectorAll('[itemprop]');
        
        propElements.forEach(el => {
            const prop = el.getAttribute('itemprop');
            const value = el.getAttribute('content') || el.textContent.trim();
            properties[prop] = value;
        });

        return properties;
    }

    /**
     * Analyze performance metrics
     */
    async analyzePerformance() {
        if (!('performance' in window)) {
            return { score: 0, issues: ['Performance API not available'] };
        }

        const navigation = performance.getEntriesByType('navigation')[0];
        const analysis = {
            loadTime: navigation ? navigation.loadEventEnd - navigation.loadEventStart : 0,
            domContentLoaded: navigation ? navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart : 0,
            score: 0,
            issues: []
        };

        // Score based on load time
        if (analysis.loadTime < 1000) {
            analysis.score = 100;
        } else if (analysis.loadTime < 3000) {
            analysis.score = 80;
        } else if (analysis.loadTime < 5000) {
            analysis.score = 60;
        } else {
            analysis.score = 30;
            analysis.issues.push('Slow page load time');
        }

        return analysis;
    }

    /**
     * Analyze accessibility
     */
    analyzeAccessibility() {
        const analysis = {
            score: 0,
            issues: [],
            checks: {
                altText: this.checkAltText(),
                headingStructure: this.checkHeadingStructure(),
                colorContrast: this.checkColorContrast(),
                focusable: this.checkFocusableElements()
            }
        };

        const checkScores = Object.values(analysis.checks);
        analysis.score = checkScores.reduce((sum, score) => sum + score, 0) / checkScores.length;

        return analysis;
    }

    /**
     * Check alt text for accessibility
     */
    checkAltText() {
        const images = document.querySelectorAll('img');
        let score = 100;
        
        images.forEach(img => {
            const alt = img.getAttribute('alt');
            if (!alt || !alt.trim()) {
                score -= 10;
            }
        });

        return Math.max(0, score);
    }

    /**
     * Check heading structure for accessibility
     */
    checkHeadingStructure() {
        const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
        if (headings.length === 0) return 0;
        
        let previousLevel = 0;
        let valid = true;
        
        headings.forEach(heading => {
            const level = parseInt(heading.tagName.charAt(1));
            if (level > previousLevel + 1 && previousLevel !== 0) {
                valid = false;
            }
            previousLevel = level;
        });

        return valid ? 100 : 50;
    }

    /**
     * Basic color contrast check
     */
    checkColorContrast() {
        // This is a simplified check - full contrast analysis would require more complex calculations
        const elements = document.querySelectorAll('*');
        let score = 100;
        
        // Basic check for common contrast issues
        elements.forEach(el => {
            const styles = window.getComputedStyle(el);
            const color = styles.color;
            const backgroundColor = styles.backgroundColor;
            
            // Check for common problematic combinations
            if (color === 'rgb(128, 128, 128)' && backgroundColor === 'rgb(255, 255, 255)') {
                score -= 5; // Light gray on white
            }
        });

        return Math.max(0, score);
    }

    /**
     * Check focusable elements
     */
    checkFocusableElements() {
        const focusableElements = document.querySelectorAll('a, button, input, textarea, select, [tabindex]');
        let score = 100;
        
        focusableElements.forEach(el => {
            const tabIndex = el.getAttribute('tabindex');
            if (tabIndex && parseInt(tabIndex) < 0) {
                score -= 5; // Negative tabindex can be problematic
            }
        });

        return Math.max(0, score);
    }

    /**
     * Analyze mobile readiness
     */
    analyzeMobileReadiness() {
        const viewport = document.querySelector('meta[name="viewport"]');
        const analysis = {
            hasViewport: !!viewport,
            viewportContent: viewport ? viewport.getAttribute('content') : null,
            score: 0,
            issues: []
        };

        if (!viewport) {
            analysis.issues.push('Missing viewport meta tag');
            analysis.score = 0;
        } else if (analysis.viewportContent.includes('width=device-width')) {
            analysis.score = 100;
        } else {
            analysis.score = 50;
            analysis.issues.push('Viewport not optimized for mobile');
        }

        return analysis;
    }

    /**
     * Analyze AI readiness
     */
    analyzeAIReadiness() {
        const analysis = {
            structuredData: this.results.schema?.jsonLd.length > 0,
            semanticHTML: this.checkSemanticHTML(),
            cleanContent: this.checkCleanContent(),
            fastLoading: this.results.performance?.score > 70,
            score: 0,
            issues: []
        };

        let score = 0;
        if (analysis.structuredData) score += 25;
        if (analysis.semanticHTML) score += 25;
        if (analysis.cleanContent) score += 25;
        if (analysis.fastLoading) score += 25;

        analysis.score = score;

        if (!analysis.structuredData) {
            analysis.issues.push('Missing structured data for AI understanding');
        }
        if (!analysis.semanticHTML) {
            analysis.issues.push('Limited semantic HTML elements');
        }
        if (!analysis.cleanContent) {
            analysis.issues.push('Content structure could be cleaner for AI parsing');
        }
        if (!analysis.fastLoading) {
            analysis.issues.push('Slow loading affects AI bot crawling');
        }

        return analysis;
    }

    /**
     * Check for semantic HTML usage
     */
    checkSemanticHTML() {
        const semanticElements = ['main', 'article', 'section', 'nav', 'header', 'footer', 'aside'];
        return semanticElements.some(tag => document.querySelector(tag));
    }

    /**
     * Check content cleanliness
     */
    checkCleanContent() {
        const textContent = document.body.textContent || '';
        const htmlContent = document.body.innerHTML || '';
        
        // Ratio of text to HTML - higher is better for AI parsing
        const textRatio = textContent.length / htmlContent.length;
        return textRatio > 0.3;
    }

    /**
     * Calculate overall SEO score
     */
    calculateOverallScore() {
        const weights = {
            title: 0.15,
            meta: 0.15,
            headings: 0.1,
            content: 0.15,
            images: 0.05,
            links: 0.05,
            schema: 0.1,
            performance: 0.1,
            accessibility: 0.05,
            mobile: 0.05,
            aiReadiness: 0.05
        };

        let totalScore = 0;
        Object.entries(weights).forEach(([key, weight]) => {
            if (this.results[key] && typeof this.results[key].score === 'number') {
                totalScore += this.results[key].score * weight;
            }
        });

        this.results.score = Math.round(totalScore);
    }

    /**
     * Generate improvement suggestions
     */
    generateSuggestions() {
        this.suggestions = [];

        // Title suggestions
        if (this.results.title.score < 80) {
            this.suggestions.push({
                category: 'Title',
                priority: 'high',
                suggestion: 'Optimize page title length to 30-60 characters for better search visibility'
            });
        }

        // Meta description suggestions
        if (!this.results.meta.description) {
            this.suggestions.push({
                category: 'Meta',
                priority: 'high',
                suggestion: 'Add a meta description (120-160 characters) to improve click-through rates'
            });
        }

        // Structured data suggestions
        if (this.results.schema.jsonLd.length === 0) {
            this.suggestions.push({
                category: 'Structured Data',
                priority: 'medium',
                suggestion: 'Add JSON-LD structured data to help AI systems understand your content'
            });
        }

        // Performance suggestions
        if (this.results.performance.score < 70) {
            this.suggestions.push({
                category: 'Performance',
                priority: 'high',
                suggestion: 'Improve page loading speed for better user experience and AI bot crawling'
            });
        }

        // AI readiness suggestions
        if (this.results.aiReadiness.score < 70) {
            this.suggestions.push({
                category: 'AI Readiness',
                priority: 'medium',
                suggestion: 'Optimize content structure for AI systems with clean HTML and structured data'
            });
        }
    }

    /**
     * Export results as JSON
     */
    exportResults() {
        return {
            analysis: this.results,
            warnings: this.warnings,
            errors: this.errors,
            suggestions: this.suggestions,
            exportTime: new Date().toISOString()
        };
    }

    /**
     * Generate human-readable report
     */
    generateReport() {
        const report = {
            summary: {
                score: this.results.score,
                grade: this.getGrade(this.results.score),
                totalIssues: this.errors.length + this.warnings.length
            },
            keyMetrics: {
                title: this.results.title.score,
                content: this.results.content.wordCount,
                performance: Math.round(this.results.performance.loadTime) + 'ms',
                aiReadiness: this.results.aiReadiness.score + '%'
            },
            topSuggestions: this.suggestions.slice(0, 5)
        };

        return report;
    }

    /**
     * Get letter grade based on score
     */
    getGrade(score) {
        if (score >= 90) return 'A';
        if (score >= 80) return 'B';
        if (score >= 70) return 'C';
        if (score >= 60) return 'D';
        return 'F';
    }
}

/**
 * JSON-LD Validator and Generator
 */
class JSONLDValidator {
    constructor() {
        this.schemas = {
            Organization: this.getOrganizationSchema(),
            WebSite: this.getWebSiteSchema(),
            Article: this.getArticleSchema(),
            Service: this.getServiceSchema()
        };
    }

    /**
     * Validate JSON-LD structure
     */
    validate(jsonLd) {
        const results = {
            valid: true,
            errors: [],
            warnings: [],
            suggestions: []
        };

        try {
            const data = typeof jsonLd === 'string' ? JSON.parse(jsonLd) : jsonLd;
            
            // Check required @context
            if (!data['@context']) {
                results.errors.push('Missing @context property');
                results.valid = false;
            }

            // Check @type
            if (!data['@type']) {
                results.errors.push('Missing @type property');
                results.valid = false;
            }

            // Validate based on type
            if (data['@type'] && this.schemas[data['@type']]) {
                const schemaValidation = this.validateAgainstSchema(data, this.schemas[data['@type']]);
                results.errors.push(...schemaValidation.errors);
                results.warnings.push(...schemaValidation.warnings);
                results.suggestions.push(...schemaValidation.suggestions);
            }

        } catch (error) {
            results.valid = false;
            results.errors.push('Invalid JSON structure: ' + error.message);
        }

        return results;
    }

    /**
     * Validate against schema
     */
    validateAgainstSchema(data, schema) {
        const results = { errors: [], warnings: [], suggestions: [] };

        // Check required properties
        schema.required.forEach(prop => {
            if (!data[prop]) {
                results.errors.push(`Missing required property: ${prop}`);
            }
        });

        // Check recommended properties
        schema.recommended.forEach(prop => {
            if (!data[prop]) {
                results.warnings.push(`Missing recommended property: ${prop}`);
            }
        });

        return results;
    }

    /**
     * Generate Organization schema
     */
    generateOrganizationSchema(data) {
        return {
            "@context": "https://schema.org",
            "@type": "Organization",
            "name": data.name || "Your Organization",
            "url": data.url || window.location.origin,
            "logo": data.logo || null,
            "contactPoint": {
                "@type": "ContactPoint",
                "telephone": data.telephone || null,
                "contactType": "Customer Service",
                "email": data.email || null
            },
            "address": data.address ? {
                "@type": "PostalAddress",
                "streetAddress": data.address.street,
                "addressLocality": data.address.city,
                "postalCode": data.address.postalCode,
                "addressCountry": data.address.country
            } : null,
            "sameAs": data.socialMedia || []
        };
    }

    /**
     * Get Organization schema requirements
     */
    getOrganizationSchema() {
        return {
            required: ['@context', '@type', 'name'],
            recommended: ['url', 'logo', 'contactPoint', 'address']
        };
    }

    /**
     * Get WebSite schema requirements
     */
    getWebSiteSchema() {
        return {
            required: ['@context', '@type', 'name', 'url'],
            recommended: ['description', 'publisher']
        };
    }

    /**
     * Get Article schema requirements
     */
    getArticleSchema() {
        return {
            required: ['@context', '@type', 'headline', 'author'],
            recommended: ['datePublished', 'dateModified', 'description', 'image']
        };
    }

    /**
     * Get Service schema requirements
     */
    getServiceSchema() {
        return {
            required: ['@context', '@type', 'name', 'provider'],
            recommended: ['description', 'offers', 'areaServed']
        };
    }
}

/**
 * Competitor Analysis Tool
 */
class CompetitorAnalyzer {
    constructor() {
        this.analyzer = new SEOAnalyzer();
    }

    /**
     * Analyze competitor website (would require CORS proxy in production)
     */
    async analyzeCompetitor(url) {
        // Note: This would require a CORS proxy or server-side implementation
        // For now, return a mock analysis structure
        return {
            url,
            timestamp: new Date().toISOString(),
            analysis: {
                title: { score: 85, length: 45 },
                meta: { score: 70, description: true },
                content: { wordCount: 1200, readabilityScore: 80 },
                performance: { score: 75, loadTime: 2300 },
                structuredData: { jsonLd: 1, score: 60 },
                overall: 75
            },
            suggestions: [
                'Competitor has shorter page load time',
                'Better structured data implementation',
                'More comprehensive meta descriptions'
            ]
        };
    }

    /**
     * Compare multiple competitors
     */
    async compareCompetitors(urls) {
        const comparisons = [];
        
        for (const url of urls) {
            try {
                const analysis = await this.analyzeCompetitor(url);
                comparisons.push(analysis);
            } catch (error) {
                console.error(`Failed to analyze ${url}:`, error);
            }
        }

        return this.generateComparisonReport(comparisons);
    }

    /**
     * Generate comparison report
     */
    generateComparisonReport(comparisons) {
        const metrics = ['title', 'meta', 'content', 'performance', 'structuredData'];
        const report = {
            competitors: comparisons,
            benchmarks: {},
            recommendations: []
        };

        // Calculate benchmarks
        metrics.forEach(metric => {
            const scores = comparisons.map(comp => comp.analysis[metric].score);
            report.benchmarks[metric] = {
                average: scores.reduce((sum, score) => sum + score, 0) / scores.length,
                best: Math.max(...scores),
                worst: Math.min(...scores)
            };
        });

        // Generate recommendations
        report.recommendations = this.generateCompetitiveRecommendations(report.benchmarks);

        return report;
    }

    /**
     * Generate competitive recommendations
     */
    generateCompetitiveRecommendations(benchmarks) {
        const recommendations = [];

        Object.entries(benchmarks).forEach(([metric, data]) => {
            if (data.average > 80) {
                recommendations.push({
                    metric,
                    priority: 'high',
                    suggestion: `Competitors excel in ${metric} (avg: ${Math.round(data.average)}%). Focus on improvement.`
                });
            }
        });

        return recommendations;
    }
}

// Initialize global SEO tools
window.CongruentSEO = {
    SEOAnalyzer,
    JSONLDValidator,
    CompetitorAnalyzer,
    
    // Quick analysis function
    async quickAnalysis() {
        const analyzer = new SEOAnalyzer();
        const results = await analyzer.analyzePage();
        console.table(analyzer.generateReport());
        return results;
    },

    // Validate current page JSON-LD
    validateJSONLD() {
        const validator = new JSONLDValidator();
        const scripts = document.querySelectorAll('script[type="application/ld+json"]');
        
        scripts.forEach((script, index) => {
            const validation = validator.validate(script.textContent);
            console.log(`JSON-LD ${index + 1}:`, validation);
        });
    }
};

// Auto-analyze on load for development
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('🔧 Congruent SEO Tools Loaded');
        console.log('Run CongruentSEO.quickAnalysis() for page analysis');
    });
}