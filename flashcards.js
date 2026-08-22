const PRINT_PAYLOAD_KEY = 'foundations_print_payload';

function renderFlashcards(week){
  const grid = document.getElementById('flashcardGrid');
  grid.innerHTML = SUBJECTS.map(meta => {
    const data = week.subjects[meta.id];
    return `
      <div class="flashcard">
        <div class="flashcard-title"><span class="icon">${meta.icon}</span>${meta.title}</div>
        <div class="flashcard-body">
          ${data.label ? `<div class="flashcard-label">${escapeHtml(data.label)}</div>` : ''}
          <div class="flashcard-content">${contentToHtml(data.content)}</div>
          ${data.ref ? `<div class="flashcard-ref">${escapeHtml(data.ref)}</div>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

const raw = localStorage.getItem(PRINT_PAYLOAD_KEY);
if(raw){
  try{
    const payload = JSON.parse(raw);
    renderFlashcards(payload.week);
  }catch(e){
    document.body.innerHTML = '<p style="padding:40px;font-family:sans-serif">No se pudo cargar la semana. Vuelve a la pestaña del planificador e intenta de nuevo con "Flashcards".</p>';
  }
} else {
  document.body.innerHTML = '<p style="padding:40px;font-family:sans-serif">No hay datos para mostrar. Vuelve a la pestaña del planificador e intenta de nuevo con "Flashcards".</p>';
}

document.getElementById('btnPrint').addEventListener('click', ()=> window.print());
document.getElementById('btnClose').addEventListener('click', ()=> window.close());
