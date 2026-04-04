import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { compare } from "bcryptjs";

/**
 * Authenticate a request using API key (Bearer token).
 * Returns the user if valid, null if not.
 */
export async function authenticateApiKey(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  if (!token.startsWith("cx_")) return null;

  // Find API keys matching this prefix
  const prefix = token.slice(0, 11); // "cx_" + first 8 chars
  const candidates = await prisma.apiKey.findMany({
    where: {
      keyPrefix: prefix,
      revokedAt: null,
    },
    include: { user: true },
  });

  for (const key of candidates) {
    const isMatch = await compare(token, key.keyHash);
    if (isMatch) {
      // Check expiry
      if (key.expiresAt && key.expiresAt < new Date()) return null;

      // Update last used
      await prisma.apiKey.update({
        where: { id: key.id },
        data: { lastUsedAt: new Date() },
      });

      return key.user;
    }
  }

  return null;
}
