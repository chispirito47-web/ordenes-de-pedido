// Servidor intermedio hacia WAHA (WhatsApp).
// Solo permite ENVIAR TEXTO con el formato que usan las apps; cualquier otra cosa se rechaza.
// La clave y la dirección deben vivir en variables de entorno de Vercel (WAHA_KEY, WAHA_URL).
// Los valores de respaldo de abajo se retirarán en cuanto la clave nueva esté configurada en Vercel.
const ENDPOINTS_PERMITIDOS = new Set(['/api/sendText']);
const WAHA_URL = process.env.WAHA_URL || "https://conjuror-deviator-unleveled.ngrok-free.dev";
const WAHA_KEY = process.env.WAHA_KEY || "7a498bf58d914dfba845841aca339131";
const MAX_TEXTO = 5000;

function validarEnvio(endpoint, payload) {
  if (!ENDPOINTS_PERMITIDOS.has(endpoint)) return { error: 'Endpoint no permitido' };
  if (!payload || typeof payload !== 'object') return { error: 'Payload inválido' };
  if (payload.session !== 'default') return { error: 'Sesión inválida' };
  if (typeof payload.chatId !== 'string' || !/^\d{8,15}@c\.us$/.test(payload.chatId)) return { error: 'chatId inválido' };
  if (typeof payload.text !== 'string' || payload.text.length === 0 || payload.text.length > MAX_TEXTO) return { error: 'Texto inválido' };
  // Solo se reenvían los campos conocidos
  const limpio = { session: payload.session, chatId: payload.chatId, text: payload.text };
  if (typeof payload.linkPreview === 'boolean') limpio.linkPreview = payload.linkPreview;
  return { payload: limpio };
}

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  try {
    const { endpoint, payload } = req.body || {};
    const v = validarEnvio(endpoint, payload);
    if (v.error) return res.status(400).json({ error: v.error });
    const response = await fetch(`${WAHA_URL}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": WAHA_KEY, "ngrok-skip-browser-warning": "true" },
      body: JSON.stringify(v.payload)
    });
    const data = await response.text();
    res.status(response.status).send(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};

module.exports.validarEnvio = validarEnvio;
