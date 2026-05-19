let leads = [];
let dossiers = [];
let currentDossierId = null;
let selectedLeadIds = new Set();
let currentSort = { column: 'date', direction: 'desc' };
let editingLeadId = null;

const API_URL = '/api';

// Settings & Theme
let prixMoyen = parseInt(localStorage.getItem('prixMoyen')) || 1500;
let currentTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', currentTheme);

// DOM Elements
const tableBody = document.getElementById('table-body');
const searchInput = document.getElementById('search-input');
const statusFilter = document.getElementById('status-filter');
const periodFilter = document.getElementById('period-filter');
const sourceFilter = document.getElementById('source-filter');
const priorityFilter = document.getElementById('priority-filter');

const dossierSelect = document.getElementById('dossier-select');
const newDossierBtn = document.getElementById('new-dossier-btn');
const deleteDossierBtn = document.getElementById('delete-dossier-btn');

const exportPdfBtn = document.getElementById('export-pdf-btn');
const exportBtn = document.getElementById('export-btn');
const importBtn = document.getElementById('import-btn');
const importFile = document.getElementById('import-file');
const addLeadBtn = document.getElementById('add-lead-btn');
const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
const selectAllCheckbox = document.getElementById('select-all');

const themeToggle = document.getElementById('theme-toggle');
const settingsBtn = document.getElementById('settings-btn');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const settingPrice = document.getElementById('setting-price');

// Modals
const addModal = document.getElementById('add-modal');
const editModal = document.getElementById('edit-modal');
const notesModal = document.getElementById('notes-modal');
const dossierModal = document.getElementById('dossier-modal');
const settingsModal = document.getElementById('settings-modal');
const closeModals = document.querySelectorAll('.close-modal, .cancel-modal');

// Date Formatting
const currentDateEl = document.getElementById('current-date');
const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
currentDateEl.textContent = new Date().toLocaleDateString('fr-FR', options);

// Charts instances
let chartPeriod, chartStatus, chartSource, chartTimeline, chartPax;

// Initialization
async function init() {
    setupEventListeners();
    initCharts();
    await fetchDossiers();
}

async function fetchDossiers() {
    try {
        const response = await fetch(`${API_URL}/dossiers`);
        if(response.ok) {
            dossiers = await response.json();
            renderDossierSelect();
            if (dossiers.length > 0) {
                if (!dossiers.find(d => d.id === currentDossierId)) {
                    currentDossierId = dossiers[0].id;
                }
                dossierSelect.value = currentDossierId;
                await fetchLeads();
            } else {
                leads = [];
                currentDossierId = null;
                updateAllViews();
            }
        }
    } catch (error) {
        console.error('Erreur chargement dossiers:', error);
    }
}

function renderDossierSelect() {
    dossierSelect.innerHTML = '';
    dossiers.forEach(d => {
        const option = document.createElement('option');
        option.value = d.id;
        option.textContent = d.name;
        dossierSelect.appendChild(option);
    });
    deleteDossierBtn.style.display = dossiers.length > 1 ? 'inline-flex' : 'none';
}

async function fetchLeads() {
    if (!currentDossierId) return;
    try {
        const response = await fetch(`${API_URL}/leads?dossierId=${currentDossierId}`);
        if(response.ok) {
            leads = await response.json();
            selectedLeadIds.clear();
            updateBulkDeleteVisibility();
            updateAllViews();
        }
    } catch (error) {
        console.error('Erreur chargement leads:', error);
    }
}

function updateAllViews() {
    renderTable();
    updateKPIs();
    updateCharts();
    updateReminders();
    updateStatsTable();
}

// Helpers
function getStatusClass(status) { return 'badge-status-' + status.replace(/\s+/g, ''); }
function formatDate(dateStr) {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
    return dateStr;
}
function calculateScore(lead) {
    let score = 0;
    // Priority
    if (lead.priority === 'Haute') score += 4;
    else if (lead.priority === 'Moyenne') score += 2;
    else score += 1;

    // Status
    if (lead.status === 'Intéressé') score += 4;
    else if (lead.status === 'Contacté') score += 2;
    else if (lead.status === 'À relancer') score += 3;
    else if (lead.status === 'Nouveau') score += 1;
    // Réservé & Perdu sont finaux, score informatif
    if (lead.status === 'Réservé') return 10;
    if (lead.status === 'Perdu') return 0;

    // Recall Date
    if (lead.recallDate) {
        const today = new Date().toISOString().split('T')[0];
        if (lead.recallDate === today) score += 2;
        else if (lead.recallDate < today) score += 1; // Late
    }
    return Math.min(score, 10);
}

function getScoreBadge(score) {
    if (score >= 8) return `<span class="score-badge score-high">${score}</span>`;
    if (score >= 4) return `<span class="score-badge score-med">${score}</span>`;
    return `<span class="score-badge score-low">${score}</span>`;
}

// Bulk Delete Visibility
function updateBulkDeleteVisibility() {
    if (selectedLeadIds.size > 0) {
        bulkDeleteBtn.style.display = 'inline-flex';
        document.getElementById('selected-count').textContent = selectedLeadIds.size;
    } else {
        bulkDeleteBtn.style.display = 'none';
    }
    const visibleLeads = getFilteredLeads();
    selectAllCheckbox.checked = visibleLeads.length > 0 && visibleLeads.every(l => selectedLeadIds.has(l.id));
}

// Filtering
function getFilteredLeads() {
    return leads.filter(lead => {
        const searchTerm = searchInput.value.toLowerCase();
        const matchSearch = lead.name.toLowerCase().includes(searchTerm) || 
                            lead.phone.includes(searchTerm) || 
                            (lead.email && lead.email.toLowerCase().includes(searchTerm));
        const matchStatus = statusFilter.value === 'all' || lead.status === statusFilter.value;
        const matchPeriod = periodFilter.value === 'all' || lead.period === periodFilter.value;
        const matchSource = sourceFilter.value === 'all' || lead.source === sourceFilter.value;
        const matchPriority = priorityFilter.value === 'all' || lead.priority === priorityFilter.value;
        
        return matchSearch && matchStatus && matchPeriod && matchSource && matchPriority;
    });
}

// TABLE
function renderTable() {
    let filteredLeads = getFilteredLeads();

    filteredLeads.sort((a, b) => {
        let valA = a[currentSort.column];
        let valB = b[currentSort.column];
        if (currentSort.column === 'pax') { valA = parseInt(valA); valB = parseInt(valB); }
        if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
        if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;
        return 0;
    });

    tableBody.innerHTML = '';
    
    filteredLeads.forEach(lead => {
        const tr = document.createElement('tr');
        const isSelected = selectedLeadIds.has(lead.id);
        const score = calculateScore(lead);
        const waLink = `https://wa.me/${lead.phone.replace(/[^0-9+]/g, '')}`;

        tr.innerHTML = `
            <td><input type="checkbox" class="lead-checkbox" value="${lead.id}" ${isSelected ? 'checked' : ''}></td>
            <td>${formatDate(lead.date)}</td>
            <td>${getScoreBadge(score)}</td>
            <td style="font-weight: 500;">${lead.name}</td>
            <td>${lead.phone}</td>
            <td>${lead.pax} pax</td>
            <td><span class="badge" style="background:#2A2A2A; color:#E5E7EB; border:1px solid #3F3F46;">${lead.period}</span></td>
            <td>
                <span class="badge ${getStatusClass(lead.status)}">
                    <select class="table-status-select" onchange="changeStatus(${lead.id}, this.value)">
                        <option value="Nouveau" ${lead.status === 'Nouveau' ? 'selected' : ''}>Nouveau</option>
                        <option value="Contacté" ${lead.status === 'Contacté' ? 'selected' : ''}>Contacté</option>
                        <option value="Intéressé" ${lead.status === 'Intéressé' ? 'selected' : ''}>Intéressé</option>
                        <option value="Réservé" ${lead.status === 'Réservé' ? 'selected' : ''}>Réservé</option>
                        <option value="À relancer" ${lead.status === 'À relancer' ? 'selected' : ''}>À relancer</option>
                        <option value="Perdu" ${lead.status === 'Perdu' ? 'selected' : ''}>Perdu</option>
                    </select>
                </span>
            </td>
            <td style="font-weight:bold; color:var(--p-${lead.priority==='Haute'?'high':lead.priority==='Moyenne'?'med':'low'})">${lead.priority}</td>
            <td>${formatDate(lead.recallDate)}</td>
            <td><div class="note-preview" onclick="openNotes(${lead.id})">${lead.notes || 'Ajouter une note...'}</div></td>
            <td>
                <div class="action-btns">
                    <a href="tel:${lead.phone}" class="btn-icon" title="Appeler">📞</a>
                    <a href="${waLink}" target="_blank" class="btn-icon" title="WhatsApp">💬</a>
                    <button class="btn-icon" onclick="openEditModal(${lead.id})" title="Modifier">✏️</button>
                    <button class="btn-icon" onclick="deleteLead(${lead.id})" title="Supprimer">🗑️</button>
                </div>
            </td>
        `;
        const cb = tr.querySelector('.lead-checkbox');
        cb.addEventListener('change', (e) => {
            if (e.target.checked) selectedLeadIds.add(lead.id);
            else selectedLeadIds.delete(lead.id);
            updateBulkDeleteVisibility();
        });
        tableBody.appendChild(tr);
    });

    document.getElementById('displayed-count').textContent = filteredLeads.length;
    document.getElementById('total-count').textContent = leads.length;
    updateBulkDeleteVisibility();
}

// KPIs
function updateKPIs() {
    const total = leads.length;
    const reserved = leads.filter(l => l.status === 'Réservé');
    const lost = leads.filter(l => l.status === 'Perdu');
    const hot = leads.filter(l => l.status === 'Intéressé' || l.status === 'À relancer');
    
    const today = new Date().toISOString().split('T')[0];
    const todayReminders = leads.filter(l => l.recallDate === today);

    let ca = 0;
    reserved.forEach(l => { ca += (parseInt(l.pax) || 1) * prixMoyen; });

    const convRate = total > 0 ? ((reserved.length / total) * 100).toFixed(1) : 0;
    const lossRate = total > 0 ? ((lost.length / total) * 100).toFixed(1) : 0;

    document.getElementById('kpi-total').textContent = total;
    document.getElementById('kpi-conv').textContent = `${convRate}%`;
    document.getElementById('kpi-ca').textContent = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(ca);
    document.getElementById('kpi-hot').textContent = hot.length;
    document.getElementById('kpi-today-reminders').textContent = todayReminders.length;
    document.getElementById('kpi-loss').textContent = `${lossRate}%`;
}

// Reminders
function updateReminders() {
    const today = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString().split('T')[0];

    const todayList = [];
    const lateList = [];
    const idleList = [];

    leads.forEach(l => {
        if (l.status === 'Réservé' || l.status === 'Perdu') return;

        if (l.recallDate === today) todayList.push(l);
        else if (l.recallDate && l.recallDate < today) lateList.push(l);

        // Date is creation date, if we had updatedDate we would use it. Using date for now.
        if (l.date && l.date < sevenDaysAgoStr) idleList.push(l);
    });

    const renderBlock = (list, elementId, countId) => {
        const el = document.getElementById(elementId);
        document.getElementById(countId).textContent = list.length;
        el.innerHTML = '';
        list.forEach(l => {
            el.innerHTML += `
                <div class="reminder-item">
                    <div class="reminder-info">
                        <h4>${l.name} <span style="font-size:0.75rem; color:var(--text-muted)">(${l.phone})</span></h4>
                        <p>Statut: ${l.status} | Période: ${l.period}</p>
                    </div>
                    <div class="reminder-actions">
                        <button class="btn-icon" onclick="openEditModal(${l.id})">✏️</button>
                    </div>
                </div>
            `;
        });
        if(list.length === 0) el.innerHTML = `<p class="text-muted" style="font-size:0.85rem">Aucun lead ici.</p>`;
    };

    renderBlock(todayList, 'list-today', 'count-today');
    renderBlock(lateList, 'list-late', 'count-late');
    renderBlock(idleList, 'list-idle', 'count-idle');

    const badge = document.getElementById('sidebar-reminder-badge');
    const totalLate = lateList.length + todayList.length;
    if (totalLate > 0) {
        badge.style.display = 'inline-block';
        badge.textContent = totalLate;
    } else {
        badge.style.display = 'none';
    }
}

// Performance Table
function updateStatsTable() {
    const periods = ["Juin 2026", "Juillet 2026", "Septembre 2026", "Octobre 2026", "Novembre 2026", "Décembre 2026"];
    const tbody = document.getElementById('perf-table-body');
    const tfoot = document.getElementById('perf-table-foot');
    tbody.innerHTML = '';
    
    let tLeads=0, tRes=0, tPax=0, tCA=0;

    periods.forEach(p => {
        const pLeads = leads.filter(l => l.period === p);
        const pRes = pLeads.filter(l => l.status === 'Réservé');
        const pPax = pRes.reduce((sum, l) => sum + (parseInt(l.pax)||1), 0);
        const pCA = pPax * prixMoyen;
        const pConv = pLeads.length > 0 ? ((pRes.length / pLeads.length)*100).toFixed(1) : 0;

        tLeads += pLeads.length;
        tRes += pRes.length;
        tPax += pPax;
        tCA += pCA;

        if (pLeads.length > 0) {
            tbody.innerHTML += `
                <tr>
                    <td><strong>${p}</strong></td>
                    <td>${pLeads.length}</td>
                    <td><span class="text-green">${pRes.length}</span></td>
                    <td>${pPax}</td>
                    <td>${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(pCA)}</td>
                    <td>${pConv}%</td>
                </tr>
            `;
        }
    });

    const tConv = tLeads > 0 ? ((tRes / tLeads)*100).toFixed(1) : 0;
    tfoot.innerHTML = `
        <tr>
            <th>TOTAL</th>
            <th>${tLeads}</th>
            <th>${tRes}</th>
            <th>${tPax}</th>
            <th>${new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(tCA)}</th>
            <th>${tConv}%</th>
        </tr>
    `;
}

// CHARTS INITIALIZATION & UPDATES
const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#9ca3af' } } },
    scales: { 
        x: { ticks: { color: '#9ca3af' }, grid: { color: '#2E2E2E' } },
        y: { ticks: { color: '#9ca3af' }, grid: { color: '#2E2E2E' } }
    }
};
const pieOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#9ca3af' } } } };

function initCharts() {
    const ctxPeriod = document.getElementById('chartPeriod').getContext('2d');
    chartPeriod = new Chart(ctxPeriod, { type: 'bar', options: commonOptions, data: { labels: [], datasets: [] } });

    const ctxStatus = document.getElementById('chartStatus').getContext('2d');
    chartStatus = new Chart(ctxStatus, { type: 'doughnut', options: pieOptions, data: { labels: [], datasets: [] } });

    const ctxSource = document.getElementById('chartSource').getContext('2d');
    chartSource = new Chart(ctxSource, { type: 'bar', options: { ...commonOptions, indexAxis: 'y' }, data: { labels: [], datasets: [] } });

    const ctxTimeline = document.getElementById('chartTimeline').getContext('2d');
    chartTimeline = new Chart(ctxTimeline, { type: 'line', options: commonOptions, data: { labels: [], datasets: [] } });

    const ctxPax = document.getElementById('chartPax').getContext('2d');
    chartPax = new Chart(ctxPax, { type: 'bar', options: commonOptions, data: { labels: [], datasets: [] } });
}

function updateCharts() {
    if(!chartPeriod) return;

    // Period Chart
    const periods = ["Juin 2026", "Juillet 2026", "Septembre 2026", "Octobre 2026", "Novembre 2026", "Décembre 2026"];
    const periodCounts = periods.map(p => leads.filter(l => l.period === p).length);
    chartPeriod.data = {
        labels: periods.map(p => p.split(' ')[0]),
        datasets: [{ label: 'Leads', data: periodCounts, backgroundColor: '#3B82F6', borderRadius: 4 }]
    };
    chartPeriod.update();

    // Status Chart
    const statusMap = { 'Nouveau': 0, 'Contacté': 0, 'Intéressé': 0, 'Réservé': 0, 'À relancer': 0, 'Perdu': 0 };
    leads.forEach(l => { if(statusMap[l.status]!==undefined) statusMap[l.status]++; });
    chartStatus.data = {
        labels: Object.keys(statusMap),
        datasets: [{
            data: Object.values(statusMap),
            backgroundColor: ['#3B82F6', '#8B5CF6', '#F97316', '#22C55E', '#EAB308', '#EF4444'],
            borderWidth: 0
        }]
    };
    chartStatus.update();

    // Source Chart
    const sourceMap = {};
    leads.forEach(l => { sourceMap[l.source] = (sourceMap[l.source] || 0) + 1; });
    const sortedSources = Object.entries(sourceMap).sort((a,b)=>b[1]-a[1]);
    chartSource.data = {
        labels: sortedSources.map(s => s[0]),
        datasets: [{ label: 'Volume', data: sortedSources.map(s => s[1]), backgroundColor: '#C9A84C', borderRadius: 4 }]
    };
    chartSource.update();

    // Timeline Chart
    const dateMap = {};
    leads.forEach(l => { if(l.date) dateMap[l.date] = (dateMap[l.date] || 0) + 1; });
    const sortedDates = Object.keys(dateMap).sort();
    let cum = 0;
    const timelineData = sortedDates.map(d => { cum+=dateMap[d]; return cum; });
    chartTimeline.data = {
        labels: sortedDates.map(d => d.substring(5)), // MM-DD
        datasets: [{ label: 'Leads Cumulés', data: timelineData, borderColor: '#10B981', tension: 0.3, fill: true, backgroundColor: 'rgba(16, 185, 129, 0.1)' }]
    };
    chartTimeline.update();

    // Pax Chart (Pax by period)
    const paxCounts = periods.map(p => {
        return leads.filter(l => l.period === p).reduce((sum, l) => sum + (parseInt(l.pax)||1), 0);
    });
    chartPax.data = {
        labels: periods.map(p => p.split(' ')[0]),
        datasets: [{ label: 'Voyageurs (Pax)', data: paxCounts, backgroundColor: '#8B5CF6', borderRadius: 4 }]
    };
    chartPax.update();
}

// API & ACTIONS (CRUD)
window.changeStatus = async function(id, newStatus) {
    try {
        const response = await fetch(`${API_URL}/leads/${id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus })
        });
        if (response.ok) {
            const updatedLead = await response.json();
            const index = leads.findIndex(l => l.id === id);
            if (index !== -1) leads[index] = updatedLead;
            updateAllViews();
        }
    } catch (error) { console.error(error); }
};

window.deleteLead = async function(id) {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce lead ?')) {
        try {
            const response = await fetch(`${API_URL}/leads/${id}`, { method: 'DELETE' });
            if (response.ok) {
                leads = leads.filter(l => l.id !== id);
                selectedLeadIds.delete(id);
                updateAllViews();
            }
        } catch (error) { console.error(error); }
    }
};

window.openNotes = function(id) {
    const lead = leads.find(l => l.id === id);
    if (lead) {
        editingLeadId = id;
        document.getElementById('edit-notes-area').value = lead.notes || '';
        notesModal.classList.add('active');
    }
};

window.openEditModal = function(id) {
    const lead = leads.find(l => l.id === id);
    if (lead) {
        document.getElementById('edit-id').value = lead.id;
        document.getElementById('edit-name').value = lead.name || '';
        document.getElementById('edit-phone').value = lead.phone || '';
        document.getElementById('edit-email').value = lead.email || '';
        document.getElementById('edit-pax').value = lead.pax || 1;
        document.getElementById('edit-period').value = lead.period || 'Juin 2026';
        document.getElementById('edit-source').value = lead.source || 'Facebook Ads';
        document.getElementById('edit-status').value = lead.status || 'Nouveau';
        document.getElementById('edit-priority').value = lead.priority || 'Moyenne';
        document.getElementById('edit-recall').value = lead.recallDate || '';
        document.getElementById('edit-notes').value = lead.notes || '';
        editModal.classList.add('active');
    }
};

// EVENT LISTENERS
function setupEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-links li').forEach(li => {
        li.addEventListener('click', (e) => {
            document.querySelectorAll('.nav-links li').forEach(el => el.classList.remove('active'));
            li.classList.add('active');
            
            document.querySelectorAll('.view-section').forEach(section => section.classList.remove('active'));
            document.getElementById(li.dataset.target).classList.add('active');
        });
    });

    // Theme & Settings
    themeToggle.addEventListener('click', () => {
        currentTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', currentTheme);
        localStorage.setItem('theme', currentTheme);
    });

    settingsBtn.addEventListener('click', () => {
        settingPrice.value = prixMoyen;
        settingsModal.classList.add('active');
    });

    saveSettingsBtn.addEventListener('click', () => {
        prixMoyen = parseInt(settingPrice.value) || 1500;
        localStorage.setItem('prixMoyen', prixMoyen);
        settingsModal.classList.remove('active');
        updateAllViews();
    });

    // Filters
    [searchInput, statusFilter, periodFilter, sourceFilter, priorityFilter].forEach(el => {
        if(el) el.addEventListener('input', renderTable);
    });

    // Sorting
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.dataset.sort;
            if (currentSort.column === column) currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            else { currentSort.column = column; currentSort.direction = 'asc'; }
            renderTable();
        });
    });

    // Modals
    addLeadBtn.addEventListener('click', () => {
        if(!currentDossierId) { alert("Veuillez d'abord créer un dossier."); return; }
        addModal.classList.add('active');
    });
    newDossierBtn.addEventListener('click', () => dossierModal.classList.add('active'));
    closeModals.forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
        });
    });

    // Forms
    dossierSelect.addEventListener('change', async (e) => {
        currentDossierId = parseInt(e.target.value);
        await fetchLeads();
    });

    document.getElementById('add-dossier-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('add-dossier-name').value;
        try {
            const response = await fetch(`${API_URL}/dossiers`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name })
            });
            if (response.ok) {
                const newDossier = await response.json();
                dossiers.push(newDossier);
                currentDossierId = newDossier.id;
                dossierModal.classList.remove('active');
                e.target.reset();
                renderDossierSelect();
                dossierSelect.value = currentDossierId;
                await fetchLeads();
            }
        } catch(err) { console.error(err); }
    });

    deleteDossierBtn.addEventListener('click', async () => {
        if(confirm("Êtes-vous sûr de vouloir supprimer ce dossier ET tous les leads à l'intérieur ?")) {
            try {
                const response = await fetch(`${API_URL}/dossiers/${currentDossierId}`, { method: 'DELETE' });
                if (response.ok) await fetchDossiers();
            } catch(err) { console.error(err); }
        }
    });

    document.getElementById('add-lead-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const newLeadData = {
            dossierId: currentDossierId,
            name: document.getElementById('add-name').value,
            phone: document.getElementById('add-phone').value,
            email: document.getElementById('add-email').value,
            pax: document.getElementById('add-pax').value,
            period: document.getElementById('add-period').value,
            source: document.getElementById('add-source').value,
            status: document.getElementById('add-status').value,
            priority: document.getElementById('add-priority').value,
            recallDate: document.getElementById('add-recall').value,
            notes: document.getElementById('add-notes').value
        };
        try {
            const response = await fetch(`${API_URL}/leads`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(newLeadData)
            });
            if (response.ok) {
                const addedLead = await response.json();
                leads.unshift(addedLead);
                addModal.classList.remove('active');
                e.target.reset();
                updateAllViews();
            } else if (response.status === 409) {
                alert((await response.json()).error);
            }
        } catch (error) { console.error(error); }
    });

    document.getElementById('edit-lead-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = parseInt(document.getElementById('edit-id').value);
        const updatedData = {
            name: document.getElementById('edit-name').value,
            phone: document.getElementById('edit-phone').value,
            email: document.getElementById('edit-email').value,
            pax: document.getElementById('edit-pax').value,
            period: document.getElementById('edit-period').value,
            source: document.getElementById('edit-source').value,
            status: document.getElementById('edit-status').value,
            priority: document.getElementById('edit-priority').value,
            recallDate: document.getElementById('edit-recall').value,
            notes: document.getElementById('edit-notes').value
        };
        try {
            const response = await fetch(`${API_URL}/leads/${id}`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedData)
            });
            if (response.ok) {
                const updatedLead = await response.json();
                const idx = leads.findIndex(l => l.id === id);
                if (idx !== -1) leads[idx] = updatedLead;
                editModal.classList.remove('active');
                updateAllViews();
            }
        } catch (error) { console.error(error); }
    });

    document.getElementById('save-notes-btn').addEventListener('click', async () => {
        if (editingLeadId) {
            try {
                const response = await fetch(`${API_URL}/leads/${editingLeadId}`, {
                    method: 'PUT', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ notes: document.getElementById('edit-notes-area').value })
                });
                if (response.ok) {
                    const updatedLead = await response.json();
                    const idx = leads.findIndex(l => l.id === editingLeadId);
                    if (idx !== -1) leads[idx] = updatedLead;
                    updateAllViews();
                }
            } catch (error) { console.error(error); }
        }
        notesModal.classList.remove('active');
    });

    // Bulk Select & Delete
    selectAllCheckbox.addEventListener('change', (e) => {
        const visibleLeads = getFilteredLeads();
        if (e.target.checked) visibleLeads.forEach(l => selectedLeadIds.add(l.id));
        else visibleLeads.forEach(l => selectedLeadIds.delete(l.id));
        renderTable();
    });

    bulkDeleteBtn.addEventListener('click', async () => {
        if (selectedLeadIds.size === 0) return;
        if (confirm(`Supprimer ${selectedLeadIds.size} leads ?`)) {
            try {
                const response = await fetch(`${API_URL}/leads/bulk-delete`, {
                    method: 'POST', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids: Array.from(selectedLeadIds) })
                });
                if (response.ok) {
                    leads = leads.filter(l => !selectedLeadIds.has(l.id));
                    selectedLeadIds.clear();
                    updateAllViews();
                }
            } catch (error) { console.error(error); }
        }
    });

    // Import/Export CSV
    exportBtn.addEventListener('click', () => {
        const headers = ['ID', 'Date', 'Nom', 'Téléphone', 'Email', 'Pax', 'Période', 'Source', 'Statut', 'Priorité', 'Date Rappel', 'Notes'];
        const csvRows = [headers.join(',')];
        leads.forEach(l => {
            csvRows.push([
                l.id, l.date, `"${l.name}"`, `"${l.phone}"`, l.email||'', l.pax,
                `"${l.period}"`, `"${l.source}"`, `"${l.status}"`, l.priority, l.recallDate,
                `"${(l.notes||'').replace(/"/g, '""')}"`
            ].join(','));
        });
        const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'leads_omra.csv';
        link.click();
    });

    importBtn.addEventListener('click', () => {
        if(!currentDossierId) { alert("Créez d'abord un dossier."); return; }
        importFile.click();
    });

    importFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const workbook = XLSX.read(evt.target.result, { type: 'binary' });
                const rawLeads = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { header: 1 });
                if (rawLeads.length <= 1) return;
                const headers = rawLeads[0].map(h => String(h).trim().toLowerCase());
                const findCol = kw => headers.findIndex(h => kw.some(k => h.includes(k)));
                
                const cN=findCol(['nom','name']), cP=findCol(['téléphone','tel','phone']), cE=findCol(['email','mail']);
                const cPx=findCol(['pax','personne']), cPer=findCol(['période','period']), cSrc=findCol(['source']);
                const cStat=findCol(['statut']), cPrio=findCol(['priorité']), cNot=findCol(['note']);

                const leadsToImport = [];
                for(let i=1; i<rawLeads.length; i++) {
                    const r=rawLeads[i]; if(!r||!r.length) continue;
                    let n=cN>=0?r[cN]:'', p=cP>=0?r[cP]:'';
                    if(!n && !p) continue;
                    leadsToImport.push({
                        name: n||'Inconnu', phone: p?String(p):'', email: cE>=0?r[cE]:'',
                        pax: cPx>=0?(parseInt(r[cPx])||1):1, period: cPer>=0?r[cPer]:'Juin 2026',
                        source: cSrc>=0?r[cSrc]:'Import', status: cStat>=0?r[cStat]:'Nouveau',
                        priority: cPrio>=0?r[cPrio]:'Moyenne', notes: cNot>=0?r[cNot]:'',
                        recallDate: '', date: new Date().toISOString().split('T')[0]
                    });
                }
                
                if (leadsToImport.length > 0 && confirm(`Importer ${leadsToImport.length} leads ?`)) {
                    importBtn.innerHTML = '⏳...';
                    const response = await fetch(`${API_URL}/leads/bulk`, {
                        method: 'POST', headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ dossierId: currentDossierId, leads: leadsToImport })
                    });
                    if(response.ok) {
                        const res = await response.json();
                        alert(`✅ ${res.added} ajoutés\n⚠️ ${res.skipped} ignorés`);
                        await fetchLeads();
                    }
                }
            } catch(err) { alert("Erreur fichier"); } finally {
                importFile.value=''; importBtn.innerHTML='⬆️ Importer';
            }
        };
        reader.readAsBinaryString(file);
    });

    // Export PDF
    exportPdfBtn.addEventListener('click', () => {
        exportPdfBtn.innerHTML = "⏳ Génération...";
        exportPdfBtn.disabled = true;
        // Temporarily show all sections to capture them, or just capture the main container
        const element = document.getElementById('export-content');
        const opt = {
            margin:       10,
            filename:     'Rapport_Omra_2026.pdf',
            image:        { type: 'jpeg', quality: 0.98 },
            html2canvas:  { scale: 2, useCORS: true },
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' }
        };
        
        // Show everything for export
        document.querySelectorAll('.view-section').forEach(s => s.style.display = 'block');

        html2pdf().set(opt).from(element).save().then(() => {
            // Restore views
            document.querySelectorAll('.view-section').forEach(s => s.style.display = '');
            exportPdfBtn.innerHTML = "📄 Rapport PDF";
            exportPdfBtn.disabled = false;
        });
    });
}

document.addEventListener('DOMContentLoaded', init);
