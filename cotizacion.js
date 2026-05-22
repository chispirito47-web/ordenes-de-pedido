const SUPA_URL = 'https://pqpzhmopnigxyacwdjbc.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxcHpobW9wbmlneHlhY3dkamJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NTc1NzUsImV4cCI6MjA5MjIzMzU3NX0.HDy-WoX5ldwnTsfXHecnJwJ72v2jgaPrXwCSjBrmsys';

/* =========================================================
   COTIZACIÓN — Lógica
   ========================================================= */

let productos = []; // [{id, qty, desc, unitario, photo: dataUrl}]
let layout = 'lista';
let formasPago = new Set();
let photoTargetId = null; // ID del producto al que asignar foto

/* ---------- INIT ---------- */
window.addEventListener('DOMContentLoaded', () => {
  // Fecha hoy
  document.getElementById('fechaCotizacion').value = today();

  // Número consecutivo
  const num = getContador('cotizacion_num', 1);
  document.getElementById('numeroCotizacion').value = formatNumCotizacion(num);
  document.getElementById('displayNumero').textContent = formatNumCotizacion(num);

  // 3 filas iniciales
  agregarProducto(); agregarProducto(); agregarProducto();

  // Vencimiento inicial
  actualizarVencimiento();

  // Listeners
  document.getElementById('numeroCotizacion').addEventListener('input', e => {
    document.getElementById('displayNumero').textContent = e.target.value || '—';
  });
  document.getElementById('fechaCotizacion').addEventListener('change', actualizarVencimiento);
  document.getElementById('validezDias').addEventListener('input', actualizarVencimiento);

  // Chips formas de pago
  document.querySelectorAll('#chipsPago .chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const val = chip.dataset.value;
      if (formasPago.has(val)) { formasPago.delete(val); chip.classList.remove('active'); }
      else { formasPago.add(val); chip.classList.add('active'); }
    });
  });
  // Preseleccionar algunas
  ['Efectivo', 'Transferencia', '50% anticipo'].forEach(v => {
    formasPago.add(v);
    document.querySelector(`#chipsPago .chip[data-value="${v}"]`)?.classList.add('active');
  });

  // Photo input handler
  document.getElementById('photoInput').addEventListener('change', e => {
    const file = e.target.files[0];
    if (file && fotoTargetFila !== null) {
      const reader = new FileReader();
      reader.onload = ev => {
        fotosPorFila[fotoTargetFila] = ev.target.result;
        const btn = document.getElementById('fotobtn-' + fotoTargetFila);
        const txt = document.getElementById('fototxt-' + fotoTargetFila);
        if (btn) btn.style.borderColor = '#C49A3C';
        if (txt) txt.textContent = '✓ Foto';
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
    fotoTargetFila = null;
  });

  // Modal close
  document.getElementById('modalWA').addEventListener('click', function(e) {
    if (e.target === this) cerrarModal();
  });
});

function formatNumCotizacion(n) {
  return 'COT-' + String(n).padStart(4, '0');
}

/* ---------- VENCIMIENTO ---------- */
function actualizarVencimiento() {
  const fecha = document.getElementById('fechaCotizacion').value;
  const dias = parseInt(document.getElementById('validezDias').value) || 0;
  if (!fecha) { document.getElementById('fechaVencimiento').textContent = '—'; return; }
  const venc = addDays(fecha, dias);
  document.getElementById('fechaVencimiento').textContent = formatDate(venc);
}

/* ---------- PRODUCTOS — igual que orden.html + foto ---------- */
let filaCounter = 1;
let filas = [];

function agregarProducto() {
  const id = filaCounter++;
  filas.push(id);
  const body = document.getElementById('productosBody');
  const row = document.createElement('div');
  row.className = 'producto-row';
  row.id = 'fila-' + id;
  row.innerHTML = `
    <input type="number" placeholder="1" min="1" oninput="calcularSubtotalCot(${id})" class="qty-cot-${id}" value="1">
    <div style="display:flex;flex-direction:column;gap:4px">
      <input type="text" placeholder="Descripción del mueble..." class="desc-cot-${id}">
      <div onclick="abrirFotoCot(${id})" id="fotobtn-${id}" style="display:inline-flex;align-items:center;gap:5px;cursor:pointer;padding:3px 8px;border:1px dashed #D4C9B8;border-radius:6px;font-size:11px;color:#9E9488;width:fit-content;background:transparent">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        <span id="fototxt-${id}">+ Foto</span>
      </div>
    </div>
    <input type="text" placeholder="$0" oninput="calcularSubtotalCot(${id})" onblur="formatearPrecioCot(${id})" class="price-cot-${id}" style="text-align:right">
    <div class="subtotal-display" id="sub-cot-${id}">$0</div>
    <button class="btn-delete-row" onclick="eliminarFilaCot(${id})">✕</button>
  `;
  body.appendChild(row);
  calcularTotales();
}

function eliminarFilaCot(id) {
  const row = document.getElementById('fila-' + id);
  if (row) row.remove();
  filas = filas.filter(f => f !== id);
  calcularTotales();
}

function updateProducto(id, campo, valor) {
  // Compatibilidad — no se usa en el nuevo sistema
}

function actualizarSubtotalFila(id) {
  // no se usa en nuevo sistema
}

function calcularSubtotalCot(id) {
  const qty = parseFloat(document.querySelector('.qty-cot-' + id)?.value) || 0;
  const price = parseMonto(document.querySelector('.price-cot-' + id)?.value || '');
  const sub = qty * price;
  const el = document.getElementById('sub-cot-' + id);
  if (el) el.textContent = formatPesos(sub);
  calcularTotales();
}

function formatearPrecioCot(id) {
  const el = document.querySelector('.price-cot-' + id);
  if (!el) return;
  const val = parseMonto(el.value);
  if (val > 0) el.value = formatPesos(val);
  calcularSubtotalCot(id);
}

// Foto por fila
let fotosPorFila = {}; // {id: dataUrl}
let fotoTargetFila = null;

function abrirFotoCot(id) {
  fotoTargetFila = id;
  document.getElementById('photoInput').click();
}

function updateProducto(id, campo, valor) {
}

function subtotalProducto(p) {
  const qty = parseFloat(p.qty) || 0;
  const u = parseMonto(p.unitario);
  return qty * u;
}

function actualizarSubtotalFila(id) { /* no usado */ }

/* ---------- LAYOUT SWITCH ---------- */
function cambiarLayout(nuevo) {
  renderProductos();
}

/* ---------- RENDER ---------- */
function renderProductos() {
  renderLista();
}

// renderLista manejada por agregarProducto

function abrirFoto(pid) {
  photoTargetId = pid;
  document.getElementById('photoInput').click();
}

function escapeAttr(v) {
  return String(v ?? '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

function photoSlotHTML(pid, photoUrl, isLarge = false) {
  const has = photoUrl ? 'has-image' : '';
  return `
    <div class="photo-slot ${has}" data-pid="${pid}">
      ${photoUrl ? `<img src="${photoUrl}" alt="Foto del mueble">` : ''}
      <div class="placeholder-content">
        <svg class="upload-icon" width="${isLarge ? 32 : 18}" height="${isLarge ? 32 : 18}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
          <circle cx="8.5" cy="8.5" r="1.5"/>
          <polyline points="21 15 16 10 5 21"/>
        </svg>
        ${isLarge ? '<span class="upload-hint">Arrastra una foto o haz clic</span>' : ''}
      </div>
      <button class="photo-remove" onclick="event.stopPropagation(); quitarFoto('${pid}')" title="Quitar foto">✕</button>
    </div>
  `;
}

function attachPhotoListeners(scope, pid) {
  const slot = scope.querySelector('.photo-slot');
  if (!slot) return;

  slot.addEventListener('click', e => {
    if (e.target.classList.contains('photo-remove')) return;
    photoTargetId = pid;
    document.getElementById('photoInput').click();
  });

  ['dragenter', 'dragover'].forEach(evt => {
    slot.addEventListener(evt, e => {
      e.preventDefault(); e.stopPropagation();
      slot.classList.add('dragover');
    });
  });
  ['dragleave', 'drop'].forEach(evt => {
    slot.addEventListener(evt, e => {
      e.preventDefault(); e.stopPropagation();
      slot.classList.remove('dragover');
    });
  });
  slot.addEventListener('drop', e => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
      cargarFotoEnProducto(pid, file);
    }
  });
}

function cargarFotoEnProducto(pid, file) {
  // Redimensionar para no inflar el PDF
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const MAX = 800;
      let { width, height } = img;
      if (width > MAX || height > MAX) {
        const r = Math.min(MAX / width, MAX / height);
        width = Math.round(width * r);
        height = Math.round(height * r);
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      fotosPorFila[pid] = dataUrl;
      const txt = document.getElementById('fototxt-' + pid);
      const btn = document.getElementById('fotobtn-' + pid);
      if (txt) txt.textContent = '✓ Foto';
      if (btn) btn.style.borderColor = '#C49A3C';
      mostrarToast('✓ Foto agregada');
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function quitarFoto(pid) {
  delete fotosPorFila[pid];
  const txt = document.getElementById('fototxt-' + pid);
  const btn = document.getElementById('fotobtn-' + pid);
  if (txt) txt.textContent = '+ Foto';
  if (btn) btn.style.borderColor = '#D4C9B8';
}

function formatearPrecioInput(input, pid) {
  const val = parseMonto(input.value);
  if (val > 0) {
    input.value = formatPesos(val);
    updateProducto(pid, 'unitario', input.value);
  }
}

/* ---------- TOTALES ---------- */
function calcularTotales() {
  let total = 0;
  filas.forEach(id => {
    const qty = parseFloat(document.querySelector('.qty-cot-' + id)?.value) || 0;
    const price = parseMonto(document.querySelector('.price-cot-' + id)?.value || '');
    total += qty * price;
  });
  document.getElementById('totalGeneral').textContent = formatPesos(total);
  document.getElementById('sonLetras').textContent = total > 0 ? totalEnLetras(total) : '—';
}

/* ---------- DATOS / GETTERS ---------- */
function getDatos() {
  return {
    numero: document.getElementById('numeroCotizacion').value || '—',
    fecha: document.getElementById('fechaCotizacion').value,
    validezDias: document.getElementById('validezDias').value || '5',
    fechaVencimiento: addDays(document.getElementById('fechaCotizacion').value, document.getElementById('validezDias').value),
    vendedor: document.getElementById('vendedor').value,
    tiempoEntrega: document.getElementById('tiempoEntrega').value,
    nombre: document.getElementById('clienteNombre').value,
    direccion: document.getElementById('clienteDireccion').value,
    ciudad: document.getElementById('clienteCiudad').value,
    cc: document.getElementById('clienteCC').value,
    tel: document.getElementById('clienteTel').value,
    correo: document.getElementById('clienteCorreo').value,
    total: document.getElementById('totalGeneral').textContent,
    son: document.getElementById('sonLetras').textContent,
    formasPago: Array.from(formasPago),
    mensaje: document.getElementById('mensajeCliente').value
  };
}

/* =========================================================
   PDF
   ========================================================= */
async function generarPDFBlob() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });
  const d = getDatos();

  const W = 215.9, H = 279.4;
  const margin = 15;
  const contentW = W - margin * 2;
  let page = 1;

  // ====== HEADER ======
  function drawHeader() {
    doc.setFillColor(28, 26, 23);
    doc.rect(0, 0, W, 40, 'F');

    // Logo (sobre el fondo oscuro - se integra)
    let textX = margin;
    if (window.LOGO_DATA_URL) {
      try {
        doc.addImage(window.LOGO_DATA_URL, 'JPEG', margin, 5, 30, 30);
        textX = margin + 34;
      } catch (e) {}
    }

    doc.setTextColor(196, 154, 60);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('CASA DAMS', textX, 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(158, 148, 136);
    doc.text('Muebles Nacionales e Importados', textX, 21);
    doc.text('Cra. 4 N° 49-71 B/Los Laureles 2. Montería - Córdoba', textX, 26);
    doc.text('Cel. 321 540 0839  ·  casadams2015@gmail.com', textX, 31);

    // Caja N° cotización
    doc.setFillColor(196, 154, 60);
    doc.roundedRect(W - 70, 8, 55, 24, 3, 3, 'F');
    doc.setTextColor(28, 26, 23);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('COTIZACIÓN', W - 42.5, 14, { align: 'center' });
    doc.setFontSize(15);
    doc.text(d.numero, W - 42.5, 22, { align: 'center' });
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text(formatDate(d.fecha), W - 42.5, 28, { align: 'center' });
  }

  drawHeader();
  let y = 48;

  // ====== DATOS CLIENTE ======
  doc.setFillColor(245, 240, 232);
  doc.rect(margin, y, contentW, 28, 'F');
  doc.setDrawColor(212, 201, 184);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentW, 28);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(107, 79, 53);
  doc.text('COTIZADO PARA', margin + 4, y + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(28, 26, 23);
  doc.text(d.nombre || '—', margin + 4, y + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(80, 70, 60);
  const lineaCliente = [d.direccion, d.ciudad].filter(Boolean).join(' · ') || '—';
  doc.text(lineaCliente, margin + 4, y + 18);
  const lineaCliente2 = [d.tel && `Tel. ${d.tel}`, d.correo, d.cc && `C.C. ${d.cc}`].filter(Boolean).join('  ·  ');
  if (lineaCliente2) doc.text(lineaCliente2, margin + 4, y + 23);

  // Validez box (derecha)
  const vbX = margin + contentW - 60;
  doc.setFillColor(255, 255, 255);
  doc.rect(vbX, y, 60, 28, 'F');
  doc.setDrawColor(196, 154, 60);
  doc.setLineWidth(0.4);
  doc.line(vbX, y, vbX, y + 28);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(196, 154, 60);
  doc.text('VÁLIDA HASTA', vbX + 30, y + 6, { align: 'center' });
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(28, 26, 23);
  doc.text(formatDate(d.fechaVencimiento), vbX + 30, y + 13, { align: 'center' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(107, 79, 53);
  doc.text(`(${d.validezDias} días de validez)`, vbX + 30, y + 19, { align: 'center' });
  if (d.tiempoEntrega) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(107, 79, 53);
    doc.text('ENTREGA: ' + d.tiempoEntrega.toUpperCase(), vbX + 30, y + 25, { align: 'center' });
  }

  y += 36;

  // ====== TABLA PRODUCTOS — header ======
  doc.setFillColor(28, 26, 23);
  doc.rect(margin, y, contentW, 9, 'F');
  doc.setTextColor(196, 154, 60);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);

  // Columnas: foto(22) cant(14) desc(rest) unitario(32) subtotal(32)
  const colW = { foto: 22, cant: 14, desc: 0, unit: 32, sub: 32 };
  colW.desc = contentW - colW.foto - colW.cant - colW.unit - colW.sub;
  const colX = {
    foto: margin,
    cant: margin + colW.foto,
    desc: margin + colW.foto + colW.cant,
    unit: margin + colW.foto + colW.cant + colW.desc,
    sub: margin + colW.foto + colW.cant + colW.desc + colW.unit
  };
  doc.text('FOTO', colX.foto + colW.foto/2, y + 6, { align: 'center' });
  doc.text('CANT.', colX.cant + colW.cant/2, y + 6, { align: 'center' });
  doc.text('DESCRIPCIÓN', colX.desc + 3, y + 6);
  doc.text('VR. UNITARIO', colX.unit + colW.unit - 3, y + 6, { align: 'right' });
  doc.text('SUBTOTAL', colX.sub + colW.sub - 3, y + 6, { align: 'right' });

  y += 9;

  // ====== PRODUCTOS ======
  const _prods = getProductos();
  const minRowH = 26;
  for (let i = 0; i < _prods.length; i++) {
    const p = _prods[i];

    // Calcular altura de fila según descripción
    doc.setFontSize(9);
    const descLines = doc.splitTextToSize(p.desc || '—', colW.desc - 6);
    const textH = descLines.length * 4 + 8;
    const rowH = Math.max(minRowH, textH);

    // Nueva página si no cabe
    if (y + rowH > H - 80) {
      doc.addPage();
      page++;
      drawHeader();
      y = 48;
      // Repetir header tabla
      doc.setFillColor(28, 26, 23);
      doc.rect(margin, y, contentW, 9, 'F');
      doc.setTextColor(196, 154, 60);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.text('FOTO', colX.foto + colW.foto/2, y + 6, { align: 'center' });
      doc.text('CANT.', colX.cant + colW.cant/2, y + 6, { align: 'center' });
      doc.text('DESCRIPCIÓN', colX.desc + 3, y + 6);
      doc.text('VR. UNITARIO', colX.unit + colW.unit - 3, y + 6, { align: 'right' });
      doc.text('SUBTOTAL', colX.sub + colW.sub - 3, y + 6, { align: 'right' });
      y += 9;
    }

    // Fondo alterno
    if (i % 2 === 0) {
      doc.setFillColor(253, 252, 249);
    } else {
      doc.setFillColor(245, 240, 232);
    }
    doc.rect(margin, y, contentW, rowH, 'F');

    // Foto
    if (p.photo) {
      try {
        const imgSize = rowH - 4;
        doc.addImage(p.photo, 'JPEG', colX.foto + (colW.foto - imgSize) / 2, y + 2, imgSize, imgSize);
      } catch (e) { console.warn('Img error', e); }
    } else {
      doc.setFillColor(238, 232, 220);
      const ps = rowH - 6;
      doc.rect(colX.foto + (colW.foto - ps) / 2, y + 3, ps, ps, 'F');
      doc.setFontSize(5);
      doc.setTextColor(160, 150, 140);
      doc.text('SIN FOTO', colX.foto + colW.foto / 2, y + rowH / 2 + 1, { align: 'center' });
    }

    // Cantidad
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(107, 79, 53);
    doc.text(String(p.qty || '—'), colX.cant + colW.cant / 2, y + rowH / 2 + 2, { align: 'center' });

    // Descripción
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(28, 26, 23);
    doc.text(descLines, colX.desc + 3, y + 7);

    // Unitario
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(80, 70, 60);
    const unitVal = parseMonto(p.unitario);
    doc.text(formatPesos(unitVal), colX.unit + colW.unit - 3, y + rowH / 2 + 2, { align: 'right' });

    // Subtotal
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(28, 26, 23);
    doc.text(formatPesos(subtotalProducto(p)), colX.sub + colW.sub - 3, y + rowH / 2 + 2, { align: 'right' });

    // Línea inferior
    doc.setDrawColor(212, 201, 184);
    doc.setLineWidth(0.2);
    doc.line(margin, y + rowH, margin + contentW, y + rowH);

    y += rowH;
  }

  // Borde general tabla
  doc.setDrawColor(28, 26, 23);
  doc.setLineWidth(0.4);
  doc.rect(margin, y - minRowH * _prods.length - 9, contentW, minRowH * _prods.length + 9);

  y += 6;

  // ====== TOTAL ======
  // Nueva página si está al borde
  if (y > H - 70) { doc.addPage(); drawHeader(); y = 48; }

  // Son
  doc.setFillColor(245, 240, 232);
  doc.rect(margin, y, contentW * 0.6, 14, 'F');
  doc.setDrawColor(212, 201, 184);
  doc.rect(margin, y, contentW * 0.6, 14);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(107, 79, 53);
  doc.text('SON', margin + 3, y + 4.5);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(80, 70, 60);
  const sonLines = doc.splitTextToSize(d.son, contentW * 0.6 - 6);
  doc.text(sonLines.slice(0, 2), margin + 3, y + 9);

  // Total
  const totX = margin + contentW * 0.62;
  const totW = contentW * 0.38;
  doc.setFillColor(28, 26, 23);
  doc.rect(totX, y, totW, 14, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(196, 154, 60);
  doc.text('TOTAL COTIZACIÓN', totX + 4, y + 5.5);
  doc.setFontSize(14);
  doc.setTextColor(232, 201, 106);
  doc.text(d.total, totX + totW - 4, y + 11, { align: 'right' });

  y += 22;

  // ====== TIEMPO + PAGOS ======
  if (d.tiempoEntrega || d.formasPago.length) {
    doc.setFillColor(253, 252, 249);
    doc.setDrawColor(212, 201, 184);
    doc.setLineWidth(0.3);

    let infoH = 0;
    const infoLines = [];
    if (d.tiempoEntrega) infoLines.push({ k: 'TIEMPO DE ENTREGA', v: d.tiempoEntrega });
    if (d.formasPago.length) infoLines.push({ k: 'FORMAS DE PAGO', v: d.formasPago.join(' · ') });
    infoH = infoLines.length * 8 + 8;

    doc.rect(margin, y, contentW, infoH, 'F');
    doc.rect(margin, y, contentW, infoH);

    let iy = y + 7;
    infoLines.forEach(line => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(196, 154, 60);
      doc.text(line.k, margin + 4, iy);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(28, 26, 23);
      doc.text(line.v, margin + 50, iy);
      iy += 7;
    });
    y += infoH + 4;
  }

  // ====== MENSAJE ======
  if (d.mensaje) {
    if (y > H - 60) { doc.addPage(); drawHeader(); y = 48; }
    const msgLines = doc.splitTextToSize(d.mensaje, contentW - 12);
    const msgH = msgLines.length * 4.5 + 14;
    doc.setFillColor(245, 240, 232);
    doc.rect(margin, y, contentW, msgH, 'F');
    doc.setDrawColor(196, 154, 60);
    doc.setLineWidth(0.5);
    doc.line(margin, y, margin, y + msgH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(196, 154, 60);
    doc.text('MENSAJE DEL VENDEDOR', margin + 4, y + 6);
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(80, 65, 50);
    doc.text(msgLines, margin + 4, y + 12);
    y += msgH + 4;
  }

  // ====== FOOTER ======
  // Asegurar espacio
  if (y > H - 40) { doc.addPage(); drawHeader(); y = 48; }
  const footerY = Math.max(y + 10, H - 30);
  doc.setDrawColor(196, 154, 60);
  doc.setLineWidth(0.5);
  doc.line(margin, footerY, W - margin, footerY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(196, 154, 60);
  doc.text('CASA DAMS', margin, footerY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(107, 79, 53);
  doc.text('Cra. 4 N° 49-71 · B/Los Laureles 2 · Montería - Córdoba', margin, footerY + 11);
  doc.text('Cel. 321 540 0839 · casadams2015@gmail.com', margin, footerY + 15);

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(7);
  doc.setTextColor(158, 148, 136);
  if (d.vendedor) doc.text('Atentamente, ' + d.vendedor, W - margin, footerY + 6, { align: 'right' });
  doc.text('Gracias por confiar en nosotros.', W - margin, footerY + 12, { align: 'right' });

  return doc;
}

async function descargarPDF() {
  try {
    mostrarToast('⏳ Generando PDF...');
    const doc = await generarPDFBlob();
    const d = getDatos();
    doc.save(`Cotizacion_CasaDams_${d.numero}.pdf`);
    mostrarToast('✓ PDF descargado');
    // Avanzar contador la primera vez
    const num = parseInt(d.numero.replace(/\D/g, ''));
    if (!isNaN(num)) setContador('cotizacion_num', num);
  } catch (e) {
    console.error(e);
    mostrarToast('✗ Error al generar PDF');
  }
}

async function previsualizarPDF() {
  try {
    mostrarToast('⏳ Generando vista previa...');
    const doc = await generarPDFBlob();
    const blob = doc.output('blob');
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
  } catch (e) {
    console.error(e);
    mostrarToast('✗ Error al previsualizar');
  }
}

/* =========================================================
   WHATSAPP
   ========================================================= */
function abrirModalWA() {
  const tel = document.getElementById('clienteTel').value.replace(/\D/g, '');
  if (tel) {
    const num = tel.startsWith('57') ? tel : '57' + tel;
    document.getElementById('waNumero').value = num;
  }
  document.getElementById('modalWA').classList.add('show');
}

function cerrarModal() {
  document.getElementById('modalWA').classList.remove('show');
}

async function enviarWA() {
  const numero = document.getElementById('waNumero').value.replace(/\D/g, '');
  if (!numero || numero.length < 10) {
    mostrarToast('⚠ Ingresa un número válido');
    return;
  }
  cerrarModal();
  mostrarToast('⏳ Generando PDF...');

  try {
    const d = getDatos();
    const doc = await generarPDFBlob();
    const pdfBlob = doc.output('blob');
    const fileName = `Cotizacion_CasaDams_${d.numero}_${Date.now()}.pdf`;

    mostrarToast('⏳ Subiendo PDF...');
    const pdfLink = await subirPDFaSupabase(pdfBlob, fileName, 'ordenes');

    mostrarToast('⏳ Enviando por WhatsApp...');
    const chatId = numero + '@c.us';
    const productosTxt = productos
      .filter(p => p.desc || p.qty)
      .map(p => `• ${p.qty || 1}x ${p.desc} — ${formatPesos(subtotalProducto(p))}`)
      .join('\n');

    const mensaje = `🛋️ *CASA DAMS — Cotización ${d.numero}*

Hola ${d.nombre || 'cliente'}, le compartimos la cotización solicitada:

${productosTxt}

💰 *Total:* ${d.total}
📅 *Válida hasta:* ${formatDate(d.fechaVencimiento)}
${d.tiempoEntrega ? `📦 *Entrega:* ${d.tiempoEntrega}\n` : ''}
${pdfLink ? `📄 ${pdfLink}` : ''}

Quedamos atentos a su confirmación.
📍 Cra. 4 N° 49-71, Montería · 📞 321 540 0839`;

    const res = await enviarMensajeWA(chatId, mensaje);
    if (res.ok) {
      // Guardar en Supabase
      try {
        await fetch(`${SUPA_URL}/rest/v1/cotizaciones`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': SUPA_KEY,
            'Authorization': 'Bearer ' + SUPA_KEY,
            'Prefer': 'return=minimal'
          },
          body: JSON.stringify({
            numero_cotizacion: d.numero,
            cliente: d.nombre || '',
            telefono: d.tel || '',
            fecha_cotizacion: d.fecha || new Date().toISOString().split('T')[0],
            fecha_vencimiento: d.fechaVencimiento || null,
            tiempo_entrega: d.tiempoEntrega || '',
            vendedor: d.vendedor || '',
            productos: getProductos(),
            valor_total: parseMonto(d.total),
            pdf_url: pdfLink || '',
            enviado_whatsapp: true,
            notas: d.son || ''
          })
        });
      } catch(e) { console.warn('No se pudo guardar en Supabase:', e); }
      mostrarToast(pdfLink ? '✓ Cotización enviada con PDF' : '✓ Mensaje enviado');
    } else {
      throw new Error('WAHA error');
    }
  } catch (e) {
    console.error(e);
    mostrarToast('⚠ Abriendo WhatsApp directamente...');
    const d = getDatos();
    const msg = `🛋️ *CASA DAMS - Cotización ${d.numero}*\n\n👤 ${d.nombre || '—'}\n💰 Total: ${d.total}\n📅 Válida hasta: ${formatDate(d.fechaVencimiento)}\n\nGracias por su interés.`;
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(msg)}`, '_blank');
  }
}

/* =========================================================
   NUEVA / RESET
   ========================================================= */
function nuevaCotizacion() {
  if (!confirm('¿Crear nueva cotización? Se perderán los datos actuales.')) return;

  const currentNum = parseInt(document.getElementById('numeroCotizacion').value.replace(/\D/g, '')) || 1;
  const next = currentNum + 1;
  setContador('cotizacion_num', next);

  document.getElementById('numeroCotizacion').value = formatNumCotizacion(next);
  document.getElementById('displayNumero').textContent = formatNumCotizacion(next);
  document.getElementById('fechaCotizacion').value = today();
  document.getElementById('validezDias').value = '5';
  document.getElementById('vendedor').value = '';
  document.getElementById('tiempoEntrega').value = '';
  document.getElementById('clienteNombre').value = '';
  document.getElementById('clienteDireccion').value = '';
  document.getElementById('clienteCiudad').value = '';
  document.getElementById('clienteCC').value = '';
  document.getElementById('clienteTel').value = '';
  document.getElementById('clienteCorreo').value = '';
  document.getElementById('mensajeCliente').value = '';

  filas = [];
  filaCounter = 1;
  fotosPorFila = {};
  document.getElementById('productosBody').innerHTML = '';
  agregarProducto(); agregarProducto();
  calcularTotales();
  actualizarVencimiento();

  mostrarToast('✓ Nueva cotización lista');
}


/* =========================================================
   HISTORIAL DE COTIZACIONES
   ========================================================= */
let todasLasCotizaciones = [];

async function cargarHistorialCotizaciones() {
  const lista = document.getElementById('historialCotLista');
  if (!lista) return;
  lista.innerHTML = '<div style="text-align:center;padding:40px;color:var(--warm-gray)">⏳ Cargando...</div>';
  try {
    const res = await fetch(`${SUPA_URL}/rest/v1/cotizaciones?select=*&order=created_at.desc&limit=100`, {
      headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY }
    });
    if (!res.ok) throw new Error('Error');
    const data = await res.json();
    todasLasCotizaciones = data;
    renderCotizaciones(data);
  } catch(e) {
    lista.innerHTML = '<div style="text-align:center;padding:40px;color:var(--warm-gray)">⚠️ No se pudo cargar el historial</div>';
  }
}

function filtrarCotizaciones() {
  const q = (document.getElementById('historialCotBuscar')?.value || '').toLowerCase().trim();
  if (!q) { renderCotizaciones(todasLasCotizaciones); return; }
  renderCotizaciones(todasLasCotizaciones.filter(c =>
    (c.cliente||'').toLowerCase().includes(q) ||
    (c.numero_cotizacion||'').toLowerCase().includes(q) ||
    (c.telefono||'').includes(q) ||
    (c.vendedor||'').toLowerCase().includes(q)
  ));
}

function formatCOPH(n) { if(!n&&n!==0)return'—'; return'$'+Number(n).toLocaleString('es-CO'); }
function formatFechaH(f) { if(!f)return'—'; return new Date(f+'T12:00:00').toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'}); }

function renderCotizaciones(lista) {
  const el = document.getElementById('historialCotLista');
  if (!el) return;
  if (!lista || lista.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--warm-gray)"><div style="font-size:48px;margin-bottom:12px">🗂</div><p>No hay cotizaciones guardadas</p></div>';
    return;
  }
  el.innerHTML = lista.map(c => `
    <div style="background:var(--white);border-radius:14px;border:1px solid var(--border);margin-bottom:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04);cursor:pointer;transition:all 0.2s" onclick="verDetalleCot('${c.id}')" onmouseover="this.style.borderColor='#C49A3C'" onmouseout="this.style.borderColor='#D4C9B8'">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:var(--cream);border-bottom:1px solid var(--border)">
        <div>
          <div style="font-family:'Playfair Display',serif;font-size:18px;font-weight:700;color:#C49A3C">${c.numero_cotizacion||'—'}</div>
          <div style="font-size:12px;color:var(--warm-gray)">${formatFechaH(c.fecha_cotizacion||c.created_at)}</div>
        </div>
        <span style="font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;background:${c.enviado_whatsapp?'#D1FAE5':'#FEE2E2'};color:${c.enviado_whatsapp?'#065F46':'#991B1B'}">
          ${c.enviado_whatsapp?'✅ Enviada':'📋 Sin enviar'}
        </span>
      </div>
      <div style="padding:14px 18px">
        <div style="font-size:16px;font-weight:600;color:var(--dark);margin-bottom:6px">👤 ${c.cliente||'Sin nombre'}</div>
        <div style="display:flex;gap:20px;flex-wrap:wrap;font-size:13px;color:var(--warm-gray)">
          ${c.telefono?`<span>📞 ${c.telefono}</span>`:''}
          ${c.vendedor?`<span>🧑 ${c.vendedor}</span>`:''}
          ${c.fecha_vencimiento?`<span>📅 Vence: ${formatFechaH(c.fecha_vencimiento)}</span>`:''}
        </div>
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);display:flex;gap:16px">
          <div><div style="font-size:10px;color:var(--warm-gray);letter-spacing:1px;text-transform:uppercase">Total</div><div style="font-family:'Playfair Display',serif;font-size:15px;font-weight:700">${formatCOPH(c.valor_total)}</div></div>
          ${c.pdf_url?`<a href="${c.pdf_url}" target="_blank" onclick="event.stopPropagation()" style="display:inline-flex;align-items:center;gap:6px;background:var(--gold);color:var(--dark);padding:6px 14px;border-radius:8px;font-weight:700;font-size:13px;text-decoration:none;margin-left:auto;align-self:center">📄 PDF</a>`:''}
        </div>
      </div>
    </div>
  `).join('');
}

function verDetalleCot(id) {
  const c = todasLasCotizaciones.find(x => x.id === id);
  if (!c) return;
  const overlay = document.getElementById('detalleCotOverlay');
  const titulo = document.getElementById('detalleCotTitulo');
  const contenido = document.getElementById('detalleCotContenido');
  if (!overlay) return;
  titulo.textContent = `Cotización ${c.numero_cotizacion||'—'}`;
  let productosHTML = '';
  if (c.productos && c.productos.length > 0) {
    productosHTML = `<div style="background:var(--cream);border-radius:10px;padding:14px;margin-bottom:16px">${c.productos.map(p=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:14px"><span>${p.qty||1}x ${p.desc||'—'}</span><span style="font-weight:600;color:var(--brown)">${p.sub||'—'}</span></div>`).join('')}</div>`;
  }
  contenido.innerHTML = `
    ${c.pdf_url?`<a href="${c.pdf_url}" target="_blank" style="display:inline-flex;align-items:center;gap:8px;background:var(--gold);color:var(--dark);padding:10px 18px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none;margin-bottom:16px">📄 Ver PDF de la cotización</a>`:''}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div><div style="font-size:10px;font-weight:600;color:var(--warm-gray);letter-spacing:1px;text-transform:uppercase">Cliente</div><div style="font-size:15px;font-weight:500">${c.cliente||'—'}</div></div>
      <div><div style="font-size:10px;font-weight:600;color:var(--warm-gray);letter-spacing:1px;text-transform:uppercase">Teléfono</div><div style="font-size:15px;font-weight:500">${c.telefono||'—'}</div></div>
      <div><div style="font-size:10px;font-weight:600;color:var(--warm-gray);letter-spacing:1px;text-transform:uppercase">Vendedor</div><div style="font-size:15px;font-weight:500">${c.vendedor||'—'}</div></div>
      <div><div style="font-size:10px;font-weight:600;color:var(--warm-gray);letter-spacing:1px;text-transform:uppercase">Fecha</div><div style="font-size:15px;font-weight:500">${formatFechaH(c.fecha_cotizacion)}</div></div>
      <div><div style="font-size:10px;font-weight:600;color:var(--warm-gray);letter-spacing:1px;text-transform:uppercase">Vence</div><div style="font-size:15px;font-weight:500">${formatFechaH(c.fecha_vencimiento)}</div></div>
      <div><div style="font-size:10px;font-weight:600;color:var(--warm-gray);letter-spacing:1px;text-transform:uppercase">Total</div><div style="font-family:'Playfair Display',serif;font-size:18px;font-weight:700;color:var(--green)">${formatCOPH(c.valor_total)}</div></div>
    </div>
    ${productosHTML}
  `;
  overlay.classList.add('show');
}
