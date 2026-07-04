import { NextRequest, NextResponse } from "next/server";
import { chatCompletion } from "@/lib/mockPersona";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const model = body?.model ?? "claude-opus-4-8";
  const prompt =
    body?.messages?.[body.messages.length - 1]?.content?.toString() ?? "";
  return NextResponse.json(chatCompletion("honest", model, prompt));
}
