/* =========================================================
   COTIZACIÓN — Lógica
   ========================================================= */

let productos = []; // [{id, qty, desc, unitario, photo: dataUrl}]
let layout = 'lista';
let formasPago = new Set();
let photoTargetId = null; // ID del producto al que asignar foto
let editandoCotId = null;   // id de la cotización guardada que se está editando (null = cotización nueva)
let numeroNuevaCot = '';    // número que le tocaba a la próxima cotización nueva (se restaura al terminar de editar)

/* ---------- INIT ---------- */
window.addEventListener('DOMContentLoaded', async () => {
  // Fecha hoy
  document.getElementById('fechaCotizacion').value = today();

  // Número consecutivo desde Supabase
  let num = getContador('cotizacion_num', 1);
  try {
    const rn = await fetch(`${SUPA_URL}/rest/v1/consecutivos?clave=eq.cotizacion&select=valor`, {
      headers: {'apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY}
    });
    const rows = await rn.json();
    if (Array.isArray(rows) && rows.length > 0) num = rows[0].valor + 1;
  } catch(e) { console.warn('Consecutivo offline, usando local'); }
  document.getElementById('numeroCotizacion').value = formatNumCotizacion(num);
  document.getElementById('displayNumero').textContent = formatNumCotizacion(num);

  // 2 productos iniciales para empezar a llenar
  agregarProducto();
  agregarProducto();

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
    if (file && photoTargetId !== null) {
      cargarFotoEnProducto(photoTargetId, file);
    }
    e.target.value = '';
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

/* ---------- PRODUCTOS — DATOS ---------- */
function agregarProducto() {
  const id = Date.now() + Math.random().toString(36).slice(2, 5);
  productos.push({ id, qty: '', desc: '', unitario: '', photo: null });
  renderProductos();
  // focus en la última fila
  setTimeout(() => {
    const last = document.querySelector(`[data-pid="${id}"] input`);
    if (last) last.focus();
  }, 50);
}

function eliminarProducto(id) {
  productos = productos.filter(p => p.id !== id);
  renderProductos();
  calcularTotales();
}

function updateProducto(id, campo, valor) {
  const p = productos.find(p => p.id === id);
  if (!p) return;
  p[campo] = valor;
  // Recalcular el subtotal de esta fila
  actualizarSubtotalFila(id);
  calcularTotales();
}

function subtotalProducto(p) {
  const qty = parseFloat(p.qty) || 0;
  const u = parseMonto(p.unitario);
  return qty * u;
}

function actualizarSubtotalFila(id) {
  const p = productos.find(p => p.id === id);
  if (!p) return;
  const sub = subtotalProducto(p);
  const el = document.querySelector(`[data-pid="${id}"] .subtotal-display, [data-pid="${id}"] .card-totals-value`);
  if (el) el.textContent = formatPesos(sub);
}

/* ---------- LAYOUT SWITCH ---------- */
function cambiarLayout(nuevo) {
  layout = nuevo;
  document.getElementById('btnLista').classList.toggle('active', nuevo === 'lista');
  document.getElementById('btnGaleria').classList.toggle('active', nuevo === 'galeria');
  document.getElementById('layoutLista').style.display = nuevo === 'lista' ? '' : 'none';
  document.getElementById('layoutGaleria').style.display = nuevo === 'galeria' ? '' : 'none';
  renderProductos();
}

/* ---------- RENDER ---------- */
function renderProductos() {
  if (layout === 'lista') renderLista();
  else renderGaleria();
}

function renderLista() {
  const body = document.getElementById('productosBody');
  body.innerHTML = '';
  productos.forEach(p => {
    const row = document.createElement('div');
    row.className = 'producto-row';
    row.dataset.pid = p.id;
    row.innerHTML = `
      <input type="number" placeholder="1" min="1" value="${escapeAttr(p.qty)}" oninput="updateProducto('${p.id}', 'qty', this.value)">
      ${photoSlotHTML(p.id, p.photo)}
      <input type="text" placeholder="Cama Montaña 140x190 — color rosa palo" value="${escapeAttr(p.desc)}" oninput="updateProducto('${p.id}', 'desc', this.value)">
      <input type="text" placeholder="$0" value="${escapeAttr(p.unitario)}" oninput="updateProducto('${p.id}', 'unitario', this.value)" onblur="formatearPrecioInput(this, '${p.id}')" style="text-align:right">
      <div class="subtotal-display">${formatPesos(subtotalProducto(p))}</div>
      <button class="btn-delete-row" onclick="eliminarProducto('${p.id}')" title="Eliminar">✕</button>
    `;
    body.appendChild(row);
    attachPhotoListeners(row, p.id);
  });
}

function renderGaleria() {
  const grid = document.getElementById('productosGrid');
  grid.innerHTML = '';
  productos.forEach(p => {
    const card = document.createElement('div');
    card.className = 'producto-card';
    card.dataset.pid = p.id;
    card.innerHTML = `
      <button class="btn-delete-card" onclick="eliminarProducto('${p.id}')" title="Eliminar">✕</button>
      <div class="card-photo-wrap">${photoSlotHTML(p.id, p.photo, true)}</div>
      <div class="card-body">
        <input type="text" class="desc-input" placeholder="Cama Montaña 140x190 — rosa palo" value="${escapeAttr(p.desc)}" oninput="updateProducto('${p.id}', 'desc', this.value)">
        <div class="card-row-2">
          <input type="number" placeholder="Cant." min="1" value="${escapeAttr(p.qty)}" oninput="updateProducto('${p.id}', 'qty', this.value)">
          <input type="text" placeholder="$ Vr. Unitario" value="${escapeAttr(p.unitario)}" oninput="updateProducto('${p.id}', 'unitario', this.value)" onblur="formatearPrecioInput(this, '${p.id}')" style="text-align:right">
        </div>
        <div class="card-totals">
          <span class="card-totals-label">Subtotal</span>
          <span class="card-totals-value">${formatPesos(subtotalProducto(p))}</span>
        </div>
      </div>
    `;
    grid.appendChild(card);
    attachPhotoListeners(card, p.id);
  });
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
      const p = productos.find(p => p.id === pid);
      if (p) {
        p.photo = dataUrl;
        renderProductos();
        mostrarToast('✓ Foto agregada');
      }
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function quitarFoto(pid) {
  const p = productos.find(p => p.id === pid);
  if (p) {
    p.photo = null;
    renderProductos();
  }
}

function formatearPrecioInput(input, pid) {
  const val = parseMonto(input.value);
  if (val > 0) {
    input.value = formatPesos(val);
    updateProducto(pid, 'unitario', input.value);
  }
}

/* ---------- TOTALES ---------- */
/* Descuento opcional y manual: nunca se aplica solo. El descuento en % se redondea
   a múltiplos de $5.000 para que el precio final quede en múltiplos de $5.000. */
function leerDescuento() {
  const subtotal = productos.reduce((acc, p) => acc + subtotalProducto(p), 0);
  const base = { activo: false, subtotal: subtotal, monto: 0, total: subtotal, etiqueta: '', tipo: '', pct: 0 };
  const chk = document.getElementById('descActivo');
  if (!chk || !chk.checked || subtotal <= 0) return base;
  const tipo = document.getElementById('descTipo').value;
  const raw = document.getElementById('descValor').value;
  let monto = 0, etiqueta = 'Descuento', pct = 0;
  if (tipo === 'pct') {
    pct = Math.min(100, Math.max(0, parseFloat(String(raw).replace(',', '.')) || 0));
    monto = Math.round(subtotal * pct / 100 / 5000) * 5000;
    etiqueta = 'Descuento ' + String(pct).replace('.', ',') + '%';
  } else {
    monto = parseMonto(raw);
  }
  monto = Math.min(subtotal, Math.max(0, monto));
  if (monto <= 0) return base;
  return { activo: true, subtotal: subtotal, monto: monto, total: subtotal - monto, etiqueta: etiqueta, tipo: tipo, pct: pct };
}

function toggleDescuento() {
  const on = document.getElementById('descActivo').checked;
  document.getElementById('descCampos').style.display = on ? '' : 'none';
  if (!on) document.getElementById('descValor').value = '';
  else document.getElementById('descValor').focus();
  calcularTotales();
}

function calcularTotales() {
  const d = leerDescuento();
  document.getElementById('totalGeneral').textContent = formatPesos(d.total);
  document.getElementById('sonLetras').textContent = d.total > 0 ? totalEnLetras(d.total) : '—';
  document.getElementById('rowSubtotal').style.display = d.activo ? '' : 'none';
  document.getElementById('rowDescuento').style.display = d.activo ? '' : 'none';
  document.getElementById('subtotalGeneral').textContent = formatPesos(d.subtotal);
  document.getElementById('descLabel').textContent = d.etiqueta || 'Descuento';
  document.getElementById('descMonto').textContent = '- ' + formatPesos(d.monto);
  document.getElementById('totalLabel').textContent = d.activo ? 'Total con descuento' : 'Total Cotización';
  const aviso = document.getElementById('descAviso');
  if (aviso) {
    if (!d.activo) aviso.textContent = '';
    else if (d.tipo === 'pct') aviso.textContent = 'Equivale a ' + formatPesos(d.monto) + ' (redondeado a múltiplo de $5.000).';
    else aviso.textContent = d.monto % 5000 !== 0 ? 'Ojo: el descuento no es múltiplo de $5.000.' : '';
  }
}

/* Líneas de producto para guardar: si hay descuento se añade como una línea más,
   así el historial y el reenvío por WhatsApp lo muestran sin cambiar la base de datos. */
function productosParaGuardar() {
  const lineas = productos.filter(p => p.desc || p.qty).map(p => ({ qty: p.qty, desc: p.desc, unitario: p.unitario, sub: formatPesos(subtotalProducto(p)) }));
  const d = leerDescuento();
  if (d.activo) lineas.push({ qty: 1, desc: d.etiqueta, unitario: -d.monto, sub: '- ' + formatPesos(d.monto), esDescuento: true });
  // Datos que no tienen columna propia: se guardan aquí para poder editar la cotización después
  lineas.push({ esMeta: true,
    cc: document.getElementById('clienteCC').value, direccion: document.getElementById('clienteDireccion').value,
    ciudad: document.getElementById('clienteCiudad').value, correo: document.getElementById('clienteCorreo').value,
    formasPago: Array.from(formasPago), mensaje: document.getElementById('mensajeCliente').value,
    validezDias: document.getElementById('validezDias').value });
  return lineas;
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
    descuento: leerDescuento(),
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
  const minRowH = 26;
  for (let i = 0; i < productos.length; i++) {
    const p = productos[i];

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
  doc.rect(margin, y - minRowH * productos.length - 9, contentW, minRowH * productos.length + 9);

  y += 6;

  // ====== TOTAL ======
  // Nueva página si está al borde
  const dsc = d.descuento && d.descuento.activo ? d.descuento : null;
  if (y > H - (dsc ? 88 : 70)) { doc.addPage(); drawHeader(); y = 48; }

  // Precio normal (tachado) y descuento, solo si se aplicó uno
  if (dsc) {
    const dx = margin + contentW * 0.62, dw = contentW * 0.38;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(120, 110, 100);
    doc.text('PRECIO NORMAL', dx + 4, y + 4);
    doc.setFontSize(10);
    const normalTxt = formatPesos(dsc.subtotal);
    doc.text(normalTxt, dx + dw - 4, y + 4, { align: 'right' });
    const normalW = doc.getTextWidth(normalTxt);
    doc.setDrawColor(120, 110, 100);
    doc.setLineWidth(0.3);
    doc.line(dx + dw - 4 - normalW, y + 3, dx + dw - 4, y + 3);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(39, 99, 74);
    doc.text(dsc.etiqueta.toUpperCase(), dx + 4, y + 10);
    doc.setFontSize(10);
    doc.text('- ' + formatPesos(dsc.monto), dx + dw - 4, y + 10, { align: 'right' });
    y += 14;
  }

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
  doc.text(dsc ? 'TOTAL CON DESCUENTO' : 'TOTAL COTIZACIÓN', totX + 4, y + 5.5);
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

async function guardarCotizacionEnSupabase(d, pdfLink, enviadoWA) {
  try {
    const datos = {
      numero_cotizacion: d.numero,
      cliente: d.nombre||'', telefono: d.tel||'',
      fecha_cotizacion: d.fecha||new Date().toISOString().split('T')[0],
      fecha_vencimiento: d.fechaVencimiento||null,
      tiempo_entrega: d.tiempoEntrega||'', vendedor: d.vendedor||'',
      productos: productosParaGuardar(),
      valor_total: leerDescuento().total,
      pdf_url: pdfLink||''
    };
    const headers = { 'Content-Type':'application/json','apikey':_SUPA_KEY,'Authorization':'Bearer '+_SUPA_KEY,'Prefer':'return=minimal' };
    if (editandoCotId) {
      // Edición: se actualiza la misma cotización. Solo se marca como enviada si se acaba de enviar.
      if (enviadoWA) datos.enviado_whatsapp = true;
      await fetch(`${_SUPA_URL}/rest/v1/cotizaciones?id=eq.${encodeURIComponent(editandoCotId)}`, { method: 'PATCH', headers, body: JSON.stringify(datos) });
    } else {
      datos.enviado_whatsapp = enviadoWA;
      await fetch(`${_SUPA_URL}/rest/v1/cotizaciones`, { method: 'POST', headers, body: JSON.stringify(datos) });
    }
  } catch(e) { console.warn('Supabase error al guardar cotización:', e); }
}

async function descargarPDF() {
  try {
    mostrarToast('⏳ Generando PDF...');
    const doc = await generarPDFBlob();
    const d = getDatos();
    const pdfBlob = doc.output('blob');
    const fileName = `Cotizacion_CasaDams_${d.numero}_${Date.now()}.pdf`;
    // Subir a Supabase para que quede en el historial
    mostrarToast('⏳ Guardando...');
    const pdfLink = await subirPDFaSupabase(pdfBlob, fileName, 'ordenes');
    doc.save(`Cotizacion_CasaDams_${d.numero}.pdf`);
    const estabaEditando = !!editandoCotId;
    await guardarCotizacionEnSupabase(d, pdfLink, false);
    mostrarToast(estabaEditando ? '✓ Cambios guardados y PDF descargado' : '✓ PDF descargado');
    if (estabaEditando) { await terminarEdicion(); return; }
    // Avanzar contador
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

    const dsc = d.descuento && d.descuento.activo ? d.descuento : null;
    const lineaTotal = dsc
      ? `💰 *Precio normal:* ~${formatPesos(dsc.subtotal)}~\n🎁 *${dsc.etiqueta}:* -${formatPesos(dsc.monto)}\n✅ *Total con descuento:* ${d.total}`
      : `💰 *Total:* ${d.total}`;

    const mensaje = `🛋️ *CASA DAMS — Cotización ${d.numero}*

Hola ${d.nombre || 'cliente'}, le compartimos la cotización solicitada:

${productosTxt}

${lineaTotal}
📅 *Válida hasta:* ${formatDate(d.fechaVencimiento)}
${d.tiempoEntrega ? `📦 *Entrega:* ${d.tiempoEntrega}\n` : ''}
${pdfLink ? `📄 ${pdfLink}` : ''}

Quedamos atentos a su confirmación.
📍 Cra. 4 N° 49-71, Montería · 📞 321 540 0839`;

    const res = await enviarMensajeWA(chatId, mensaje);
    if (res.ok) {
      const estabaEditando = !!editandoCotId;
      await guardarCotizacionEnSupabase(d, pdfLink, true);
      if (estabaEditando) await terminarEdicion();
      mostrarToast(pdfLink ? '✓ Cotización enviada con PDF' : '✓ Mensaje enviado');
    } else {
      throw new Error('WAHA error');
    }
  } catch (e) {
    console.error(e);
    mostrarToast('⚠️ Error al enviar. Verifica que WAHA esté activo.');
  }
}

/* =========================================================
   NUEVA / RESET
   ========================================================= */
async function nuevaCotizacion() {
  if (editandoCotId) { cancelarEdicion(); return; }
  if (!confirm('¿Crear nueva cotización? Se perderán los datos actuales.')) return;

  const currentNum = parseInt(document.getElementById('numeroCotizacion').value.replace(/\D/g, '')) || 1;
  const next = currentNum + 1;
  setContador('cotizacion_num', next);
  // Actualizar consecutivo en Supabase
  try {
    await fetch(`${SUPA_URL}/rest/v1/consecutivos?clave=eq.cotizacion`, {
      method: 'PATCH',
      headers: {'Content-Type':'application/json','apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY,'Prefer':'return=minimal'},
      body: JSON.stringify({ valor: next })
    });
  } catch(e) { console.warn('Error actualizando consecutivo remoto'); }

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
  document.getElementById('descActivo').checked = false;
  document.getElementById('descCampos').style.display = 'none';
  document.getElementById('descValor').value = '';
  document.getElementById('descTipo').value = 'pct';

  productos = [];
  agregarProducto(); agregarProducto();
  calcularTotales();
  actualizarVencimiento();

  mostrarToast('✓ Nueva cotización lista');
}


/* =========================================================
   EDITAR UNA COTIZACIÓN GUARDADA
   ========================================================= */
function _setVal(id, v) {
  const el = document.getElementById(id);
  if (!el) return;
  const val = v == null ? '' : String(v);
  // En listas desplegables: si el valor guardado ya no está entre las opciones, se agrega para no perderlo
  if (el.tagName === 'SELECT' && val && ![...el.options].some(o => o.value === val)) el.add(new Option(val, val));
  el.value = val;
}

function editarCotizacion(id) {
  const c = _cotizaciones.find(x => String(x.id) === String(id));
  if (!c) return;
  if (editandoCotId === null) numeroNuevaCot = document.getElementById('numeroCotizacion').value;   // para restaurarlo luego
  editandoCotId = c.id;

  const lineas = Array.isArray(c.productos) ? c.productos : [];
  const meta = lineas.find(p => p.esMeta) || {};
  const lineaDesc = lineas.find(p => p.esDescuento);

  _setVal('numeroCotizacion', c.numero_cotizacion || '');
  document.getElementById('displayNumero').textContent = c.numero_cotizacion || '—';
  _setVal('fechaCotizacion', c.fecha_cotizacion || today());
  let validez = meta.validezDias;
  if (!validez && c.fecha_cotizacion && c.fecha_vencimiento) {
    validez = String(Math.round((Date.parse(c.fecha_vencimiento + 'T12:00:00Z') - Date.parse(c.fecha_cotizacion + 'T12:00:00Z')) / 86400000));
  }
  _setVal('validezDias', validez || '5');
  _setVal('vendedor', c.vendedor);
  _setVal('tiempoEntrega', c.tiempo_entrega);
  _setVal('clienteNombre', c.cliente);
  _setVal('clienteTel', c.telefono);
  _setVal('clienteDireccion', meta.direccion);
  _setVal('clienteCiudad', meta.ciudad);
  _setVal('clienteCC', meta.cc);
  _setVal('clienteCorreo', meta.correo);
  _setVal('mensajeCliente', meta.mensaje);

  if (Array.isArray(meta.formasPago)) {
    formasPago = new Set(meta.formasPago);
    document.querySelectorAll('#chipsPago .chip').forEach(ch => ch.classList.toggle('active', formasPago.has(ch.dataset.value)));
  }

  productos = lineas.filter(p => !p.esMeta && !p.esDescuento)
    .map((p, i) => ({ id: Date.now() + '' + i, qty: p.qty, desc: p.desc, unitario: p.unitario, photo: null }));
  if (productos.length === 0) productos.push({ id: Date.now() + 'x', qty: '', desc: '', unitario: '', photo: null });

  // descuento guardado → vuelve a la casilla
  const chk = document.getElementById('descActivo');
  chk.checked = !!lineaDesc;
  document.getElementById('descCampos').style.display = lineaDesc ? '' : 'none';
  if (lineaDesc) {
    const m = /([\d.,]+)\s*%/.exec(lineaDesc.desc || '');
    if (m) { _setVal('descTipo', 'pct'); _setVal('descValor', m[1]); }
    else { _setVal('descTipo', 'monto'); _setVal('descValor', formatPesos(Math.abs(Number(lineaDesc.unitario) || 0))); }
  } else { _setVal('descValor', ''); _setVal('descTipo', 'pct'); }

  renderProductos();
  calcularTotales();
  actualizarVencimiento();

  const sinExtras = !lineas.some(p => p.esMeta);
  document.getElementById('beTitulo').textContent = 'Editando ' + (c.numero_cotizacion || 'cotización');
  document.getElementById('beNota').textContent =
    'Los cambios reemplazan la cotización guardada (mismo número). Las fotos de los muebles no se guardan: vuelve a adjuntarlas si las necesitas.' +
    (sinExtras ? ' Esta cotización es anterior a la función de editar: completa cédula, dirección, ciudad, correo y formas de pago si hacen falta.' : '');
  const a = document.getElementById('bePdfAnterior');
  if (c.pdf_url) { a.href = c.pdf_url; a.style.display = ''; } else { a.style.display = 'none'; }
  document.getElementById('bannerEdicion').style.display = 'flex';
  const eb = document.getElementById('estadoBadge'); if (eb) eb.textContent = 'Editando';

  cerrarDetCotSiAbierto();
  cambiarTabCot('nueva');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function cerrarDetCotSiAbierto() {
  const o = document.getElementById('detalleCotOverlay');
  if (o) o.style.display = 'none';
}

function restaurarFormularioNuevo() {
  _setVal('numeroCotizacion', numeroNuevaCot);
  document.getElementById('displayNumero').textContent = numeroNuevaCot || '—';
  _setVal('fechaCotizacion', today());
  _setVal('validezDias', '5');
  ['vendedor', 'tiempoEntrega', 'clienteNombre', 'clienteDireccion', 'clienteCiudad', 'clienteCC', 'clienteTel', 'clienteCorreo', 'mensajeCliente'].forEach(i => _setVal(i, ''));
  document.getElementById('descActivo').checked = false;
  document.getElementById('descCampos').style.display = 'none';
  _setVal('descValor', ''); _setVal('descTipo', 'pct');
  formasPago = new Set(['Efectivo', 'Transferencia', '50% anticipo']);
  document.querySelectorAll('#chipsPago .chip').forEach(ch => ch.classList.toggle('active', formasPago.has(ch.dataset.value)));
  productos = [];
  agregarProducto(); agregarProducto();
  calcularTotales();
  actualizarVencimiento();
  const eb = document.getElementById('estadoBadge'); if (eb) eb.textContent = 'Borrador';
  document.getElementById('bannerEdicion').style.display = 'none';
}

function cancelarEdicion() {
  if (!confirm('¿Salir de la edición? Se perderán los cambios que no hayas guardado.')) return;
  editandoCotId = null;
  restaurarFormularioNuevo();
  mostrarToast('Edición cancelada');
}

async function terminarEdicion() {
  editandoCotId = null;
  restaurarFormularioNuevo();
  cambiarTabCot('historial');
}

/* =========================================================
   PESTAÑAS + HISTORIAL
   ========================================================= */
const _SUPA_URL = 'https://pqpzhmopnigxyacwdjbc.supabase.co';
const _SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxcHpobW9wbmlneHlhY3dkamJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NTc1NzUsImV4cCI6MjA5MjIzMzU3NX0.HDy-WoX5ldwnTsfXHecnJwJ72v2jgaPrXwCSjBrmsys';
let _cotizaciones = [];

function cambiarTabCot(tab) {
  const btnNueva = document.getElementById('tabBtnCot');
  const btnHist = document.getElementById('tabBtnHist');
  const tabNueva = document.getElementById('tabCotNueva');
  const tabHist = document.getElementById('tabCotHistorial');
  if (!btnNueva) return;
  if (tab === 'historial') {
    tabNueva.style.display='none'; tabHist.style.display='block';
    btnNueva.style.color='#9E9488'; btnNueva.style.borderBottomColor='transparent';
    btnHist.style.color='#C49A3C'; btnHist.style.borderBottomColor='#C49A3C';
    cargarHistorialCot();
  } else {
    tabNueva.style.display='block'; tabHist.style.display='none';
    btnNueva.style.color='#C49A3C'; btnNueva.style.borderBottomColor='#C49A3C';
    btnHist.style.color='#9E9488'; btnHist.style.borderBottomColor='transparent';
  }
}

async function cargarHistorialCot() {
  const lista = document.getElementById('historialCotLista');
  if (!lista) return;
  lista.innerHTML = '<div style="text-align:center;padding:40px;color:#9E9488">⏳ Cargando...</div>';
  try {
    const res = await fetch(`${_SUPA_URL}/rest/v1/cotizaciones?select=*&order=created_at.desc&limit=100`, {
      headers: { 'apikey': _SUPA_KEY, 'Authorization': 'Bearer ' + _SUPA_KEY }
    });
    _cotizaciones = await res.json();
    renderHistCot(_cotizaciones);
  } catch(e) {
    lista.innerHTML = '<div style="text-align:center;padding:40px;color:#9E9488">⚠️ Error al cargar</div>';
  }
}

function filtrarCotizaciones() {
  const q = (document.getElementById('historialCotBuscar')?.value||'').toLowerCase();
  renderHistCot(q ? _cotizaciones.filter(c=>(c.cliente||'').toLowerCase().includes(q)||(c.numero_cotizacion||'').toLowerCase().includes(q)||(c.vendedor||'').toLowerCase().includes(q)) : _cotizaciones);
}

function renderHistCot(lista) {
  const el = document.getElementById('historialCotLista');
  if (!el) return;
  if (!lista||lista.length===0) { el.innerHTML='<div style="text-align:center;padding:60px;color:#9E9488"><div style="font-size:48px">🗂</div><p>No hay cotizaciones</p></div>'; return; }
  const fH = f => { if(!f)return'—'; return new Date(f+'T12:00:00').toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'}); };
  el.innerHTML = lista.map(c=>`
    <div style="background:#FDFCF9;border-radius:14px;border:1px solid #D4C9B8;margin-bottom:12px;overflow:hidden;cursor:pointer" onclick="verDetCot('${c.id}')">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:#F5F0E8;border-bottom:1px solid #D4C9B8">
        <div><div style="font-family:'Playfair Display',serif;font-size:18px;font-weight:700;color:#C49A3C">${c.numero_cotizacion||'—'}</div>
        <div style="font-size:12px;color:#9E9488">${fH(c.fecha_cotizacion)}</div></div>
        <div style="display:flex;align-items:center;gap:8px">
          <span style="font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;background:${c.enviado_whatsapp?'#D1FAE5':'#FEE2E2'};color:${c.enviado_whatsapp?'#065F46':'#991B1B'}">${c.enviado_whatsapp?'✅ Enviada':'📋 Sin enviar'}</span>
          <button onclick="event.stopPropagation();editarCotizacion('${c.id}')" style="background:#fff;color:#6B4F35;border:1.5px solid #C49A3C;border-radius:20px;padding:4px 12px;font-family:'DM Sans',sans-serif;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap">✏️ Editar</button>
          ${!c.enviado_whatsapp?`<button id="btn-reenv-cot-${c.id}" onclick="event.stopPropagation();reenviarWACot('${c.id}',this)" style="background:#25D366;color:#fff;border:none;border-radius:20px;padding:4px 12px;font-family:'DM Sans',sans-serif;font-size:12px;font-weight:700;cursor:pointer;white-space:nowrap">🔁 Reenviar WA</button>`:''}
        </div>
      </div>
      <div style="padding:14px 18px">
        <div style="font-size:16px;font-weight:600;margin-bottom:6px">👤 ${c.cliente||'Sin nombre'}</div>
        <div style="display:flex;gap:16px;font-size:13px;color:#9E9488">
          ${c.telefono?`<span>📞 ${c.telefono}</span>`:''}${c.vendedor?`<span>🧑 ${c.vendedor}</span>`:''}
        </div>
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid #D4C9B8;display:flex;align-items:center">
          <div><div style="font-size:10px;color:#9E9488;text-transform:uppercase;letter-spacing:1px">Total</div>
          <div style="font-family:'Playfair Display',serif;font-size:15px;font-weight:700">$${Number(c.valor_total||0).toLocaleString('es-CO')}</div></div>
          ${c.pdf_url?`<a href="${c.pdf_url}" target="_blank" onclick="event.stopPropagation()" style="margin-left:auto;background:#C49A3C;color:#1C1A17;padding:6px 14px;border-radius:8px;font-weight:700;font-size:13px;text-decoration:none">📄 PDF</a>`:''}
        </div>
      </div>
    </div>`).join('');
}

/* =========================================================
   REENVIAR WA COTIZACIÓN
   ========================================================= */
async function reenviarWACot(cotId, btn) {
  const textoOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳ Enviando...';

  try {
    const c = _cotizaciones.find(x => x.id === cotId);
    if (!c) throw new Error('Cotización no encontrada');

    const telefono = (c.telefono || '').replace(/\D/g, '');
    if (!telefono) {
      mostrarToast('⚠️ Esta cotización no tiene teléfono guardado');
      btn.disabled = false;
      btn.textContent = textoOriginal;
      return;
    }

    const chatId = (telefono.startsWith('57') ? telefono : '57' + telefono) + '@c.us';
    const productosTxt = (c.productos || [])
      .filter(p => p.desc || p.qty)
      .map(p => p.esDescuento ? `🎁 ${p.desc} — ${p.sub || ''}` : `• ${p.qty || 1}x ${p.desc} — ${p.sub || ''}`)
      .join('\n');

    const mensaje = `🛋️ *CASA DAMS — Cotización ${c.numero_cotizacion || '—'}*\n\nHola ${c.cliente || 'cliente'}, le compartimos la cotización solicitada:\n\n${productosTxt}\n\n💰 *Total:* $${Number(c.valor_total||0).toLocaleString('es-CO')}\n${c.fecha_vencimiento ? `📅 *Válida hasta:* ${new Date(c.fecha_vencimiento+'T12:00:00').toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'})}\n` : ''}${c.pdf_url ? `📄 ${c.pdf_url}` : ''}\n\nQuedamos atentos a su confirmación.\n📍 Cra. 4 N° 49-71, Montería · 📞 321 540 0839`;

    const res = await enviarMensajeWA(chatId, mensaje);
    if (!res.ok) throw new Error('WAHA error');

    // Marcar como enviado en Supabase
    await fetch(`${_SUPA_URL}/rest/v1/cotizaciones?id=eq.${cotId}`, {
      method: 'PATCH',
      headers: { 'Content-Type':'application/json','apikey':_SUPA_KEY,'Authorization':'Bearer '+_SUPA_KEY,'Prefer':'return=minimal' },
      body: JSON.stringify({ enviado_whatsapp: true })
    });

    // Actualizar en memoria
    const idx = _cotizaciones.findIndex(x => x.id === cotId);
    if (idx !== -1) _cotizaciones[idx].enviado_whatsapp = true;

    mostrarToast('✅ WhatsApp enviado correctamente');
    btn.textContent = '✅ Enviado';
    btn.style.background = '#27634A';
    btn.disabled = true;
    renderHistCot(_cotizaciones);

  } catch(e) {
    console.error('Error al reenviar WA cotización:', e);
    mostrarToast('❌ Error al enviar — verifica que WAHA esté activo');
    btn.disabled = false;
    btn.textContent = textoOriginal;
  }
}

function verDetCot(id) {
  const c = _cotizaciones.find(x=>x.id===id);
  if (!c) return;
  const o = document.getElementById('detalleCotOverlay');
  const t = document.getElementById('detalleCotTitulo');
  const cn = document.getElementById('detalleCotContenido');
  if (!o) return;
  t.textContent = `Cotización ${c.numero_cotizacion||'—'}`;
  let ph = '';
  if (c.productos&&c.productos.length>0) {
    ph = `<div style="background:#F5F0E8;border-radius:10px;padding:14px;margin-bottom:16px">${c.productos.filter(p=>!p.esMeta).map(p=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #D4C9B8;font-size:14px"><span>${p.esDescuento ? '' : (p.qty||1)+'x '}${p.desc||'—'}</span><span style="font-weight:600;color:#6B4F35">${p.sub||'—'}</span></div>`).join('')}</div>`;
  }
  cn.innerHTML = `${c.pdf_url?`<a href="${c.pdf_url}" target="_blank" style="display:inline-flex;align-items:center;gap:8px;background:#C49A3C;color:#1C1A17;padding:10px 18px;border-radius:10px;font-weight:700;font-size:14px;text-decoration:none;margin:0 8px 16px 0">📄 Ver PDF</a>`:''}<button onclick="editarCotizacion('${c.id}')" style="display:inline-flex;align-items:center;gap:8px;background:#fff;color:#6B4F35;border:1.5px solid #C49A3C;padding:9px 18px;border-radius:10px;font-weight:700;font-size:14px;cursor:pointer;margin-bottom:16px">✏️ Editar cotización</button>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">
      <div><div style="font-size:10px;font-weight:600;color:#9E9488;letter-spacing:1px;text-transform:uppercase">Cliente</div><div style="font-size:15px">${c.cliente||'—'}</div></div>
      <div><div style="font-size:10px;font-weight:600;color:#9E9488;letter-spacing:1px;text-transform:uppercase">Teléfono</div><div style="font-size:15px">${c.telefono||'—'}</div></div>
      <div><div style="font-size:10px;font-weight:600;color:#9E9488;letter-spacing:1px;text-transform:uppercase">Vendedor</div><div style="font-size:15px">${c.vendedor||'—'}</div></div>
      <div><div style="font-size:10px;font-weight:600;color:#9E9488;letter-spacing:1px;text-transform:uppercase">Total</div><div style="font-family:'Playfair Display',serif;font-size:18px;font-weight:700;color:#27634A">$${Number(c.valor_total||0).toLocaleString('es-CO')}</div></div>
    </div>${ph}`;
  o.style.display='flex';
}
