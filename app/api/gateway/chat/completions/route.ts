import { NextRequest, NextResponse } from "next/server";
import {
  keccak256,
  encodePacked,
  recoverMessageAddress,
  isAddress,
} from "viem";
import {
  publicClient,
  relayerWallet,
  GATEWAY_ADDRESS,
  UPSTREAM_BASE,
  UPSTREAM_KEY,
  EXPLORER,
} from "@/lib/chain";
import { GATEWAY_ABI, WEI_PER_TOKEN } from "@/lib/gatewayAbi";

// In-memory replay protection (per-process; fine for the demo).
const usedNonces = new Set<string>();

function sidOf(sessionKey: `0x${string}`) {
  return keccak256(encodePacked(["address"], [sessionKey]));
}

export async function POST(req: NextRequest) {
  const sessionKey = req.headers.get("x-session-key") as `0x${string}` | null;
  const signature = req.headers.get("x-signature") as `0x${string}` | null;
  const nonce = req.headers.get("x-nonce");
  const body = await req.json().catch(() => ({}));

  // --- 1. authenticate the session key via signature (no reusable secret) ---
  if (!sessionKey || !signature || !nonce || !isAddress(sessionKey)) {
    return NextResponse.json(
      { error: "missing X-Session-Key / X-Signature / X-Nonce" },
      { status: 401 }
    );
  }
  const message = `proofofmodel:${sessionKey.toLowerCase()}:${nonce}`;
  let recovered: string;
  try {
    recovered = await recoverMessageAddress({ message, signature });
  } catch {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }
  if (recovered.toLowerCase() !== sessionKey.toLowerCase()) {
    return NextResponse.json({ error: "signature != session key" }, { status: 401 });
  }
  const nonceKey = `${sessionKey.toLowerCase()}:${nonce}`;
  if (usedNonces.has(nonceKey)) {
    return NextResponse.json({ error: "nonce replayed" }, { status: 401 });
  }
  usedNonces.add(nonceKey);

  // --- 2. check the session on-chain (cap / expiry / revoked / balance) ---
  const onchain = !!GATEWAY_ADDRESS && !!relayerWallet();
  const id = sidOf(sessionKey);
  let remaining = 0n;
  let userBalance = 0n;
  if (onchain) {
    const [user, cap, spent, expiry, revoked, bal] = (await publicClient().readContract({
      address: GATEWAY_ADDRESS as `0x${string}`,
      abi: GATEWAY_ABI,
      functionName: "sessionOf",
      args: [sessionKey],
    })) as [string, bigint, bigint, bigint, boolean, bigint];

    if (user === "0x0000000000000000000000000000000000000000")
      return NextResponse.json({ error: "no such session on-chain" }, { status: 402 });
    if (revoked) return NextResponse.json({ error: "session revoked" }, { status: 403 });
    if (BigInt(Math.floor(Date.now() / 1000)) > expiry)
      return NextResponse.json({ error: "session expired" }, { status: 403 });
    remaining = cap - spent;
    userBalance = bal;
    if (userBalance <= 0n)
      return NextResponse.json(
        { error: "no prepaid balance — deposit MON (step 2) before making a request" },
        { status: 402 }
      );
    if (remaining <= 0n)
      return NextResponse.json(
        { error: "session cap exhausted — open a new session with a higher cap" },
        { status: 402 }
      );
  }

  // --- 3. forward to the real upstream with the SERVER-HELD key ---
  const model = body?.model ?? "claude-opus-4.8";
  let upstream: any;
  try {
    const res = await fetch(`${UPSTREAM_BASE.replace(/\/+$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${UPSTREAM_KEY}`,
      },
      body: JSON.stringify({ ...body, stream: false }),
    });
    upstream = await res.json();
    if (!res.ok) {
      return NextResponse.json(
        { error: `upstream ${res.status}`, detail: upstream },
        { status: 502 }
      );
    }
  } catch (e: any) {
    return NextResponse.json({ error: `upstream failed: ${e.message}` }, { status: 502 });
  }

  // --- 4. meter usage & settle on Monad ---
  const tokens: number =
    upstream?.usage?.total_tokens ??
    (JSON.stringify(body).length + JSON.stringify(upstream).length) / 4;
  let cost = BigInt(Math.ceil(tokens)) * WEI_PER_TOKEN;

  const meta: any = { onchain, model, tokens: Math.ceil(tokens) };
  if (onchain) {
    if (cost > remaining) cost = remaining; // clamp to session cap
    if (cost > userBalance) cost = userBalance; // clamp to balance
    try {
      const wallet = relayerWallet()!;
      const txHash = await wallet.writeContract({
        address: GATEWAY_ADDRESS as `0x${string}`,
        abi: GATEWAY_ABI,
        functionName: "debit",
        args: [id, cost, model, Math.min(Math.ceil(tokens), 4_294_967_295)],
      });
      await publicClient().waitForTransactionReceipt({ hash: txHash });
      meta.cost = cost.toString();
      meta.txHash = txHash;
      meta.explorerUrl = `${EXPLORER}/tx/${txHash}`;
      meta.remainingCap = (remaining - cost).toString();
      meta.remainingBalance = (userBalance - cost).toString();
    } catch (e: any) {
      meta.debitError = e.message;
    }
  } else {
    meta.cost = cost.toString();
    meta.note = "simulated (deploy PrepaidGateway + set relayer to settle on Monad)";
  }

  // Return the upstream response verbatim + settlement metadata in a header.
  return NextResponse.json(upstream, {
    headers: {
      "X-Gateway-Meter": JSON.stringify(meta),
      "X-Gateway-Model": model,
      "X-Gateway-Tokens": String(Math.ceil(tokens)),
      ...(meta.txHash ? { "X-Gateway-Tx": meta.txHash } : {}),
    },
  });
}
