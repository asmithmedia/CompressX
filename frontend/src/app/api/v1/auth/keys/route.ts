import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hash } from "bcryptjs";
import { randomBytes } from "crypto";

// GET /api/v1/auth/keys - List user's API keys
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keys = await prisma.apiKey.findMany({
    where: { userId: session.user.id, revokedAt: null },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      lastUsedAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(keys);
}

// POST /api/v1/auth/keys - Create a new API key
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const name = body.name || "Default";
  const scopes = body.scopes || ["compress", "read"];

  // Generate the key
  const rawKey = `cx_${randomBytes(32).toString("hex")}`;
  const keyPrefix = rawKey.slice(0, 11); // "cx_" + 8 chars
  const keyHash = await hash(rawKey, 12);

  await prisma.apiKey.create({
    data: {
      userId: session.user.id,
      name,
      keyHash,
      keyPrefix,
      scopes,
    },
  });

  // Return the raw key ONCE — it can never be retrieved again
  return NextResponse.json({
    key: rawKey,
    prefix: keyPrefix,
    name,
    scopes,
    message: "Save this key now. It cannot be shown again.",
  }, { status: 201 });
}
