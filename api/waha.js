module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { endpoint, payload } = req.body;
    const WAHA_URL = "https://conjuror-deviator-unleveled.ngrok-free.dev";
    const WAHA_KEY = "7a498bf58d914dfba845841aca339131";
    const response = await fetch(`${WAHA_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": WAHA_KEY, "ngrok-skip-browser-warning": "true" },
      body: JSON.stringify(payload)
    });
    const data = await response.text();
    res.status(response.status).send(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
