let leads = [];
let dossiers = [];
let currentDossierId = null;
let selectedLeadIds = new Set();

// State
let currentSort = { column: 'date', direction: 'desc' };
let editingLeadId = null;

const API_URL = '/api';

// DOM Elements
const tableBody = document.getElementById('table-body');
const searchInput = document.getElementById('search-input');
const statusFilter = document.getElementById('status-filter');
const periodFilter = document.getElementById('period-filter');
const exportBtn = document.getElementById('export-btn');
const addLeadBtn = document.getElementById('add-lead-btn');
const addModal = document.getElementById('add-modal');
const editModal = document.getElementById('edit-modal');
const notesModal = document.getElementById('notes-modal');
const dossierModal = document.getElementById('dossier-modal');
const closeModals = document.querySelectorAll('.close-modal, .cancel-modal');
const addLeadForm = document.getElementById('add-lead-form');
const editLeadForm = document.getElementById('edit-lead-form');
const addDossierForm = document.getElementById('add-dossier-form');
const saveNotesBtn = document.getElementById('save-notes-btn');
const editNotesArea = document.getElementById('edit-notes-area');

// Dossier Elements
const dossierSelect = document.getElementById('dossier-select');
const newDossierBtn = document.getElementById('new-dossier-btn');
const deleteDossierBtn = document.getElementById('delete-dossier-btn');

// Bulk Selection Elements
const selectAllCheckbox = document.getElementById('select-all');
const bulkDeleteBtn = document.getElementById('bulk-delete-btn');
const selectedCountSpan = document.getElementById('selected-count');

// Initialization
async function init() {
    await fetchDossiers();
    setupEventListeners();
}

async function fetchDossiers() {
    try {
        const response = await fetch(`${API_URL}/dossiers`);
        if(response.ok) {
            dossiers = await response.json();
            renderDossierSelect();
            if (dossiers.length > 0) {
                // Keep selected dossier if it still exists, else pick first
                if (!dossiers.find(d => d.id === currentDossierId)) {
                    currentDossierId = dossiers[0].id;
                }
                dossierSelect.value = currentDossierId;
                await fetchLeads();
            } else {
                leads = [];
                currentDossierId = null;
                renderTable();
                updateKPIs();
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
    
    if (dossiers.length > 1) {
        deleteDossierBtn.style.display = 'inline-flex';
    } else {
        deleteDossierBtn.style.display = 'none';
    }
}

async function fetchLeads() {
    if (!currentDossierId) return;
    try {
        const response = await fetch(`${API_URL}/leads?dossierId=${currentDossierId}`);
        if(response.ok) {
            leads = await response.json();
            selectedLeadIds.clear(); // Reset selections on fetch
            updateBulkDeleteVisibility();
            renderTable();
            updateKPIs();
        }
    } catch (error) {
        console.error('Erreur chargement leads:', error);
    }
}

// Helpers
function getStatusClass(status) {
    return 'badge-status-' + status.replace(/\s+/g, '');
}

function getPeriodClass(period) {
    if(period.includes('Juin')) return 'period-juin';
    if(period.includes('Juillet')) return 'period-juil';
    if(period.includes('Septembre')) return 'period-sept';
    if(period.includes('Octobre')) return 'period-oct';
    if(period.includes('Novembre')) return 'period-nov';
    if(period.includes('Décembre')) return 'period-dec';
    return '';
}

function getPriorityClass(priority) {
    if(priority === 'Haute') return 'priority-high';
    if(priority === 'Moyenne') return 'priority-med';
    if(priority === 'Basse') return 'priority-low';
    return '';
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }
    return dateStr;
}

function updateBulkDeleteVisibility() {
    if (selectedLeadIds.size > 0) {
        bulkDeleteBtn.style.display = 'inline-flex';
        selectedCountSpan.textContent = selectedLeadIds.size;
    } else {
        bulkDeleteBtn.style.display = 'none';
    }
    // Update master checkbox state
    const visibleLeads = getFilteredLeads();
    selectAllCheckbox.checked = visibleLeads.length > 0 && visibleLeads.every(l => selectedLeadIds.has(l.id));
}

function getFilteredLeads() {
    return leads.filter(lead => {
        const searchTerm = searchInput.value.toLowerCase();
        const matchesSearch = lead.name.toLowerCase().includes(searchTerm) || 
                              lead.phone.includes(searchTerm) || 
                              (lead.email && lead.email.toLowerCase().includes(searchTerm));
        
        const matchesStatus = statusFilter.value === 'all' || lead.status === statusFilter.value;
        const matchesPeriod = periodFilter.value === 'all' || lead.period === periodFilter.value;
        
        return matchesSearch && matchesStatus && matchesPeriod;
    });
}

// Rendering
function renderTable() {
    let filteredLeads = getFilteredLeads();

    // Sorting
    filteredLeads.sort((a, b) => {
        let valA = a[currentSort.column];
        let valB = b[currentSort.column];
        
        if (currentSort.column === 'pax') {
            valA = parseInt(valA);
            valB = parseInt(valB);
        }
        
        if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
        if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;
        return 0;
    });

    tableBody.innerHTML = '';
    
    filteredLeads.forEach((lead) => {
        const tr = document.createElement('tr');
        
        // Auto WhatsApp Message
        const waMessage = encodeURIComponent(`Bonjour ${lead.name.split(' ')[0]} 🌙\n\nVous avez demandé des informations sur nos voyages Omra 2026 🕌\n\nNous avons plusieurs départs disponibles :\n🟢 Juin 2026\n🟢 Juillet 2026\n🟢 Septembre 2026\n🟢 Octobre 2026\n🟢 Novembre 2026\n🟢 Décembre 2026\n\nVous partez seul(e) ou en famille ?\n\nQu'Allah facilite votre voyage 🤲`);
        const waLink = `https://wa.me/${lead.phone.replace(/[^0-9+]/g, '')}?text=${waMessage}`;
        
        const isSelected = selectedLeadIds.has(lead.id);

        tr.innerHTML = `
            <td><input type="checkbox" class="lead-checkbox" value="${lead.id}" ${isSelected ? 'checked' : ''}></td>
            <td>${lead.id}</td>
            <td>${formatDate(lead.date)}</td>
            <td style="font-weight: 500;">${lead.name}</td>
            <td>${lead.phone}</td>
            <td style="color: var(--text-muted);">${lead.email || '-'}</td>
            <td>${lead.pax} <span style="color:var(--text-muted); font-size: 0.8rem;">pax</span></td>
            <td><span class="badge badge-period ${getPeriodClass(lead.period)}">${lead.period}</span></td>
            <td>${lead.source}</td>
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
            <td class="${getPriorityClass(lead.priority)}">${lead.priority}</td>
            <td>${formatDate(lead.recallDate)}</td>
            <td>
                <div class="note-preview" onclick="openNotes(${lead.id})">
                    ${lead.notes || 'Ajouter une note...'}
                </div>
            </td>
            <td>
                <div class="action-btns">
                    <a href="tel:${lead.phone}" class="btn-icon btn-call" title="Appeler">📞</a>
                    <a href="${waLink}" target="_blank" class="btn-icon btn-wa" title="WhatsApp">💬</a>
                    <button class="btn-icon btn-edit" onclick="openEditModal(${lead.id})" title="Modifier">✏️</button>
                    <button class="btn-icon btn-delete" onclick="deleteLead(${lead.id})" title="Supprimer">🗑️</button>
                </div>
            </td>
        `;
        
        // Checkbox event
        const cb = tr.querySelector('.lead-checkbox');
        cb.addEventListener('change', (e) => {
            if (e.target.checked) {
                selectedLeadIds.add(lead.id);
            } else {
                selectedLeadIds.delete(lead.id);
            }
            updateBulkDeleteVisibility();
        });

        tableBody.appendChild(tr);
    });

    document.getElementById('displayed-count').textContent = filteredLeads.length;
    document.getElementById('total-count').textContent = leads.length;
    updateBulkDeleteVisibility();
}

function updateKPIs() {
    document.getElementById('kpi-total').textContent = leads.length;
    document.getElementById('kpi-reserved').textContent = leads.filter(l => l.status === 'Réservé').length;
    document.getElementById('kpi-interested').textContent = leads.filter(l => l.status === 'Intéressé').length;
    document.getElementById('kpi-recall').textContent = leads.filter(l => l.status === 'À relancer').length;
    document.getElementById('kpi-lost').textContent = leads.filter(l => l.status === 'Perdu').length;
}

// Actions API
window.changeStatus = async function(id, newStatus) {
    try {
        const response = await fetch(`${API_URL}/leads/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });
        if (response.ok) {
            const updatedLead = await response.json();
            const index = leads.findIndex(l => l.id === id);
            if (index !== -1) {
                leads[index] = updatedLead;
                updateKPIs();
                renderTable();
            }
        }
    } catch (error) {
        console.error('Erreur:', error);
    }
};

window.deleteLead = async function(id) {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce lead ?')) {
        try {
            const response = await fetch(`${API_URL}/leads/${id}`, {
                method: 'DELETE'
            });
            if (response.ok) {
                leads = leads.filter(l => l.id !== id);
                selectedLeadIds.delete(id);
                updateKPIs();
                renderTable();
            }
        } catch (error) {
            console.error('Erreur:', error);
        }
    }
};

window.openNotes = function(id) {
    const lead = leads.find(l => l.id === id);
    if (lead) {
        editingLeadId = id;
        editNotesArea.value = lead.notes || '';
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

// Event Listeners
function setupEventListeners() {
    searchInput.addEventListener('input', renderTable);
    statusFilter.addEventListener('change', renderTable);
    periodFilter.addEventListener('change', renderTable);

    // Sorting
    document.querySelectorAll('th[data-sort]').forEach(th => {
        th.addEventListener('click', () => {
            const column = th.dataset.sort;
            if (currentSort.column === column) {
                currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
            } else {
                currentSort.column = column;
                currentSort.direction = 'asc';
            }
            renderTable();
        });
    });

    // Modals
    addLeadBtn.addEventListener('click', () => {
        if(!currentDossierId) {
            alert("Veuillez d'abord créer un dossier.");
            return;
        }
        addModal.classList.add('active');
    });

    newDossierBtn.addEventListener('click', () => {
        dossierModal.classList.add('active');
    });

    closeModals.forEach(btn => {
        btn.addEventListener('click', () => {
            addModal.classList.remove('active');
            editModal.classList.remove('active');
            notesModal.classList.remove('active');
            dossierModal.classList.remove('active');
        });
    });

    // Dossier Logic
    dossierSelect.addEventListener('change', async (e) => {
        currentDossierId = parseInt(e.target.value);
        await fetchLeads();
    });

    addDossierForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('add-dossier-name').value;
        try {
            const response = await fetch(`${API_URL}/dossiers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name })
            });
            if (response.ok) {
                const newDossier = await response.json();
                dossiers.push(newDossier);
                currentDossierId = newDossier.id;
                dossierModal.classList.remove('active');
                addDossierForm.reset();
                renderDossierSelect();
                dossierSelect.value = currentDossierId;
                await fetchLeads();
            }
        } catch(err) {
            console.error(err);
        }
    });

    deleteDossierBtn.addEventListener('click', async () => {
        if(confirm("Êtes-vous sûr de vouloir supprimer ce dossier ET tous les leads à l'intérieur ?")) {
            try {
                const response = await fetch(`${API_URL}/dossiers/${currentDossierId}`, {
                    method: 'DELETE'
                });
                if (response.ok) {
                    await fetchDossiers();
                }
            } catch(err) {
                console.error(err);
            }
        }
    });

    // Bulk Select Logic
    selectAllCheckbox.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        const visibleLeads = getFilteredLeads();
        if (isChecked) {
            visibleLeads.forEach(l => selectedLeadIds.add(l.id));
        } else {
            visibleLeads.forEach(l => selectedLeadIds.delete(l.id));
        }
        renderTable(); // Re-render to update checkbox visuals
    });

    bulkDeleteBtn.addEventListener('click', async () => {
        if (selectedLeadIds.size === 0) return;
        if (confirm(`Êtes-vous sûr de vouloir supprimer ces ${selectedLeadIds.size} leads ?`)) {
            try {
                const response = await fetch(`${API_URL}/leads/bulk-delete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ ids: Array.from(selectedLeadIds) })
                });
                
                if (response.ok) {
                    leads = leads.filter(l => !selectedLeadIds.has(l.id));
                    selectedLeadIds.clear();
                    updateKPIs();
                    renderTable();
                }
            } catch (error) {
                console.error('Erreur:', error);
            }
        }
    });


    // Add Form API
    addLeadForm.addEventListener('submit', async (e) => {
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
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newLeadData)
            });
            
            if (response.ok) {
                const addedLead = await response.json();
                leads.unshift(addedLead);
                
                addModal.classList.remove('active');
                addLeadForm.reset();
                
                updateKPIs();
                renderTable();
            } else if (response.status === 409) {
                const errorData = await response.json();
                alert(errorData.error);
            }
        } catch (error) {
            console.error('Erreur:', error);
        }
    });

    // Edit Form API
    editLeadForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const id = parseInt(document.getElementById('edit-id').value);
        const updatedLeadData = {
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
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedLeadData)
            });
            
            if (response.ok) {
                const updatedLead = await response.json();
                const index = leads.findIndex(l => l.id === id);
                if (index !== -1) {
                    leads[index] = updatedLead;
                    editModal.classList.remove('active');
                    updateKPIs();
                    renderTable();
                }
            }
        } catch (error) {
            console.error('Erreur:', error);
        }
    });

    // Save Notes API
    saveNotesBtn.addEventListener('click', async () => {
        if (editingLeadId) {
            try {
                const response = await fetch(`${API_URL}/leads/${editingLeadId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ notes: editNotesArea.value })
                });
                
                if (response.ok) {
                    const updatedLead = await response.json();
                    const index = leads.findIndex(l => l.id === editingLeadId);
                    if (index !== -1) {
                        leads[index] = updatedLead;
                        renderTable();
                    }
                }
            } catch (error) {
                console.error('Erreur:', error);
            }
        }
        notesModal.classList.remove('active');
    });

    // Export CSV
    exportBtn.addEventListener('click', () => {
        const headers = ['ID', 'Date', 'Nom', 'Téléphone', 'Email', 'Pax', 'Période', 'Source', 'Statut', 'Priorité', 'Date Rappel', 'Notes'];
        const csvRows = [headers.join(',')];
        
        leads.forEach(lead => {
            const row = [
                lead.id,
                lead.date,
                `"${lead.name}"`,
                `"${lead.phone}"`,
                lead.email || '',
                lead.pax,
                `"${lead.period}"`,
                `"${lead.source}"`,
                `"${lead.status}"`,
                lead.priority,
                lead.recallDate,
                `"${(lead.notes || '').replace(/"/g, '""')}"`
            ];
            csvRows.push(row.join(','));
        });
        
        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', 'leads_omra_2026.csv');
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });
}

// Start
document.addEventListener('DOMContentLoaded', init);
