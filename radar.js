/* ============================================================
   Capital Hipotecario — Radar de Oportunidades (radar.js)
   Calcula, para cada aviso:
     · Arriendo estimado (yield bruto por tipo)
     · Dividendo del crédito (cuota francesa, % financiado, tasa, plazo)
     · Flujo mensual = arriendo − dividendo  → A FAVOR / EN CONTRA
     · Descuento vs pares (UF/m² bajo la mediana del segmento, con IQR)
   Datos: window.RADAR_DEMO (radar-data.js). Importa CSV para datos reales.
   ============================================================ */
(function () {
  'use strict';

  // ---------- Parámetros de inversión (editables en el panel) ----------
  const P = {
    yieldDepto: 4.8,   // % bruto anual del valor → arriendo (departamentos)
    yieldCasa: 4.0,    // % bruto anual del valor → arriendo (casas)
    financiamiento: 80,// % del valor financiado con crédito (pie = resto)
    tasaAnual: (window.CONFIG && CONFIG.tasaDefault) || 5.3, // % anual
    plazo: 25,         // años del crédito
    uf: (window.UF && UF.value) || (window.CONFIG && CONFIG.ufFallback) || 39800
  };

  // ---------- Helpers ----------
  const $ = id => document.getElementById(id);
  const REF_M2 = r => (r.tipo === 'Departamento' || r.tipo === 'Casa') ? r.m2_utiles : r.m2_terreno;
  const RENTABLE = r => (r.tipo === 'Departamento' || r.tipo === 'Casa');
  const segKey = r => RENTABLE(r) ? `${r.tipo}|${r.comuna}|${r.dormitorios}D` : `${r.tipo}|${r.comuna}`;

  function fmt(n, d = 0) {
    return (n == null || isNaN(n)) ? '—' : n.toLocaleString('es-CL', { minimumFractionDigits: d, maximumFractionDigits: d });
  }
  function clp(uf) {
    if (uf == null || isNaN(uf)) return '—';
    return '$' + Math.round(uf * P.uf).toLocaleString('es-CL');
  }
  function median(a) { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; }
  function quantile(a, q) { const s = [...a].sort((x, y) => x - y); const p = (s.length - 1) * q; const b = Math.floor(p); return s[b + 1] !== undefined ? s[b] + (p - b) * (s[b + 1] - s[b]) : s[b]; }

  // ---------- Motor: segmentos y comparables (descuento vs pares) ----------
  let SEG = {};
  function buildSegments(rows) {
    const g = {};
    rows.forEach(r => { r.uf_m2 = +(r.precio_uf / REF_M2(r)).toFixed(3) || 0; (g[segKey(r)] = g[segKey(r)] || []).push(r); });
    SEG = {};
    for (const k in g) {
      let vals = g[k].map(r => r.uf_m2).filter(v => v > 0);
      if (vals.length >= 4) { // recorte de outliers por IQR
        const q1 = quantile(vals, .25), q3 = quantile(vals, .75), iqr = q3 - q1;
        const lo = q1 - 1.5 * iqr, hi = q3 + 1.5 * iqr;
        vals = vals.filter(v => v >= lo && v <= hi);
      }
      const med = median(vals);
      const mean = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
      const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / (vals.length || 1)) || 0;
      const devs = vals.map(v => Math.abs(v - med)).sort((a, b) => a - b);
      const mad = median(devs) || 0;
      SEG[k] = { n: vals.length, median: med, cv: med ? sd / med : 0, mad, min: Math.min(...vals), max: Math.max(...vals) };
    }
  }

  // ---------- Motor: arriendo, dividendo y flujo ----------
  function dividendoUF(creditoUF) {
    const i = (P.tasaAnual / 100) / 12, n = P.plazo * 12;
    if (i <= 0) return creditoUF / n;
    return creditoUF * (i / (1 - Math.pow(1 + i, -n)));
  }

  function enrich(rows) {
    const minN = P.minNObj();
    rows.forEach(r => {
      // --- descuento vs pares ---
      const s = SEG[segKey(r)]; r._seg = s;
      if (s && s.median) {
        r.medianSeg = s.median;
        r.descuento = (s.median - r.uf_m2) / s.median; // >0 = más barato que pares
        r.z = s.mad > 0 ? (s.median - r.uf_m2) / (1.4826 * s.mad) : 0;
        if (s.n >= 12 && s.cv < 0.20) r.conf = 'alta';
        else if (s.n >= minN) r.conf = 'media';
        else r.conf = 'baja';
        const dsc = Math.max(0, Math.min(1, r.descuento / 0.30));
        const zz = Math.max(0, Math.min(1, r.z / 3));
        const cf = r.conf === 'alta' ? 1 : r.conf === 'media' ? 0.6 : 0.3;
        r.score = Math.round((dsc * 0.7 + zz * 0.2 + cf * 0.1) * 100);
      } else { r.medianSeg = null; r.descuento = null; r.conf = 'baja'; r.score = 0; r.z = 0; }

      // --- arriendo / dividendo / flujo ---
      if (RENTABLE(r) && r.precio_uf > 0) {
        const y = (r.tipo === 'Departamento' ? P.yieldDepto : P.yieldCasa) / 100;
        // Arriendo de MERCADO: estimado con la mediana de pares (UF/m²), no con el
        // precio del aviso. Así un aviso bajo sus comparables arrienda como el mercado
        // pero con un dividendo menor → queda a favor.
        const baseUFm2 = (s && s.median) ? s.median : r.uf_m2;
        r.arriendoUF = baseUFm2 * REF_M2(r) * y / 12;
        r.pieUF = r.precio_uf * (1 - P.financiamiento / 100);
        r.creditoUF = r.precio_uf * P.financiamiento / 100;
        r.dividendoUF = dividendoUF(r.creditoUF);
        r.flujoUF = r.arriendoUF - r.dividendoUF;
        r.coberturaPct = r.dividendoUF > 0 ? (r.arriendoUF / r.dividendoUF) * 100 : null;
      } else {
        r.arriendoUF = r.dividendoUF = r.flujoUF = r.pieUF = r.creditoUF = r.coberturaPct = null;
      }
    });
  }

  // ---------- Estado UI ----------
  let ROWS = [];
  const state = {
    tipos: new Set(), region: '', comunas: new Set(), dorms: new Set(), conf: new Set(), portal: '',
    m2min: null, m2max: null, ufmin: null, ufmax: null, disc: 0.10, q: '',
    onlyFav: false, onlyOpp: false, sortK: 'flujoUF', sortDir: -1
  };
  P.minNObj = () => (+($('minN') && $('minN').value) || 5);

  function recompute() { buildSegments(ROWS); enrich(ROWS); }

  function init(rows) {
    ROWS = rows;
    recompute();
    if ($('nload')) $('nload').textContent = ROWS.length.toLocaleString('es-CL');
    // poblar filtros
    const tipos = [...new Set(ROWS.map(r => r.tipo))];
    const tc = $('tipoChips'); tc.innerHTML = '';
    tipos.forEach(t => { const c = document.createElement('div'); c.className = 'rchip rtipo'; c.textContent = t; c.onclick = () => { toggle(state.tipos, t, c); render(); }; tc.appendChild(c); });
    const regions = [...new Set(ROWS.map(r => r.region))].sort();
    $('region').innerHTML = '<option value="">Todas</option>' + regions.map(r => `<option>${r}</option>`).join('');
    const portals = [...new Set(ROWS.map(r => r.portal))].sort();
    $('portal').innerHTML = '<option value="">Todos</option>' + portals.map(p => `<option>${p}</option>`).join('');
    const dc = $('dormChips'); dc.innerHTML = '';
    [1, 2, 3, 4, 5].forEach(d => { const c = document.createElement('div'); c.className = 'rchip'; c.textContent = d + 'D'; c.onclick = () => { toggle(state.dorms, d, c); render(); }; dc.appendChild(c); });
    const cc = $('confChips'); cc.innerHTML = '';
    [['alta', 'Alta'], ['media', 'Media'], ['baja', 'Baja']].forEach(([k, l]) => { const c = document.createElement('div'); c.className = 'rchip'; c.textContent = l; c.onclick = () => { toggle(state.conf, k, c); render(); }; cc.appendChild(c); });
    buildMuni();
    render();
  }

  function buildMuni() {
    const reg = state.region;
    let comunas = [...new Set(ROWS.filter(r => !reg || r.region === reg).map(r => r.comuna))].sort();
    const box = $('muniBox'); box.innerHTML = '';
    comunas.forEach(c => {
      const id = 'm_' + c.replace(/\W/g, '');
      const l = document.createElement('label');
      l.innerHTML = `<input type="checkbox" ${state.comunas.has(c) ? 'checked' : ''} id="${id}"> ${c}`;
      l.querySelector('input').onchange = e => { e.target.checked ? state.comunas.add(c) : state.comunas.delete(c); render(); };
      box.appendChild(l);
    });
  }
  function toggle(set, v, el) { if (set.has(v)) { set.delete(v); el.classList.remove('on'); } else { set.add(v); el.classList.add('on'); } }

  function passes(r) {
    if (state.tipos.size && !state.tipos.has(r.tipo)) return false;
    if (state.region && r.region !== state.region) return false;
    if (state.comunas.size && !state.comunas.has(r.comuna)) return false;
    if (state.dorms.size && !(state.dorms.has(r.dormitorios))) return false;
    if (state.conf.size && !state.conf.has(r.conf)) return false;
    if (state.portal && r.portal !== state.portal) return false;
    const m2 = REF_M2(r);
    if (state.m2min != null && m2 < state.m2min) return false;
    if (state.m2max != null && m2 > state.m2max) return false;
    if (state.ufmin != null && r.precio_uf < state.ufmin) return false;
    if (state.ufmax != null && r.precio_uf > state.ufmax) return false;
    if (state.q) { const s = (r.comuna + ' ' + r.sector + ' ' + r.id + ' ' + r.tipo).toLowerCase(); if (!s.includes(state.q.toLowerCase())) return false; }
    if (state.onlyFav && !(r.flujoUF != null && r.flujoUF >= 0)) return false;
    if (state.onlyOpp) { if (!(r.descuento != null && r.descuento >= state.disc && r._seg && r._seg.n >= P.minNObj())) return false; }
    return true;
  }
  function tipoTag(t) { const m = { Departamento: 't-dep', Casa: 't-cas', Parcela: 't-par', Terreno: 't-ter' }; return `<span class="rtag ${m[t]}">${t}</span>`; }
  function discClass(d) { if (d == null) return 'lo'; if (d >= 0.15) return 'hi'; if (d >= 0.10) return 'mid'; return 'lo'; }

  let _filtered = [];
  function render() {
    let rows = ROWS.filter(passes);
    const k = state.sortK;
    rows.sort((a, b) => {
      let va, vb;
      if (k === 'comuna') { va = a.comuna; vb = b.comuna; }
      else if (k === 'tipo') { va = a.tipo; vb = b.tipo; }
      else if (k === 'tipologia') { va = a.tipologia; vb = b.tipologia; }
      else if (k === 'm2') { va = REF_M2(a); vb = REF_M2(b); }
      else { va = a[k]; vb = b[k]; }
      if (va == null) va = -1e12; if (vb == null) vb = -1e12;
      if (va < vb) return -state.sortDir; if (va > vb) return state.sortDir; return 0;
    });
    _filtered = rows;

    // ---- KPIs ----
    const rent = rows.filter(r => r.flujoUF != null);
    const fav = rent.filter(r => r.flujoUF >= 0);
    const avgFlujo = rent.length ? rent.reduce((a, b) => a + b.flujoUF, 0) / rent.length : null;
    const opps = ROWS.filter(r => r.descuento != null && r.descuento >= state.disc && r._seg && r._seg.n >= P.minNObj());
    $('kpis').innerHTML = `
     <div class="rkpi"><div class="v">${rows.length.toLocaleString('es-CL')}</div><div class="l">Avisos en vista</div></div>
     <div class="rkpi good"><div class="v">${fav.length.toLocaleString('es-CL')}</div><div class="l">A favor (flujo ≥ 0)</div></div>
     <div class="rkpi ${avgFlujo >= 0 ? 'good' : 'bad'}"><div class="v">${avgFlujo == null ? '—' : (avgFlujo >= 0 ? '+' : '') + fmt(avgFlujo, 1) + ' UF'}</div><div class="l">Flujo mensual promedio</div></div>
     <div class="rkpi"><div class="v">${opps.length.toLocaleString('es-CL')}</div><div class="l">Oportunidades (≥${Math.round(state.disc * 100)}% vs pares)</div></div>`;
    $('count').textContent = `${rows.length} resultados`;

    // ---- tabla ----
    const tb = $('tbody');
    if (!rows.length) { tb.innerHTML = '<tr><td colspan="10"><div class="rempty">Sin resultados con estos filtros. Prueba quitar “solo a favor” o ampliar comunas.</div></td></tr>'; return; }
    tb.innerHTML = rows.slice(0, 300).map(rowHtml).join('');
  }

  function flujoBadge(r) {
    if (r.flujoUF == null) return '<span class="rflujo na">no aplica</span>';
    const fav = r.flujoUF >= 0;
    return `<span class="rflujo ${fav ? 'pos' : 'neg'}">${fav ? '▲ A favor' : '▼ En contra'}<br><b>${(fav ? '+' : '−') + fmt(Math.abs(r.flujoUF), 1)} UF</b> · ${clp(Math.abs(r.flujoUF))}</span>`;
  }

  function rowHtml(r) {
    const m2 = REF_M2(r), d = r.descuento;
    return `<tr class="rrow" data-id="${r.id}">
     <td><b>${r.comuna}</b><br><span class="rsub">${r.sector} · ${r.region}</span></td>
     <td>${tipoTag(r.tipo)}</td>
     <td>${r.tipologia === '-' ? '<span class="rmut">terreno</span>' : r.tipologia}</td>
     <td>${fmt(m2, m2 < 100 ? 1 : 0)}</td>
     <td><b>${fmt(r.precio_uf, 0)}</b> UF<br><span class="rsub">${clp(r.precio_uf)}</span></td>
     <td>${r.arriendoUF == null ? '<span class="rmut">—</span>' : fmt(r.arriendoUF, 1) + ' UF<br><span class="rsub">' + clp(r.arriendoUF) + '</span>'}</td>
     <td>${r.dividendoUF == null ? '<span class="rmut">—</span>' : fmt(r.dividendoUF, 1) + ' UF<br><span class="rsub">' + clp(r.dividendoUF) + '</span>'}</td>
     <td>${flujoBadge(r)}</td>
     <td class="rdisc ${discClass(d)}">${d == null ? '—' : (d >= 0 ? '−' : '+') + Math.abs(d * 100).toFixed(1) + '%'}<br><span class="rsub">${r.medianSeg != null ? 'pares ' + fmt(r.medianSeg, 1) : ''}</span></td>
     <td><span class="rconf ${r.conf}">${r.conf[0].toUpperCase() + r.conf.slice(1)}</span><br><span class="rsub">${r.portal}</span></td>
    </tr>`;
  }

  // ---------- Detalle expandible ----------
  document.addEventListener('click', e => {
    const tr = e.target.closest('.rrow'); if (!tr) return;
    const id = tr.dataset.id; const r = ROWS.find(x => x.id === id);
    const nx = tr.nextElementSibling;
    if (nx && nx.classList.contains('detrow')) { nx.remove(); return; }
    document.querySelectorAll('.detrow').forEach(n => n.remove());
    const s = r._seg;
    const peers = ROWS.filter(x => segKey(x) === segKey(r)).map(x => x.uf_m2).filter(v => v > 0);
    const tr2 = document.createElement('tr'); tr2.className = 'detrow';
    const flujoLine = r.flujoUF == null
      ? '<p class="rlegend">Este tipo de propiedad (terreno/parcela) no genera arriendo, por lo que solo se evalúa el descuento vs comparables.</p>'
      : `<table class="rmini">
          <tr><td>Valor de la propiedad</td><td><b>${fmt(r.precio_uf, 0)} UF</b> · ${clp(r.precio_uf)}</td></tr>
          <tr><td>Pie (${100 - P.financiamiento}%)</td><td>${fmt(r.pieUF, 0)} UF · ${clp(r.pieUF)}</td></tr>
          <tr><td>Crédito (${P.financiamiento}%)</td><td>${fmt(r.creditoUF, 0)} UF · ${clp(r.creditoUF)}</td></tr>
          <tr><td>Dividendo (${P.tasaAnual}% · ${P.plazo} años)</td><td>${fmt(r.dividendoUF, 1)} UF · ${clp(r.dividendoUF)}</td></tr>
          <tr><td>Arriendo de mercado (${r.tipo === 'Departamento' ? P.yieldDepto : P.yieldCasa}% anual s/ comparables)</td><td>${fmt(r.arriendoUF, 1)} UF · ${clp(r.arriendoUF)}</td></tr>
          <tr><td>Cobertura arriendo/dividendo</td><td><b>${r.coberturaPct == null ? '—' : Math.round(r.coberturaPct) + '%'}</b></td></tr>
          <tr><td>Flujo mensual</td><td class="${r.flujoUF >= 0 ? 'rpos' : 'rneg'}"><b>${(r.flujoUF >= 0 ? '+' : '−') + fmt(Math.abs(r.flujoUF), 1)} UF</b> · ${clp(Math.abs(r.flujoUF))} → ${r.flujoUF >= 0 ? 'A FAVOR' : 'EN CONTRA'}</td></tr>
         </table>`;
    tr2.innerHTML = `<td colspan="10"><div class="rdetail"><div class="rgrid">
      <div>
       <h4>Flujo del inversionista</h4>
       ${flujoLine}
       <p class="rlegend">Estimación referencial: arriendo bruto (sin descontar vacancia, gastos comunes ni contribuciones) menos el dividendo del crédito. Ajusta los parámetros en el panel “Supuestos”.</p>
      </div>
      <div>
       <h4>Comparación con pares · ${segKey(r).replace(/\|/g, ' · ')}</h4>
       <table class="rmini">
        <tr><td>Pares comparables (post-outliers)</td><td><b>${s ? s.n : 0}</b></td></tr>
        <tr><td>Mediana UF/m² del segmento</td><td><b>${s ? fmt(s.median, 2) : '—'}</b></td></tr>
        <tr><td>Esta propiedad UF/m²</td><td><b>${fmt(r.uf_m2, 2)}</b></td></tr>
        <tr><td>Descuento vs mediana</td><td class="rdisc ${discClass(r.descuento)}">${r.descuento == null ? '—' : (r.descuento * 100).toFixed(1) + '%'}</td></tr>
        <tr><td>Confianza del comparable</td><td><span class="rconf ${r.conf}">${r.conf}</span></td></tr>
       </table>
       ${distSvg(peers, r.uf_m2, s)}
       <p class="rlegend">${r.estado || '—'} · ${r.antiguedad ? r.antiguedad + ' años' : 's/d antigüedad'} · ${r.estacionamiento || 0} estac. · ${r.bodega ? 'con' : 'sin'} bodega</p>
      </div>
     </div></div></td>`;
    tr.after(tr2);
  });

  function distSvg(vals, mark, s) {
    if (!vals.length || !s) return '';
    const min = Math.min(...vals), max = Math.max(...vals), W = 360, H = 70, pad = 6;
    const bins = 12, bw = (max - min) / bins || 1; const counts = new Array(bins).fill(0);
    vals.forEach(v => { let b = Math.floor((v - min) / bw); if (b >= bins) b = bins - 1; if (b < 0) b = 0; counts[b]++; });
    const mx = Math.max(...counts);
    const x = v => pad + ((v - min) / (max - min || 1)) * (W - 2 * pad);
    let bars = ''; counts.forEach((c, i) => { const h = (c / mx) * (H - 16); bars += `<rect x="${x(min + i * bw)}" y="${H - 16 - h}" width="${(W - 2 * pad) / bins - 2}" height="${h}" fill="#cfe7ea" rx="2"/>`; });
    const ml = x(s.median), pl = x(mark);
    return `<svg class="rdist" viewBox="0 0 ${W} ${H}" style="width:100%;height:70px;margin-top:6px">${bars}
     <line x1="${ml}" y1="0" x2="${ml}" y2="${H - 14}" stroke="#16b8c6" stroke-width="2"/>
     <line x1="${pl}" y1="0" x2="${pl}" y2="${H - 14}" stroke="#ff7a66" stroke-width="2" stroke-dasharray="3,2"/>
     <text x="${pad}" y="${H - 2}" font-size="9" fill="#5b6b80">${fmt(min, 1)}</text>
     <text x="${W - pad}" y="${H - 2}" font-size="9" fill="#5b6b80" text-anchor="end">${fmt(max, 1)}</text></svg>`;
  }

  // ---------- Eventos de filtros / parámetros ----------
  function bind() {
    $('q').oninput = e => { state.q = e.target.value; render(); };
    $('region').onchange = e => { state.region = e.target.value; state.comunas.clear(); buildMuni(); render(); };
    $('portal').onchange = e => { state.portal = e.target.value; render(); };
    $('m2min').oninput = e => { state.m2min = e.target.value ? +e.target.value : null; render(); };
    $('m2max').oninput = e => { state.m2max = e.target.value ? +e.target.value : null; render(); };
    $('ufmin').oninput = e => { state.ufmin = e.target.value ? +e.target.value : null; render(); };
    $('ufmax').oninput = e => { state.ufmax = e.target.value ? +e.target.value : null; render(); };
    $('discSlider').oninput = e => { state.disc = +e.target.value / 100; $('discLbl').textContent = e.target.value + '%'; render(); };
    $('onlyFav').onchange = e => { state.onlyFav = e.target.checked; render(); };
    $('onlyOpp').onchange = e => { state.onlyOpp = e.target.checked; render(); };
    $('minN').oninput = () => { recompute(); render(); };
    // parámetros de inversión
    const reparam = () => {
      P.yieldDepto = +$('pYieldD').value || 4.8;
      P.yieldCasa = +$('pYieldC').value || 4.0;
      P.financiamiento = Math.min(100, Math.max(0, +$('pFin').value || 80));
      P.tasaAnual = +$('pTasa').value || 5.3;
      P.plazo = +$('pPlazo').value || 25;
      enrich(ROWS); render();
    };
    ['pYieldD', 'pYieldC', 'pFin', 'pTasa', 'pPlazo'].forEach(id => { if ($(id)) $(id).oninput = reparam; });
    if ($('ufValue')) $('ufValue').oninput = e => { P.uf = +e.target.value || P.uf; render(); };
    // orden por encabezados
    document.querySelectorAll('#tbl thead th[data-k]').forEach(th => th.onclick = () => {
      const k = th.dataset.k; if (state.sortK === k) state.sortDir *= -1; else { state.sortK = k; state.sortDir = -1; } render();
    });
    // exportar oportunidades
    $('exportBtn').onclick = () => {
      const cols = ['id', 'portal', 'region', 'comuna', 'sector', 'tipo', 'tipologia', 'm2_utiles', 'precio_uf', 'arriendoUF', 'dividendoUF', 'flujoUF', 'descuento', 'score', 'conf'];
      const rows = _filtered;
      const csv = [cols.join(',')].concat(rows.map(r => cols.map(c => {
        let v = r[c]; if (c === 'descuento' && v != null) v = (v * 100).toFixed(1);
        if (['arriendoUF', 'dividendoUF', 'flujoUF'].includes(c) && v != null) v = v.toFixed(1);
        return JSON.stringify(v ?? '');
      }).join(','))).join('\n');
      const b = new Blob([csv], { type: 'text/csv' }); const a = document.createElement('a');
      a.href = URL.createObjectURL(b); a.download = 'radar-flujos.csv'; a.click();
    };
    // importar CSV real
    $('csvIn').onchange = e => {
      const f = e.target.files[0]; if (!f) return; const rd = new FileReader();
      rd.onload = () => { try { init(parseCSV(rd.result)); $('banner').innerHTML = '✅ Datos reales cargados: <b>' + ROWS.length + '</b> avisos. Recalculé arriendo, dividendo, flujo y comparables.'; } catch (err) { alert('Error al leer CSV: ' + err.message); } };
      rd.readAsText(f);
    };
    $('resetData').onclick = () => { init(JSON.parse(JSON.stringify(window.RADAR_DEMO || []))); $('banner').innerHTML = 'Demo restaurada con <b>' + ROWS.length + '</b> avisos.'; };
  }

  function parseCSV(txt) {
    const lines = txt.split(/\r?\n/).filter(x => x.trim()); const hd = splitCsv(lines[0]);
    const num = new Set(['dormitorios', 'banos', 'm2_utiles', 'm2_terreno', 'estacionamiento', 'bodega', 'antiguedad', 'precio_uf', 'uf_m2']);
    return lines.slice(1).map((ln, i) => {
      const c = splitCsv(ln); const o = {};
      hd.forEach((h, j) => { let v = c[j]; if (num.has(h)) v = parseFloat(v) || 0; o[h] = v; });
      if (!o.id) o.id = 'R' + i;
      if (!o.tipo) o.tipo = 'Departamento';
      if (!o.uf_m2 && o.precio_uf) { const m = (o.tipo === 'Departamento' || o.tipo === 'Casa') ? o.m2_utiles : o.m2_terreno; o.uf_m2 = m ? o.precio_uf / m : 0; }
      return o;
    });
  }
  function splitCsv(l) { const out = []; let cur = '', q = false; for (let i = 0; i < l.length; i++) { const ch = l[i]; if (ch === '"') { if (q && l[i + 1] === '"') { cur += '"'; i++; } else q = !q; } else if (ch === ',' && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out; }

  // ---------- UF en vivo ----------
  function applyUF() {
    if (window.UF && UF.value) {
      P.uf = UF.value;
      if ($('ufValue')) $('ufValue').value = Math.round(UF.value);
      if ($('ufStamp')) $('ufStamp').textContent = 'UF de hoy: $' + Math.round(UF.value).toLocaleString('es-CL') + (UF.date ? ' · ' + new Date(UF.date).toLocaleDateString('es-CL') : '');
      render();
    }
  }
  document.addEventListener('uf-ready', applyUF);

  // ---------- Arranque ----------
  document.addEventListener('DOMContentLoaded', () => {
    if (!window.RADAR_DEMO) { $('banner').innerHTML = '⚠️ No se encontró radar-data.js'; return; }
    bind();
    if ($('pTasa')) $('pTasa').value = P.tasaAnual;
    if ($('ufValue')) $('ufValue').value = Math.round(P.uf);
    init(JSON.parse(JSON.stringify(window.RADAR_DEMO)));
    applyUF();
  });
})();
