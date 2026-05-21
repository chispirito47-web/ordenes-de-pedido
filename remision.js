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

/* ---------- PRODUCTOS ---------- */
function agregarFila() {
  const id = Date.now() + Math.random().toString(36).slice(2, 5);
  items.push({ id, qty: '', desc: '' });
  renderItems();
  setTimeout(() => {
    const el = document.querySelector(`[data-iid="${id}"] input.qty-input`);
    if (el) el.focus();
  }, 50);
}

function eliminarFila(id) {
  items = items.filter(i => i.id !== id);
  renderItems();
}

function updateItem(id, campo, valor) {
  const it = items.find(i => i.id === id);
  if (!it) return;
  it[campo] = valor;
  actualizarContador();
}

function renderItems() {
  const body = document.getElementById('productosBody');
  body.innerHTML = '';
  items.forEach(it => {
    const row = document.createElement('div');
    row.className = 'producto-row';
    row.dataset.iid = it.id;
    row.innerHTML = `
      <input type="number" class="qty-input" min="1" placeholder="1" value="${escapeAttr(it.qty)}" oninput="updateItem('${it.id}', 'qty', this.value)">
      <input type="text" placeholder="Ej: Sillas barra Montaña — color negro" value="${escapeAttr(it.desc)}" oninput="updateItem('${it.id}', 'desc', this.value)">
      <button class="btn-delete-row" onclick="eliminarFila('${it.id}')" title="Eliminar">✕</button>
    `;
    body.appendChild(row);
  });
  actualizarContador();
}

function actualizarContador() {
  const total = items.filter(i => i.qty || i.desc).length;
  const cantTotal = items.reduce((acc, i) => acc + (parseInt(i.qty) || 0), 0);
  const badge = document.getElementById('contadorBadge');
  if (badge) badge.textContent = cantTotal > 0 ? `${cantTotal} ${cantTotal === 1 ? 'unidad' : 'unidades'}` : `${total} items`;
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
    if (Array.isArray(orden.productos) && orden.productos.length > 0) {
      items = orden.productos
        .filter(p => p.qty || p.desc)
        .map(p => ({
          id: Date.now() + Math.random().toString(36).slice(2, 5),
          qty: p.qty || '',
          desc: p.desc || ''
        }));
      if (items.length === 0) {
        agregarFila();
      } else {
        renderItems();
      }
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
  const itemsValidos = items.filter(i => i.qty || i.desc);
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
    const itemsTxt = items
      .filter(i => i.qty || i.desc)
      .map(i => `• ${i.qty || 1}x ${i.desc}`)
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

  items = [];
  agregarFila(); agregarFila();

  limpiarFirma('firmaComprador');
  limpiarFirma('firmaVendedor');
  document.getElementById('entregaStamp').classList.remove('firmado');
  document.getElementById('refInfo').classList.remove('show');

  mostrarToast('✓ Nueva remisión lista');
}
