const PRINT_PAYLOAD_KEY = 'foundations_print_payload';

const raw = localStorage.getItem(PRINT_PAYLOAD_KEY);
if(raw){
  try{
    const payload = JSON.parse(raw);
    renderSheet(payload.config, payload.week);
  }catch(e){
    document.body.innerHTML = '<p style="padding:40px;font-family:sans-serif">No se pudo cargar la semana. Vuelve a la pestaña del planificador e intenta de nuevo con "Generar PDF".</p>';
  }
} else {
  document.body.innerHTML = '<p style="padding:40px;font-family:sans-serif">No hay datos para mostrar. Vuelve a la pestaña del planificador e intenta de nuevo con "Generar PDF".</p>';
}

document.getElementById('btnPrint').addEventListener('click', ()=> window.print());
document.getElementById('btnClose').addEventListener('click', ()=> window.close());
