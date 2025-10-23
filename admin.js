/* admin.js - Version corrigée (sans backend requis) */

const CONFIG = {
  DATA_URL: 'https://raw.githubusercontent.com/redragon38/comparateur-ia/main/info.json',
  CACHE_KEY: 'ia-data-draft',
  CACHE_EXPIRY: 24 * 60 * 60 * 1000
};

const AppState = {
  iaData: [],
  filteredData: [],
  isDirty: false,
  db: null,
  columnFilters: {},
  searchTerm: '',
  categoryQuick: ''
};

let msgEl, searchInput, tableBody, headerRow, categorySelect, categoryFiltersDiv, detailModal, modalBody;

// ========== INITIALISATION ==========
document.addEventListener('DOMContentLoaded', async () => {
  try {
    msgEl = document.getElementById('msg');
    tableBody = document.getElementById('tableBody');
    headerRow = document.getElementById('headerRow');
    categorySelect = document.getElementById('categorySelect');
    categoryFiltersDiv = document.getElementById('categoryFilters');
    detailModal = document.getElementById('detailModal');
    modalBody = document.getElementById('modalBody');

    if (!msgEl || !searchInput || !tableBody || !headerRow) {
      throw new Error('Éléments HTML manquants');
    }

    await initIndexedDB();
    setupEventListeners();
    await loadData();
    renderCategoryQuickButtons();
    applyFilters();
    await restoreDraftIfAvailable();
  } catch (err) {
    console.error('Erreur initialisation:', err);
    if (msgEl) showMsg('Erreur: ' + err.message, 'error');
  }
});

// ========== INDEXED DB ==========
function initIndexedDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('IAComparator', 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      AppState.db = req.result;
      resolve();
    };
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('drafts')) {
        db.createObjectStore('drafts', { keyPath: 'id' });
      }
    };
  });
}

function saveDraftLocal() {
  if (!AppState.db) return Promise.resolve();
  return new Promise((resolve) => {
    const tx = AppState.db.transaction(['drafts'], 'readwrite');
    const store = tx.objectStore('drafts');
    store.put({ id: 'latest', data: AppState.iaData, timestamp: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

function restoreDraftIfAvailable() {
  if (!AppState.db) return Promise.resolve();
  return new Promise((resolve) => {
    const tx = AppState.db.transaction(['drafts'], 'readonly');
    const req = tx.objectStore('drafts').get('latest');
    req.onsuccess = () => {
      if (req.result && (Date.now() - req.result.timestamp < CONFIG.CACHE_EXPIRY)) {
        showMsg('Brouillon restauré', 'warning', 3000);
        AppState.iaData = req.result.data;
        applyFilters();
      }
      resolve();
    };
    req.onerror = () => resolve();
  });
}

// ========== UTILITAIRES UI ==========
function showMsg(text, type = 'success', duration = 4000) {
  if (!msgEl) return;
  msgEl.textContent = text;
  msgEl.className = `msg ${type}`;
  msgEl.style.display = 'block';
  if (duration > 0) {
    setTimeout(() => {
      msgEl.style.display = 'none';
      msgEl.className = 'msg';
    }, duration);
  }
}

function updateStats() {
  const totalEl = document.getElementById('totalCount');
  const publishedEl = document.getElementById('publishedCount');
  const featuredEl = document.getElementById('featuredCount');
  const recordEl = document.getElementById('recordCount');
  const statusEl = document.getElementById('statusIndicator');

  if (totalEl) totalEl.textContent = AppState.iaData.length;
  if (publishedEl) publishedEl.textContent = AppState.iaData.filter(i => i.status === 'published').length;
  if (featuredEl) featuredEl.textContent = AppState.iaData.filter(i => i.featured).length;
  if (recordEl) recordEl.textContent = `${AppState.filteredData.length} enregistrements`;
  if (statusEl) {
    if (AppState.isDirty) {
      statusEl.textContent = '● Non sauvegardé';
      statusEl.style.color = '#f59e0b';
    } else {
      statusEl.textContent = '✓ À jour';
      statusEl.style.color = '#10b981';
    }
  }
}

// ========== CHARGEMENT DONNÉES ==========
async function loadData() {
  showMsg('Chargement...', 'warning', 0);
  try {
    const res = await fetch(CONFIG.DATA_URL + '?t=' + Date.now());
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const txt = await res.text();
    AppState.iaData = JSON.parse(txt);
    applyFilters();
    updateStats();
    showMsg(`${AppState.iaData.length} IA chargées`, 'success', 2000);
  } catch (err) {
    showMsg('Impossible de charger: ' + err.message, 'error', 5000);
    console.error(err);
  }
}

// ========== UTILITAIRES CHAMPS ==========
function getAllFields() {
  const set = new Set();
  AppState.iaData.forEach(item => Object.keys(item).forEach(k => set.add(k)));
  if (set.size === 0) {
    ['id', 'name', 'short', 'categories', 'status', 'featured', 'updatedAt'].forEach(k => set.add(k));
  }
  return Array.from(set).sort();
}

function getColumnValues(field) {
  const s = new Set();
  AppState.iaData.forEach(ia => {
    const v = ia[field];
    if (Array.isArray(v)) v.forEach(x => s.add(String(x)));
    else if (v !== undefined && v !== null) s.add(String(v));
  });
  return Array.from(s).sort();
}

function escapeHtml(str = '') {
  if (typeof str !== 'string') return String(str || '');
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[m]));
}

// ========== FILTRAGE ==========
function applyFilters() {
  const term = (searchInput.value || '').toLowerCase();
  AppState.searchTerm = term;
  const selectedCategory = (categorySelect.value || '').toLowerCase();
  AppState.categoryQuick = selectedCategory;

  AppState.filteredData = AppState.iaData.filter(ia => {
    for (const [field, selectedValues] of Object.entries(AppState.columnFilters)) {
      if (!selectedValues || selectedValues.length === 0) continue;
      const val = ia[field];
      let itemVals = [];
      if (Array.isArray(val)) itemVals = val.map(v => String(v));
      else if (val !== undefined && val !== null) itemVals = [String(val)];
      const match = selectedValues.some(sel => itemVals.includes(sel));
      if (!match) return false;
    }

    if (term) {
      const hay = [ia.name, ia.short, ia.id, ia.slug, ia.description].filter(Boolean).join(' ').toLowerCase();
      const categoriesStr = (ia.categories || []).join(' ').toLowerCase();
      if (!(hay.includes(term) || categoriesStr.includes(term))) return false;
    }

    if (selectedCategory) {
      const cats = (ia.categories || []).map(c => String(c).toLowerCase());
      if (!cats.some(c => c === selectedCategory)) return false;
    }

    return true;
  });

  renderTable();
  updateStats();
  updateFilterIndicators();
}

// ========== RENDU TABLEAU ==========
function renderTable() {
  const fields = getAllFields();
  headerRow.innerHTML = fields.map(f => `
    <th title="${escapeHtml(f)}" data-field="${escapeHtml(f)}" class="header-cell">
      ${escapeHtml(f)} <span class="filter-icon">⚙️</span>
    </th>
  `).join('') + '<th style="min-width:160px;">Actions</th>';

  tableBody.innerHTML = '';
  AppState.filteredData.forEach((ia, idx) => {
    const tr = document.createElement('tr');
    let html = '';
    fields.forEach(field => {
      const val = ia[field];
      html += `<td>${renderCellContent(val, field, idx)}</td>`;
    });
    html += `<td class="actions">
      <button class="btn-detail" onclick="openDetailModal(${idx})">📋</button>
      <button class="btn-delete" onclick="confirmDelete(${idx})">🗑️</button>
    </td>`;
    tr.innerHTML = html;
    tableBody.appendChild(tr);
  });

  attachHeaderFilters();
}

function renderCellContent(value, field, idx) {
  if (typeof value === 'boolean') {
    return `<input type="checkbox" ${value ? 'checked' : ''} data-field="${field}" data-index="${idx}" class="cell-checkbox">`;
  }

  if (field === 'status') {
    return `<select data-field="status" data-index="${idx}" class="cell-input">
      <option value="published" ${value === 'published' ? 'selected' : ''}>Publié</option>
      <option value="draft" ${value === 'draft' ? 'selected' : ''}>Draft</option>
    </select>`;
  }

  if (typeof value === 'number') {
    return `<input type="number" step="0.01" value="${value}" data-field="${field}" data-index="${idx}" class="cell-input">`;
  }

  if (field === 'categories' && Array.isArray(value)) {
    if (value.length === 0) return '<span style="color:#999">-</span>';
    return value.map(cat => `<span class="category-tag">${escapeHtml(cat)}</span>`).join('');
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '<span style="color:#999">-</span>';
    return value.map(it => `<span class="array-badge">${escapeHtml(String(it))}</span>`).join('');
  }

  if (typeof value === 'object' && value !== null) {
    return `<span class="obj-badge" onclick="openDetailModal(${idx})" title="Cliquer pour éditer">{...}</span>`;
  }

  if (typeof value === 'string') {
    const disp = value.length > 40 ? escapeHtml(value.substring(0, 37)) + '...' : escapeHtml(value);
    return `<input type="text" value="${escapeHtml(value)}" data-field="${escapeHtml(field)}" data-index="${idx}" class="cell-input" title="${escapeHtml(value)}">`;
  }

  return '<span style="color:#999">-</span>';
}

// ========== FILTRES EXCEL ==========
function attachHeaderFilters() {
  document.querySelectorAll('th.header-cell').forEach(header => {
    header.removeEventListener('click', header._clickHandler);
    header._clickHandler = (e) => {
      e.stopPropagation();
      showExcelFilterMenu(header, header.dataset.field);
    };
    header.addEventListener('click', header._clickHandler);
  });
}

function showExcelFilterMenu(headerElement, field) {
  document.querySelectorAll('.excel-filter-menu').forEach(m => m.remove());
  const values = getColumnValues(field);
  const current = AppState.columnFilters[field] || [];

  const menu = document.createElement('div');
  menu.className = 'excel-filter-menu';
  menu.innerHTML = `
    <div style="padding:10px; width:320px;">
      <input type="text" class="filter-search" placeholder="Rechercher..." style="width:100%;padding:8px;margin-bottom:8px;border:1px solid #eee;border-radius:6px;">
      <label style="display:block;padding:8px;font-weight:600;border-bottom:1px solid #f1f5f9;">
        <input type="checkbox" class="select-all" ${values.length > 0 && values.every(v => current.includes(v)) ? 'checked' : ''}> Tout sélectionner
      </label>
      <div style="max-height:220px;overflow:auto;margin-top:6px;">
        ${values.map(v => `<label style="display:block;padding:6px;"><input type="checkbox" class="filter-option" value="${escapeHtml(v)}" ${current.includes(v) ? 'checked' : ''}> ${escapeHtml(v || '(vide)')}</label>`).join('')}
      </div>
      <div style="display:flex;gap:8px;margin-top:8px;">
        <button class="btn-apply" style="flex:1;padding:8px;border-radius:6px;background:#3b82f6;color:white;border:none;">Appliquer</button>
        <button class="btn-clear" style="flex:1;padding:8px;border-radius:6px;background:#ef4444;color:white;border:none;">Réinitialiser</button>
      </div>
    </div>
  `;
  document.body.appendChild(menu);

  const rect = headerElement.getBoundingClientRect();
  menu.style.position = 'fixed';
  menu.style.top = (rect.bottom + 8) + 'px';
  menu.style.left = rect.left + 'px';
  menu.style.zIndex = '1002';
  menu.style.boxShadow = '0 8px 30px rgba(2,6,23,0.15)';
  menu.style.borderRadius = '8px';
  menu.style.background = 'white';

  const selectAll = menu.querySelector('.select-all');
  const options = menu.querySelectorAll('.filter-option');
  const search = menu.querySelector('.filter-search');

  selectAll?.addEventListener('change', () => options.forEach(o => o.checked = selectAll.checked));
  options.forEach(o => o.addEventListener('change', () => selectAll.checked = Array.from(options).every(x => x.checked)));

  search.addEventListener('input', (e) => {
    const t = e.target.value.toLowerCase();
    menu.querySelectorAll('div > label').forEach(lbl => {
      const txt = lbl.textContent.toLowerCase();
      lbl.style.display = txt.includes(t) ? 'block' : 'none';
    });
  });

  menu.querySelector('.btn-apply').addEventListener('click', () => {
    const selected = Array.from(options).filter(o => o.checked).map(o => o.value);
    AppState.columnFilters[field] = selected;
    applyFilters();
    menu.remove();
  });

  menu.querySelector('.btn-clear').addEventListener('click', () => {
    AppState.columnFilters[field] = [];
    applyFilters();
    menu.remove();
  });

  setTimeout(() => {
    document.addEventListener('click', function fn(e) {
      if (!menu.contains(e.target) && !headerElement.contains(e.target)) {
        menu.remove();
        document.removeEventListener('click', fn);
      }
    });
  }, 100);
}

function updateFilterIndicators() {
  document.querySelectorAll('th.header-cell').forEach(h => {
    const field = h.dataset.field;
    const icon = h.querySelector('.filter-icon');
    if (AppState.columnFilters[field] && AppState.columnFilters[field].length > 0) {
      icon.textContent = '🔍';
      icon.style.color = '#667eea';
    } else {
      icon.textContent = '⚙️';
      icon.style.color = 'inherit';
    }
  });
}

// ========== MODAL DÉTAILS ==========
function openDetailModal(index) {
  const ia = AppState.filteredData[index];
  document.getElementById('modalTitle').textContent = ia.name || 'Détails';
  let html = '';
  const fields = getAllFields();
  fields.forEach(field => {
    const val = ia[field];
    const str = (typeof val === 'object') ? JSON.stringify(val, null, 2) : String(val || '');
    html += `
      <div class="field-group">
        <label>${escapeHtml(field)}</label>
        <textarea data-field="${escapeHtml(field)}" data-index="${index}">${escapeHtml(str)}</textarea>
      </div>
    `;
  });
  html += `<div style="display:flex;gap:8px;margin-top:8px;">
    <button class="btn-save" style="flex:1;padding:10px;border-radius:8px;background:var(--accent);color:white;border:none;" onclick="saveDetailChanges(${index})">💾 Enregistrer</button>
    <button class="btn-delete" style="flex:1;padding:10px;border-radius:8px;background:#ef4444;color:white;border:none;" onclick="closeModal()">✕ Annuler</button>
  </div>`;
  modalBody.innerHTML = html;
  detailModal.classList.add('show');
  detailModal.setAttribute('aria-hidden', 'false');
}

function closeModal() {
  detailModal.classList.remove('show');
  detailModal.setAttribute('aria-hidden', 'true');
}

function saveDetailChanges(index) {
  const inputs = modalBody.querySelectorAll(`[data-index="${index}"]`);
  const updated = { ...AppState.filteredData[index] };
  inputs.forEach(inp => {
    const field = inp.dataset.field;
    let value = inp.value;
    try {
      if ((value.startsWith('{') || value.startsWith('['))) {
        value = JSON.parse(value);
      }
    } catch (e) {}
    updated[field] = value;
  });
  updated.updatedAt = new Date().toISOString().split('T')[0];
  const origIdx = AppState.iaData.findIndex(it => it.id === updated.id);
  if (origIdx !== -1) {
    AppState.iaData[origIdx] = updated;
  } else {
    AppState.iaData.push(updated);
  }
  AppState.isDirty = true;
  saveDraftLocal();
  applyFilters();
  showMsg('Changements enregistrés', 'success', 2000);
  closeModal();
}

// ========== ACTIONS CRUD ==========
function confirmDelete(index) {
  const ia = AppState.filteredData[index];
  if (!ia) return;
  if (confirm(`Supprimer "${ia.name || ia.id || 'élément'}" ?`)) {
    deleteIA(index);
  }
}

function deleteIA(index) {
  const ia = AppState.filteredData[index];
  const origIdx = AppState.iaData.findIndex(it => it.id === ia.id);
  if (origIdx !== -1) AppState.iaData.splice(origIdx, 1);
  AppState.isDirty = true;
  saveDraftLocal();
  applyFilters();
  showMsg(`"${ia.name || ia.id}" supprimée`, 'success', 2000);
}

function addIA() {
  const newIA = {
    id: 'new-' + Date.now(),
    slug: 'new-slug-' + Date.now(),
    name: 'Nouvelle IA',
    short: '',
    description: '',
    categories: [],
    status: 'draft',
    featured: false,
    updatedAt: new Date().toISOString().split('T')[0]
  };
  AppState.iaData.unshift(newIA);
  AppState.isDirty = true;
  saveDraftLocal();
  applyFilters();
  showMsg('Nouvelle IA ajoutée', 'success', 1500);
}

// ========== EXPORT / SAVE ==========
function exportJSON() {
  const dataStr = JSON.stringify(AppState.iaData, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ia-data-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showMsg('Fichier exporté', 'success', 1500);
}

async function saveAll() {
  showMsg('Sauvegarde en cours...', 'warning', 0);
  try {
    // Au lieu d'envoyer au serveur, on exporte simplement
    exportJSON();
    AppState.isDirty = true;
    updateStats();
    showMsg('Données exportées et brouillon sauvegardé localement!', 'success', 3000);
  } catch (err) {
    showMsg('Erreur sauvegarde: ' + err.message, 'error', 0);
    console.error(err);
  }
}

// ========== MODIFICATIONS INLINE ==========
function handleTableChange(e) {
  if (!e.target.dataset.field) return;
  const field = e.target.dataset.field;
  const index = parseInt(e.target.dataset.index);
  let value = e.target.value;
  if (e.target.type === 'checkbox') value = e.target.checked;
  else if (e.target.type === 'number') value = parseFloat(value) || 0;

  AppState.filteredData[index][field] = value;
  AppState.filteredData[index].updatedAt = new Date().toISOString().split('T')[0];

  const origIdx = AppState.iaData.findIndex(ia => ia.id === AppState.filteredData[index].id);
  if (origIdx !== -1) AppState.iaData[origIdx] = AppState.filteredData[index];

  AppState.isDirty = true;
  saveDraftLocal();
  updateStats();
}

// ========== EVENT LISTENERS ==========
function setupEventListeners() {
  document.getElementById('addIA')?.addEventListener('click', addIA);
  document.getElementById('exportJSON')?.addEventListener('click', exportJSON);
  document.getElementById('saveAll')?.addEventListener('click', saveAll);
  document.getElementById('refreshData')?.addEventListener('click', () => {
    if (confirm('Rafraîchir ? Vous perdrez vos brouillons locaux.')) {
      AppState.columnFilters = {};
      loadData();
      AppState.isDirty = false;
    }
  });

  searchInput?.addEventListener('input', () => {
    clearTimeout(searchInput._t);
    searchInput._t = setTimeout(() => applyFilters(), 180);
  });

  categorySelect?.addEventListener('change', () => {
    const val = categorySelect.value;
    document.querySelectorAll('#categoryFilters .filter-btn').forEach(b =>
      b.classList.toggle('active', b.dataset.cat === val)
    );
    applyFilters();
  });

  tableBody?.addEventListener('input', handleTableChange);
  tableBody?.addEventListener('change', handleTableChange);

  document.getElementById('closeModalBtn')?.addEventListener('click', closeModal);
  detailModal?.addEventListener('click', (e) => {
    if (e.target === detailModal) closeModal();
  });
}

// ========== BOUTONS CATÉGORIES RAPIDES ==========
function renderCategoryQuickButtons() {
  const cats = new Set(AppState.iaData.flatMap(ia => ia.categories || []));
  if (!categoryFiltersDiv) return;
  
  categoryFiltersDiv.innerHTML = '';
  const allBtn = document.createElement('button');
  allBtn.className = 'filter-btn active';
  allBtn.dataset.cat = '';
  allBtn.textContent = 'Toutes';
  categoryFiltersDiv.appendChild(allBtn);

  allBtn.addEventListener('click', () => {
    document.querySelectorAll('#categoryFilters .filter-btn').forEach(b => b.classList.remove('active'));
    allBtn.classList.add('active');
    categorySelect.value = '';
    applyFilters();
  });

  Array.from(cats).slice(0, 12).forEach(c => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn';
    btn.dataset.cat = c;
    btn.textContent = c;
    btn.addEventListener('click', () => {
      document.querySelectorAll('#categoryFilters .filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      categorySelect.value = c;
      applyFilters();
    });
    categoryFiltersDiv.appendChild(btn);
  });
}

// ========== GLOBALS ==========
window.openDetailModal = openDetailModal;
window.closeModal = closeModal;
window.saveDetailChanges = saveDetailChanges;
window.confirmDelete = confirmDelete;
window.deleteIA = deleteIA;
// ========== REDIMENSIONNEMENT DES COLONNES ==========
function makeColumnsResizable() {
  const table = document.getElementById("iaTable");
  const ths = table.querySelectorAll("th");

  ths.forEach(th => {
    // ajoute une poignée si pas déjà présente
    if (!th.querySelector('.resize-handle')) {
      const handle = document.createElement('div');
      handle.className = 'resize-handle';
      th.appendChild(handle);

      // Variables pour le drag
      let startX, startWidth;

      handle.addEventListener('mousedown', (e) => {
        startX = e.pageX;
        startWidth = th.offsetWidth;
        document.body.style.cursor = 'col-resize';
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        e.preventDefault();
      });

      function onMouseMove(e) {
        const newWidth = startWidth + (e.pageX - startX);
        th.style.width = newWidth + 'px';
      }

      function onMouseUp() {
        document.body.style.cursor = '';
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
      }
    }
  });
}

// Exécuter après chaque rendu du tableau
const _renderTable = renderTable;
renderTable = function() {
  _renderTable();
  makeColumnsResizable();
};
async function saveToGitHub(updatedData) {
  const token = "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"; // ⚠️ a remplacer par ton token
  const repoOwner = "redragon38";
  const repoName = "comparateur IA";
  const filePath = "info.json";

  const getRes = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`, {
    headers: { Authorization: `token ${token}` }
  });

  if (!getRes.ok) {
    alert("Erreur : impossible de récupérer le fichier sur GitHub.");
    return;
  }

  const fileData = await getRes.json();
  const sha = fileData.sha;

  const newContent = btoa(unescape(encodeURIComponent(JSON.stringify(updatedData, null, 2))));

  const res = await fetch(`https://api.github.com/repos/${repoOwner}/${repoName}/contents/${filePath}`, {
    method: "PUT",
    headers: {
      Authorization: `token ${token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      message: "Mise à jour depuis l’interface admin",
      content: newContent,
      sha: sha
    })
  });

  if (res.ok) {
    alert("✅ Sauvegardé avec succès sur GitHub !");
  } else {
    alert("❌ Erreur lors de la sauvegarde sur GitHub.");
  }
}
document.getElementById('saveBtn').addEventListener('click', () => {

});
