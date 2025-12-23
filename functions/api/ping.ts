export const onRequest: PagesFunction = async (context) => {
  const gasBase =
    (context.env as any)?.GAS_BASE ||
    (globalThis as any)?.process?.env?.GAS_BASE ||
    "";
  return new Response(
    JSON.stringify({ ok: true, message: "pong", has_gas_base: !!gasBase }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
};
