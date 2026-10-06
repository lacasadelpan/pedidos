// app.js — v5 (01/10/2026): nombres exactos del catálogo, fecha local, fechaISO/panDomingo, Repetir con data-producto, respuesta real del servidor
// La URL del Apps Script viene de config.js (un archivo por entorno). Si no existe, se usa la de PRUEBAS.
var SCRIPT_URL = (window.SALMARFER_CONFIG && window.SALMARFER_CONFIG.SCRIPT_URL) || 'https://script.google.com/macros/s/AKfycbzGYLahIhYRcXaf0nvOqVO_lR-QmcUX1qRq5ArD_o-bJICMlZ9aquo_lRTE8qCVz5Uw/exec';
var MAX_HISTORIAL = 5;
var DURACION_CD = 10 * 60; // 10 minutos en segundos

// Nombres EXACTOS del 📋 Catálogo (con tildes). Si cambias el catálogo, cambia también esta lista.
var FAMILIAS = {
  'Bollos': ['Bollo Grande','Bollo Grande Picado','Bollo de Pellizco','Bollo Mediano','Bollo Mediano Liado','Bollo Chico','Bollo Chico Liado','Bollo 1/2 Kg','Bollo 1 Kg','Bollo Mini Hosteler\u00eda','Bollo Mini Hosteler\u00eda Liado'],
  'Integrales': ['Integral Chico','Integral Grande','Integral Multicereales Chico','Integral Multicereales Grande','Integral Nueces Chico','Integral Nueces Grande','Integral Pipas de Calabaza Chico','Integral Pipas de Calabaza Grande','Integral Chico Cuadrado','Integral Grande Cuadrado'],
  'Molletes': ['Mollete Chico','Mollete Grande','Mollete Extra','Mollete Chico Cuadrado','Mollete Grande Cuadrado','Yeye Barra 350','Yeye Barra','Yeye','Yeye Mini','Mollete Redondo Extra'],
  'Prieto': ['Prieto Chapata Grande','Prieto Pepito An\u00eds','Prieto Pepito Ajonjol\u00ed','Prieto Mediano Ajonjol\u00ed','Prieto Grande','Prieto Grande Ajonjol\u00ed','Prieto Pepito','Prieto Mediano','Prieto Chapata Mediano','Prieto Pepito Mini'],
  'Panader\u00eda': ['Pan de Pueblo','Barra R\u00fastica','Baguette','Hallulla 500gr','Hallulla Grande Sabores','Hallulla Grande','Hallulla','Pan de Pueblo 1 Kg','Pan de Pueblo 1,5 Kg','Pan de Aceituna'],
  'Especiales': ['Brioche Molde','Burguer 150','Burguer 115','Burguer Cerveza','Chatocao 125']
};

var cliente = '';
var cantidades = {};
var esDomingo = false;
var enviando = false;
var toastTimer = null;

// Cuenta atras
var cdTimer = null;
var cdSegundosRestantes = 0;
var cdPayloadPendiente = null;
var cdLineasPendientes = null;
var cdFechaPendiente = null;

function init() {
  var params = new URLSearchParams(window.location.search);
  cliente = (params.get('cliente') || '').trim();

  if (!cliente) {
    document.getElementById('nombreCliente').textContent = 'Sin identificar';
    mostrarToast('Usa tu enlace personalizado para hacer pedidos.', 'error');
  } else {
    document.getElementById('nombreCliente').textContent = cliente;
    document.getElementById('avatar').textContent = cliente.charAt(0).toUpperCase();
  }

  if (SCRIPT_URL.indexOf('script.google.com') === -1) {
    mostrarToast('Formulario sin configurar: falta la URL en config.js', 'error');
  }

  generarFechas();
  generarFormulario();
  mostrarHistorial();
  actualizarResumen();
  ajustarStickyResumen();
}

// Calcula el top del resumen dinamicamente segun la altura del header
function ajustarStickyResumen() {
  var header = document.querySelector('header');
  var resumen = document.querySelector('.resumen');
  if (header && resumen) {
    resumen.style.top = header.offsetHeight + 'px';
  }
}

function generarFechas() {
  var inp = document.getElementById('fechaEntrega');
  var man = new Date();
  man.setDate(man.getDate() + 1);
  // Fecha LOCAL (toISOString usa UTC y entre 00:00 y 02:00 daba el día equivocado)
  function fmt(d) {
    return d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
  }
  inp.min = fmt(man);
  inp.value = fmt(man);
  bloqueDomingo();
  inp.addEventListener('change', function() {
    var sel = new Date(inp.value + 'T12:00:00');
    if (sel.getDay() === 0) {
      sel.setDate(sel.getDate() + 1);
      inp.value = fmt(sel);
      mostrarToast('Los domingos no hay reparto. Movido al lunes.', 'error');
    }
    bloqueDomingo();
    ajustarStickyResumen();
  });
}

function bloqueDomingo() {
  var inp = document.getElementById('fechaEntrega');
  var sel = new Date(inp.value + 'T12:00:00');
  var esSab = sel.getDay() === 6;
  document.getElementById('domingoWrap').classList.toggle('show', esSab);
  if (!esSab) { esDomingo = false; document.getElementById('domingoToggle').classList.remove('on'); }
  ajustarStickyResumen();
}

function toggleDomingo() {
  if (enviando) return;
  var inp = document.getElementById('fechaEntrega');
  if (new Date(inp.value + 'T12:00:00').getDay() !== 6) return;
  esDomingo = !esDomingo;
  document.getElementById('domingoToggle').classList.toggle('on', esDomingo);
}

function generarFormulario() {
  var c = document.getElementById('mainContainer');
  c.innerHTML = '';
  cantidades = {};
  var habituales = obtenerHabituales();
  var familias = Object.keys(FAMILIAS);

  if (habituales.length > 0) {
    var cardHab = document.createElement('div');
    cardHab.className = 'section-card';
    var hdrHab = document.createElement('div');
    hdrHab.className = 'section-header hab-header';
    var badgeHab = document.createElement('span');
    badgeHab.className = 'badge';
    badgeHab.id = 'badge-habituales';
    badgeHab.textContent = '0';
    hdrHab.textContent = 'Tus habituales ';
    hdrHab.appendChild(badgeHab);
    cardHab.appendChild(hdrHab);
    for (var h = 0; h < habituales.length; h++) {
      cantidades[habituales[h]] = 0;
      cardHab.appendChild(crearFila(habituales[h], familiaDeProducto(habituales[h]), false));
    }
    c.appendChild(cardHab);

    var banner = document.createElement('div');
    banner.className = 'banner-hab';
    var bTit = document.createElement('div');
    bTit.className = 'b-titulo';
    bTit.textContent = 'Necesitas algo mas?';
    var bSub = document.createElement('div');
    bSub.className = 'b-sub';
    bSub.textContent = 'Todos los productos disponibles abajo';
    banner.appendChild(bTit);
    banner.appendChild(bSub);
    c.appendChild(banner);
  }

  for (var fi = 0; fi < familias.length; fi++) {
    var fam = familias[fi];
    var prods = FAMILIAS[fam];
    var vis = [];
    var ocu = [];
    for (var pi = 0; pi < prods.length; pi++) {
      var p = prods[pi];
      if (!cantidades.hasOwnProperty(p)) cantidades[p] = 0;
      if (habituales.indexOf(p) === -1) {
        if (habituales.length === 0) {
          if (vis.length < 6) vis.push(p); else ocu.push(p);
        } else {
          if (vis.length < 4) vis.push(p); else ocu.push(p);
        }
      }
    }
    if (vis.length === 0 && ocu.length === 0 && habituales.length > 0) continue;

    var card = document.createElement('div');
    card.className = 'section-card';
    var hdr = document.createElement('div');
    hdr.className = 'section-header';
    var badge = document.createElement('span');
    badge.className = 'badge';
    badge.id = 'badge-' + slug(fam);
    badge.textContent = '0';
    hdr.textContent = fam + ' ';
    hdr.appendChild(badge);
    card.appendChild(hdr);

    for (var vi = 0; vi < vis.length; vi++) card.appendChild(crearFila(vis[vi], fam, false));

    if (ocu.length > 0) {
      for (var oi = 0; oi < ocu.length; oi++) card.appendChild(crearFila(ocu[oi], fam, true));
      var masBtn = document.createElement('div');
      masBtn.className = 'mas-btn';
      var masSpan = document.createElement('span');
      masSpan.textContent = '+ Mas productos';
      var icoSpan = document.createElement('span');
      icoSpan.className = 'ico';
      icoSpan.textContent = 'V';
      masBtn.appendChild(masSpan);
      masBtn.appendChild(icoSpan);
      (function(f, btn) { btn.onclick = function() { toggleMas(f, btn); }; })(fam, masBtn);
      card.appendChild(masBtn);
    }
    c.appendChild(card);
  }

  var notasDiv = document.createElement('div');
  notasDiv.className = 'notas-card';
  var notasLabel = document.createElement('label');
  notasLabel.textContent = 'Notas adicionales';
  var notasTA = document.createElement('textarea');
  notasTA.id = 'notas';
  notasTA.placeholder = 'Observaciones, cambios o productos especiales...';
  notasDiv.appendChild(notasLabel);
  notasDiv.appendChild(notasTA);
  c.appendChild(notasDiv);

  var ley = document.createElement('div');
  ley.className = 'leyenda';
  ley.textContent = 'Recuerda: pide antes de las 20:00 y lo recibes al dia siguiente. Los domingos no hay reparto: el pan del domingo se entrega el sabado.';
  c.appendChild(ley);
}

function toggleMas(fam, btn) {
  btn.classList.toggle('abierto');
  var abierto = btn.classList.contains('abierto');
  var filas = document.querySelectorAll('[data-fam="' + slug(fam) + '"]');
  for (var i = 0; i < filas.length; i++) filas[i].classList.toggle('oculto', !abierto);
}

function crearFila(prod, fam, oculto) {
  var row = document.createElement('div');
  row.className = 'product-row' + (oculto ? ' oculto' : '');
  if (oculto) row.dataset.fam = slug(fam);

  var nm = document.createElement('div');
  nm.className = 'product-name';
  nm.textContent = prod;

  var ctrl = document.createElement('div');
  ctrl.className = 'qty-control';

  var bm = document.createElement('button');
  bm.className = 'qty-btn'; bm.type = 'button'; bm.textContent = '-';

  var inp = document.createElement('input');
  inp.type = 'number'; inp.className = 'qty-input'; inp.value = 0; inp.min = 0; inp.inputMode = 'numeric';
  inp.setAttribute('data-producto', prod);   // lo usa el botón "Repetir" del historial

  var bp = document.createElement('button');
  bp.className = 'qty-btn'; bp.type = 'button'; bp.textContent = '+';

  (function(p, f, r, i) {
    bm.onclick = function() { cambiar(p, f, -1, r, i); };
    bp.onclick = function() { cambiar(p, f,  1, r, i); };
    inp.onchange = function() {
      var v = Math.max(0, parseInt(inp.value, 10) || 0);
      inp.value = v; cantidades[p] = v;
      r.classList.toggle('active', v > 0);
      actualizarBadges(f);
      actualizarResumen();
    };
  })(prod, fam, row, inp);

  ctrl.appendChild(bm); ctrl.appendChild(inp); ctrl.appendChild(bp);
  row.appendChild(nm); row.appendChild(ctrl);
  return row;
}

function cambiar(prod, fam, delta, row, inp) {
  if (enviando) return;
  var v = Math.max(0, (cantidades[prod] || 0) + delta);
  cantidades[prod] = v; inp.value = v;
  row.classList.toggle('active', v > 0);
  actualizarBadges(fam);
  actualizarResumen();
}

function actualizarBadges(fam) {
  var badgeFam = document.getElementById('badge-' + slug(fam));
  if (badgeFam) {
    var prods = FAMILIAS[fam] || [];
    var tot = 0;
    for (var i = 0; i < prods.length; i++) tot += (cantidades[prods[i]] || 0);
    badgeFam.textContent = tot;
  }
  var badgeHab = document.getElementById('badge-habituales');
  if (badgeHab) {
    var hab = obtenerHabituales();
    var totH = 0;
    for (var j = 0; j < hab.length; j++) totH += (cantidades[hab[j]] || 0);
    badgeHab.textContent = totH;
  }
}

function actualizarResumen() {
  var lineas = obtenerLineas();
  var totalUds = 0;
  var fams = {};
  for (var i = 0; i < lineas.length; i++) {
    totalUds += lineas[i][1];
    var f = familiaDeProducto(lineas[i][0]);
    if (f) fams[f] = true;
  }
  document.getElementById('rTotal').textContent = totalUds;
  document.getElementById('rProductos').textContent = lineas.length;
  document.getElementById('rFamilias').textContent = Object.keys(fams).length;
  document.getElementById('bTotal').textContent = totalUds + ' uds';
  document.getElementById('bSub').textContent = lineas.length > 0
    ? lineas.length + ' producto' + (lineas.length !== 1 ? 's' : '') + ' seleccionado' + (lineas.length !== 1 ? 's' : '')
    : 'Sin productos seleccionados';
  document.getElementById('btnVer').disabled = lineas.length === 0;
}

// ── HISTORIAL ──────────────────────────────────────────────────
function claveHab() { return 'habituales_' + (cliente || 'anonimo'); }
function claveLS()  { return 'historial_'  + (cliente || 'anonimo'); }

function obtenerHabituales() {
  try {
    var r = localStorage.getItem(claveHab());
    var lista = r ? JSON.parse(r) : [];
    // Pasa nombres antiguos (sin tildes) al nombre actual y quita los que ya no existen
    var out = [];
    for (var i = 0; i < lista.length; i++) {
      var p = productoOficial(lista[i]);
      if (p && out.indexOf(p) === -1) out.push(p);
    }
    return out;
  } catch(e) { return []; }
}

function guardarHabituales(lineas) {
  try {
    var freq = {};
    var ex = obtenerHabituales();
    for (var i = 0; i < ex.length; i++) freq[ex[i]] = (freq[ex[i]] || 0) + 1;
    for (var j = 0; j < lineas.length; j++) freq[lineas[j][0]] = (freq[lineas[j][0]] || 0) + 2;
    var ord = Object.keys(freq).sort(function(a,b){ return freq[b]-freq[a]; });
    localStorage.setItem(claveHab(), JSON.stringify(ord.slice(0,8)));
  } catch(e) {}
}

function obtenerHistorial() {
  try { var r = localStorage.getItem(claveLS()); return r ? JSON.parse(r) : []; } catch(e) { return []; }
}

function guardarEnHistorial(lineas, fecha) {
  try {
    var hist = obtenerHistorial();
    hist.unshift({ fecha: fecha, lineas: lineas });
    if (hist.length > MAX_HISTORIAL) hist = hist.slice(0, MAX_HISTORIAL);
    localStorage.setItem(claveLS(), JSON.stringify(hist));
  } catch(e) {}
}

function mostrarHistorial() {
  var hist = obtenerHistorial();
  if (!hist.length) return;
  var card = document.createElement('div');
  card.className = 'historial-card';
  var hdr = document.createElement('div');
  hdr.className = 'hist-header';
  hdr.textContent = 'Mis ultimos pedidos';
  var body = document.createElement('div');
  body.style.display = 'none';
  hdr.onclick = function() { body.style.display = body.style.display === 'none' ? 'block' : 'none'; };
  for (var hi = 0; hi < hist.length; hi++) {
    (function(h) {
      var item = document.createElement('div');
      item.className = 'hist-item';
      var info = document.createElement('div');
      var fd = document.createElement('div'); fd.className = 'hist-fecha'; fd.textContent = h.fecha;
      var pd = document.createElement('div'); pd.className = 'hist-prods';
      pd.textContent = h.lineas.slice(0,3).map(function(l){ return l[0]+' x'+l[1]; }).join(', ') + (h.lineas.length>3?'...':'');
      info.appendChild(fd); info.appendChild(pd);
      var btn = document.createElement('button'); btn.className = 'btn-repedir'; btn.textContent = 'Repetir';
      btn.onclick = function() { repetirPedido(h.lineas); };
      item.appendChild(info); item.appendChild(btn); body.appendChild(item);
    })(hist[hi]);
  }
  card.appendChild(hdr); card.appendChild(body);
  var c = document.getElementById('mainContainer');
  c.insertBefore(card, c.firstChild);
}

function repetirPedido(lineas) {
  borrarPedido();
  for (var i = 0; i < lineas.length; i++) {
    var prod = productoOficial(lineas[i][0]); var cant = lineas[i][1];
    if (!prod) continue;
    if (cantidades.hasOwnProperty(prod)) {
      cantidades[prod] = cant;
      var nms = document.querySelectorAll('.product-name');
      for (var j = 0; j < nms.length; j++) {
        if (nms[j].textContent === prod) {
          var row = nms[j].parentElement;
          var inp = row.querySelector('.qty-input');
          if (inp) { inp.value = cant; row.classList.toggle('active', cant > 0); }
        }
      }
    }
  }
  actualizarResumen();
  mostrarToast('Pedido anterior cargado. Revisalo y confirma.', 'ok');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── MODAL RESUMEN ──────────────────────────────────────────────
function formatFecha() {
  var raw = document.getElementById('fechaEntrega').value;
  if (!raw) return '';
  var parts = raw.split('-');
  var obj = new Date(raw + 'T12:00:00');
  var dias = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
  var meses = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
  var fmt = dias[obj.getDay()] + ' ' + parseInt(parts[2],10) + ' de ' + meses[parseInt(parts[1],10)-1] + ' de ' + parts[0];
  return esDomingo ? 'Pan domingo - entrega ' + fmt : fmt;
}

function obtenerLineas() {
  var lineas = [];
  var prods = Object.keys(cantidades);
  for (var i = 0; i < prods.length; i++) {
    if (cantidades[prods[i]] > 0) lineas.push([prods[i], cantidades[prods[i]]]);
  }
  return lineas;
}

function abrirModal() {
  if (enviando) return;
  var lineas = obtenerLineas();
  if (!lineas.length) { mostrarToast('Anade al menos un producto.', 'error'); return; }
  var fecha = formatFecha();
  if (!fecha) { mostrarToast('Selecciona una fecha de entrega.', 'error'); return; }

  document.getElementById('modalFecha').textContent = 'Entrega: ' + fecha;
  var det = document.getElementById('modalDetalle');
  det.innerHTML = '';
  for (var i = 0; i < lineas.length; i++) {
    var lin = document.createElement('div'); lin.className = 'modal-linea';
    var np = document.createElement('span'); np.className = 'm-prod'; np.textContent = lineas[i][0];
    var nc = document.createElement('span'); nc.className = 'm-cant'; nc.textContent = lineas[i][1] + ' uds';
    lin.appendChild(np); lin.appendChild(nc); det.appendChild(lin);
  }
  document.getElementById('modalOverlay').classList.add('open');
}

function cerrarModal() {
  if (enviando) return;
  document.getElementById('modalOverlay').classList.remove('open');
}

// ── CUENTA ATRÁS ───────────────────────────────────────────────
function iniciarCuentaAtras(payload, lineas, fecha) {
  cdPayloadPendiente = payload;
  cdLineasPendientes = lineas;
  cdFechaPendiente = fecha;
  cdSegundosRestantes = DURACION_CD;

  // Rellenar pantalla
  document.getElementById('cdFecha').textContent = 'Entrega: ' + fecha;
  var det = document.getElementById('cdDetalle');
  det.innerHTML = '';
  for (var i = 0; i < lineas.length; i++) {
    var lin = document.createElement('div'); lin.className = 'cd-linea';
    var np = document.createElement('span'); np.className = 'cd-prod'; np.textContent = lineas[i][0];
    var nc = document.createElement('span'); nc.className = 'cd-cant'; nc.textContent = lineas[i][1] + ' uds';
    lin.appendChild(np); lin.appendChild(nc); det.appendChild(lin);
  }

  document.getElementById('countdownScreen').classList.add('open');
  actualizarReloj();

  cdTimer = setInterval(function() {
    cdSegundosRestantes--;
    actualizarReloj();
    if (cdSegundosRestantes <= 0) {
      clearInterval(cdTimer);
      cdTimer = null;
      enviarAlServidor();
    }
  }, 1000);
}

function actualizarReloj() {
  var mins = Math.floor(cdSegundosRestantes / 60);
  var segs = cdSegundosRestantes % 60;
  document.getElementById('cdMins').textContent = (mins < 10 ? '0' : '') + mins + ':' + (segs < 10 ? '0' : '') + segs;
  // Anillo SVG — circunferencia 2*PI*34 = 213.6
  var progreso = cdSegundosRestantes / DURACION_CD;
  var offset = 213.6 * (1 - progreso);
  document.getElementById('cdRingProg').style.strokeDashoffset = offset;
}

function confirmarYa() {
  if (cdTimer) { clearInterval(cdTimer); cdTimer = null; }
  enviarAlServidor();
}

function cancelarCuentaAtras() {
  if (cdTimer) { clearInterval(cdTimer); cdTimer = null; }
  cdPayloadPendiente = null;
  cdLineasPendientes = null;
  cdFechaPendiente = null;
  document.getElementById('countdownScreen').classList.remove('open');
  mostrarToast('Pedido cancelado.', 'error');
}

function enviarAlServidor() {
  document.getElementById('countdownScreen').classList.remove('open');
  if (!cdPayloadPendiente) return;

  var payload = cdPayloadPendiente;
  var lineas  = cdLineasPendientes;
  var fecha   = cdFechaPendiente;

  setEnviando(true);

  // text/plain evita el bloqueo CORS y permite leer la respuesta del servidor
  // (antes con mode:'no-cors' se mostraba "Pedido enviado" aunque el servidor fallase)
  fetch(SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload)
  }).then(function(r) {
    return r.text().then(function(t) {
      try { return JSON.parse(t); } catch(e) { return { ok: true }; }   // respuesta ilegible: el pedido llegó
    });
  }).then(function(res) {
    if (res && res.ok === false) {
      // El servidor ha rechazado el pedido: no se ha guardado nada
      document.getElementById('modalOverlay').classList.add('open');
      mostrarToast('No se ha registrado: ' + (res.error || 'error del servidor') + '. Intentalo de nuevo.', 'error');
      return;
    }
    guardarHabituales(lineas);
    guardarEnHistorial(lineas, fecha);
    document.getElementById('successFecha').textContent = fecha;
    document.getElementById('successScreen').classList.add('open');
  }).catch(function(err) {
    console.error(err);
    document.getElementById('modalOverlay').classList.add('open');
    mostrarToast('Error al enviar. Revisa la conexion y vuelve a intentarlo.', 'error');
  }).finally(function() {
    setEnviando(false);
    cdPayloadPendiente = null;
    cdLineasPendientes = null;
    cdFechaPendiente = null;
  });
}

// ── ENVÍO (ahora abre la cuenta atrás) ─────────────────────────
function enviarPedido() {
  if (enviando) return;
  var lineas = obtenerLineas();
  if (!lineas.length) { mostrarToast('Anade al menos un producto.', 'error'); return; }
  var fecha = formatFecha();
  if (!fecha) { mostrarToast('Selecciona una fecha valida.', 'error'); return; }

  var notasEl = document.getElementById('notas');
  var notas = notasEl ? notasEl.value.trim() : '';

  var productos = [];
  for (var i = 0; i < lineas.length; i++) productos.push({ producto: lineas[i][0], cantidad: lineas[i][1] });

  var payload = {
    cliente: cliente,
    fecha: fecha,                       // texto para mostrar ("viernes 2 de octubre de 2026")
    fechaISO: fechaISOSeleccionada(),   // fecha exacta para la hoja
    panDomingo: esDomingo,              // sábado + "pedido para el domingo"
    notas: notas,
    productos: productos
  };

  cerrarModal();
  iniciarCuentaAtras(payload, lineas, fecha);
}

function setEnviando(v) {
  enviando = v;
  var ids = ['btnEnviar','btnVer','btnConfirmar','btnCancelar','btnConfirmarYa'];
  for (var i = 0; i < ids.length; i++) {
    var el = document.getElementById(ids[i]);
    if (el) el.disabled = v;
  }
  document.getElementById('sendingScreen').classList.toggle('open', v);
  var btns = document.querySelectorAll('.qty-btn');
  for (var b = 0; b < btns.length; b++) btns[b].disabled = v;
  var inps = document.querySelectorAll('.qty-input');
  for (var ii = 0; ii < inps.length; ii++) inps[ii].disabled = v;
}

function nuevoPedido() {
  borrarPedido();
  document.getElementById('successScreen').classList.remove('open');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function borrarPedido() {
  var prods = Object.keys(cantidades);
  for (var i = 0; i < prods.length; i++) cantidades[prods[i]] = 0;
  var inps = document.querySelectorAll('.qty-input');
  for (var j = 0; j < inps.length; j++) inps[j].value = 0;
  var rows = document.querySelectorAll('.product-row');
  for (var k = 0; k < rows.length; k++) rows[k].classList.remove('active');
  var badges = document.querySelectorAll('.badge');
  for (var b = 0; b < badges.length; b++) badges[b].textContent = '0';
  var n = document.getElementById('notas');
  if (n) n.value = '';
  esDomingo = false;
  document.getElementById('domingoToggle').classList.remove('on');
  actualizarResumen();
}

function mostrarToast(msg, tipo) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast show ' + (tipo || '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function() { t.className = 'toast'; }, 3200);
}

function familiaDeProducto(prod) {
  var familias = Object.keys(FAMILIAS);
  for (var i = 0; i < familias.length; i++) {
    if (FAMILIAS[familias[i]].indexOf(prod) !== -1) return familias[i];
  }
  return '';
}

// Texto sin tildes ni mayúsculas, para comparar nombres
function textoPlano(txt) {
  return String(txt || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Nombre oficial del catálogo ('Prieto Pepito Anis' → 'Prieto Pepito Anís'), o '' si no existe
function productoOficial(nombre) {
  var k = textoPlano(nombre);
  var fams = Object.keys(FAMILIAS);
  for (var i = 0; i < fams.length; i++) {
    for (var j = 0; j < FAMILIAS[fams[i]].length; j++) {
      if (textoPlano(FAMILIAS[fams[i]][j]) === k) return FAMILIAS[fams[i]][j];
    }
  }
  return '';
}

// "2026-10-02" de la fecha elegida
function fechaISOSeleccionada() {
  return document.getElementById('fechaEntrega').value || '';
}

function slug(txt) {
  return String(txt).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,'-').toLowerCase();
}

window.addEventListener('resize', ajustarStickyResumen);
init();
