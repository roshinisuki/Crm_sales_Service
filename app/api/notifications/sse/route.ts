import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const userPayload = await verifyAuth();
  if (!userPayload) {
    return new Response("Unauthorized", { status: 401 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let intervalId: NodeJS.Timeout;
      let closed = false;

      const isControllerClosed = () => closed || controller.desiredSize === null;

      const safeEnqueue = (chunk: Uint8Array) => {
        if (isControllerClosed()) return;
        try {
          controller.enqueue(chunk);
        } catch {
          closed = true;
          clearInterval(intervalId);
        }
      };

      const poll = async () => {
        if (isControllerClosed()) return;
        try {
          const notifications = await prisma.notification.findMany({
            where: { userId: userPayload.id },
            orderBy: { createdAt: "desc" },
            take: 20,
          });
          if (isControllerClosed()) return;
          safeEnqueue(encoder.encode(`data: ${JSON.stringify({ success: true, data: notifications })}\n\n`));
        } catch (e) {
          // Silently handle controller-closed errors from client disconnects
          if (!isControllerClosed() && !(e instanceof TypeError && e.message.includes("Controller"))) {
            console.error("SSE Polling Error:", e);
          }
          closed = true;
          clearInterval(intervalId);
        }
      };

      // Send immediately on connect
      await poll();

      // Poll every 8 seconds server-side instead of client HTTP polling
      intervalId = setInterval(poll, 8000);

      request.signal.addEventListener("abort", () => {
        closed = true;
        clearInterval(intervalId);
        try {
          controller.close();
        } catch {
          // Already closed
        }
      });
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
    },
  });
}
