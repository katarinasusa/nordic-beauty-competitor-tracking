export default function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const { password } = req.body;
  if (password === "beautymatas26") {
    res.setHeader("Set-Cookie", `nbi_auth=beautymatas26; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`);
    return res.status(200).json({ ok: true });
  }
  return res.status(401).json({ error: "Wrong password" });
}
