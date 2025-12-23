const GAS_BASE =
  "https://script.google.com/macros/s/AKfycbzArTo4z1Yo7vi2WZbPx9fEhm26-cfz8O8tz3aubMinZ5XwYwVFhqUK3cWyHv7YblYa0A/exec";

export const onRequest: PagesFunction = async (context) => {
  const url = new URL(context.request.url);
  const path = url.searchParams.get("path") || "";

  const gasUrl = new URL(GAS_BASE);
  gasUrl.searchParams.set("path", path);

  // query転送（admin_token等）
  for (const [k, v] of url.searchParams.entries()) {
    if (k === "path") continue;
    gasUrl.searchParams.set(k, v);
  }

  const req = context.request;
  const method = req.method.toUpperCase();

  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  }

  const headers = new Headers();
  headers.set("Content-Type", "application/json");

  const bodyText = method === "GET" ? undefined : await req.text();

  let gasRes: Response;
  try {
    gasRes = await fetch(gasUrl.toString(), {
      method,
      headers,
      body: bodyText
    });
  } catch (e: any) {
    return new Response(
      JSON.stringify({ ok: false, message: "fetch to GAS failed", detail: String(e?.message || e) }),
      { status: 502, headers: { "Content-Type": "application/json" } }
    );
  }

  const text = await gasRes.text();
  return new Response(text, {
    status: gasRes.status,
    headers: { "Content-Type": "application/json; charset=utf-8" }
  });
};
