/* =========================================================
   CASA DAMS — Utilidades compartidas
   ========================================================= */

/* ---------- MONEY ---------- */
function parseMonto(str) {
  if (!str) return 0;
  let clean = String(str).replace(/[^0-9.,]/g, '');
  if ((clean.match(/\./g) || []).length > 1) {
    clean = clean.replace(/\./g, '');
  } else if (clean.includes(',')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else {
    clean = clean.replace(/\./g, '');
  }
  return parseFloat(clean) || 0;
}

function formatPesos(num) {
  if (!num || isNaN(num)) return '$0';
  return '$' + Math.round(num).toLocaleString('es-CO');
}

/* ---------- DATE ---------- */
function formatDate(str) {
  if (!str) return '—';
  const [y, m, d] = str.split('-');
  return `${d}/${m}/${y}`;
}

function addDays(dateStr, days) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + Number(days || 0));
  return d.toISOString().split('T')[0];
}

function today() {
  return new Date().toISOString().split('T')[0];
}

/* ---------- NÚMERO EN LETRAS ---------- */
function numeroALetras(num) {
  const unidades = ['', 'UN', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
    'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
  const decenas = ['', '', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
  const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

  if (num === 0) return 'CERO';
  if (num === 100) return 'CIEN';

  let resultado = '';
  if (num >= 1000000) {
    const m = Math.floor(num / 1000000);
    resultado += (m === 1 ? 'UN MILLÓN ' : numeroALetras(m) + ' MILLONES ');
    num %= 1000000;
  }
  if (num >= 1000) {
    const m = Math.floor(num / 1000);
    resultado += (m === 1 ? 'MIL ' : numeroALetras(m) + ' MIL ');
    num %= 1000;
  }
  if (num >= 100) {
    resultado += centenas[Math.floor(num / 100)] + ' ';
    num %= 100;
  }
  if (num >= 20) {
    resultado += decenas[Math.floor(num / 10)];
    if (num % 10) resultado += ' Y ' + unidades[num % 10];
    resultado += ' ';
  } else if (num > 0) {
    resultado += unidades[num] + ' ';
  }
  return resultado.trim();
}

function totalEnLetras(total) {
  if (!total) return '—';
  const entero = Math.floor(total);
  let texto = numeroALetras(entero) + ' PESOS M/CTE';
  return texto;
}

/* ---------- FIRMA DIGITAL ---------- */
function initFirma(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let drawing = false, lastX = 0, lastY = 0;

  function getPos(e) {
    const rect = canvas.getBoundingClientRect();
    const sx = canvas.width / rect.width;
    const sy = canvas.height / rect.height;
    if (e.touches) {
      return { x: (e.touches[0].clientX - rect.left) * sx, y: (e.touches[0].clientY - rect.top) * sy };
    }
    return { x: (e.clientX - rect.left) * sx, y: (e.clientY - rect.top) * sy };
  }
  function start(e) {
    e.preventDefault();
    drawing = true;
    const p = getPos(e);
    lastX = p.x; lastY = p.y;
    canvas.classList.add('active');
  }
  function draw(e) {
    e.preventDefault();
    if (!drawing) return;
    const p = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(p.x, p.y);
    ctx.strokeStyle = '#1C1A17';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    lastX = p.x; lastY = p.y;
  }
  function stop() { drawing = false; canvas.classList.remove('active'); }

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', draw);
  canvas.addEventListener('mouseup', stop);
  canvas.addEventListener('mouseleave', stop);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', draw, { passive: false });
  canvas.addEventListener('touchend', stop);
}

function limpiarFirma(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function getFirmaDataURL(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const hasContent = data.some((v, i) => i % 4 === 3 && v !== 0);
  return hasContent ? canvas.toDataURL('image/png') : null;
}

/* ---------- TOAST ---------- */
function mostrarToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

/* ---------- CONTADOR (localStorage) ---------- */
function getContador(key, fallback = 1) {
  const v = parseInt(localStorage.getItem('casadams_' + key));
  return isNaN(v) ? fallback : v;
}
function setContador(key, val) {
  localStorage.setItem('casadams_' + key, String(val));
}
function nextContador(key, fallback = 1) {
  const next = getContador(key, fallback) + 1;
  setContador(key, next);
  return next;
}

/* ---------- WHATSAPP / SUPABASE ---------- */
const WAHA_URL  = '/api/waha';
const WAHA_KEY  = '7a498bf58d914dfba845841aca339131';
const WAHA_SESSION = 'default';
const SUPA_URL = 'https://pqpzhmopnigxyacwdjbc.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxcHpobW9wbmlneHlhY3dkamJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NTc1NzUsImV4cCI6MjA5MjIzMzU3NX0.HDy-WoX5ldwnTsfXHecnJwJ72v2jgaPrXwCSjBrmsys';

async function subirPDFaSupabase(pdfBlob, fileName, bucket = 'ordenes') {
  try {
    const res = await fetch(`${SUPA_URL}/storage/v1/object/${bucket}/${fileName}`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + SUPA_KEY,
        'apikey': SUPA_KEY,
        'Content-Type': 'application/pdf'
      },
      body: pdfBlob
    });
    return res.ok ? `${SUPA_URL}/storage/v1/object/public/${bucket}/${fileName}` : '';
  } catch (e) {
    console.error('Upload error:', e);
    return '';
  }
}

async function enviarMensajeWA(chatId, texto) {
  return fetch(`${WAHA_URL}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': WAHA_KEY,
    },
    body: JSON.stringify({ session: WAHA_SESSION, chatId, text: texto })
  });
}

/* ---------- LOGO PRELOAD (para PDFs) ---------- */
window.LOGO_DATA_URL = null;
(function preloadLogo() {
  const img = new Image();
  img.onload = function() {
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    try { window.LOGO_DATA_URL = c.toDataURL('image/jpeg', 0.92); } catch (e) {}
  };
  img.onerror = () => console.warn('Logo no se pudo cargar');
  img.src = 'assets/logo-casa-dams.jpeg';
})();

/* ---------- HEADER ANIMATION ON LOAD ---------- */
window.addEventListener('DOMContentLoaded', () => {
  const numeroEl = document.querySelector('.doc-numero');
  if (numeroEl) {
    numeroEl.style.animation = 'pulseNumero 0.6s ease-out';
  }
});

/* Inyectar keyframes una sola vez */
(function() {
  if (document.getElementById('cd-keyframes')) return;
  const style = document.createElement('style');
  style.id = 'cd-keyframes';
  style.textContent = `
    @keyframes pulseNumero { 0% { opacity: 0; transform: scale(0.9); } 100% { opacity: 1; transform: scale(1); } }
    @keyframes fadeInUp { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
  `;
  document.head.appendChild(style);
})();
