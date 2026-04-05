import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get("q");
  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }

  const res = await fetch(
    `https://huggingface.co/api/models?search=${encodeURIComponent(query)}&filter=text-generation&sort=downloads&direction=-1&limit=20`,
    { next: { revalidate: 60 } }
  );

  if (!res.ok) {
    return NextResponse.json({ error: "HuggingFace API error" }, { status: 502 });
  }

  const models = await res.json();

  const results = models.map((m: Record<string, unknown>) => ({
    id: m.id || m.modelId,
    author: (m.id as string)?.split("/")[0] || "",
    downloads: m.downloads,
    likes: m.likes,
    pipeline_tag: m.pipeline_tag,
    tags: Array.isArray(m.tags) ? m.tags.slice(0, 10) : [],
  }));

  return NextResponse.json(results);
}
