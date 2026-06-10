import {themes as prismThemes} from 'prism-react-renderer';
import type {Config} from '@docusaurus/types';
import type * as Preset from '@docusaurus/preset-classic';

/**
 * Canonical Basilisk URLs — single source of truth for the docs site.
 * Override at deploy time with BASILISK_APP_URL / BASILISK_DOCS_URL / BASILISK_GITHUB_URL.
 * When the production domain is purchased, change a default here or set the env var.
 */
const APP_URL = process.env.BASILISK_APP_URL || 'https://basilisk.vercel.app';
const DOCS_URL = process.env.BASILISK_DOCS_URL || 'https://basilisk-docs.vercel.app';
const GITHUB_URL = process.env.BASILISK_GITHUB_URL || 'https://github.com/wbaxterh/basilisk';

const config: Config = {
  title: 'Basilisk Docs',
  tagline: 'Cardano analytics for humans & agents',
  favicon: 'img/favicon.svg',

  future: {
    v4: false,
  },

  url: DOCS_URL,
  baseUrl: '/',

  organizationName: 'wbaxterh',
  projectName: 'basilisk',

  // Expose canonical URLs to MDX/JSX components via useDocusaurusContext().siteConfig.customFields.
  customFields: {
    appUrl: APP_URL,
    docsUrl: DOCS_URL,
    githubUrl: GITHUB_URL,
  },

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  headTags: [
    {
      tagName: 'link',
      attributes: { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
    },
    {
      tagName: 'link',
      attributes: { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: 'anonymous' },
    },
    {
      tagName: 'link',
      attributes: {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500&display=swap',
      },
    },
  ],

  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          routeBasePath: '/docs',
          editUrl: `${GITHUB_URL}/tree/main/apps/docs/`,
        },
        blog: {
          path: 'changelog',
          routeBasePath: '/changelog',
          blogTitle: 'Release Notes',
          blogDescription: 'What\'s new in Basilisk',
          blogSidebarTitle: 'Recent releases',
          blogSidebarCount: 'ALL',
          showReadingTime: false,
          feedOptions: {
            type: ['rss', 'atom'],
            title: 'Basilisk releases',
            xslt: true,
          },
          editUrl: `${GITHUB_URL}/tree/main/apps/docs/`,
          onInlineTags: 'warn',
          onInlineAuthors: 'ignore',
          onUntruncatedBlogPosts: 'ignore',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      } satisfies Preset.Options,
    ],
  ],

  themeConfig: {
    image: 'img/basilisk-og.png',
    colorMode: {
      defaultMode: 'dark',
      disableSwitch: false,
      respectPrefersColorScheme: false,
    },
    navbar: {
      title: 'Basilisk',
      logo: {
        alt: 'Basilisk',
        src: 'img/logo.svg',
      },
      items: [
        {
          type: 'docSidebar',
          sidebarId: 'docsSidebar',
          position: 'left',
          label: 'Docs',
        },
        {
          to: '/docs/api/overview',
          label: 'API',
          position: 'left',
        },
        {
          to: '/docs/agents/overview',
          label: 'For Agents',
          position: 'left',
        },
        {to: '/changelog', label: 'Releases', position: 'left'},
        {
          href: APP_URL,
          label: 'App ↗',
          position: 'right',
        },
        {
          href: GITHUB_URL,
          label: 'GitHub',
          position: 'right',
        },
      ],
    },
    footer: {
      style: 'dark',
      links: [
        {
          title: 'Product',
          items: [
            {label: 'Launch app', href: APP_URL},
            {label: 'Whitepaper', href: `${APP_URL}/whitepaper`},
            {label: 'Releases', to: '/changelog'},
          ],
        },
        {
          title: 'Developers',
          items: [
            {label: 'Getting started', to: '/docs/getting-started/overview'},
            {label: 'REST API', to: '/docs/api/overview'},
            {label: 'x402 + MCP', to: '/docs/agents/overview'},
            {label: 'GitHub', href: GITHUB_URL},
          ],
        },
        {
          title: 'Community',
          items: [
            {label: 'Issues', href: `${GITHUB_URL}/issues`},
            {label: 'Discussions', href: `${GITHUB_URL}/discussions`},
          ],
        },
      ],
      copyright: `© ${new Date().getFullYear()} Basilisk · Cardano analytics for humans & agents`,
    },
    prism: {
      theme: prismThemes.vsDark,
      darkTheme: prismThemes.vsDark,
      additionalLanguages: ['bash', 'json', 'typescript', 'sql'],
    },
  } satisfies Preset.ThemeConfig,
};

export default config;
