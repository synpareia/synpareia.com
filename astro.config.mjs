import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://synpareia.com',
  integrations: [
    sitemap(),
    starlight({
      title: 'synpareia',
      description: 'Cryptographic trust layer for AI agents',
      logo: {
        light: './src/assets/logo-light.svg',
        dark: './src/assets/logo-dark.svg',
        replacesTitle: false,
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/synpareia' },
      ],
      editLink: {
        baseUrl: 'https://github.com/synpareia/synpareia.com/edit/main/',
      },
      customCss: ['./src/styles/custom.css'],
      sidebar: [
        {
          label: 'Getting Started',
          items: [
            { label: 'Quickstart', slug: 'getting-started' },
            { label: 'Installation', slug: 'installation' },
          ],
        },
        {
          label: 'Concepts',
          items: [
            { label: 'Overview', slug: 'concepts/overview' },
            { label: 'Blocks', slug: 'concepts/blocks' },
            { label: 'Chains', slug: 'concepts/chains' },
            { label: 'Anchors', slug: 'concepts/anchors' },
            { label: 'Witness Seals', slug: 'concepts/seals' },
            { label: 'Identity', slug: 'concepts/identity' },
            { label: 'Reputation Tiers', slug: 'concepts/reputation-tiers' },
          ],
        },
        {
          label: 'Guides',
          items: [
            { label: 'Two Operators, End-to-End', slug: 'guides/two-operators-end-to-end' },
            { label: 'Building a Chain of Presence', slug: 'guides/chain-of-presence' },
            { label: 'Cross-Chain References', slug: 'guides/cross-chain-references' },
            { label: 'Commit-Reveal Schemes', slug: 'guides/commit-reveal' },
            { label: 'Chain Export and Verification', slug: 'guides/export-verify' },
            { label: 'Run Your Own Witness', slug: 'guides/self-hosted-witness' },
          ],
        },
        {
          label: 'Integrations',
          items: [
            { label: 'Trust Toolkit MCP', slug: 'integrations/trust-toolkit' },
            { label: 'CrewAI', slug: 'integrations/crewai' },
          ],
        },
        {
          label: 'The synpareia network',
          items: [
            { label: 'Profile Directory', slug: 'services/network/profile' },
            { label: 'Matching Design', slug: 'services/network/matching' },
            { label: 'Roadmap', slug: 'services/network/roadmap' },
          ],
        },
        {
          label: 'Reference',
          items: [
            { label: 'SDK API', slug: 'reference/api' },
            { label: 'Witness API', slug: 'reference/witness-api' },
            { label: 'Architecture Decisions', slug: 'reference/decisions' },
          ],
        },
      ],
      head: [
        { tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.googleapis.com' } },
        { tag: 'link', attrs: { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: true } },
        { tag: 'link', attrs: { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap' } },
      ],
    }),
  ],
});
