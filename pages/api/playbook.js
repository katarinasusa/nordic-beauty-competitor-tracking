export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { company, markets } = req.body;
  if (!company) return res.status(400).json({ error: "company required" });

  const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const prompt = `You are a Nordic beauty retail strategy analyst. Today: ${today}.
Analyze "${company}" operating in ${(markets || []).join(", ")} for Matas Group's competitive intelligence.

Return ONLY valid JSON (no markdown):
{
  "pricing": {
    "positioning": "premium|mid|value|varies",
    "recentMoves": "One sentence on any recent pricing changes or strategy",
    "vsMattas": "How their pricing compares to Matas/KICKS"
  },
  "promo": {
    "intensity": "high|medium|low",
    "recentCampaigns": "Brief description of recent promotional activity",
    "channels": ["channel1", "channel2"]
  },
  "assortment": {
    "recentExpansions": "Any new categories, brands or SKUs added recently",
    "keyBrands": ["brand1", "brand2", "brand3"],
    "gap": "Where their assortment differs most from Matas/KICKS"
  },
  "media": {
    "pressure": "high|medium|low",
    "recentActivity": "Recent notable marketing or media activity",
    "channels": ["channel1", "channel2"]
  },
  "signals": [
    {"type": "threat|opportunity|watch", "description": "Specific competitive signal worth flagging", "urgency": "high|medium|low"},
    {"type": "threat|opportunity|watch", "description": "Specific competitive signal worth flagging", "urgency": "high|medium|low"}
  ],
  "soWhat": {
    "action": "The single most important action Matas Group should take in response",
    "rationale": "Why this action matters, one sentence",
    "timing": "immediate|this quarter|next quarter"
  }
}`;

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
        max_tokens: 900,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!response.ok) return res.status(response.status).json({ error: await response.text() });
    const data = await response.json();
    const text = data.content.filter(b => b.type === "text").map(b => b.text).join("");
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: "No JSON" });
    res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate");
    return res.status(200).json(JSON.parse(match[0]));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
