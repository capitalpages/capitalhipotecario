/* ============================================================
   Capital Hipotecario — herosim.js
   Simulador inline del inicio (estilo de la referencia):
   - "Por Renta": ingreso líquido -> dividendo máximo + crédito máximo (UF)
   - "Por Monto de Crédito": monto UF -> dividendo estimado + renta necesaria
   Usa window.UF (valor en vivo) de main.js. Cálculo referencial.
   ============================================================ */
(function(){
  if(!document.getElementById("presim")) return;
  const TASA=(window.CONFIG&&CONFIG.tasaDefault)||5.3, N=360, RATIO=0.25;
  const r=Math.pow(1+TASA/100,1/12)-1;
  const AF=(1-Math.pow(1+r,-N))/r;                // factor: crédito = dividendo * AF
  const $=id=>document.getElementById(id);
  const parseNum=s=>parseInt(String(s).replace(/[^\d]/g,""),10)||0;
  const miles=n=>new Intl.NumberFormat("es-CL").format(Math.round(n));
  const clp=n=>"$"+miles(n);
  const ufFmt=n=>miles(Math.round(n/10)*10)+" UF";   // crédito redondeado a 10 UF
  const st={renta:1800000, monto:2000};

  function uf(){ return (window.UF&&UF.value)||((window.CONFIG&&CONFIG.ufFallback)||39800); }

  function calc(){
    const u=uf();
    // Por Renta
    const divMax=st.renta*RATIO;
    const credMaxUF=(divMax/u)*AF;
    if($("preDivMax")) $("preDivMax").textContent=clp(divMax);
    if($("preCredMax")) $("preCredMax").innerHTML=ufFmt(credMaxUF)+" <small>≈ "+clp(credMaxUF*u)+"</small>";
    // Por Monto
    const cuotaUF=st.monto/AF;
    const divEst=cuotaUF*u;
    const rentaNec=divEst/RATIO;
    if($("preDivEst")) $("preDivEst").textContent=clp(divEst);
    if($("preRentaNec")) $("preRentaNec").textContent=clp(rentaNec);
    // sello UF
    const stamp=$("preUf");
    if(stamp){ const d=(window.UF&&UF.date)?UF.date.toLocaleDateString("es-CL"):"hoy"; stamp.innerHTML='Valor UF al '+d+': <span class="uf">'+clp(u)+'</span>'; }
    window.lastSim=`Pre-aprobación · Renta ${clp(st.renta)} → Dividendo máx ${clp(divMax)} · Crédito máx ${ufFmt(credMaxUF)}`;
  }

  document.addEventListener("DOMContentLoaded",()=>{
    const rentaIn=$("preRentaIn"), montoIn=$("preMontoIn");
    if(rentaIn) rentaIn.addEventListener("input",()=>{const v=parseNum(rentaIn.value);rentaIn.value=v?miles(v):"";st.renta=v;calc();});
    if(montoIn) montoIn.addEventListener("input",()=>{const v=parseNum(montoIn.value);montoIn.value=v?miles(v):"";st.monto=v;calc();});

    document.querySelectorAll(".presim-tabs button").forEach(b=>{
      b.addEventListener("click",()=>{
        document.querySelectorAll(".presim-tabs button").forEach(x=>x.classList.remove("active"));
        b.classList.add("active");
        const mode=b.dataset.pre;
        $("preRenta").style.display = mode==="renta"?"grid":"none";
        $("preMonto").style.display = mode==="monto"?"grid":"none";
      });
    });

    document.addEventListener("uf-ready",calc);
    calc();
  });
})();
