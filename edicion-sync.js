/* edicion-sync.js
 * Cuando se EDITA una orden de pedido, actualiza también su registro en Secretaría/Gerencial
 * (tabla transacciones). Módulo aparte: no cambia ninguna función existente.
 *
 * Reglas de seguridad:
 *  - Solo actúa si la orden ya está en Secretaría y hay EXACTAMENTE 1 registro unido (por número de orden).
 *  - Nunca toca abonos, fechas, métodos de pago, fotos ni el balance de otras ventas.
 *  - Pide confirmación mostrando "antes → después". Si el usuario dice No, no escribe nada.
 *  - Si algo falla, no rompe el guardado de la orden (el llamador lo envuelve en try/catch).
 *  - Con ?prueba=1 solo muestra lo que haría y NO escribe.
 */
(function (root) {
  'use strict';

  var IVA_NO_USADO = null; // (a propósito: aquí no se calcula IVA ni bonificaciones)

  function fmt(n) {
    return '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');
  }
  function soloDigitos(s) { return String(s == null ? '' : s).replace(/[^0-9]/g, ''); }

  function extrasDe(nota) {
    try {
      var m = String(nota || '').match(/⟦([\s\S]*?)⟧\s*$/);
      return m ? JSON.parse(m[1]) : {};
    } catch (e) { return {}; }
  }

  // Misma regla que usa orden.html al subir a Secretaría
  function conceptoDe(prods, numOrden) {
    var arr = Array.isArray(prods) ? prods : [];
    var d = arr.map(function (p) {
      var q = (p.qty || '').toString().trim();
      var t = (p.desc || '').toString().trim();
      return t ? (q && q !== '1' ? q + ' ' + t : t) : '';
    }).filter(Boolean).join(', ');
    if (!d) d = 'Orden ' + numOrden;
    if (d.length > 250) d = d.slice(0, 247) + '...';
    return d;
  }

  async function get(cfg, path) {
    var r = await fetch(cfg.url + '/rest/v1/' + path, {
      headers: { apikey: cfg.key, Authorization: 'Bearer ' + cfg.key }
    });
    if (!r.ok) throw new Error('GET ' + path.split('?')[0] + ' ' + r.status);
    return r.json();
  }

  async function buscarTx(cfg, numOrden) {
    var cand = await get(cfg, 'transacciones?select=id,monto,abono,estado,vendedor,cliente,telefono,direccion,descripcion,nota,fecha' +
      '&tipo=eq.ingreso&nota=ilike.' + encodeURIComponent('*' + numOrden + '*'));
    var exacto = cand.filter(function (t) {
      var e = extrasDe(t.nota);
      return (e.origenOrden && e.origenOrden === numOrden) || (e.factura && e.factura === numOrden);
    });
    if (exacto.length) return exacto;
    // respaldo: mismo número de factura ignorando formato (ORD/154 vs ORD-154)
    var n = soloDigitos(numOrden);
    return cand.filter(function (t) {
      var e = extrasDe(t.nota);
      return e.factura && soloDigitos(e.factura) && soloDigitos(e.factura) === n;
    });
  }

  /* Calcula qué cambiaría en Secretaría. NO escribe nada.
   * cfg: { url, key }   ctx: { o, datos, totalNum, prodsAntes }
   * Devuelve { motivoNo } si no corresponde, o { tx, cambios[], payload, avisos[] } */
  async function planificar(cfg, ctx) {
    var o = ctx.o, datos = ctx.datos, total = Number(ctx.totalNum) || 0;
    var numOrden = String(o.numero_orden || o.op || '');
    if (!numOrden) return { motivoNo: 'La orden no tiene número.' };

    var txs = await buscarTx(cfg, numOrden);
    if (txs.length === 0) return { motivoNo: 'Esta orden todavía no está en Secretaría (nada que actualizar).' };
    if (txs.length > 1) return { motivoNo: 'Hay ' + txs.length + ' registros en Secretaría para ' + numOrden + '. Por seguridad no se toca ninguno; corrígelo a mano.' };
    var tx = txs[0];

    var cambios = [], avisos = [], payload = {};

    // ── Monto ──
    if (total > 0 && Math.abs(Number(tx.monto) - total) > 0.5) {
      payload.monto = total;
      cambios.push(['Monto', fmt(tx.monto), fmt(total)]);
    }

    // ── Datos de texto (solo si hay valor nuevo y es distinto) ──
    var campos = [['vendedor', 'Vendedor'], ['cliente', 'Cliente'], ['telefono', 'Teléfono'], ['direccion', 'Dirección']];
    campos.forEach(function (c) {
      var nuevo = (datos[c[0]] || '').toString().trim();
      var viejo = (tx[c[0]] || '').toString().trim();
      if (nuevo && nuevo !== viejo) {
        payload[c[0]] = nuevo;
        cambios.push([c[1], viejo || '—', nuevo]);
      }
    });

    // ── Concepto: solo si era el generado automáticamente por la orden anterior ──
    var conceptoAntes = conceptoDe(ctx.prodsAntes, numOrden);
    var conceptoNuevo = conceptoDe(o.productos, numOrden);
    if ((tx.descripcion || '').trim() === conceptoAntes.trim() && conceptoNuevo !== conceptoAntes) {
      payload.descripcion = conceptoNuevo;
      cambios.push(['Concepto (lista de productos)', 'se actualiza para que coincida con la orden', '']);
    }

    // ── Estado y saldo: misma regla que Secretaría (abonos_cartera = fuente de verdad) ──
    var filas = await get(cfg, 'abonos_cartera?select=monto&transaccion_id=eq.' + tx.id);
    var abonado = null;
    if (filas.length > 0) abonado = filas.reduce(function (s, a) { return s + Number(a.monto); }, 0);
    else if (Number(tx.abono) > 0) abonado = Number(tx.abono);

    var nuevoMonto = payload.monto != null ? payload.monto : Number(tx.monto);
    var estadosConocidos = ['pagado', 'abono', 'pendiente'];
    var saldoNuevo = null;
    if (abonado !== null && estadosConocidos.indexOf(tx.estado) >= 0) {
      var estadoNuevo = abonado >= nuevoMonto - 0.01 ? 'pagado' : (abonado > 0 ? 'abono' : 'pendiente');
      saldoNuevo = Math.max(0, nuevoMonto - abonado);
      if (estadoNuevo !== tx.estado) {
        payload.estado = estadoNuevo;
        cambios.push(['Estado', tx.estado, estadoNuevo]);
      }
      if (abonado > nuevoMonto + 0.5) {
        avisos.push('El cliente ya abonó ' + fmt(abonado) + ', más que el nuevo total ' + fmt(nuevoMonto) + '. Habría que devolver ' + fmt(abonado - nuevoMonto) + ' o pasarlo a otro artículo (se maneja aparte; aquí no se toca ningún abono).');
      }
    } else if (payload.monto != null) {
      avisos.push('No hay abonos registrados que permitan recalcular el estado; el estado actual (' + (tx.estado || '—') + ') se deja igual.');
    }

    if (cambios.length === 0) return { motivoNo: 'Secretaría ya tiene estos mismos datos (nada que actualizar).' };

    // ── Nota con extras ⟦JSON⟧: se mantienen todas las llaves y solo se ajustan estas ──
    if (typeof tx.nota === 'string' && tx.nota.indexOf('⟦') >= 0) {
      var extras = extrasDe(tx.nota);
      if (payload.cliente) extras.cliente = payload.cliente;
      if (payload.telefono) extras.telefono = payload.telefono;
      if (payload.direccion) extras.direccion = payload.direccion;
      if (saldoNuevo !== null) extras.saldo = saldoNuevo;
      extras.ultimaEdicionOrden = {
        fecha: new Date().toISOString(),
        montoAnterior: Number(tx.monto),
        montoNuevo: nuevoMonto
      };
      payload.nota = tx.nota.replace(/⟦[\s\S]*?⟧\s*$/, '⟦' + JSON.stringify(extras) + '⟧');
    }

    return { tx: tx, cambios: cambios, payload: payload, avisos: avisos, numOrden: numOrden };
  }

  async function aplicar(cfg, plan) {
    var r = await fetch(cfg.url + '/rest/v1/transacciones?id=eq.' + plan.tx.id, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json', apikey: cfg.key,
        Authorization: 'Bearer ' + cfg.key, Prefer: 'return=minimal'
      },
      body: JSON.stringify(plan.payload)
    });
    return r.ok;
  }

  /* Flujo completo con el usuario. Devuelve texto corto con lo que pasó (o '' si nada). */
  async function sincronizar(args) {
    var cfg = { url: args.url, key: args.key };
    var plan = await planificar(cfg, args);
    if (plan.motivoNo) { console.info('[EdicionSync]', plan.motivoNo); return plan.motivoNo; }

    var lineas = plan.cambios.map(function (c) { return '  • ' + c[0] + ': ' + c[1] + '  →  ' + c[2]; }).join('\n');
    var avisos = plan.avisos.length ? '\n\n⚠️ ' + plan.avisos.join('\n⚠️ ') : '';
    var msg = '¿Actualizar también SECRETARÍA y GERENCIAL con estos cambios de la orden ' + plan.numOrden + '?\n\n' +
      lineas + avisos +
      '\n\nNo se tocan abonos, fechas, métodos de pago ni fotos.' +
      '\n\nAceptar = actualizar Secretaría.\nCancelar = solo queda guardada la orden (Secretaría igual).';

    if (args.prueba) {
      alert('🧪 MODO PRUEBA — no se guardó nada en Secretaría.\n\n' + msg);
      return 'prueba';
    }
    if (!confirm(msg)) return 'cancelado';

    var ok = await aplicar(cfg, plan);
    if (!ok) {
      alert('⚠️ La orden se guardó, pero NO se pudo actualizar Secretaría. Corrígelo a mano allá.');
      return 'error';
    }
    return 'ok';
  }

  var api = { sincronizar: sincronizar, _planificar: planificar, _conceptoDe: conceptoDe, _extrasDe: extrasDe };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.EdicionSync = api;
})(typeof window !== 'undefined' ? window : globalThis);
