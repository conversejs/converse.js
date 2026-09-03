// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import starlightLinksValidator from 'starlight-links-validator';

// https://astro.build/config
export default defineConfig({
    base: '/docs/',
    // Keep the docs build self-contained: without this, Vite searches
    // upwards and picks up the main app's postcss.config.js, which pulls
    // autoprefixer out of the root node_modules.
    vite: { css: { postcss: {} } },
    integrations: [
        starlight({
            plugins: [
                starlightLinksValidator({
                    // The dev docs legitimately point readers at their own
                    // local dev server (http://localhost:8000/dev.html etc).
                    errorOnLocalLinks: false,
                }),
            ],
            title: 'Converse',
            logo: {
                src: './src/assets/logo.svg',
            },
            components: {
                Footer: './src/components/Footer.astro',
                Hero: './src/components/Hero.astro',
            },
            social: [
                { icon: 'github', label: 'GitHub', href: 'https://github.com/conversejs/converse.js' },
            ],
            editLink: {
                baseUrl: 'https://github.com/conversejs/converse.js/edit/master/docs/',
            },
            sidebar: [
                { label: 'Quickstart', slug: 'quickstart' },
                { label: 'Features', slug: 'features' },
                { label: 'Setup and Integration', slug: 'setup' },
                { label: 'Session Management', slug: 'session' },
                { label: 'Configuration', slug: 'configuration' },
                {
                    label: 'Development',
                    items: [
                        { label: 'Development Documentation', slug: 'development/overview' },
                        { label: 'Setting up a Dev Environment', slug: 'development/setup-dev-environment' },
                        { label: 'Writing a Plugin', slug: 'development/plugin-development' },
                        { label: 'Automated Tests', slug: 'development/testing' },
                        { label: 'Generating Builds', slug: 'development/builds' },
                        { label: 'Software Style Guide', slug: 'development/style-guide' },
                    ],
                },
                { label: 'Theming', slug: 'theming' },
                { label: 'Security', slug: 'security' },
                { label: 'Translations', slug: 'translations' },
                { label: 'Troubleshooting', slug: 'troubleshooting' },
                { label: 'Writing Documentation', slug: 'documentation' },
            ],
        }),
    ],
});
