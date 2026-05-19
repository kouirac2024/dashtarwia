const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

const defaultData = {
    dossiers: [{ id: 1, name: "Campagne Omra" }],
    leads: []
};

let memoryData = null;

try {
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2));
    }
} catch (e) {
    console.warn("Could not write default data file (expected on Vercel)");
}

function readData() {
    if (memoryData) return memoryData;
    try {
        const data = fs.readFileSync(DATA_FILE, 'utf8');
        const parsed = JSON.parse(data);
        if (Array.isArray(parsed)) {
            const migrated = {
                dossiers: [{ id: 1, name: "Campagne Générale" }],
                leads: parsed.map(l => ({ ...l, dossierId: 1 }))
            };
            writeData(migrated);
            return migrated;
        }
        memoryData = parsed;
        return parsed;
    } catch (error) {
        console.error("Error reading data:", error);
        memoryData = defaultData;
        return defaultData;
    }
}

function writeData(data) {
    memoryData = data;
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
    } catch(e) {
        console.warn("Read-only filesystem (expected on Vercel), data saved in memory only.");
    }
}

// DOSSIERS API
app.get('/api/dossiers', (req, res) => {
    const data = readData();
    res.json(data.dossiers || []);
});

app.post('/api/dossiers', (req, res) => {
    const data = readData();
    const newDossier = req.body;
    const maxId = data.dossiers.length > 0 ? Math.max(...data.dossiers.map(d => d.id)) : 0;
    newDossier.id = maxId + 1;
    data.dossiers.push(newDossier);
    writeData(data);
    res.status(201).json(newDossier);
});

app.delete('/api/dossiers/:id', (req, res) => {
    const data = readData();
    const id = parseInt(req.params.id);
    
    data.dossiers = data.dossiers.filter(d => d.id !== id);
    data.leads = data.leads.filter(l => l.dossierId !== id);
    
    writeData(data);
    res.status(204).send();
});


// LEADS API
app.get('/api/leads', (req, res) => {
    const data = readData();
    const dossierId = req.query.dossierId ? parseInt(req.query.dossierId) : null;
    let leads = data.leads || [];
    if (dossierId) {
        leads = leads.filter(l => l.dossierId === dossierId);
    }
    res.json(leads);
});

app.post('/api/leads', (req, res) => {
    const data = readData();
    const newLead = req.body;

    // Check if lead already exists based on phone number
    const existingLead = data.leads.find(l => l.phone === newLead.phone);
    if (existingLead) {
        const dossier = data.dossiers.find(d => d.id === existingLead.dossierId);
        const dossierName = dossier ? dossier.name : "un autre dossier";
        return res.status(409).json({ error: `⚠️ Impossible d'ajouter : Ce lead (téléphone: ${newLead.phone}) existe déjà et est pris en charge dans le dossier "${dossierName}".` });
    }

    const maxId = data.leads.length > 0 ? Math.max(...data.leads.map(l => l.id)) : 0;
    newLead.id = maxId + 1;
    if (!newLead.date) {
        newLead.date = new Date().toISOString().split('T')[0];
    }
    if(!newLead.dossierId) newLead.dossierId = 1;
    
    data.leads.unshift(newLead);
    writeData(data);
    
    res.status(201).json(newLead);
});

app.put('/api/leads/:id', (req, res) => {
    const data = readData();
    const id = parseInt(req.params.id);
    const index = data.leads.findIndex(l => l.id === id);
    if (index !== -1) {
        data.leads[index] = { ...data.leads[index], ...req.body };
        writeData(data);
        res.json(data.leads[index]);
    } else {
        res.status(404).json({ error: 'Lead not found' });
    }
});

app.delete('/api/leads/:id', (req, res) => {
    const data = readData();
    const id = parseInt(req.params.id);
    const initialLength = data.leads.length;
    data.leads = data.leads.filter(l => l.id !== id);
    if (data.leads.length < initialLength) {
        writeData(data);
        res.status(204).send();
    } else {
        res.status(404).json({ error: 'Lead not found' });
    }
});

// Bulk Delete Leads
app.post('/api/leads/bulk-delete', (req, res) => {
    const data = readData();
    const idsToDelete = req.body.ids || [];
    data.leads = data.leads.filter(l => !idsToDelete.includes(l.id));
    writeData(data);
    res.status(204).send();
});

const server = app.listen(PORT, () => {
    console.log(`✅ Backend server is running on http://localhost:${PORT}`);
});

module.exports = app;
