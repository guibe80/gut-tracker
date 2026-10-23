import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type"
};

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return new Response(JSON.stringify({ error: "POST required" }), { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "Unauthenticated" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const { text } = await req.json().catch(() => ({}));
  if (typeof text !== "string" || !text.trim() || text.length > 2000) return new Response(JSON.stringify({ error: "Enter up to 2,000 characters." }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const key = Deno.env.get("GROQ_API_KEY");
  const model = Deno.env.get("GROQ_MODEL") || "openai/gpt-oss-20b";
  if (!key) return new Response(JSON.stringify({ error: "Groq analysis is not configured." }), { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  const prompt = `
You are helping a user review a food or drink entry.
Write a short plain-English summary they can review and then enter manually into a food journal.

Include:
- what they ate or drank
- rough carbohydrate estimate
- rough protein estimate
- rough fibre estimate
- rough calories if obvious
- water amount if relevant
- any uncertainty or assumptions

Keep it readable and brief.
Do not mention that you are an AI.
Do not use markdown tables or code blocks.
Do not return JSON.
Return just plain text.
`;

  console.log("groq-request-start", { model, textLength: text.length, hasKey: !!key });

  try {
    const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: text }
        ],
        temperature: 0.2,
        max_tokens: 500
      })
    });

    const raw = await upstream.text();
    console.log("groq-response", { status: upstream.status, statusText: upstream.statusText, preview: raw.slice(0, 500) });

    if (!upstream.ok) {
      return new Response(JSON.stringify({ error: "Groq is temporarily unavailable.", providerStatus: upstream.status, providerResponse: raw.slice(0, 500) }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let payload;
    try {
      payload = JSON.parse(raw);
    } catch (err) {
      return new Response(JSON.stringify({ error: "Unable to parse Groq response.", detail: String(err).slice(0, 500) }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const content = payload?.choices?.[0]?.message?.content;
    if (typeof content !== "string") {
      return new Response(JSON.stringify({ error: "The analysis provider returned an invalid result." }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(content.trim(), { headers: { ...corsHeaders, "Content-Type": "text/plain; charset=utf-8" } });
  } catch (err) {
    console.error("groq-fetch-exception", String(err));
    return new Response(JSON.stringify({ error: "Groq request threw an exception.", detail: String(err).slice(0, 500) }), { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
