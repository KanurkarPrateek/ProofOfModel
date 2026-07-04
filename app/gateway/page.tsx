"use client";

import { useState, useEffect } from "react";
import {
  createWalletClient,
  createPublicClient,
  custom,
  http,
  defineChain,
  parseEther,
  formatEther,
  keccak256,
  encodePacked,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { GATEWAY_ABI } from "@/lib/gatewayAbi";

const GATEWAY = (process.env.NEXT_PUBLIC_GATEWAY_ADDRESS || "") as `0x${string}`;
const EXPLORER = "https://testnet.monadexplorer.com";

const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz"] } },
  blockExplorers: { default: { name: "Monad", url: EXPLORER } },
});

const pub = createPublicClient({ chain: monadTestnet, transport: http() });

export default function Gateway() {
  const [addr, setAddr] = useState<`0x${string}` | "">("");
  const [balance, setBalance] = useState("0");
  const [depositAmt, setDepositAmt] = useState("0.05");
  const [capAmt, setCapAmt] = useState("0.01");
  const [durationMin, setDurationMin] = useState("30");
  const [session, setSession] = useState<{ pk: `0x${string}`; address: `0x${string}` } | null>(null);
  const [sessionState, setSessionState] = useState<any>(null);
  const [prompt, setPrompt] = useState("Say hello in 5 words.");
  const [model, setModel] = useState("claude-opus-4.8");
  const [log, setLog] = useState<any[]>([]);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  function wallet() {
    // @ts-ignore
    const eth = typeof window !== "undefined" ? (window as any).ethereum : null;
    if (!eth) throw new Error("MetaMask not found");
    return createWalletClient({ chain: monadTestnet, transport: custom(eth) });
  }

  async function connect() {
    setErr("");
    try {
      const w = wallet();
      const [a] = await w.requestAddresses();
      // ensure Monad testnet
      try {
        await w.switchChain({ id: monadTestnet.id });
      } catch {
        await w.addChain({ chain: monadTestnet });
      }
      setAddr(a);
    } catch (e: any) {
      setErr(e.message);
    }
  }

  async function refresh() {
    if (!GATEWAY || !addr) return;
    const bal = (await pub.readContract({
      address: GATEWAY,
      abi: GATEWAY_ABI,
      functionName: "balance",
      args: [addr],
    })) as bigint;
    setBalance(formatEther(bal));
    if (session) {
      const s = (await pub.readContract({
        address: GATEWAY,
        abi: GATEWAY_ABI,
        functionName: "sessionOf",
        args: [session.address],
      })) as unknown as any[];
      setSessionState({
        user: s[0],
        cap: formatEther(s[1]),
        spent: formatEther(s[2]),
        remaining: formatEther((s[1] as bigint) - (s[2] as bigint)),
        expiry: Number(s[3]),
        revoked: s[4],
        userBalance: formatEther(s[5]),
      });
    }
  }
  useEffect(() => {
    refresh();
    // eslint-disable-next-line
  }, [addr, session]);

  async function deposit() {
    setErr("");
    setBusy("deposit");
    try {
      const w = wallet();
      const hash = await w.writeContract({
        account: addr as `0x${string}`,
        address: GATEWAY,
        abi: GATEWAY_ABI,
        functionName: "deposit",
        value: parseEther(depositAmt),
      });
      await pub.waitForTransactionReceipt({ hash });
      await refresh();
    } catch (e: any) {
      setErr(e.shortMessage || e.message);
    } finally {
      setBusy("");
    }
  }

  async function openSession() {
    setErr("");
    setBusy("session");
    try {
      const pk = generatePrivateKey();
      const account = privateKeyToAccount(pk);
      const expiry = BigInt(Math.floor(Date.now() / 1000) + Number(durationMin) * 60);
      const w = wallet();
      const hash = await w.writeContract({
        account: addr as `0x${string}`,
        address: GATEWAY,
        abi: GATEWAY_ABI,
        functionName: "openSession",
        args: [account.address, parseEther(capAmt), expiry],
      });
      await pub.waitForTransactionReceipt({ hash });
      setSession({ pk, address: account.address });
    } catch (e: any) {
      setErr(e.shortMessage || e.message);
    } finally {
      setBusy("");
    }
  }

  async function call() {
    setErr("");
    setBusy("call");
    try {
      if (!session) throw new Error("open a session first");
      const account = privateKeyToAccount(session.pk);
      const nonce = `${Date.now()}`;
      const message = `proofofmodel:${session.address.toLowerCase()}:${nonce}`;
      const signature = await account.signMessage({ message });
      const res = await fetch("/api/gateway/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Session-Key": session.address,
          "X-Signature": signature,
          "X-Nonce": nonce,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: 80,
        }),
      });
      const meter = JSON.parse(res.headers.get("x-gateway-meter") || "{}");
      const data = await res.json();
      const answer =
        data?.choices?.[0]?.message?.content ??
        data?.error ??
        JSON.stringify(data).slice(0, 160);
      setLog((l) => [{ ok: res.ok, status: res.status, answer, meter }, ...l]);
      await refresh();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setBusy("");
    }
  }

  async function revoke() {
    setErr("");
    setBusy("revoke");
    try {
      if (!session) return;
      const id = keccak256(encodePacked(["address"], [session.address]));
      const w = wallet();
      const hash = await w.writeContract({
        account: addr as `0x${string}`,
        address: GATEWAY,
        abi: GATEWAY_ABI,
        functionName: "revokeSession",
        args: [id],
      });
      await pub.waitForTransactionReceipt({ hash });
      await refresh();
    } catch (e: any) {
      setErr(e.shortMessage || e.message);
    } finally {
      setBusy("");
    }
  }

  const deployed = !!GATEWAY;

  return (
    <div className="wrap">
      <div className="brand">
        <div className="logo">◈</div>
        <div>
          <h1>Secure Gateway</h1>
          <p className="tag">
            Scoped, prepaid, per-call access on Monad — a leaked or worm-hijacked
            key can drain at most its tiny cap, and you can <b>revoke()</b> instantly.
          </p>
        </div>
      </div>
      <span className="pill">
        <a href="/" style={{ color: "inherit" }}>
          ← authenticity oracle
        </a>{" "}
        · anti-theft gateway
      </span>

      {!deployed && (
        <div className="card">
          <div className="err">
            Gateway contract not deployed yet. Fund the relayer + run{" "}
            <span className="mono">npm run deploy</span>. (You can still test the
            metered call path below in simulated mode after connecting.)
          </div>
        </div>
      )}

      <div className="card">
        <div className="section-title">1 · Wallet</div>
        {addr ? (
          <div className="meta">
            <div>
              <span>Connected</span>
              <b className="mono">{addr.slice(0, 10)}…</b>
            </div>
            <div>
              <span>Prepaid balance</span>
              <b>{balance} MON</b>
            </div>
          </div>
        ) : (
          <button className="btn" onClick={connect}>
            Connect MetaMask
          </button>
        )}

        {addr && (
          <>
            <div className="section-title">2 · Prepay</div>
            <div className="row">
              <input
                style={{ maxWidth: 140 }}
                value={depositAmt}
                onChange={(e) => setDepositAmt(e.target.value)}
              />
              <button
                className="btn"
                disabled={!deployed || busy === "deposit"}
                onClick={deposit}
              >
                {busy === "deposit" ? "…" : "Deposit MON"}
              </button>
            </div>

            <div className="section-title">3 · Open a scoped session</div>
            <div className="row" style={{ alignItems: "flex-end" }}>
              <div>
                <label>Spend cap (MON)</label>
                <input
                  style={{ maxWidth: 120 }}
                  value={capAmt}
                  onChange={(e) => setCapAmt(e.target.value)}
                />
              </div>
              <div>
                <label>Expiry (min)</label>
                <input
                  style={{ maxWidth: 100 }}
                  value={durationMin}
                  onChange={(e) => setDurationMin(e.target.value)}
                />
              </div>
              <button
                className="btn"
                disabled={!deployed || busy === "session"}
                onClick={openSession}
              >
                {busy === "session" ? "…" : "Open session"}
              </button>
            </div>
            {session && (
              <div className="chainbox" style={{ marginTop: 12 }}>
                <div className="dim">
                  Ephemeral session key (the only thing the agent holds):
                </div>
                <div className="mono">{session.address}</div>
                {sessionState && (
                  <div className="meta" style={{ marginTop: 10 }}>
                    <div>
                      <span>Cap</span>
                      <b>{sessionState.cap}</b>
                    </div>
                    <div>
                      <span>Spent</span>
                      <b>{sessionState.spent}</b>
                    </div>
                    <div>
                      <span>Remaining</span>
                      <b>{sessionState.remaining}</b>
                    </div>
                    <div>
                      <span>Status</span>
                      <b style={{ color: sessionState.revoked ? "var(--red)" : "var(--green)" }}>
                        {sessionState.revoked ? "REVOKED" : "active"}
                      </b>
                    </div>
                  </div>
                )}
                <button
                  className="btn secondary"
                  style={{ marginTop: 10 }}
                  disabled={busy === "revoke"}
                  onClick={revoke}
                >
                  {busy === "revoke" ? "…" : "🛑 Revoke session (kill switch)"}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {addr && (
        <div className="card">
          <div className="section-title">4 · Make a metered request</div>
          <label>Model</label>
          <input value={model} onChange={(e) => setModel(e.target.value)} />
          <label>Prompt</label>
          <input value={prompt} onChange={(e) => setPrompt(e.target.value)} />
          {deployed && Number(balance) <= 0 && (
            <div className="dim" style={{ color: "var(--yellow)", marginTop: 10 }}>
              ⚠ Prepaid balance is 0 — deposit MON (step 2) first, or the gateway
              will block the request.
            </div>
          )}
          <div style={{ marginTop: 14 }}>
            <button
              className="btn"
              disabled={busy === "call" || !session}
              onClick={call}
            >
              {busy === "call" ? "Calling…" : "Send through gateway"}
            </button>
          </div>

          {log.map((entry, i) => (
            <div key={i} className="chainbox" style={{ marginTop: 12 }}>
              <div style={{ color: entry.ok ? "var(--green)" : "var(--red)" }}>
                {entry.ok ? "✓ served" : `✕ blocked (${entry.status})`}
              </div>
              <div style={{ margin: "6px 0" }}>{entry.answer}</div>
              {entry.meter && (
                <div className="dim">
                  {entry.meter.tokens} tokens ·{" "}
                  {entry.meter.cost ? formatEther(BigInt(entry.meter.cost)) : "0"} MON
                  {entry.meter.txHash ? (
                    <>
                      {" "}
                      ·{" "}
                      <a href={entry.meter.explorerUrl} target="_blank" rel="noreferrer">
                        on-chain debit ↗
                      </a>
                    </>
                  ) : entry.meter.note ? (
                    <> · {entry.meter.note}</>
                  ) : null}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {err && <div className="card err">✕ {err}</div>}

      <footer>
        {deployed ? (
          <>
            Gateway:{" "}
            <a href={`${EXPLORER}/address/${GATEWAY}`} target="_blank" rel="noreferrer">
              {GATEWAY}
            </a>
          </>
        ) : (
          <>PrepaidGateway not deployed · Monad Testnet (10143)</>
        )}
      </footer>
    </div>
  );
}
