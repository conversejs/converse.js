// @ts-check
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
    integrations: [
        starlight({
            title: 'Converse',
            logo: {
                src: './src/assets/logo.svg',
            },
            components: {
                Footer: './src/components/Footer.astro',
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
                        { label: 'Overview', slug: 'development/overview' },
                        { label: 'Setting up a Dev Environment', slug: 'development/setup-dev-environment' },
                        { label: 'Writing a Plugin', slug: 'development/plugin-development' },
                        { label: 'Automated Tests', slug: 'development/testing' },
                        { label: 'Integrating into Other Frameworks', slug: 'development/other-frameworks' },
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
