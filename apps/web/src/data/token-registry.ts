/**
 * Curated registry of Cardano native tokens with verified DexScreener coverage.
 *
 * COVERAGE: DexScreener indexes only SundaeSwap + WingRiders pools on Cardano
 * (no Minswap). Aggregates built from this registry are therefore
 * "SundaeSwap + WingRiders via DexScreener" — never label them total Cardano
 * volume/liquidity.
 *
 * Every entry below was verified empirically on 2026-07-06: a request to
 *   GET https://api.dexscreener.com/tokens/v1/cardano/{addr1,addr2,...}
 * returned >= 1 live cardano pair for each address (30/30 confirmed in a
 * single batch call).
 *
 * HOW TO REGENERATE:
 * 1. Candidate mining: hit
 *      GET https://api.dexscreener.com/latest/dex/search?q=<ticker>
 *    for a broad ticker list (plus queries like "wingriders", "sundaeswap",
 *    "ADA") and keep pairs where chainId === "cardano".
 * 2. Collect unique baseToken.address values ({policyId}{assetNameHex}).
 * 3. Confirm each via the batch endpoint above (max 30 addresses per call);
 *    drop any address that returns zero pairs.
 * 4. Sort by aggregate liquidity desc and update this file.
 *
 * address = Cardano asset unit: 56-char policy id + asset name hex.
 */

export interface RegistryToken {
  address: string;
  symbol: string;
  name: string;
}

// Sorted by verified DexScreener liquidity (USD) at generation time.
export const TOKEN_REGISTRY: RegistryToken[] = [
  { address: "c48cbb3d5e57ed56e276bc45f99ab39abe94e6cd7ac39fb402da47ad0014df105553444d", symbol: "USDM", name: "USDM" },
  { address: "fe7c786ab321f41c654ef6c1af7b3250a613c24e4213e0425a7ae45655534441", symbol: "USDA", name: "USDA" },
  { address: "0691b2fecca1ac4f53cb6dfb00b7013e561d1f34403b957cbb5af1fa4e49474854", symbol: "NIGHT", name: "NIGHT" },
  { address: "9a9693a9a37912a5097918f97918d15240c92ab729a0b7c4aa144d7753554e444145", symbol: "SUNDAE", name: "SUNDAE" },
  { address: "5d16cc1a177b5d9ba9cfa9793b07e60f1fb70fea1f8aef064415d114494147", symbol: "IAG", name: "IAGON" },
  { address: "c0ee29a85b13209423b10447d3c2e6a50641a15c57770e27cb9d507357696e67526964657273", symbol: "WRT", name: "WingRiders Governance Token" },
  { address: "016be5325fd988fea98ad422fcfd53e5352cacfced5c106a932a35a442544e", symbol: "BTN", name: "BTN" },
  { address: "8483844875ce4d61c2aa459240f277d32081ee08fe0ad16899a0f5810014df10544954414e", symbol: "TITAN", name: "TITAN" },
  { address: "9ff9a1b456f074e03be90631e1a5f9b6ed08eacabd0e7f95a11ffff10014df1041544c4153", symbol: "ATLAS", name: "ATLAS" },
  { address: "8db269c3ec630e06ae29f74bc39edd1f87c819f1056206e879a1cd615368656e4d6963726f555344", symbol: "SHEN", name: "Shen USD" },
  { address: "8db269c3ec630e06ae29f74bc39edd1f87c819f1056206e879a1cd61446a65644d6963726f555344", symbol: "DJED", name: "Djed USD" },
  { address: "279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f534e454b", symbol: "SNEK", name: "Snek" },
  { address: "e5a42a1a1d3d1da71b0449663c32798725888d2eb0843c4dabeca05a576f726c644d6f62696c65546f6b656e58", symbol: "WMTX", name: "WorldMobileTokenX" },
  { address: "f66d78b4a3cb3d37afa0ec36461e51ecbde00f26c8f0a68f94b6988069555344", symbol: "iUSD", name: "iUSD" },
  { address: "533bb94a8850ee3ccbe483106489399112b74c905342cb1792a797a0494e4459", symbol: "INDY", name: "INDY" },
  { address: "1f3aec8bfe7ea4fe14c5f121e2a92e301afe414147860d557cac7e345553444378", symbol: "USDCx", name: "USDCx" },
  { address: "4a6d25f8bbc2b318517f4de4c1e7d55bbde6a5921602bbaa131b229b4e4f4359", symbol: "NOCY", name: "NOCY" },
  { address: "51a5e236c4de3af2b8020442e2a26f454fda3b04cb621c1294a0ef34424f4f4b", symbol: "STUFF", name: "STUFF (Book.io)" },
  { address: "edfd7a1d77bcb8b884c474bdc92a16002d1fb720e454fa6e993444794e5458", symbol: "NTX", name: "NuNet Utility Token" },
  { address: "b7c5cd554f3e83c8aa0900a0c9053284a5348244d23d0406c28eaf4d50414c4d0a", symbol: "PALM", name: "PALM Economy Token" },
  { address: "da8c30857834c6ae7203935b89278c532b3995245295456f993e1d244c51", symbol: "LQ", name: "Liqwid DAO Token" },
  { address: "ec6ec45fc2275a2380b16449c1e34869dc0b6609bdf17a8b7c9f1cb4546f6d61746f436f696e", symbol: "TCOIN", name: "TomatoCoin" },
  { address: "884892bcdc360bcef87d6b3f806e7f9cd5ac30d999d49970e7a903ae5041564941", symbol: "PAVIA", name: "PAVIA Token" },
  { address: "c881c20e49dbaca3ff6cef365969354150983230c39520b917f5cf7c4e696b65", symbol: "NIKEPIG", name: "Nike" },
  { address: "2b28c81dbba6d67e4b5a997c6be1212cba9d60d33f82444ab8b1f21842414e4b", symbol: "BANK", name: "Bank" },
  { address: "a0028f350aaabe0545fdcb56b039bfb08e4bb4d8c4d7c3c7d481c235484f534b59", symbol: "HOSKY", name: "HOSKY Token" },
  { address: "f66d78b4a3cb3d37afa0ec36461e51ecbde00f26c8f0a68f94b6988069425443", symbol: "iBTC", name: "iBTC" },
  { address: "590f6d119b214cdcf7ef7751f8b7f1de615ff8f6de097a5ce62b257b534841524c", symbol: "SHARL", name: "SHARL" },
  { address: "dda5fdb1002f7389b33e036b6afee82a8189becb6cba852e8b79b4fb0014df1047454e53", symbol: "GENS", name: "Genius Yield Token" },
  { address: "60faa64709fede8dffed0dccb69da337a5bf61eda0c773156ea78b4d534b59", symbol: "SKY", name: "SKY" },
];

/** Fast lookup: asset unit → registry entry. */
export const TOKEN_REGISTRY_BY_ADDRESS: ReadonlyMap<string, RegistryToken> =
  new Map(TOKEN_REGISTRY.map((t) => [t.address, t]));
