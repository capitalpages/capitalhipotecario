/* ============================================================
   Capital Hipotecario — simulador.js
   Imita el simulador de BICE Hipotecaria:
   - Trabaja en UF (valor en vivo) con equivalente en pesos
   - Desglose: tasa anual, CAE, dividendo sin seguros, seguros,
     gastos operacionales y costo total del crédito
   - Modo "¿Cuánto puedo pedir?" (renta -> dividendo y crédito máx.)
   Parámetros del producto definidos por el cliente (no por BICE).
   ============================================================ */
(function(){
  const F = {
    // factores referenciales de seguros y gastos (editables)
    segIncendio: 0.00022,   // mensual, por UF de valor de propiedad
    segDesgravamen: 0.00018,// mensual, por UF de saldo inicial
    gastosOperac: 0.020     // 2% del crédito, por una vez
  };

  const state = { tipo:"casa", valor:120000000, fin:90, plazo:30, tasa:CONFIG.tasaDefault, renta:1500000 };

  // ---- helpers ----
  const $ = id => document.getElementById(id);
  const parseNum = s => parseInt(String(s).replace(/[^\d]/g,""),10)||0;
  const tasaMensual = i => Math.pow(1+i/100,1/12)-1;
  function cuota(P,i,n){ const r=tasaMensual(i); return r===0? P/n : P*(r*Math.pow(1+r,n))/(Math.pow(1+r,n)-1); }
  // CAE: TIR anual del flujo crédito vs dividendos con seguros (bisección)
  function caePct(credito,divConSeg,n){
    let lo=0, hi=1; // tasa mensual 0..100%
    const npv=r=>{let s=-credito;for(let t=1;t<=n;t++)s+=divConSeg/Math.pow(1+r,t);return s;};
    if(npv(lo)<0) return state.tasa; // sin costos extra
    for(let k=0;k<80;k++){const m=(lo+hi)/2; if(npv(m)>0){lo=m;}else{hi=m;}}
    const rm=(lo+hi)/2; return (Math.pow(1+rm,12)-1)*100;
  }

  // ---- modo 1: dividendo ----
  function calcDividendo(){
    const uf=UF.value;
    const valorUF=state.valor/uf;
    const creditoUF=valorUF*state.fin/100;
    const pieUF=valorUF-creditoUF;
    const n=state.plazo*12;
    const divSinSegUF=cuota(creditoUF,state.tasa,n);
    const segUF=valorUF*F.segIncendio + creditoUF*F.segDesgravamen;
    const divConSegUF=divSinSegUF+segUF;
    const gopUF=creditoUF*F.gastosOperac;
    const costoTotalUF=divConSegUF*n+gopUF;
    const cae=caePct(creditoUF,divConSegUF,n);

    const toCLP=x=>x*uf;
    set("rValor", fmtUF(valorUF), fmtCLP.format(state.valor));
    set("rDiv", fmtCLP.format(toCLP(divSinSegUF)));
    set("rDivUF", "≈ "+fmtUF(divSinSegUF)+" / mes");
    set("rTasa", state.tasa.toLocaleString("es-CL")+"%");
    set("rPlazo", state.plazo+" años");
    set("rCredito", fmtUF(creditoUF), fmtCLP.format(toCLP(creditoUF)));

    const ufTxt = UF.date ? UF.date.toLocaleDateString("es-CL") : "valor referencial";
    const st=$("ufStamp"); if(st) st.textContent=`Valor UF al ${ufTxt}: ${fmtCLP.format(uf)}`;

    window.lastSim = `Simulación dividendo: Propiedad ${fmtCLP.format(state.valor)} (${fmtUF(valorUF)}) · Financia ${state.fin}% · Plazo ${state.plazo} años · Tasa ${state.tasa}% · Dividendo aprox. ${fmtCLP.format(toCLP(divSinSegUF))}`;
  }

  // ---- modo 2: capacidad ----
  function calcCapacidad(){
    const uf=UF.value;
    const divMaxCLP=state.renta*0.25;
    const divMaxUF=divMaxCLP/uf;
    const n=state.plazoCap*12;
    const r=tasaMensual(state.tasa);
    const creditoMaxUF = r===0 ? divMaxUF*n : divMaxUF*(Math.pow(1+r,n)-1)/(r*Math.pow(1+r,n));
    const creditoMaxCLP=creditoMaxUF*uf;
    const valorMaxCLP=creditoMaxCLP/0.90; // financiando 90%

    set("cDivMax", fmtCLP.format(divMaxCLP));
    set("cDivMaxUF","≈ "+fmtUF(divMaxUF)+" / mes");
    set("cCredito", fmtUF(creditoMaxUF));
    set("cCreditoUF","≈ "+fmtCLP.format(creditoMaxCLP));
    set("cValor", fmtCLP.format(valorMaxCLP));
    set("cPlazoCap", state.plazoCap+" años");
    const ufTxt = UF.date ? UF.date.toLocaleDateString("es-CL") : "valor referencial";
    const st=$("ufStampCap"); if(st) st.textContent=`Valor UF al ${ufTxt}: ${fmtCLP.format(uf)}`;

    window.lastSim = `Simulación capacidad: Renta líquida ${fmtCLP.format(state.renta)} · Plazo ${state.plazoCap} años · Crédito máx. aprox. ${fmtUF(creditoMaxUF)} (${fmtCLP.format(creditoMaxCLP)})`;
  }

  function set(id,val,sub){
    const e=$(id); if(!e)return;
    if(sub!==undefined){ e.innerHTML = `${val} <small>${sub}</small>`; }
    else e.textContent=val;
  }

  function recalc(){ calcDividendo(); calcCapacidad(); }

  // ---- wiring ----
  document.addEventListener("DOMContentLoaded", ()=>{
    if(!$("sim")) return;

    // tabs
    document.querySelectorAll(".sim-tabs button").forEach(b=>{
      b.addEventListener("click",()=>{
        document.querySelectorAll(".sim-tabs button").forEach(x=>x.classList.remove("active"));
        b.classList.add("active");
        document.querySelectorAll("[data-pane]").forEach(p=>p.style.display="none");
        $(b.dataset.target).style.display="grid";
      });
    });

    // tipo propiedad
    const segTipo=$("segTipo");
    if(segTipo) segTipo.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;
      segTipo.querySelectorAll("button").forEach(x=>x.classList.remove("active"));b.classList.add("active");state.tipo=b.dataset.tipo;});

    // valor propiedad (solo input)
    const valor=$("valor"), ufEq=$("ufEq");
    function ufHint(){ if(ufEq) ufEq.innerHTML=`Equivale a <b>${fmtUF(state.valor/UF.value)}</b>`; }
    if(valor){
      valor.addEventListener("input",()=>{let v=parseNum(valor.value);valor.value=v?fmtMiles(v):"";state.valor=v;ufHint();recalc();});
      valor.addEventListener("blur",()=>{if(state.valor<20000000){state.valor=20000000;valor.value=fmtMiles(state.valor);ufHint();recalc();}});
    }

    // financiamiento
    const segFin=$("segFin");
    if(segFin) segFin.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;
      segFin.querySelectorAll("button").forEach(x=>x.classList.remove("active"));b.classList.add("active");state.fin=+b.dataset.fin;recalc();});

    // plazo (segmentos)
    const segPlazo=$("segPlazo");
    if(segPlazo) segPlazo.addEventListener("click",e=>{const b=e.target.closest("button");if(!b)return;
      segPlazo.querySelectorAll("button").forEach(x=>x.classList.remove("active"));b.classList.add("active");state.plazo=+b.dataset.plazo;recalc();});

    // tasa
    const tasa=$("tasa");
    if(tasa) tasa.addEventListener("input",()=>{const t=parseFloat(tasa.value.replace(",","."));state.tasa=isNaN(t)?0:t;recalc();});

    // capacidad: renta + plazo stepper
    state.plazoCap=30;
    const renta=$("renta");
    if(renta) renta.addEventListener("input",()=>{let v=parseNum(renta.value);renta.value=v?fmtMiles(v):"";state.renta=v;recalc();});
    const capMinus=$("capMinus"), capPlus=$("capPlus"), capVal=$("capPlazoVal");
    function setCap(v){state.plazoCap=Math.max(5,Math.min(40,v));if(capVal)capVal.firstChild.nodeValue=state.plazoCap;recalc();}
    if(capMinus) capMinus.addEventListener("click",()=>setCap(state.plazoCap-5));
    if(capPlus) capPlus.addEventListener("click",()=>setCap(state.plazoCap+5));

    // recalcular cuando llegue la UF en vivo
    document.addEventListener("uf-ready",()=>{ufHint&&ufHint();recalc();});
    ufHint&&ufHint(); recalc();
  });
})();
