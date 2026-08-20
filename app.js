// ---------- constants ----------
const PRINT_PAYLOAD_KEY = 'foundations_print_payload';
const ASSETS_BUCKET = 'assets';

// ---------- state ----------
let config = { ...DEFAULT_CONFIG };
let current = emptyWeek();

// ---------- Supabase persistence ----------
async function currentUserId(){
  const { data: { user } } = await sb.auth.getUser();
  return user ? user.id : null;
}

async function loadConfig(){
  const { data, error } = await sb.from('app_config').select('payload').maybeSingle();
  if(error || !data) return { ...DEFAULT_CONFIG };
  return { ...DEFAULT_CONFIG, ...data.payload };
}
async function saveConfig(){
  const userId = await currentUserId();
  if(!userId) return;
  await sb.from('app_config').upsert({
    user_id: userId,
    payload: config,
    updated_at: new Date().toISOString(),
  });
}

async function loadWeeks(){
  const { data, error } = await sb
    .from('weeks')
    .select('id, week_number, payload, saved_at')
    .order('saved_at', { ascending: false });
  if(error || !data) return [];
  return data.map(row => ({
    ...row.payload,
    id: row.id,
    week: row.week_number,
    savedAt: row.saved_at ? new Date(row.saved_at).getTime() : null,
  }));
}
async function saveCurrentWeek(){
  const userId = await currentUserId();
  if(!userId) return;
  current.savedAt = Date.now();
  const { error } = await sb.from('weeks').upsert({
    id: current.id,
    user_id: userId,
    week_number: current.week,
    payload: current,
    saved_at: new Date(current.savedAt).toISOString(),
  });
  if(error) throw error;
}
async function deleteWeek(id){
  await sb.from('weeks').delete().eq('id', id);
}

async function uploadAsset(file, prefix){
  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const userId = await currentUserId();
  const path = `${userId}/${prefix}/${makeId()}.${ext}`;
  const { error } = await sb.storage.from(ASSETS_BUCKET).upload(path, file, { upsert: true });
  if(error) throw error;
  const { data } = sb.storage.from(ASSETS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// ---------- render: editor ----------
function renderLogoEditor(){
  const el = document.getElementById('logoPreview');
  el.innerHTML = config.logoDataUrl
    ? `<img src="${config.logoDataUrl}" alt="logo">`
    : `<span class="empty">Sin logo</span>`;
}

function renderConfigEditor(){
  document.getElementById('cfgKicker').value = config.kicker;
  document.getElementById('cfgCommunity').value = config.community;
  document.getElementById('cfgCycle').value = config.cycle;
  document.getElementById('cfgTagline').value = config.tagline;
  document.getElementById('cfgFooterLeft').value = config.footerLeft;
  document.getElementById('cfgFooterRight').value = config.footerRight;
}

function renderTimelineEditor(){
  const el = document.getElementById('timelineEditor');
  el.innerHTML = '';
  current.timeline.forEach((item, idx) => {
    const box = document.createElement('div');
    box.className = 'timeline-item-editor';
    box.innerHTML = `
      <div class="row-head">
        <span>Evento ${idx+1}</span>
        <button class="remove-btn" data-idx="${idx}">✕ Quitar</button>
      </div>
      <div class="tl-preview-row">
        <div class="tl-thumb-preview">${item.img ? `<img src="${item.img}">` : `<span class="empty">Sin imagen</span>`}</div>
        <label style="flex:1;margin:0">Imagen
          <input type="file" accept="image/*" class="tl-img" data-idx="${idx}">
        </label>
      </div>
      <label>Texto en español
        <input type="text" class="tl-es" data-idx="${idx}" value="${escapeAttr(item.es)}">
      </label>
      <label>Texto en inglés
        <input type="text" class="tl-en" data-idx="${idx}" value="${escapeAttr(item.en)}">
      </label>
    `;
    el.appendChild(box);
  });

  el.querySelectorAll('.remove-btn').forEach(btn=>{
    btn.onclick = () => { current.timeline.splice(+btn.dataset.idx,1); renderTimelineEditor(); renderPreview(); };
  });
  el.querySelectorAll('.tl-es').forEach(inp=>{
    inp.oninput = () => { current.timeline[+inp.dataset.idx].es = inp.value; renderPreview(); };
  });
  el.querySelectorAll('.tl-en').forEach(inp=>{
    inp.oninput = () => { current.timeline[+inp.dataset.idx].en = inp.value; renderPreview(); };
  });
  el.querySelectorAll('.tl-img').forEach(inp=>{
    inp.onchange = () => {
      const idx = +inp.dataset.idx;
      const file = inp.files[0];
      if(!file) return;
      inp.disabled = true;
      uploadAsset(file, 'timeline').then(url=>{
        current.timeline[idx].img = url;
        renderTimelineEditor();
        renderPreview();
      }).catch(()=> alert('No se pudo subir la imagen. Intenta de nuevo.'));
    };
  });
}

function renderSubjectsEditor(){
  const el = document.getElementById('subjectsEditor');
  el.innerHTML = '';
  SUBJECTS.forEach(meta=>{
    const data = current.subjects[meta.id];
    const box = document.createElement('div');
    box.className = 'subject-editor';
    box.innerHTML = `
      <div class="row-head"><span>${meta.icon} ${meta.title}</span></div>
      <label>Encabezado / pregunta
        <input type="text" class="sj-label" data-id="${meta.id}" placeholder="${escapeAttr(meta.labelHint)}" value="${escapeAttr(data.label)}">
      </label>
      <label>Contenido</label>
      <div class="rte-toolbar" data-id="${meta.id}">
        <button type="button" class="rte-btn" data-cmd="bold" title="Negrita"><b>N</b></button>
        <button type="button" class="rte-btn" data-cmd="italic" title="Cursiva"><i>K</i></button>
        <button type="button" class="rte-btn" data-cmd="underline" title="Subrayado"><u>S</u></button>
        <button type="button" class="rte-btn bullet" data-cmd="insertUnorderedList" title="Lista con viñetas">• Lista</button>
      </div>
      <div class="rte-editor sj-content" contenteditable="true" data-id="${meta.id}" data-placeholder="Escribe el contenido...">${contentToHtml(data.content)}</div>
      <label>Referencia / nota (opcional)
        <input type="text" class="sj-ref" data-id="${meta.id}" placeholder="${escapeAttr(meta.refHint)}" value="${escapeAttr(data.ref)}">
      </label>
      <div class="checks">
        <label><input type="checkbox" class="sj-armado" data-id="${meta.id}" ${data.armado?'checked':''}> Contenido armado</label>
        <label><input type="checkbox" class="sj-ensenado" data-id="${meta.id}" ${data.ensenado?'checked':''}> Contenido enseñado</label>
      </div>
    `;
    el.appendChild(box);
  });

  el.querySelectorAll('.sj-label').forEach(inp=>{
    inp.oninput = () => { current.subjects[inp.dataset.id].label = inp.value; renderPreview(); };
  });
  el.querySelectorAll('.sj-content').forEach(editor=>{
    editor.oninput = () => {
      current.subjects[editor.dataset.id].content = sanitizeHtml(editor.innerHTML);
      renderPreview();
    };
  });
  el.querySelectorAll('.rte-btn').forEach(btn=>{
    // mousedown + preventDefault keeps the editor's text selection intact so
    // the formatting command applies to the highlighted text, not nothing.
    btn.addEventListener('mousedown', (e)=>{
      e.preventDefault();
      const id = btn.parentElement.dataset.id;
      const editor = el.querySelector(`.sj-content[data-id="${id}"]`);
      editor.focus();
      document.execCommand(btn.dataset.cmd, false, null);
      current.subjects[id].content = sanitizeHtml(editor.innerHTML);
      renderPreview();
    });
  });
  el.querySelectorAll('.sj-ref').forEach(inp=>{
    inp.oninput = () => { current.subjects[inp.dataset.id].ref = inp.value; renderPreview(); };
  });
  el.querySelectorAll('.sj-armado').forEach(inp=>{
    inp.onchange = () => { current.subjects[inp.dataset.id].armado = inp.checked; renderPreview(); };
  });
  el.querySelectorAll('.sj-ensenado').forEach(inp=>{
    inp.onchange = () => { current.subjects[inp.dataset.id].ensenado = inp.checked; renderPreview(); };
  });
}

// ---------- render: preview / sheet ----------
function renderPreview(){
  renderSheet(config, current);
}

// ---------- weeks management ----------
function renderWeeksMenuList(weeks){
  const menu = document.getElementById('menuSemanas');
  if(weeks.length === 0){
    menu.innerHTML = `<div class="dropdown-empty">No hay semanas guardadas todavía.</div>`;
    return;
  }
  menu.innerHTML = weeks.map(w => `
    <div class="dropdown-item" data-id="${w.id}">
      <span>Semana ${String(w.week).padStart(2,'0')} ${w.savedAt ? '· ' + new Date(w.savedAt).toLocaleDateString() : ''}</span>
      <span class="del" data-del="${w.id}">Eliminar</span>
    </div>
  `).join('');

  menu.querySelectorAll('.dropdown-item').forEach(item=>{
    item.addEventListener('click', (e)=>{
      if(e.target.dataset.del) return;
      const week = weeks.find(w=>w.id===item.dataset.id);
      if(week){
        current = week;
        refreshAll();
        toggleMenu(false);
      }
    });
  });
  menu.querySelectorAll('.del').forEach(del=>{
    del.addEventListener('click', async (e)=>{
      e.stopPropagation();
      await deleteWeek(del.dataset.del);
      const fresh = await loadWeeks();
      renderWeeksMenuList(fresh);
    });
  });
}

function toggleMenu(show){
  const menu = document.getElementById('menuSemanas');
  if(show === undefined) menu.classList.toggle('hidden');
  else menu.classList.toggle('hidden', !show);
}

function refreshAll(){
  document.getElementById('weekNumber').value = current.week;
  renderTimelineEditor();
  renderSubjectsEditor();
  renderConfigEditor();
  renderLogoEditor();
  renderPreview();
}

// ---------- events ----------
document.getElementById('weekNumber').addEventListener('input', (e)=>{
  current.week = parseInt(e.target.value || '1', 10);
  renderPreview();
});

document.getElementById('btnAddTimeline').addEventListener('click', ()=>{
  current.timeline.push({ img:null, es:'', en:'' });
  renderTimelineEditor();
  renderPreview();
});

document.getElementById('btnNueva').addEventListener('click', ()=>{
  if(!confirm('¿Crear una semana nueva en blanco? Los cambios no guardados se perderán.')) return;
  const nextWeekNum = current.week + 1;
  current = emptyWeek();
  current.week = nextWeekNum;
  refreshAll();
});

document.getElementById('btnGuardar').addEventListener('click', async ()=>{
  const btn = document.getElementById('btnGuardar');
  btn.disabled = true;
  btn.textContent = 'Guardando…';
  try{
    await saveCurrentWeek();
    alert('Semana ' + String(current.week).padStart(2,'0') + ' guardada en la nube.');
  }catch(e){
    alert('No se pudo guardar. Revisa tu conexión e intenta de nuevo.');
  }finally{
    btn.disabled = false;
    btn.textContent = 'Guardar semana';
  }
});

document.getElementById('btnPDF').addEventListener('click', ()=>{
  localStorage.setItem(PRINT_PAYLOAD_KEY, JSON.stringify({ config, week: current }));
  window.open('print.html', '_blank');
});

document.getElementById('btnConfig').addEventListener('click', ()=>{
  const panel = document.getElementById('panelConfig');
  panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('btnSemanas').addEventListener('click', async (e)=>{
  e.stopPropagation();
  toggleMenu(true);
  const menu = document.getElementById('menuSemanas');
  menu.innerHTML = `<div class="dropdown-empty">Cargando…</div>`;
  const weeks = await loadWeeks();
  renderWeeksMenuList(weeks);
});
document.addEventListener('click', ()=> toggleMenu(false));

['cfgKicker','cfgCommunity','cfgCycle','cfgTagline','cfgFooterLeft','cfgFooterRight'].forEach(id=>{
  document.getElementById(id).addEventListener('input', (e)=>{
    const map = { cfgKicker:'kicker', cfgCommunity:'community', cfgCycle:'cycle', cfgTagline:'tagline', cfgFooterLeft:'footerLeft', cfgFooterRight:'footerRight' };
    config[map[id]] = e.target.value;
    saveConfig();
    renderPreview();
  });
});
document.getElementById('cfgLogo').addEventListener('change', (e)=>{
  const file = e.target.files[0];
  if(!file) return;
  uploadAsset(file, 'logo').then(url=>{
    config.logoDataUrl = url;
    saveConfig();
    renderLogoEditor();
    renderPreview();
  }).catch(()=> alert('No se pudo subir el logo. Intenta de nuevo.'));
});
document.getElementById('cfgLogoClear').addEventListener('click', ()=>{
  config.logoDataUrl = null;
  saveConfig();
  renderLogoEditor();
  renderPreview();
});

// ---------- auth ----------
async function doLogin(){
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const errEl = document.getElementById('authError');
  errEl.textContent = '';
  if(!email || !password){ errEl.textContent = 'Completa correo y contraseña.'; return; }
  const btn = document.getElementById('btnLogin');
  btn.disabled = true;
  btn.textContent = 'Entrando…';
  const { error } = await sb.auth.signInWithPassword({ email, password });
  btn.disabled = false;
  btn.textContent = 'Iniciar sesión';
  if(error){ errEl.textContent = 'Correo o contraseña incorrectos.'; }
}
document.getElementById('btnLogin').addEventListener('click', doLogin);
document.getElementById('authPassword').addEventListener('keydown', (e)=>{
  if(e.key === 'Enter') doLogin();
});
document.getElementById('btnLogout').addEventListener('click', ()=> sb.auth.signOut());

async function bootApp(){
  document.getElementById('authScreen').classList.add('hidden');
  document.getElementById('appRoot').classList.remove('hidden');
  config = await loadConfig();
  current = emptyWeek();
  refreshAll();
}
function showAuthScreen(){
  document.getElementById('authScreen').classList.remove('hidden');
  document.getElementById('appRoot').classList.add('hidden');
  document.getElementById('authPassword').value = '';
}

sb.auth.onAuthStateChange((_event, session)=>{
  if(session) bootApp();
  else showAuthScreen();
});
