import { NextRequest, NextResponse } from "next/server";
import { fingerprint } from "@/lib/fingerprint";
import {
  publicClient,
  relayerWallet,
  CONTRACT_ADDRESS,
  EXPLORER,
} from "@/lib/chain";
import { ATTESTATION_ABI } from "@/lib/abi";

export async function POST(req: NextRequest) {
  const { endpoint, apiKey, claimedModel, servedModel } = await req.json();
  if (!endpoint || !claimedModel) {
    return NextResponse.json(
      { error: "endpoint and claimedModel are required" },
      { status: 400 }
    );
  }

  // Resolve relative mock endpoints (e.g. /api/mock/fraud) to an absolute URL.
  const callBase = endpoint.startsWith("/")
    ? `${req.nextUrl.origin}${endpoint}`
    : endpoint;

  // 1) Fingerprint the endpoint.
  let verdict;
  try {
    verdict = await fingerprint(
      callBase,
      apiKey || undefined,
      claimedModel,
      servedModel || undefined
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: `verification failed: ${err.message}` },
      { status: 502 }
    );
  }

  // 2) Record the verdict on Monad (or simulate if not deployed yet).
  const chain: any = { simulated: true };
  const wallet = relayerWallet();
  if (wallet && CONTRACT_ADDRESS) {
    try {
      const pub = publicClient();
      const txHash = await wallet.writeContract({
        address: CONTRACT_ADDRESS,
        abi: ATTESTATION_ABI,
        functionName: "attest",
        args: [
          endpoint,
          claimedModel,
          verdict.detectedLabel,
          verdict.verified,
          verdict.confidence,
        ],
      });
      await pub.waitForTransactionReceipt({ hash: txHash });

      const [verifiedCount, failedCount, total, , , , , rep] =
        (await pub.readContract({
          address: CONTRACT_ADDRESS,
          abi: ATTESTATION_ABI,
          functionName: "getEndpoint",
          args: [endpoint],
        })) as any[];

      chain.simulated = false;
      chain.txHash = txHash;
      chain.explorerUrl = `${EXPLORER}/tx/${txHash}`;
      chain.reputation = Number(rep);
      chain.verifiedCount = Number(verifiedCount);
      chain.failedCount = Number(failedCount);
      chain.total = Number(total);
    } catch (err: any) {
      chain.error = err.message;
    }
  }

  return NextResponse.json({ verdict, chain });
}
