// ---------- shared between editor (app.js) and print view (print.js) ----------
const SUBJECTS = [
  { id:'biblia',     title:'Biblia',      icon:'📖', labelHint:'Pregunta (ej. ¿Cuáles son los dos temas principales de la Biblia?)', refHint:'' , afterDivider:null },
  { id:'caracter',   title:'Carácter',    icon:'☆', labelHint:'Definición: (ej. Ahorro)', refHint:'', afterDivider:null },
  { id:'versiculo',  title:'Versículo',   icon:'❝', labelHint:'Pasaje para memorizar:', refHint:'Referencia (ej. Juan 1:1 NBLA)', afterDivider:null },
  { id:'historia',   title:'Historia',    icon:'🕐', labelHint:'Pregunta (ej. Cuéntame sobre...)', refHint:'', afterDivider:'purple' },
  { id:'geografia',  title:'Geografía',   icon:'⊕', labelHint:'Título (ej. Frontera de Venezuela)', refHint:'', afterDivider:null },
  { id:'artes',      title:'Artes',       icon:'▦', labelHint:'Título (ej. Introducción al dibujo)', refHint:'', afterDivider:null },
  { id:'latin',      title:'Latín',       icon:'T', labelHint:'Título (ej. Preposiciones)', refHint:'', afterDivider:null },
  { id:'espanol',    title:'Español',     icon:'¶', labelHint:'Título (ej. El infinitivo)', refHint:'', afterDivider:'maroon' },
  { id:'ingles',     title:'Inglés',      icon:'⚑', labelHint:'Título (ej. Partes del cuerpo)', refHint:'', afterDivider:null },
  { id:'matematica', title:'Matemática',  icon:'#', labelHint:'Título (ej. Tabla del 1 y del 2)', refHint:'', afterDivider:null },
  { id:'ciencia',    title:'Ciencia',     icon:'⚛', labelHint:'Pregunta (ej. ¿Cuáles son los cuatro tipos de tejidos?)', refHint:'', afterDivider:null },
  { id:'proyecto',   title:'Proyecto',    icon:'🔍', labelHint:'Título (ej. Guiñando)', refHint:'', afterDivider:null },
];

const DEFAULT_CONFIG = {
  kicker: 'PLANIFICACIÓN SEMANAL · PROGRAMA DE MEMORIZACIÓN DE FOUNDATIONS',
  community: 'LOS CHORROS',
  cycle: 'CICLO 03',
  tagline: 'Comunidad Cristiana Clásica',
  footerLeft: 'Comunidad Cristiana Clásica LOS CHORROS',
  footerRight: 'Caracas – Venezuela – 2026-2027',
  logoDataUrl: 'https://hwcjchieqwqgnttccrrd.supabase.co/storage/v1/object/public/assets/a5b00649-3656-4b34-9015-5183797e235b/defaults/640a1c77-50e0-4e0b-985f-826f8c232ace.png',
};

function emptySubjectData(){
  const d = {};
  SUBJECTS.forEach(s => { d[s.id] = { label:'', content:'', ref:'', armado:false, ensenado:false }; });
  return d;
}

// Supabase's "weeks.id" column is uuid, so ids generated on the client must
// already be valid uuids (crypto.randomUUID needs a secure context — https
// or localhost — hence the manual fallback for plain http/file:// testing).
function makeId(){
  if(window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random()*16|0, v = c === 'x' ? r : (r&0x3|0x8);
    return v.toString(16);
  });
}

function emptyWeek(){
  return {
    id: makeId(),
    week: 1,
    savedAt: null,
    timeline: [
      { img:null, es:'', en:'' },
      { img:null, es:'', en:'' },
      { img:null, es:'', en:'' },
    ],
    subjects: emptySubjectData(),
  };
}

function escapeHtml(str){
  return (str||'').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function escapeAttr(str){ return escapeHtml(str); }

function fileToDataUrl(file){
  return new Promise(resolve=>{
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

function computeTimelineSizing(count){
  const sheetInnerWidth = 770; // 850 sheet width - 40px padding each side
  const baseGap = 14;
  const totalGap = baseGap * Math.max(count - 1, 0);
  const availableForThumbs = sheetInnerWidth - totalGap;
  const idealThumb = availableForThumbs / count;
  const thumb = Math.max(30, Math.min(64, Math.floor(idealThumb * 0.62)));
  let fontEs = 10.5, fontEn = 9.5, gap = baseGap;
  if(count > 7){ fontEs = 9.5; fontEn = 8.5; gap = 8; }
  if(count > 9){ fontEs = 8.5; fontEn = 7.5; gap = 6; }
  if(count > 11){ fontEs = 7.5; fontEn = 6.5; gap = 4; }
  return { thumb, gap, fontEs, fontEn };
}

// Legacy plain-text content (from before the rich text editor existed): lines
// starting with "- " become bullets, everything else becomes a paragraph.
function plainTextToHtml(text){
  if(!text) return '';
  const lines = text.split('\n');
  let html = '';
  let inList = false;
  lines.forEach(line=>{
    const trimmed = line.trim();
    if(trimmed.startsWith('- ')){
      if(!inList){ html += '<ul>'; inList = true; }
      html += `<li>${escapeHtml(trimmed.slice(2))}</li>`;
    } else {
      if(inList){ html += '</ul>'; inList = false; }
      if(trimmed) html += `<p>${escapeHtml(trimmed)}</p>`;
    }
  });
  if(inList) html += '</ul>';
  return html;
}

function looksLikeHtml(str){
  return /<[a-z][\s\S]*>/i.test(str || '');
}

const RTE_ALLOWED_TAGS = new Set(['B','STRONG','I','EM','U','BR','P','UL','OL','LI','DIV']);

// Strips any tag/attribute not in the whitelist, keeping only basic text formatting
// (bold/italic/underline/lists) produced by the rich text editor's toolbar.
function sanitizeHtml(html){
  const tmp = document.createElement('div');
  tmp.innerHTML = html || '';
  (function clean(node){
    [...node.childNodes].forEach(child=>{
      if(child.nodeType === 1){
        if(!RTE_ALLOWED_TAGS.has(child.tagName)){
          while(child.firstChild) node.insertBefore(child.firstChild, child);
          node.removeChild(child);
        } else {
          [...child.attributes].forEach(a => child.removeAttribute(a.name));
          clean(child);
        }
      } else if(child.nodeType !== 3){
        node.removeChild(child);
      }
    });
  })(tmp);
  return tmp.innerHTML;
}

// Content saved before the rich text editor was added is plain text; content
// saved after is already sanitized HTML from the editor's execCommand output.
function contentToHtml(raw){
  if(!raw) return '';
  return looksLikeHtml(raw) ? sanitizeHtml(raw) : plainTextToHtml(raw);
}

// Fills the #sheet markup (shared by index.html and print.html) from config + week data.
function renderSheet(config, week){
  document.getElementById('pv-kicker').textContent = config.kicker;
  document.getElementById('pv-community').textContent = config.community;
  document.getElementById('pv-cycle').textContent = config.cycle;
  document.getElementById('pv-week').textContent = 'SEM ' + String(week.week).padStart(2,'0');
  document.getElementById('pv-tagline').textContent = config.tagline;
  document.getElementById('pv-footer-left').textContent = config.footerLeft;
  document.getElementById('pv-footer-right').textContent = config.footerRight;

  const logoEl = document.getElementById('pv-logo');
  logoEl.classList.toggle('empty', !config.logoDataUrl);
  logoEl.innerHTML = config.logoDataUrl
    ? `<img src="${config.logoDataUrl}" alt="logo">`
    : `<span class="placeholder">${escapeHtml(config.tagline)}</span>`;

  const tlEl = document.getElementById('pv-timeline');
  const count = Math.max(week.timeline.length, 1);
  const sizing = computeTimelineSizing(count);
  tlEl.style.setProperty('--tl-thumb', sizing.thumb + 'px');
  tlEl.style.setProperty('--tl-gap', sizing.gap + 'px');
  tlEl.style.setProperty('--tl-font-es', sizing.fontEs + 'px');
  tlEl.style.setProperty('--tl-font-en', sizing.fontEn + 'px');
  tlEl.innerHTML = week.timeline.map(item => `
    <div class="timeline-card">
      <div class="timeline-thumb">${item.img ? `<img src="${item.img}">` : ''}</div>
      <div class="timeline-es">${escapeHtml(item.es)}</div>
      <div class="timeline-en">${escapeHtml(item.en)}</div>
    </div>
  `).join('');

  const subjEl = document.getElementById('pv-subjects');
  let html = '';
  SUBJECTS.forEach(meta=>{
    const data = week.subjects[meta.id];
    html += `
      <div class="subject-box">
        <div class="subject-title"><span class="icon">${meta.icon}</span>${meta.title}</div>
        ${data.label ? `<div class="subject-label">${escapeHtml(data.label)}</div>` : ''}
        <div class="subject-content">${contentToHtml(data.content)}</div>
        ${data.ref ? `<div class="subject-ref">${escapeHtml(data.ref)}</div>` : ''}
        <div class="subject-status">Contenido armado<span class="dot ${data.armado?'on':''}"></span>Contenido enseñado<span class="dot ${data.ensenado?'on':''}"></span></div>
      </div>
    `;
    if(meta.afterDivider === 'purple') html += `<div class="row-divider-purple"></div>`;
    if(meta.afterDivider === 'maroon') html += `<div class="row-divider-maroon"></div>`;
  });
  subjEl.innerHTML = html;
}

// The sheet is a fixed-size 850×1100 "page" (see .sheet in styles.css) so its
// internal layout (fonts, icons, grid) never has to reflow. On small screens
// it's scaled down as a whole via CSS transform, like a page thumbnail, so it
// always fits the viewport width with zero risk of internal overflow.
const SHEET_WIDTH = 850;
const SHEET_HEIGHT = SHEET_WIDTH * (11 / 8.5); // matches the sheet's fixed 8.5:11 aspect-ratio
function fitSheetToFrame(frameId, sheetId){
  const frame = document.getElementById(frameId);
  const sheet = document.getElementById(sheetId);
  if(!frame || !sheet) return;
  const container = frame.parentElement;
  const cs = getComputedStyle(container);
  const paddingX = parseFloat(cs.paddingLeft || 0) + parseFloat(cs.paddingRight || 0);
  const available = container.clientWidth - paddingX;
  const scale = Math.min(1, available / SHEET_WIDTH);
  sheet.style.transform = scale < 1 ? `scale(${scale})` : '';
  frame.style.width = (SHEET_WIDTH * scale) + 'px';
  frame.style.height = (SHEET_HEIGHT * scale) + 'px';
}
function watchSheetFit(frameId, sheetId){
  const run = () => fitSheetToFrame(frameId, sheetId);
  run();
  window.addEventListener('resize', run);
  window.addEventListener('orientationchange', run);
  const frame = document.getElementById(frameId);
  if(frame && frame.parentElement && window.ResizeObserver){
    new ResizeObserver(run).observe(frame.parentElement);
  }
  return run;
}
