import { createPublicClient, createWalletClient, http, defineChain } from "viem";
import { privateKeyToAccount } from "viem/accounts";

export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz"] } },
  blockExplorers: {
    default: { name: "Monad Explorer", url: "https://testnet.monadexplorer.com" },
  },
  testnet: true,
});

export const EXPLORER = "https://testnet.monadexplorer.com";

export function publicClient() {
  return createPublicClient({ chain: monadTestnet, transport: http() });
}

/** Server-side relayer wallet (the oracle's verifier key). */
export function relayerWallet() {
  const pk = process.env.RELAYER_PRIVATE_KEY;
  if (!pk) return null;
  const account = privateKeyToAccount(
    (pk.startsWith("0x") ? pk : "0x" + pk) as `0x${string}`
  );
  return createWalletClient({ account, chain: monadTestnet, transport: http() });
}

export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ||
  "") as `0x${string}` | "";
