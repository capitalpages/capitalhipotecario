/* ============================================================
   Capital Hipotecario — bot.js
   "Capi": asistente virtual sobre créditos hipotecarios.
   Botones rápidos enrutados por id + texto libre por palabras
   clave (con acentos normalizados) + paso a WhatsApp.
   ============================================================ */
(function(){
  function waLink(){
    const c = window.CONFIG || {whatsapp:"56966593109",whatsappMsg:""};
    return `https://wa.me/${c.whatsapp}?text=${encodeURIComponent(c.whatsappMsg||"Hola, quiero información sobre un crédito hipotecario.")}`;
  }
  // normaliza: minúsculas y sin acentos
  const norm = s => String(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");

  // Base de conocimiento (cada item tiene id + palabras clave ya sin acentos)
  const KB = {
    saludo:{keys:["hola","buenas","buenos dias","buenas tardes","hey","ola","que tal"],
      a:"¡Hola! 👋 Soy <b>Capi</b>, tu asistente de Capital Hipotecario. Puedo orientarte sobre dividendos, pie, tasas, UF, documentos y el proceso. ¿Qué te gustaría saber?"},
    pie:{keys:["cuanto pie","pie necesito","pie inicial","de pie","el pie","financiamiento","financiar","cuanto financian","cuanto se financia"],
      a:"El <b>pie</b> es la parte del valor que pagas con tus ahorros; el resto lo financia el crédito. Trabajamos con financiamiento de <b>80%, 85% o 90%</b>:<br>• 80% → pie 20%<br>• 85% → pie 15%<br>• 90% → pie 10%<br>Mientras menos pie, mayor el crédito y el dividendo. Considera además los gastos operacionales (2%–4% del crédito). Compara los tres escenarios en el <a href='simulador.html'>simulador</a>."},
    dividendo:{keys:["dividendo","cuota","cuanto pago","cuanto pagaria","mensual","pago mensual","como se calcula"],
      a:"El <b>dividendo</b> es tu cuota mensual. Depende del valor de la propiedad, cuánto financias, el plazo y la tasa, más los seguros. Calcúlalo al instante en el <a href='simulador.html'>simulador</a> — lo muestra con y sin seguros."},
    tasa:{keys:["tasa","interes","fija","variable","mixta","5,3","5.3","53"],
      a:"Nuestra tasa <b>referencial es 5,3% anual</b> (la real depende de tu evaluación y del banco). La <b>tasa fija</b> mantiene tu dividendo estable todo el crédito; la <b>variable</b> puede subir o bajar. La mayoría en Chile elige fija por la certeza."},
    uf:{keys:["uf","unidad de fomento","por que cambia","reajuste","en pesos"],
      a:"En Chile los créditos van en <b>UF</b>, no en pesos. La UF se reajusta con la inflación, así que tu dividendo en UF es fijo pero en pesos sube de a poco cada mes. El simulador usa la <b>UF del día</b> y muestra el equivalente en pesos."},
    documentos:{keys:["documento","documentos","papeles","requisito","requisitos","liquidacion","afp","dicom","que piden","que me piden","carpeta tributaria","que necesito llevar"],
      a:"Para renta dependiente normalmente piden: <b>cédula</b>, <b>3–6 liquidaciones de sueldo</b>, <b>certificado de cotizaciones AFP</b>, <b>antigüedad laboral</b>, <b>cartola del pie</b> e <b>informe de deudas</b>. Si eres independiente, se suman tus <b>F22</b> de los últimos 2 años."},
    cae:{keys:["cae","carga anual","costo total del credito","costo real"],
      a:"El <b>CAE</b> (Carga Anual Equivalente) resume el costo real del crédito incluyendo seguros y gastos, por eso suele ser algo mayor que la tasa. Es la mejor cifra para comparar ofertas entre bancos. En el <a href='simulador.html'>simulador</a> lo ves junto al desglose."},
    plazo:{keys:["plazo","cuantos anos","anos","40 anos","30 anos","20 anos","a cuanto tiempo"],
      a:"Ofrecemos plazos de <b>15 a 40 años</b>. A mayor plazo, menor dividendo mensual, pero pagas más intereses en total. Pruébalos en el <a href='simulador.html'>simulador</a>."},
    seguros:{keys:["seguro","seguros","desgravamen","incendio","sismo"],
      a:"Todo crédito lleva <b>seguro de desgravamen</b> (cubre la deuda en caso de fallecimiento) y <b>seguro de incendio y sismo</b> (protege la propiedad). El simulador los estima dentro del dividendo."},
    gastos:{keys:["gastos","operacionales","notaria","tasacion","escritura","gop","gastos asociados"],
      a:"Los <b>gastos operacionales</b> (tasación, estudio de títulos, notaría, impuesto al mutuo e inscripción) se pagan una vez al inicio y suman entre <b>2% y 4%</b> del crédito. El simulador te muestra una estimación."},
    capacidad:{keys:["cuanto puedo pedir","capacidad","con mi renta","cuanto me prestan","cuanto presta","segun mi sueldo","cuanto podria pedir","gano"],
      a:"Como referencia, el dividendo no debería superar el <b>25% de tu renta líquida</b>. En la pestaña <b>“¿Cuánto puedo pedir?”</b> del <a href='simulador.html'>simulador</a> ingresas tu renta y te estima el crédito y la propiedad máxima."},
    refinanciar:{keys:["refinanciar","portabilidad","cambiar de banco","bajar dividendo","bajar la cuota","ya tengo credito"],
      a:"Sí: podemos ayudarte a <b>refinanciar</b> o hacer <b>portabilidad financiera</b> para bajar tu tasa o tu dividendo. Cuéntanos tu caso en <a href='contacto.html'>contacto</a> o por WhatsApp y lo revisamos."},
    primera:{keys:["primera vivienda","primera casa","comprar casa","comprar departamento","comprar mi primera"],
      a:"Para tu <b>primera vivienda</b> financiamos hasta el 90% con plazos de hasta 40 años. Lo ideal es partir simulando y luego conversamos tu caso. ¿Quieres que te oriente un asesor?"},
    subsidio:{keys:["subsidio","ds1","ds19","ds 1","ds 19"],
      a:"Apoyamos crédito complementario para <b>subsidios DS1 y DS19</b>. Lo mejor es revisarlo caso a caso: déjanos tus datos en <a href='contacto.html'>contacto</a> o escríbenos por WhatsApp."},
    proceso:{keys:["proceso","como funciona","pasos","etapas","como es el tramite"],
      a:"El proceso es: <b>1)</b> simulas y conversamos · <b>2)</b> reúnes documentos · <b>3)</b> evaluación y aprobación en varios bancos · <b>4)</b> tasación y escrituras · <b>5)</b> recibes las llaves. Te acompañamos en cada paso."},
    costo:{keys:["costo","gratis","cobran","cobran algo","honorario","honorarios","comision","tiene costo"],
      a:"La <b>asesoría es sin costo</b>. Comparamos varios bancos para conseguirte la mejor opción, sin compromiso."},
    agenda:{keys:["agenda","reunion","hablar","contacto","asesor","ejecutivo","quiero hablar","contactar"],
      a:"Con gusto. Puedes dejar tus datos en <a href='contacto.html'>contacto</a> o hablar ahora mismo con un asesor por WhatsApp 👇"},
    gracias:{keys:["gracias","thank","genial","perfecto","listo","ok gracias"],
      a:"¡De nada! 😊 Si quieres, simula tu crédito en el <a href='simulador.html'>simulador</a> o escríbenos por WhatsApp para hablar con un asesor."}
  };

  // Botones rápidos enrutados directamente a su respuesta (sin adivinar)
  const CHIPS = [
    {t:"¿Cuánto pie necesito?", id:"pie"},
    {t:"¿Cómo se calcula el dividendo?", id:"dividendo"},
    {t:"Tasa fija o variable", id:"tasa"},
    {t:"¿Qué es la UF?", id:"uf"},
    {t:"Documentos necesarios", id:"documentos"},
    {t:"¿Cuánto puedo pedir?", id:"capacidad"}
  ];

  function findAnswer(text){
    const t = norm(text);
    let best=null, score=0;
    for(const id in KB){
      let s=0;
      for(const k of KB[id].keys){ if(t.includes(k)) s += k.length; }
      if(s>score){ score=s; best=KB[id]; }
    }
    if(best) return best.a;
    return "No estoy seguro de eso 🤔, pero un asesor puede ayudarte en detalle. Puedes <a href='contacto.html'>dejar tus datos</a> o escribirnos por WhatsApp. Mientras, prueba el <a href='simulador.html'>simulador</a> para estimar tu dividendo.";
  }

  function build(){
    if(document.getElementById("capiPanel")) return;
    const wa = waLink();

    const fab = document.createElement("button");
    fab.className="capi-fab"; fab.id="capiFab";
    fab.innerHTML = `<span class="av">✦</span><span>Habla con Capi</span><span class="badge-n">1</span>`;

    const panel = document.createElement("div");
    panel.className="capi-panel"; panel.id="capiPanel";
    panel.innerHTML = `
      <div class="capi-head">
        <div class="av">✦</div>
        <div class="who"><b>Capi · Asistente hipotecario</b><small>En línea · Responde al instante</small></div>
        <button class="x" id="capiX" aria-label="Cerrar"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M18 6 6 18M6 6l12 12"/></svg></button>
      </div>
      <div class="capi-body" id="capiBody"></div>
      <div class="capi-chips" id="capiChips"></div>
      <div class="capi-foot">
        <input id="capiInput" type="text" placeholder="Escribe tu pregunta..." autocomplete="off">
        <button id="capiSend" aria-label="Enviar"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg></button>
      </div>
      <div class="capi-wa"><a href="${wa}" target="_blank" rel="noopener">💬 ¿Prefieres hablar con un ejecutivo? Cambia a WhatsApp →</a></div>`;

    document.body.appendChild(fab);
    document.body.appendChild(panel);

    const body=panel.querySelector("#capiBody");
    const chipsBox=panel.querySelector("#capiChips");
    const input=panel.querySelector("#capiInput");

    function addMsg(html, who){
      const m=document.createElement("div");
      m.className="capi-msg "+who; m.innerHTML=html;
      body.appendChild(m); body.scrollTop=body.scrollHeight;
    }
    function botSay(html){ setTimeout(()=>addMsg(html,"bot"),250); }

    function renderChips(){
      chipsBox.innerHTML="";
      CHIPS.forEach(c=>{
        const b=document.createElement("button");
        b.className="capi-chip"; b.textContent=c.t;
        b.onclick=()=>{ addMsg(c.t,"user"); botSay(KB[c.id].a); };
        chipsBox.appendChild(b);
      });
    }
    function handleText(text){
      addMsg(text,"user");
      botSay(findAnswer(text));
    }

    let started=false;
    function open(){
      panel.classList.add("open"); fab.classList.add("hidden");
      if(!started){
        started=true;
        addMsg("¡Hola! 👋 Soy <b>Capi</b>, el asistente virtual de Capital Hipotecario. Te oriento sobre dividendos, pie, tasas, UF, documentos y el proceso.","bot");
        botSay("¿En qué te puedo ayudar hoy?");
        renderChips();
      }
      setTimeout(()=>input.focus(),300);
    }
    function close(){ panel.classList.remove("open"); fab.classList.remove("hidden"); }

    fab.onclick=open;
    panel.querySelector("#capiX").onclick=close;
    panel.querySelector("#capiSend").onclick=()=>{ const v=input.value.trim(); if(v){ handleText(v); input.value=""; } };
    input.addEventListener("keydown",e=>{ if(e.key==="Enter"){ const v=input.value.trim(); if(v){ handleText(v); input.value=""; } } });
  }

  if(document.readyState!=="loading") build();
  else document.addEventListener("DOMContentLoaded",build);
})();
