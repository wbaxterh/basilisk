"use client";

/**
 * Wallet connection context for Basilisk.
 *
 * Wraps the CIP-30 helpers in src/lib/wallet.ts with app-wide state:
 * - connect() with a wallet-picker modal when >1 extension is installed
 * - silent reconnect on mount (localStorage "basilisk.wallet" + isEnabled())
 * - signPayload() for community boosts/comments (CIP-30 signData)
 *
 * Client-only. Never import server modules (community.ts pulls Neon).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { bech32 } from "bech32";

import {
  detectWallets,
  connectWallet,
  getRewardAddressHex,
  signCommunityPayload,
  canonicalWalletFor,
  CANONICAL_WALLETS,
  type CardanoWalletApi,
  type SignedCommunityPayload,
  type WalletInfo,
} from "@/lib/wallet";

const STORAGE_KEY = "basilisk.wallet";
const MAINNET_REWARD_HEX_RE = /^e1[0-9a-f]{56}$/;

export type WalletStatus = "disconnected" | "connecting" | "connected";

/** Snapshot handed back by connect() so callers can act without waiting on state. */
export interface ConnectedWalletSnapshot {
  walletName: string;
  rewardAddressHex: string;
  stakeShort: string;
  api: CardanoWalletApi;
}

export interface WalletContextValue {
  status: WalletStatus;
  /** Human wallet name ("Eternl"), null when disconnected. */
  walletName: string | null;
  /** Extension icon data-URI, null when disconnected/unknown. */
  walletIcon: string | null;
  /** 29-byte hex mainnet reward address (e1…), null when disconnected. */
  rewardAddressHex: string | null;
  /** "stake1uy…abcd" display form, null when disconnected. */
  stakeShort: string | null;
  api: CardanoWalletApi | null;
  /** Last connect error (friendly copy), cleared on the next attempt. */
  error: string | null;
  /**
   * Connect a wallet. One extension → connects directly; several → opens the
   * picker modal. Resolves with a snapshot on success, null if the user
   * dismissed the picker or the connection failed.
   */
  connect(): Promise<ConnectedWalletSnapshot | null>;
  disconnect(): void;
  /**
   * Sign a community payload (boost/comment) with the connected wallet.
   * @throws Error with friendly copy when the user declines or no wallet.
   */
  signPayload(payloadObj: object): Promise<SignedCommunityPayload>;
}

const WalletContext = createContext<WalletContextValue | null>(null);

export function useWallet(): WalletContextValue {
  const ctx = useContext(WalletContext);
  if (!ctx) {
    throw new Error("useWallet must be used inside <WalletProvider> (see src/app/(app)/layout.tsx).");
  }
  return ctx;
}

function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

/** "stake1uy…abcd" from the hex reward address; falls back to short hex. */
function stakeShortFromHex(rewardAddressHex: string): string {
  const hex = rewardAddressHex.toLowerCase();
  if (MAINNET_REWARD_HEX_RE.test(hex)) {
    try {
      const full = bech32.encode("stake", bech32.toWords(hexToBytes(hex)));
      return `${full.slice(0, 8)}…${full.slice(-4)}`;
    } catch {
      // fall through to hex form
    }
  }
  return `${hex.slice(0, 6)}…${hex.slice(-4)}`;
}

/**
 * Human display name for a detected wallet: canonical registry name when we
 * know the wallet, else title-case all-lowercase injected names ("eternl" →
 * "Eternl"), else the injected name as-is.
 */
function displayWalletName(injectedName: string): string {
  const canonical = canonicalWalletFor(injectedName);
  if (canonical) return canonical.displayName;
  const trimmed = injectedName.trim();
  if (trimmed && trimmed === trimmed.toLowerCase()) {
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
  }
  return trimmed;
}

/** 22px rounded wallet mark: extension icon (data-uri) or letter fallback. */
function WalletMark({ icon, name }: { icon?: string; name: string }) {
  if (icon) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={icon}
        alt=""
        width={22}
        height={22}
        style={{ borderRadius: 6, flexShrink: 0, objectFit: "contain" }}
      />
    );
  }
  return (
    <span
      aria-hidden
      style={{
        width: 22,
        height: 22,
        borderRadius: 6,
        flexShrink: 0,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(32,235,122,0.12)",
        color: "#20EB7A",
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

/** True for CIP-30 "user declined" shapes (DataSignError code 3 et al). */
function isUserRejection(err: unknown): boolean {
  if (typeof err !== "object" || err === null) return false;
  const { code, info, message } = err as { code?: unknown; info?: unknown; message?: unknown };
  if (code === 3 || code === -3) return true;
  const text = `${typeof info === "string" ? info : ""} ${typeof message === "string" ? message : ""}`.toLowerCase();
  return text.includes("decline") || text.includes("reject") || text.includes("cancel");
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<WalletStatus>("disconnected");
  const [walletName, setWalletName] = useState<string | null>(null);
  const [walletIcon, setWalletIcon] = useState<string | null>(null);
  const [rewardAddressHex, setRewardAddressHex] = useState<string | null>(null);
  const [stakeShort, setStakeShort] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerWallets, setPickerWallets] = useState<WalletInfo[]>([]);

  const apiRef = useRef<CardanoWalletApi | null>(null);
  // Resolver for the connect() promise while the picker modal is open.
  const pickerResolveRef = useRef<((v: ConnectedWalletSnapshot | null) => void) | null>(null);

  const connectById = useCallback(async (walletId: string): Promise<ConnectedWalletSnapshot | null> => {
    setStatus("connecting");
    setError(null);
    try {
      const wallet = await connectWallet(walletId);

      const networkId = await wallet.api.getNetworkId();
      if (networkId !== 1) {
        throw new Error("Please switch your wallet to Cardano mainnet and reconnect.");
      }

      const hex = (await getRewardAddressHex(wallet.api)).toLowerCase();
      const short = stakeShortFromHex(hex);

      const prettyName = displayWalletName(wallet.info.name);
      apiRef.current = wallet.api;
      setWalletName(prettyName);
      setWalletIcon(wallet.info.icon || null);
      setRewardAddressHex(hex);
      setStakeShort(short);
      setStatus("connected");

      try {
        window.localStorage.setItem(STORAGE_KEY, walletId);
      } catch {
        // private mode etc. — persistence is best-effort
      }

      return { walletName: prettyName, rewardAddressHex: hex, stakeShort: short, api: wallet.api };
    } catch (err) {
      apiRef.current = null;
      setStatus("disconnected");
      setError(
        isUserRejection(err)
          ? "Connection request was declined in the wallet."
          : err instanceof Error
            ? err.message
            : "Could not connect the wallet."
      );
      return null;
    }
  }, []);

  // Silent reconnect: extensions inject after page load, so wait briefly,
  // then re-enable the remembered wallet only if it is already authorized.
  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      let saved: string | null = null;
      try {
        saved = window.localStorage.getItem(STORAGE_KEY);
      } catch {
        return;
      }
      if (!saved) return;

      const cardano = (window as unknown as Record<string, unknown>).cardano as
        | Record<string, { isEnabled(): Promise<boolean> }>
        | undefined;
      const entry = cardano?.[saved];
      if (!entry || typeof entry.isEnabled !== "function") return;

      try {
        const enabled = await entry.isEnabled();
        if (enabled && !cancelled) await connectById(saved);
      } catch {
        // stale extension state — stay disconnected quietly
      }
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [connectById]);

  const closePicker = useCallback((result: ConnectedWalletSnapshot | null) => {
    setPickerOpen(false);
    const resolve = pickerResolveRef.current;
    pickerResolveRef.current = null;
    resolve?.(result);
  }, []);

  // Never leave a caller awaiting connect() hanging if the provider unmounts.
  useEffect(() => {
    return () => {
      pickerResolveRef.current?.(null);
      pickerResolveRef.current = null;
    };
  }, []);

  const connect = useCallback(async (): Promise<ConnectedWalletSnapshot | null> => {
    setError(null);
    // A second connect() while the picker is open must not orphan the first
    // caller's promise — settle it as "dismissed" before re-arming.
    pickerResolveRef.current?.(null);
    pickerResolveRef.current = null;
    const wallets = detectWallets();

    if (wallets.length === 0) {
      setPickerWallets([]);
      setPickerOpen(true); // shows the "no wallets" state with install hint
      return new Promise<ConnectedWalletSnapshot | null>((resolve) => {
        pickerResolveRef.current = resolve;
      });
    }

    if (wallets.length === 1) {
      return connectById(wallets[0]!.id);
    }

    setPickerWallets(wallets);
    setPickerOpen(true);
    return new Promise<ConnectedWalletSnapshot | null>((resolve) => {
      pickerResolveRef.current = resolve;
    });
  }, [connectById]);

  const handlePickerChoice = useCallback(
    async (walletId: string) => {
      const result = await connectById(walletId);
      closePicker(result);
    },
    [connectById, closePicker]
  );

  const disconnect = useCallback(() => {
    apiRef.current = null;
    setStatus("disconnected");
    setWalletName(null);
    setWalletIcon(null);
    setRewardAddressHex(null);
    setStakeShort(null);
    setError(null);
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      // best-effort
    }
  }, []);

  const signPayload = useCallback(async (payloadObj: object): Promise<SignedCommunityPayload> => {
    const api = apiRef.current;
    if (!api) {
      throw new Error("Connect a wallet first.");
    }
    try {
      const signed = await signCommunityPayload(api, payloadObj);
      // signCommunityPayload reads the wallet's CURRENT reward address, which
      // can differ from our snapshot if the user switched accounts in the
      // extension — converge the displayed identity to what actually signed.
      setRewardAddressHex((prev) => {
        if (prev !== signed.rewardAddressHex) {
          setStakeShort(stakeShortFromHex(signed.rewardAddressHex));
          return signed.rewardAddressHex;
        }
        return prev;
      });
      return signed;
    } catch (err) {
      if (isUserRejection(err)) {
        throw new Error("Signature request was declined in the wallet.");
      }
      throw new Error(
        err instanceof Error && err.message
          ? err.message
          : "The wallet could not sign the request. Try reconnecting."
      );
    }
  }, []);

  // Close the picker on Escape.
  useEffect(() => {
    if (!pickerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closePicker(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pickerOpen, closePicker]);

  const value: WalletContextValue = {
    status,
    walletName,
    walletIcon,
    rewardAddressHex,
    stakeShort,
    api: apiRef.current,
    error,
    connect,
    disconnect,
    signPayload,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
      {pickerOpen && (
        <div
          onClick={() => closePicker(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 400,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            role="dialog"
            aria-label="Choose a Cardano wallet"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 320,
              maxWidth: "100%",
              background: "#111112",
              border: "1px solid #24242C",
              borderRadius: 8,
              padding: 14,
              boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
            }}
          >
            <div
              style={{
                fontSize: 11,
                textTransform: "uppercase",
                letterSpacing: "1.2px",
                color: "#9898A1",
                fontWeight: 700,
                padding: "2px 4px 10px",
              }}
            >
              Connect a wallet
            </div>

            {pickerWallets.length === 0 ? (
              <div style={{ padding: "6px 4px 4px", fontSize: 13, color: "#9898A1", lineHeight: 1.5 }}>
                No Cardano wallets detected.
                <div style={{ fontSize: 12, color: "#6B6B73", margin: "4px 0 12px" }}>
                  Install a CIP-30 browser wallet, then reload this page.
                </div>
                {CANONICAL_WALLETS.slice(0, 4).map((w) => (
                  <a
                    key={w.key}
                    href={w.homepage}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 10px",
                      marginBottom: 6,
                      borderRadius: 6,
                      fontSize: 13,
                      color: "#FFFFFF",
                      textDecoration: "none",
                      background: "#0A0A0B",
                      border: "1px solid #1A1A20",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.background = "#1A1A1D";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLAnchorElement).style.background = "#0A0A0B";
                    }}
                  >
                    <WalletMark name={w.displayName} />
                    <span style={{ flex: 1 }}>{w.displayName}</span>
                    <span
                      style={{
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: "1px",
                        fontWeight: 700,
                        color: "#20EB7A",
                      }}
                    >
                      Install
                    </span>
                  </a>
                ))}
              </div>
            ) : (
              pickerWallets.map((w) => (
                <button
                  key={w.id}
                  onClick={() => handlePickerChoice(w.id)}
                  disabled={status === "connecting"}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 6,
                    fontSize: 14,
                    color: "#FFFFFF",
                    background: "transparent",
                    border: "none",
                    textAlign: "left",
                    cursor: status === "connecting" ? "wait" : "pointer",
                    opacity: status === "connecting" ? 0.6 : 1,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "#1A1A1D";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                  }}
                >
                  <WalletMark icon={w.icon || undefined} name={displayWalletName(w.name)} />
                  {displayWalletName(w.name)}
                </button>
              ))
            )}

            {error && (
              <div style={{ padding: "8px 4px 2px", fontSize: 12, color: "#FF422B" }}>{error}</div>
            )}

            <button
              onClick={() => closePicker(null)}
              style={{
                marginTop: 10,
                width: "100%",
                padding: "8px 12px",
                borderRadius: 6,
                fontSize: 12,
                color: "#9898A1",
                background: "transparent",
                border: "1px solid #24242C",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </WalletContext.Provider>
  );
}
