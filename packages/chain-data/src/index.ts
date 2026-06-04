/**
 * @basilisk/chain-data
 * Cardano data-access client lib with pluggable providers.
 *
 * Providers:
 * - BlockfrostProvider — REST API, free tier (50k req/day)
 * - KupmiosProvider — Ogmios WebSocket + Kupo HTTP (primary for production)
 *
 * See ADR-001 for the provider strategy.
 */

export type { ChainDataProvider, ProviderUtxo, QueryOptions } from "./provider.js";
export { BlockfrostProvider } from "./providers/blockfrost.js";
export type { BlockfrostConfig } from "./providers/blockfrost.js";
export { KupmiosProvider } from "./providers/kupmios.js";
export type { KupmiosConfig } from "./providers/kupmios.js";
