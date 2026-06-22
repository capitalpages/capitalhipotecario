/* ============================================================
   Capital Hipotecario — main.js (compartido en todas las páginas)
   EDITA EL BLOQUE CONFIG ANTES DE PUBLICAR
   ============================================================ */
window.CONFIG = {
  whatsapp: "56966593109",                  // ← número sin + ni espacios
  whatsappMsg: "Hola, vengo del sitio Capital Hipotecario y quiero información sobre un crédito hipotecario.",
  email: "contacto@capitalhipotecario.cl",  // ← correo de contacto
  phoneDisplay: "+56 9 6659 3109",           // ← teléfono visible
  // URL del Google Apps Script que recibe el formulario y envía el correo
  // (mismo enfoque que Asfink). Si queda vacío, el formulario abre el correo.
  formEndpoint: "",
  // Pega tu enlace de Calendly para incrustar la agenda en agenda.html
  calendly: "",
  // Tasa referencial anual y valor UF de respaldo (se actualiza en vivo si hay conexión)
  tasaDefault: 5.3,
  ufFallback: 39800
};

/* ---------- Valor UF en vivo (mindicador.cl) ---------- */
window.UF = { value: CONFIG.ufFallback, date: null };
window.ufReady = (async function(){
  try{
    const r = await fetch("https://mindicador.cl/api/uf");
    if(r.ok){
      const d = await r.json();
      if(d && d.serie && d.serie[0]){
        UF.value = d.serie[0].valor;
        UF.date  = new Date(d.serie[0].fecha);
      }
    }
  }catch(e){ /* usa el respaldo */ }
  document.dispatchEvent(new Event("uf-ready"));
  return UF;
})();

/* ---------- Aplicar CONFIG a la página ---------- */
document.addEventListener("DOMContentLoaded", ()=>{
  const waUrl = `https://wa.me/${CONFIG.whatsapp}?text=${encodeURIComponent(CONFIG.whatsappMsg)}`;
  document.querySelectorAll("[data-wa]").forEach(e=>e.href=waUrl);
  document.querySelectorAll("[data-mail]").forEach(e=>{e.href="mailto:"+CONFIG.email; if(e.dataset.mail==="text")e.textContent=CONFIG.email;});
  document.querySelectorAll("[data-tel]").forEach(e=>{e.href="tel:"+CONFIG.phoneDisplay.replace(/\s/g,""); if(e.dataset.tel==="text")e.textContent=CONFIG.phoneDisplay;});
  document.querySelectorAll("[data-phone-text]").forEach(e=>e.textContent=CONFIG.phoneDisplay);

  /* menú móvil */
  const burger=document.getElementById("burger"), mm=document.getElementById("mobileMenu");
  if(burger&&mm){
    burger.addEventListener("click",()=>{mm.style.display = mm.style.display==="flex"?"none":"flex";});
    mm.querySelectorAll("a").forEach(a=>a.addEventListener("click",()=>mm.style.display="none"));
  }

  /* reveal al hacer scroll */
  const io=new IntersectionObserver(es=>{es.forEach(en=>{if(en.isIntersecting){en.target.classList.add("in");io.unobserve(en.target);}});},{threshold:.12});
  document.querySelectorAll(".reveal").forEach(el=>io.observe(el));

  /* Calendly embed en agenda.html */
  const cal=document.getElementById("calEmbed");
  if(cal && CONFIG.calendly){
    cal.innerHTML=`<iframe src="${CONFIG.calendly}?hide_gdpr_banner=1&primary_color=16b8c6" width="100%" height="640" frameborder="0" style="border:0"></iframe>`;
  }

  /* formulario de contacto */
  const form=document.getElementById("contactForm");
  if(form) initForm(form);
});

/* ---------- Formato moneda ---------- */
window.fmtCLP = new Intl.NumberFormat("es-CL",{style:"currency",currency:"CLP",maximumFractionDigits:0});
window.fmtUF  = n => new Intl.NumberFormat("es-CL",{minimumFractionDigits:2,maximumFractionDigits:2}).format(n)+" UF";
window.fmtMiles = n => new Intl.NumberFormat("es-CL").format(Math.round(n));

/* ---------- Formulario ---------- */
function initForm(form){
  const msg=form.querySelector(".form-msg")||document.getElementById("formMsg");
  const btn=form.querySelector("[type=submit]");
  form.addEventListener("submit", async e=>{
    e.preventDefault();
    msg.className="form-msg";
    const data={
      nombre:form.nombre.value.trim(),
      email:form.email.value.trim(),
      telefono:form.telefono.value.trim(),
      motivo:form.motivo?form.motivo.value:"",
      mensaje:form.mensaje?form.mensaje.value.trim():"",
      simulacion: window.lastSim || "",
      origen:"Sitio Capital Hipotecario"
    };
    if(!data.nombre||!data.email||!data.telefono){
      msg.textContent="Completa nombre, teléfono y email para enviar.";
      msg.classList.add("err"); return;
    }
    btn.disabled=true; const orig=btn.textContent; btn.textContent="Enviando...";
    try{
      if(CONFIG.formEndpoint){
        await fetch(CONFIG.formEndpoint,{method:"POST",body:JSON.stringify(data),headers:{"Content-Type":"text/plain;charset=utf-8"}});
        msg.textContent="¡Listo! Recibimos tu consulta. Te contactaremos a la brevedad.";
        msg.classList.add("ok"); form.reset();
      }else{
        const body=`Nombre: ${data.nombre}%0ATeléfono: ${data.telefono}%0AEmail: ${data.email}%0AMotivo: ${data.motivo}%0AMensaje: ${data.mensaje}%0A%0A${data.simulacion}`;
        window.location.href=`mailto:${CONFIG.email}?subject=${encodeURIComponent("Consulta crédito hipotecario — "+data.nombre)}&body=${body}`;
        msg.textContent="Te redirigimos a tu correo para enviar la consulta. (Conecta el backend para recibirlas automáticamente.)";
        msg.classList.add("ok");
      }
    }catch(err){
      msg.textContent="Hubo un problema al enviar. Escríbenos por WhatsApp y te ayudamos.";
      msg.classList.add("err");
    }finally{ btn.disabled=false; btn.textContent=orig; }
  });
}
