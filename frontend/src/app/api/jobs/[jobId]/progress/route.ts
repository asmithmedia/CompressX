import { NextRequest } from "next/server";
import { createClient } from "redis";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379/0";

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const subscriber = createClient({ url: redisUrl });
      await subscriber.connect();

      // First, send the latest state if available
      const reader = createClient({ url: redisUrl });
      await reader.connect();
      const latest = await reader.get(`job:${jobId}:latest`);
      await reader.disconnect();

      if (latest) {
        controller.enqueue(encoder.encode(`data: ${latest}\n\n`));
        const parsed = JSON.parse(latest);
        if (parsed.status === "COMPLETED" || parsed.status === "FAILED") {
          controller.close();
          await subscriber.disconnect();
          return;
        }
      }

      // Subscribe to progress updates
      await subscriber.subscribe(`job:${jobId}:progress`, (message) => {
        try {
          controller.enqueue(encoder.encode(`data: ${message}\n\n`));
          const data = JSON.parse(message);
          if (data.status === "COMPLETED" || data.status === "FAILED") {
            subscriber.unsubscribe(`job:${jobId}:progress`);
            subscriber.disconnect();
            controller.close();
          }
        } catch {
          // ignore parse errors
        }
      });

      // Cleanup on client disconnect
      request.signal.addEventListener("abort", async () => {
        try {
          await subscriber.unsubscribe(`job:${jobId}:progress`);
          await subscriber.disconnect();
        } catch {
          // already disconnected
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
