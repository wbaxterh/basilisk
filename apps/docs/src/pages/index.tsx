import type {ReactNode} from 'react';
import Link from '@docusaurus/Link';
import Layout from '@theme/Layout';
import Heading from '@theme/Heading';

import styles from './index.module.css';

function Hero() {
  return (
    <header className={styles.hero}>
      <div className={styles.heroGlow} />
      <div className={styles.container}>
        <span className={styles.pill}>
          <span className={styles.dot} /> DEVELOPER DOCS
        </span>
        <Heading as="h1" className={styles.title}>
          Build on <span className={styles.brand}>Basilisk</span>.
        </Heading>
        <p className={styles.subtitle}>
          REST API, x402 micropayments, and an MCP server for autonomous agents — all backed by real-time on-chain Cardano data.
        </p>
        <div className={styles.actions}>
          <Link className={`button button--primary button--lg ${styles.cta}`} to="/docs/getting-started/overview">
            Get started →
          </Link>
          <Link className={`button button--secondary button--lg ${styles.cta}`} to="/docs/api/overview">
            REST API
          </Link>
          <Link className={`button button--secondary button--lg ${styles.cta}`} to="/docs/agents/overview">
            For Agents
          </Link>
        </div>
      </div>
    </header>
  );
}

interface CardProps { tag: string; title: string; desc: string; to: string; }
function Card({tag, title, desc, to}: CardProps) {
  return (
    <Link to={to} className={styles.card}>
      <span className={styles.cardTag}>{tag}</span>
      <h3 className={styles.cardTitle}>{title}</h3>
      <p className={styles.cardDesc}>{desc}</p>
      <span className={styles.cardArrow}>Read →</span>
    </Link>
  );
}

function CardGrid() {
  return (
    <section className={styles.grid}>
      <div className={styles.gridInner}>
        <Card
          tag="Quickstart"
          title="Getting Started"
          desc="Pick the surface that fits — app, API, or agent — and you'll be reading live Cardano data in under 5 minutes."
          to="/docs/getting-started/overview"
        />
        <Card
          tag="HTTP"
          title="REST API Reference"
          desc="Prices, candles, tokens, wallets, screeners. Beta endpoints, generous free tier, predictable JSON envelopes."
          to="/docs/api/overview"
        />
        <Card
          tag="Agents"
          title="x402 + MCP"
          desc="Pay-per-request access in native ADA. No keys, no accounts. MCP server for Claude, GPT, and any LLM."
          to="/docs/agents/overview"
        />
        <Card
          tag="Releases"
          title="Changelog"
          desc="Every breaking change, every new endpoint, every shipped feature. Subscribe via RSS or check back here."
          to="/changelog"
        />
      </div>
    </section>
  );
}

export default function Home(): ReactNode {
  return (
    <Layout
      title="Basilisk Docs"
      description="Build on Basilisk — REST API, x402 micropayments, and MCP server for Cardano analytics and autonomous agents."
    >
      <Hero />
      <CardGrid />
    </Layout>
  );
}
