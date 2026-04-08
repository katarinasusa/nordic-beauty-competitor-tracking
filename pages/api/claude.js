export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { prompt, maxTokens } = req.body;
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: maxTokens || 800,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!response.ok) {
      const err = await response.text();
      console.error("Anthropic error:", err);
      return res.status(response.status).json({ error: err });
    }
    const data = await response.json();
    const text = data.content.filter(b => b.type === "text").map(b => b.text).join("");
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: "No JSON in response" });
    return res.status(200).json(JSON.parse(match[0]));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
