import { NextRequest, NextResponse } from "next/server";
import { publicClient, CONTRACT_ADDRESS } from "@/lib/chain";
import { ATTESTATION_ABI } from "@/lib/abi";

export async function GET(req: NextRequest) {
  const endpoint = req.nextUrl.searchParams.get("endpoint");
  if (!endpoint)
    return NextResponse.json({ error: "endpoint required" }, { status: 400 });
  if (!CONTRACT_ADDRESS)
    return NextResponse.json({ deployed: false });

  try {
    const [verifiedCount, failedCount, total, lastTime, lastVerified, claimed, detected, rep] =
      (await publicClient().readContract({
        address: CONTRACT_ADDRESS,
        abi: ATTESTATION_ABI,
        functionName: "getEndpoint",
        args: [endpoint],
      })) as unknown as any[];
    return NextResponse.json({
      deployed: true,
      endpoint,
      verifiedCount: Number(verifiedCount),
      failedCount: Number(failedCount),
      total: Number(total),
      lastVerdictTime: Number(lastTime),
      lastVerified,
      claimedModel: claimed,
      detectedModel: detected,
      reputation: Number(rep),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
