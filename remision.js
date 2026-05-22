const SUPA_URL = 'https://pqpzhmopnigxyacwdjbc.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxcHpobW9wbmlneHlhY3dkamJjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY2NTc1NzUsImV4cCI6MjA5MjIzMzU3NX0.HDy-WoX5ldwnTsfXHecnJwJ72v2jgaPrXwCSjBrmsys';
let fotoEntregaDataUrl = null;

/* =========================================================
   REMISIÓN — Lógica
   ========================================================= */

let items = []; // [{id, qty, desc}]

/* ---------- INIT ---------- */
window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('fechaEntrega').value = today();

  const num = getContador('remision_num', 1);
  document.getElementById('numeroRemision').value = formatNumRem(num);
  document.getElementById('displayNumero').textContent = formatNumRem(num);

  // 2 filas iniciales
  agregarFila();
  agregarFila();

  // Listeners
  document.getElementById('numeroRemision').addEventListener('input', e => {
    document.getElementById('displayNumero').textContent = e.target.value || '—';
  });

  // Firmas
  initFirma('firmaComprador');
  initFirma('firmaVendedor');

  // Detectar firma del comprador para animar stamp
  const fc = document.getElementById('firmaComprador');
  let mouseup = () => {
    const hasFirma = !!getFirmaDataURL('firmaComprador');
    const stamp = document.getElementById('entregaStamp');
    if (hasFirma) {
      if (!stamp.classList.contains('firmado')) stamp.classList.add('firmado');
    } else {
      stamp.classList.remove('firmado');
    }
  };
  fc.addEventListener('mouseup', mouseup);
  fc.addEventListener('touchend', mouseup);

  // Modal close
  document.getElementById('modalWA').addEventListener('click', function(e) {
    if (e.target === this) cerrarModal();
  });

  // Enter en orden ref para cargar
  document.getElementById('ordenRef').addEventListener('keypress', e => {
    if (e.key === 'Enter') { e.preventDefault(); cargarDesdeOrden(); }
  });
});

function formatNumRem(n) {
  return 'REM-' + String(n).padStart(4, '0');
}

/* ---------- MUEBLES — igual que orden.html ---------- */
let filaCounter = 1;
let filas = [];
let fotosPorFila = {};
let fotoTargetFila = null;

function agregarFila() {
  const id = filaCounter++;
  filas.push(id);
  const body = document.getElementById('productosBody');
  const row = document.createElement('div');
  row.className = 'producto-row';
  row.id = 'fila-' + id;
  row.innerHTML = `
    <input type="number" placeholder="1" min="1" value="1" class="qty-rem-${id}">
    <div style="display:flex;flex-direction:column;gap:4px">
      <input type="text" placeholder="Ej: Cama Montaña 140x190 — color negro" class="desc-rem-${id}">
      <div onclick="abrirFotoRem(${id})" id="fotobtn-rem-${id}" style="display:inline-flex;align-items:center;gap:5px;cursor:pointer;padding:3px 8px;border:1px dashed #D4C9B8;border-radius:6px;font-size:11px;color:#9E9488;width:fit-content">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        <span id="fototxt-rem-${id}">+ Foto mueble</span>
      </div>
    </div>
    <button class="btn-delete-row" onclick="eliminarFilaRem(${id})" title="Eliminar">✕</button>
  `;
  body.appendChild(row);
}

function eliminarFilaRem(id) {
  const row = document.getElementById('fila-' + id);
  if (row) row.remove();
  filas = filas.filter(f => f !== id);
  delete fotosPorFila[id];
}

function updateItem(id, campo, valor) { /* compatibilidad */ }

function abrirFotoRem(id) {
  fotoTargetFila = id;
  document.getElementById('fotoItemInput').click();
}

function actualizarContador() {
  const badge = document.getElementById('contadorBadge');
  if (badge) badge.textContent = `${filas.length} items`;
}

function escapeAttr(v) {
  return String(v ?? '').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/* ---------- CARGAR DESDE ORDEN (SUPABASE) ---------- */
async function cargarDesdeOrden() {
  const num = document.getElementById('ordenRef').value.trim();
  if (!num) { mostrarToast('⚠ Ingresa un N° de orden'); return; }

  const btn = document.getElementById('btnCargarOrden');
  btn.classList.add('loading');
  btn.disabled = true;

  try {
    const res = await fetch(`${SUPA_URL}/rest/v1/pedidos?numero_orden=eq.${encodeURIComponent(num)}&select=*&order=created_at.desc&limit=1`, {
      headers: {
        'apikey': SUPA_KEY,
        'Authorization': 'Bearer ' + SUPA_KEY
      }
    });
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) {
      mostrarToast('⚠ No se encontró la orden ' + num);
      const refInfo = document.getElementById('refInfo');
      refInfo.classList.remove('show');
      return;
    }

    const orden = data[0];

    // Rellenar campos del cliente
    if (orden.cliente) document.getElementById('clienteNombre').value = orden.cliente;
    if (orden.direccion) document.getElementById('clienteDireccion').value = orden.direccion;
    if (orden.ciudad) document.getElementById('clienteCiudad').value = orden.ciudad;
    if (orden.cedula) document.getElementById('clienteCC').value = orden.cedula;
    if (orden.telefono) document.getElementById('clienteTel').value = orden.telefono;
    if (orden.vendedor) document.getElementById('vendedor').value = orden.vendedor;

    // Cargar productos (sin precios)
    filas = []; filaCounter = 1; fotosPorFila = {};
    document.getElementById('productosBody').innerHTML = '';
    if (Array.isArray(orden.productos) && orden.productos.length > 0) {
      const productosOrden = orden.productos.filter(p => p.qty || p.desc);
      if (productosOrden.length === 0) {
        agregarFila();
      } else {
        productosOrden.forEach(p => {
          const id = filaCounter++;
          filas.push(id);
          const body = document.getElementById('productosBody');
          const row = document.createElement('div');
          row.className = 'producto-row';
          row.id = 'fila-' + id;
          row.innerHTML = `
            <input type="number" placeholder="1" min="1" value="${p.qty || 1}" class="qty-rem-${id}">
            <div style="display:flex;flex-direction:column;gap:4px">
              <input type="text" placeholder="Descripción..." value="${p.desc || ''}" class="desc-rem-${id}">
              <div onclick="abrirFotoRem(${id})" id="fotobtn-rem-${id}" style="display:inline-flex;align-items:center;gap:5px;cursor:pointer;padding:3px 8px;border:1px dashed #D4C9B8;border-radius:6px;font-size:11px;color:#9E9488;width:fit-content">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                <span id="fototxt-rem-${id}">+ Foto mueble</span>
              </div>
            </div>
            <button class="btn-delete-row" onclick="eliminarFilaRem(${id})">✕</button>
          `;
          body.appendChild(row);
        });
      }
    } else {
      agregarFila();
    }

    // Mostrar info de referencia
    const refInfo = document.getElementById('refInfo');
    const refText = document.getElementById('refInfoText');
    refText.innerHTML = `✓ Orden <strong>${num}</strong> cargada · Cliente: <strong>${orden.cliente || '—'}</strong>`;
    refInfo.classList.add('show');

    mostrarToast('✓ Datos cargados desde orden ' + num);
  } catch (e) {
    console.error(e);
    mostrarToast('✗ Error al cargar — revisa la conexión');
  } finally {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

/* ---------- DATOS ---------- */
function getDatos() {
  return {
    numero: document.getElementById('numeroRemision').value || '—',
    fecha: document.getElementById('fechaEntrega').value,
    vendedor: document.getElementById('vendedor').value,
    ordenRef: document.getElementById('ordenRef').value,
    nombre: document.getElementById('clienteNombre').value,
    direccion: document.getElementById('clienteDireccion').value,
    ciudad: document.getElementById('clienteCiudad').value,
    cc: document.getElementById('clienteCC').value,
    tel: document.getElementById('clienteTel').value,
    observaciones: document.getElementById('observaciones').value
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

  // ====== HEADER ======
  doc.setFillColor(28, 26, 23);
  doc.rect(0, 0, W, 40, 'F');

  // Logo
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

  // Caja N° remisión
  doc.setFillColor(196, 154, 60);
  doc.roundedRect(W - 70, 8, 55, 24, 3, 3, 'F');
  doc.setTextColor(28, 26, 23);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('REMISIÓN', W - 42.5, 14, { align: 'center' });
  doc.setFontSize(15);
  doc.text(d.numero, W - 42.5, 22, { align: 'center' });
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.text(formatDate(d.fecha), W - 42.5, 28, { align: 'center' });

  let y = 48;

  // ====== TITULO ENTREGA ======
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(28, 26, 23);
  doc.text('Acta de Entrega', margin, y);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(158, 148, 136);
  doc.text('Documento de entrega de mercancía · Firma de conformidad', margin, y + 5);
  if (d.ordenRef) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(196, 154, 60);
    doc.text(`REF. ORDEN N° ${d.ordenRef}`, W - margin, y, { align: 'right' });
  }
  doc.setDrawColor(196, 154, 60);
  doc.setLineWidth(0.5);
  doc.line(margin, y + 9, margin + contentW, y + 9);

  y += 16;

  // ====== DATOS CLIENTE ======
  doc.setFillColor(245, 240, 232);
  doc.rect(margin, y, contentW, 30, 'F');
  doc.setDrawColor(212, 201, 184);
  doc.setLineWidth(0.3);
  doc.rect(margin, y, contentW, 30);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(107, 79, 53);
  doc.text('SE HACE ENTREGA A', margin + 4, y + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(28, 26, 23);
  doc.text(d.nombre || '—', margin + 4, y + 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(80, 70, 60);
  doc.text('Dirección: ' + (d.direccion || '—') + (d.ciudad ? ' · ' + d.ciudad : ''), margin + 4, y + 19);
  const linea2 = [d.tel && 'Tel. ' + d.tel, d.cc && 'C.C. ' + d.cc].filter(Boolean).join('  ·  ');
  if (linea2) doc.text(linea2, margin + 4, y + 24);

  y += 38;

  // ====== TABLA PRODUCTOS ======
  const colW = { cant: 30, desc: contentW - 30 };
  const colX = { cant: margin, desc: margin + 30 };

  // Header
  doc.setFillColor(28, 26, 23);
  doc.rect(margin, y, contentW, 10, 'F');
  doc.setTextColor(196, 154, 60);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('CANT.', colX.cant + colW.cant / 2, y + 6.5, { align: 'center' });
  doc.text('DESCRIPCIÓN DEL MUEBLE ENTREGADO', colX.desc + 4, y + 6.5);
  y += 10;

  // Filas
  const itemsValidos = filas.map(id => ({
    qty: document.querySelector('.qty-rem-' + id)?.value || '1',
    desc: document.querySelector('.desc-rem-' + id)?.value || '',
    photo: fotosPorFila[id] || null
  })).filter(i => i.desc);
  const minRows = 6;
  const totalRows = Math.max(itemsValidos.length, minRows);
  const rowH = 11;

  for (let i = 0; i < totalRows; i++) {
    const it = itemsValidos[i] || {};
    if (i % 2 === 0) doc.setFillColor(253, 252, 249);
    else doc.setFillColor(245, 240, 232);
    doc.rect(margin, y, contentW, rowH, 'F');

    if (it.qty || it.desc) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(107, 79, 53);
      doc.text(String(it.qty || ''), colX.cant + colW.cant / 2, y + 7.5, { align: 'center' });
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(28, 26, 23);
      const descLines = doc.splitTextToSize(it.desc || '', colW.desc - 8);
      doc.text(descLines.slice(0, 1), colX.desc + 4, y + 7.5);
    }

    // Línea
    doc.setDrawColor(212, 201, 184);
    doc.setLineWidth(0.2);
    doc.line(margin, y + rowH, margin + contentW, y + rowH);
    // Separador vertical entre col qty y desc
    doc.line(colX.desc, y, colX.desc, y + rowH);
    y += rowH;
  }

  // Borde tabla
  doc.setDrawColor(28, 26, 23);
  doc.setLineWidth(0.4);
  doc.rect(margin, y - totalRows * rowH - 10, contentW, totalRows * rowH + 10);

  y += 6;

  // ====== OBSERVACIONES ======
  if (d.observaciones) {
    const obsLines = doc.splitTextToSize(d.observaciones, contentW - 12);
    const obsH = Math.max(20, obsLines.length * 4.5 + 12);
    doc.setFillColor(253, 252, 249);
    doc.rect(margin, y, contentW, obsH, 'F');
    doc.setDrawColor(212, 201, 184);
    doc.setLineWidth(0.3);
    doc.rect(margin, y, contentW, obsH);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(107, 79, 53);
    doc.text('OBSERVACIONES', margin + 4, y + 6);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(28, 26, 23);
    doc.text(obsLines, margin + 4, y + 11);
    y += obsH + 4;
  }

  // ====== NOTA ======
  doc.setFillColor(254, 247, 230);
  doc.rect(margin, y, contentW, 14, 'F');
  doc.setDrawColor(196, 154, 60);
  doc.setLineWidth(0.4);
  doc.rect(margin, y, contentW, 14);
  // Banda izquierda
  doc.setFillColor(196, 154, 60);
  doc.rect(margin, y, 1.5, 14, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(28, 26, 23);
  doc.text('NOTA IMPORTANTE', margin + 5, y + 5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(80, 65, 50);
  doc.text('Favor verificar la cantidad y el buen estado de su pedido. Pasadas 48 horas de recibida la mercancía', margin + 5, y + 9);
  doc.text('no aceptamos reclamos ni devoluciones.', margin + 5, y + 12);
  y += 18;

  // ====== FIRMAS ======
  // Asegurar espacio
  if (y + 40 > H - 15) { doc.addPage(); y = 20; }

  const firmaW = (contentW - 10) / 2;

  // Comprador
  doc.setFillColor(245, 240, 232);
  doc.rect(margin, y, firmaW, 36, 'F');
  doc.setDrawColor(212, 201, 184);
  doc.setLineWidth(0.4);
  doc.rect(margin, y, firmaW, 36);

  // ENTREGADO stamp
  doc.setDrawColor(39, 99, 74);
  doc.setLineWidth(1);
  doc.rect(margin + 2, y + 2, 30, 9, 'S');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(39, 99, 74);
  doc.text('ENTREGADO', margin + 17, y + 8, { align: 'center' });

  // Firma comprador
  const firmaComp = getFirmaDataURL('firmaComprador');
  if (firmaComp) {
    try { doc.addImage(firmaComp, 'PNG', margin + 4, y + 12, firmaW - 8, 16); } catch (e) {}
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(107, 79, 53);
  doc.text('FIRMA Y C.C. DEL COMPRADOR', margin + firmaW / 2, y + 35, { align: 'center' });

  // Vendedor
  const firmaVX = margin + firmaW + 10;
  doc.setFillColor(245, 240, 232);
  doc.rect(firmaVX, y, firmaW, 36, 'F');
  doc.setDrawColor(212, 201, 184);
  doc.rect(firmaVX, y, firmaW, 36);

  const firmaVen = getFirmaDataURL('firmaVendedor');
  if (firmaVen) {
    try { doc.addImage(firmaVen, 'PNG', firmaVX + 4, y + 6, firmaW - 8, 22); } catch (e) {}
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(107, 79, 53);
  doc.text('FIRMA DE QUIEN ENTREGA - CASA DAMS', firmaVX + firmaW / 2, y + 35, { align: 'center' });

  return doc;
}

async function descargarPDF() {
  try {
    mostrarToast('⏳ Generando PDF...');
    const doc = await generarPDFBlob();
    const d = getDatos();
    doc.save(`Remision_CasaDams_${d.numero}.pdf`);
    mostrarToast('✓ PDF descargado');
    const num = parseInt(d.numero.replace(/\D/g, ''));
    if (!isNaN(num)) setContador('remision_num', num);
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
    const fileName = `Remision_CasaDams_${d.numero}_${Date.now()}.pdf`;

    mostrarToast('⏳ Subiendo PDF...');
    const pdfLink = await subirPDFaSupabase(pdfBlob, fileName, 'ordenes');

    mostrarToast('⏳ Enviando por WhatsApp...');
    const chatId = numero + '@c.us';
    const itemsTxt = filas
      .map(id => ({ qty: document.querySelector('.qty-rem-' + id)?.value || '1', desc: document.querySelector('.desc-rem-' + id)?.value || '' }))
      .filter(i => i.desc)
      .map(i => `• ${i.qty}x ${i.desc}`)
      .join('\n');

    const mensaje = `🛋️ *CASA DAMS — Remisión ${d.numero}*

Hola ${d.nombre || 'cliente'}, le compartimos la remisión de entrega:

📦 *Muebles entregados:*
${itemsTxt}

📅 *Fecha de entrega:* ${formatDate(d.fecha)}
${pdfLink ? `\n📄 ${pdfLink}` : ''}

⚠ Favor verificar cantidad y buen estado. Pasadas 48 horas no aceptamos reclamos ni devoluciones.

¡Gracias por su compra!
📍 Cra. 4 N° 49-71, Montería · 📞 321 540 0839`;

    const res = await enviarMensajeWA(chatId, mensaje);
    if (res.ok) {
      try {
        const d2 = getDatos();
        await fetch(`${SUPA_URL}/rest/v1/remisiones`, {
          method: 'POST',
          headers: { 'Content-Type':'application/json','apikey':SUPA_KEY,'Authorization':'Bearer '+SUPA_KEY,'Prefer':'return=minimal' },
          body: JSON.stringify({
            numero_remision: d2.numero,
            orden_ref: d2.ordenRef || '',
            cliente: d2.nombre || '',
            telefono: d2.tel || '',
            cedula: d2.cc || '',
            direccion: d2.direccion || '',
            ciudad: d2.ciudad || '',
            fecha_entrega: d2.fecha || new Date().toISOString().split('T')[0],
            vendedor: d2.vendedor || '',
            items: filas.map(id => ({ qty: document.querySelector('.qty-rem-' + id)?.value || '1', desc: document.querySelector('.desc-rem-' + id)?.value || '' })).filter(i => i.desc),
            observaciones: d2.observaciones || '',
            foto_url: fotoEntregaDataUrl ? 'local' : '',
            pdf_url: pdfLink || '',
            enviado_whatsapp: true
          })
        });
      } catch(e) { console.warn('No se pudo guardar en Supabase:', e); }
      mostrarToast(pdfLink ? '✓ Remisión enviada con PDF' : '✓ Mensaje enviado');
    } else {
      throw new Error('WAHA error');
    }
  } catch (e) {
    console.error(e);
    mostrarToast('⚠ Abriendo WhatsApp directamente...');
    const d = getDatos();
    const msg = `🛋️ *CASA DAMS - Remisión ${d.numero}*\n\n👤 ${d.nombre || '—'}\n📅 Entrega: ${formatDate(d.fecha)}\n\n¡Gracias por su compra!`;
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(msg)}`, '_blank');
  }
}

/* ---------- NUEVA ---------- */
function nuevaRemision() {
  if (!confirm('¿Crear nueva remisión? Se perderán los datos actuales.')) return;

  const current = parseInt(document.getElementById('numeroRemision').value.replace(/\D/g, '')) || 1;
  const next = current + 1;
  setContador('remision_num', next);

  document.getElementById('numeroRemision').value = formatNumRem(next);
  document.getElementById('displayNumero').textContent = formatNumRem(next);
  document.getElementById('fechaEntrega').value = today();
  document.getElementById('vendedor').value = '';
  document.getElementById('ordenRef').value = '';
  document.getElementById('clienteNombre').value = '';
  document.getElementById('clienteDireccion').value = '';
  document.getElementById('clienteCiudad').value = '';
  document.getElementById('clienteCC').value = '';
  document.getElementById('clienteTel').value = '';
  document.getElementById('observaciones').value = '';

  filas = []; filaCounter = 1; fotosPorFila = {};
  document.getElementById('productosBody').innerHTML = '';
  agregarFila(); agregarFila();

  limpiarFirma('firmaComprador');
  limpiarFirma('firmaVendedor');
  document.getElementById('entregaStamp').classList.remove('firmado');
  document.getElementById('refInfo').classList.remove('show');

  mostrarToast('✓ Nueva remisión lista');
}


/* =========================================================
   FOTO DE ENTREGA
   ========================================================= */
function cargarFotoEntrega(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    fotoEntregaDataUrl = e.target.result;
    const preview = document.getElementById('fotoEntregaPreview');
    const placeholder = document.getElementById('fotoEntregaPlaceholder');
    const btnQuitar = document.getElementById('btnQuitarFoto');
    const wrap = document.getElementById('fotoEntregaWrap');
    preview.src = fotoEntregaDataUrl;
    preview.style.display = 'block';
    placeholder.style.display = 'none';
    btnQuitar.style.display = 'inline-block';
    wrap.style.border = '2px solid var(--gold)';
  };
  reader.readAsDataURL(file);
}

function quitarFotoEntrega() {
  fotoEntregaDataUrl = null;
  document.getElementById('fotoEntregaPreview').style.display = 'none';
  document.getElementById('fotoEntregaPreview').src = '';
  document.getElementById('fotoEntregaPlaceholder').style.display = 'block';
  document.getElementById('btnQuitarFoto').style.display = 'none';
  document.getElementById('fotoEntregaWrap').style.border = '2px dashed var(--border)';
  document.getElementById('fotoEntregaInput').value = '';
}

/* =========================================================
   HISTORIAL DE REMISIONES
   ========================================================= */
let todasLasRemisiones = [];

async function cargarHistorialRemisiones() {
  const lista = document.getElementById('historialRemLista');
  if (!lista) return;
  lista.innerHTML = '<div style="text-align:center;padding:40px;color:var(--warm-gray)">⏳ Cargando...</div>';
  try {
    const res = await fetch(`${SUPA_URL}/rest/v1/remisiones?select=*&order=created_at.desc&limit=100`, {
      headers: { 'apikey': SUPA_KEY, 'Authorization': 'Bearer ' + SUPA_KEY }
    });
    if (!res.ok) throw new Error('Error');
    const data = await res.json();
    todasLasRemisiones = data;
    renderRemisiones(data);
  } catch(e) {
    lista.innerHTML = '<div style="text-align:center;padding:40px;color:var(--warm-gray)">⚠️ No se pudo cargar el historial</div>';
  }
}

function filtrarRemisiones() {
  const q = (document.getElementById('historialRemBuscar')?.value || '').toLowerCase().trim();
  if (!q) { renderRemisiones(todasLasRemisiones); return; }
  renderRemisiones(todasLasRemisiones.filter(r =>
    (r.cliente||'').toLowerCase().includes(q) ||
    (r.numero_remision||'').toLowerCase().includes(q) ||
    (r.telefono||'').includes(q) ||
    (r.vendedor||'').toLowerCase().includes(q)
  ));
}

function formatFechaR(f) { if(!f)return'—'; return new Date(f+'T12:00:00').toLocaleDateString('es-CO',{day:'2-digit',month:'short',year:'numeric'}); }

function renderRemisiones(lista) {
  const el = document.getElementById('historialRemLista');
  if (!el) return;
  if (!lista || lista.length === 0) {
    el.innerHTML = '<div style="text-align:center;padding:60px 20px;color:var(--warm-gray)"><div style="font-size:48px;margin-bottom:12px">🗂</div><p>No hay remisiones guardadas</p></div>';
    return;
  }
  el.innerHTML = lista.map(r => `
    <div style="background:var(--white);border-radius:14px;border:1px solid #D4C9B8;margin-bottom:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.04)">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:var(--cream);border-bottom:1px solid #D4C9B8">
        <div>
          <div style="font-family:'Playfair Display',serif;font-size:18px;font-weight:700;color:#C49A3C">${r.numero_remision||'—'}</div>
          <div style="font-size:12px;color:#9E9488">${formatFechaR(r.fecha_entrega||r.created_at)}</div>
        </div>
        <span style="font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;background:${r.enviado_whatsapp?'#D1FAE5':'#FEE2E2'};color:${r.enviado_whatsapp?'#065F46':'#991B1B'}">
          ${r.enviado_whatsapp?'✅ Enviada':'📋 Sin enviar'}
        </span>
      </div>
      <div style="padding:14px 18px">
        <div style="font-size:16px;font-weight:600;margin-bottom:6px">👤 ${r.cliente||'Sin nombre'}</div>
        <div style="display:flex;gap:20px;flex-wrap:wrap;font-size:13px;color:#9E9488">
          ${r.telefono?`<span>📞 ${r.telefono}</span>`:''}
          ${r.vendedor?`<span>🧑 ${r.vendedor}</span>`:''}
          ${r.direccion?`<span>📍 ${r.direccion}</span>`:''}
        </div>
        ${r.pdf_url?`<div style="margin-top:10px"><a href="${r.pdf_url}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;background:#C49A3C;color:#1C1A17;padding:6px 14px;border-radius:8px;font-weight:700;font-size:13px;text-decoration:none">📄 Ver PDF</a></div>`:''}
      </div>
    </div>
  `).join('');
}

function cambiarTabRem(tab) {
  const nueva = document.getElementById('tabRemNueva');
  const hist = document.getElementById('tabRemHistorial');
  const btnNueva = document.getElementById('tabBtnRem');
  const btnHist = document.getElementById('tabBtnHistRem');
  if (tab === 'historial') {
    nueva.style.display = 'none';
    hist.style.display = 'block';
    btnNueva.style.color = '#9E9488'; btnNueva.style.borderBottomColor = 'transparent';
    btnHist.style.color = '#C49A3C'; btnHist.style.borderBottomColor = '#C49A3C';
    cargarHistorialRemisiones();
  } else {
    nueva.style.display = 'block';
    hist.style.display = 'none';
    btnNueva.style.color = '#C49A3C'; btnNueva.style.borderBottomColor = '#C49A3C';
    btnHist.style.color = '#9E9488'; btnHist.style.borderBottomColor = 'transparent';
  }
}
