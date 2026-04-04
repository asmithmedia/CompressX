export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/compress/:path*",
    "/history/:path*",
    "/settings/:path*",
    "/api/jobs/:path*",
    "/api/huggingface/:path*",
  ],
};
