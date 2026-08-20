export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({error:"Method not allowed"});
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({error:"ANTHROPIC_API_KEY not set"});
  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method:"POST",
      headers:{"Content-Type":"application/json","anthropic-version":"2023-06-01","x-api-key":apiKey},
      body:JSON.stringify(req.body)
    });
    const text = await response.text();
    if (!text||text.trim()==="") return res.status(502).json({error:"Empty response from Anthropic"});
    return res.status(response.status).json(JSON.parse(text));
  } catch(e) { return res.status(500).json({error:e.message}); }
}
