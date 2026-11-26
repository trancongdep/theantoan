/**
 * Cloudflare Worker CORS Proxy (TÙY CHỌN)
 * Chỉ cần triển khai file này nếu bạn muốn bấm đăng nhập & lọc ngày bất kỳ
 * trực tiếp từ trình duyệt (index.html) theo thời gian thực mà không cần chờ GitHub Actions.
 *
 * Bảo mật: Chỉ cho phép chuyển tiếp đúng 2 endpoint cần thiết của appctapi.evnhcmc.vn.
 */

const UPSTREAM_BASE = "https://appctapi.evnhcmc.vn";
const ALLOWED_PATHS = new Set([
  "/core-service/api/auth/login",
  "/core-service/api/ticket/list",
]);

function corsHeaders(origin) {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, locale, language",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export default {
  async fetch(request) {
    const origin = request.headers.get("Origin") || "*";

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    const url = new URL(request.url);
    if (!ALLOWED_PATHS.has(url.pathname)) {
      return new Response(
        JSON.stringify({ error: "Path not allowed", path: url.pathname }),
        {
          status: 403,
          headers: { ...corsHeaders(origin), "Content-Type": "application/json" },
        }
      );
    }

    const targetUrl = `${UPSTREAM_BASE}${url.pathname}${url.search}`;
    const forwardHeaders = new Headers({
      "Content-Type": "application/json",
      Accept: "application/json",
      locale: "vi",
      language: "vi",
    });

    const auth = request.headers.get("Authorization");
    if (auth) forwardHeaders.set("Authorization", auth);

    const upstreamRes = await fetch(targetUrl, {
      method: request.method,
      headers: forwardHeaders,
      body: request.method === "POST" ? await request.text() : undefined,
    });

    const body = await upstreamRes.text();
    return new Response(body, {
      status: upstreamRes.status,
      headers: {
        ...corsHeaders(origin),
        "Content-Type": upstreamRes.headers.get("Content-Type") || "application/json",
      },
    });
  },
};
