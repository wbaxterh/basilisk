/**
 * Generated map: Cardano asset unit → hotlinkable logo URL (GeckoTerminal /
 * CoinGecko CDN). Used by the /api/v1/tokens/[asset]/logo route as the
 * SECONDARY source (307 redirect) when the Cardano Token Registry (Koios
 * asset_info base64 PNG) has no logo for the unit.
 *
 * Generated 2026-07-11 from one GeckoTerminal tokens/multi call over the
 * 26-unit registry (20 hits, 6 misses). coin-images.coingecko.com verified
 * hotlinkable (no referer checks).
 *
 * HOW TO REGENERATE (30 units per call — chunk if the registry grows):
 *   curl -s -H "Accept: application/json;version=20230203" \
 *     "https://api.geckoterminal.com/api/v2/networks/cardano/tokens/multi/{unit1,unit2,...}" \
 *   | jq -r '.data[] | select(.attributes.image_url | startswith("https://")) |
 *       "\(.attributes.address): \(.attributes.image_url)"'
 * Keep only https URLs (GT reports "missing.png" for tokens without images).
 */

/** Asset unit (lowercase policyId + assetNameHex) → image URL. */
export const TOKEN_IMAGE_URLS: Readonly<Record<string, string>> = {
  // USDM
  "c48cbb3d5e57ed56e276bc45f99ab39abe94e6cd7ac39fb402da47ad0014df105553444d":
    "https://coin-images.coingecko.com/coins/images/38755/large/USDM_Logo_01.jpg?1744966625",
  // USDA
  "fe7c786ab321f41c654ef6c1af7b3250a613c24e4213e0425a7ae45655534441":
    "https://coin-images.coingecko.com/coins/images/67347/large/usda.jpg?1752476144",
  // NIGHT
  "0691b2fecca1ac4f53cb6dfb00b7013e561d1f34403b957cbb5af1fa4e49474854":
    "https://coin-images.coingecko.com/coins/images/71015/large/midnight.png?1765193080",
  // WRT
  "c0ee29a85b13209423b10447d3c2e6a50641a15c57770e27cb9d507357696e67526964657273":
    "https://coin-images.coingecko.com/coins/images/26363/large/Token_logo_200x200.png?1696525440",
  // IAG
  "5d16cc1a177b5d9ba9cfa9793b07e60f1fb70fea1f8aef064415d114494147":
    "https://coin-images.coingecko.com/coins/images/3264/large/d8c5hLbX9u0GwYCKcZRbXS2vAQ0Vd-Hfjg-3zQ73ucSZQoFYsLH4NEKN8EQkwwBVR8OPJgrTRG-_dW_XVHL058ezYSvwsSB4bjYtHH7xjZNHBaAaX1NZl7axG8zm2FIRV6AUmgdmxcbP0BcuWvUJkcUKrYYEDf0Msx2_3arxgmS1V85YMb_1SVbWt6E3QnkpvLcGyC0SxN6rGTr.jpg?1696503977",
  // DJED
  "8db269c3ec630e06ae29f74bc39edd1f87c819f1056206e879a1cd61446a65644d6963726f555344":
    "https://coin-images.coingecko.com/coins/images/28650/large/256_Djed__No_Background_%284%29_%283%29.png?1696527635",
  // SNEK
  "279c909f348e533da5808898f87f9a14bb2c3dfbbacccd631d927a3f534e454b":
    "https://coin-images.coingecko.com/coins/images/30496/large/Snek-Square-BG_200x200.png?1768638178",
  // WMTX
  "e5a42a1a1d3d1da71b0449663c32798725888d2eb0843c4dabeca05a576f726c644d6f62696c65546f6b656e58":
    "https://coin-images.coingecko.com/coins/images/17333/large/Token_icon_round_1024.png?1741247846",
  // iUSD
  "f66d78b4a3cb3d37afa0ec36461e51ecbde00f26c8f0a68f94b6988069555344":
    "https://coin-images.coingecko.com/coins/images/28494/large/iUSD_200x200.png?1714842669",
  // SHEN
  "8db269c3ec630e06ae29f74bc39edd1f87c819f1056206e879a1cd615368656e4d6963726f555344":
    "https://coin-images.coingecko.com/coins/images/28651/large/256_Shen_No_Background_%288%29_%281%29.png?1696527636",
  // INDY
  "533bb94a8850ee3ccbe483106489399112b74c905342cb1792a797a0494e4459":
    "https://coin-images.coingecko.com/coins/images/28303/large/IndigoTokenCMC.png?1696527302",
  // NOCY
  "4a6d25f8bbc2b318517f4de4c1e7d55bbde6a5921602bbaa131b229b4e4f4359":
    "https://coin-images.coingecko.com/coins/images/102171889/large/nocy_profile_gradient.png?1770264079",
  // STUFF (GT symbol: BOOK)
  "51a5e236c4de3af2b8020442e2a26f454fda3b04cb621c1294a0ef34424f4f4b":
    "https://coin-images.coingecko.com/coins/images/32590/large/stuff.jpg?1721728647",
  // NTX
  "edfd7a1d77bcb8b884c474bdc92a16002d1fb720e454fa6e993444794e5458":
    "https://coin-images.coingecko.com/coins/images/20950/large/Coingecko_NuNet_Update.png?1761124330",
  // PALM
  "b7c5cd554f3e83c8aa0900a0c9053284a5348244d23d0406c28eaf4d50414c4d0a":
    "https://coin-images.coingecko.com/coins/images/55256/large/PALM_Token_Vector.png?1745037772",
  // LQ
  "da8c30857834c6ae7203935b89278c532b3995245295456f993e1d244c51":
    "https://coin-images.coingecko.com/coins/images/23610/large/liqwid_finance_logo-200-200.png?1739392823",
  // BANK
  "2b28c81dbba6d67e4b5a997c6be1212cba9d60d33f82444ab8b1f21842414e4b":
    "https://coin-images.coingecko.com/coins/images/30616/large/_BANK_Token.png?1782896219",
  // AGIX
  "f43a62fdc3965df486de8a0d32fe800963589c41b38946602a0dc53541474958":
    "https://coin-images.coingecko.com/coins/images/2138/large/singularitynet.png?1696503103",
  // MIN
  "29d222ce763455e3d7a09a665ce554f00ac89d2e99a1a83d267170c64d494e":
    "https://coin-images.coingecko.com/coins/images/27823/large/Logo_Round.png?1727293179",
  // USDC (Cardano-native bridge mint)
  "25c5de5f5b286073c593edfd77b48abc7a48e5a4f3d4cd9d428ff93555534443":
    "https://coin-images.coingecko.com/coins/images/67282/large/usdc.jpg?1752296844",
};
