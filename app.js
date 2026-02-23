class RettungsdienstApp {
    constructor() {
        this.codes = {};
        this.foundCodes = [];
        this.currentDataSource = 'default';
    }

    async init() {
        await this.loadCodes();
        this.setupEventListeners();
        this.renderCategories();
        this.showAllCodes();
        this.updateConfigInfo();
        this.registerServiceWorker();
    }

    async loadCodes() {
        try {
            // Zuerst prüfen ob lokale Daten vorhanden sind
            const savedData = localStorage.getItem('customCodesData');
            if (savedData) {
                console.log('Lade Daten aus localStorage');
                this.codes = JSON.parse(savedData);
                this.currentDataSource = 'localStorage';
                console.log('Lokale Daten geladen:', this.codes.metadata);
                return;
            }

            // Fallback: Standard-Datei laden
            console.log('Lade Standard-Datei einsatzcodes.json');
            const response = await fetch('./einsatzcodes.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.codes = await response.json();
            this.currentDataSource = 'default';
            console.log('Standard-Codes geladen:', this.codes.metadata);

        } catch (error) {
            console.error('Fehler beim Laden der Codes:', error);
            this.showMessage('Fehler beim Laden der Einsatzcodes. Fallback-Daten werden verwendet.', 'error');

            // Fallback: Minimale Struktur
            this.codes = {
                metadata: {
                    title: "Einsatzcodes - Keine Daten verfügbar",
                    version: "Fallback v1.0",
                    lastUpdated: new Date().toISOString()
                },
                categories: {
                    "fallback": {
                        "name": "Fallback",
                        "color": "#6B7280",
                        "codes": {
                            "000": "Keine Daten verfügbar - Bitte JSON-Datei hochladen"
                        }
                    }
                }
            };
            this.currentDataSource = 'fallback';
        }
    }

    setupFileUploadEvents() {
        const fileInput = document.getElementById('file-input');
        const fileUploadArea = document.getElementById('file-upload-area');
        const selectFileBtn = document.getElementById('select-file-btn');
        const resetBtn = document.getElementById('reset-to-default-btn');
        const downloadBtn = document.getElementById('download-current-btn');

        // File Input Change
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileUpload(e.target.files[0]);
            }
        });

        // Drag & Drop
        fileUploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            fileUploadArea.classList.add('dragover');
        });

        fileUploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            fileUploadArea.classList.remove('dragover');
        });

        fileUploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            fileUploadArea.classList.remove('dragover');

            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type === 'application/json') {
                this.handleFileUpload(files[0]);
            } else {
                this.showMessage('Bitte nur JSON-Dateien verwenden!', 'error');
            }
        });

        // Click to select
        fileUploadArea.addEventListener('click', () => {
            fileInput.click();
        });

        selectFileBtn.addEventListener('click', () => {
            fileInput.click();
        });

        // Reset to default
        resetBtn.addEventListener('click', () => {
            this.resetToDefault();
        });

        // Download current config
        downloadBtn.addEventListener('click', () => {
            this.downloadCurrentConfig();
        });
    }

    async handleFileUpload(file) {
        try {
            const content = await this.readFileAsText(file);
            const jsonData = JSON.parse(content);

            // Validierung
            const validation = this.validateJsonStructure(jsonData);
            this.displayValidationResult(validation);

            if (validation.valid) {
                // Daten speichern und anwenden
                this.codes = jsonData;
                this.currentDataSource = 'uploaded';

                // In localStorage speichern
                localStorage.setItem('customCodesData', JSON.stringify(jsonData));
                localStorage.setItem('customCodesSource', file.name);

                // UI aktualisieren
                this.renderCategories();
                this.filterCodes('');
                this.updateConfigInfo();

                this.showMessage(`Datei "${file.name}" erfolgreich geladen!`, 'success');

                // Config-Sektion ausblenden
                document.getElementById('config-section').style.display = 'none';

            } else {
                this.showMessage('JSON-Datei ist nicht gültig. Siehe Validierungsdetails.', 'error');
            }

        } catch (error) {
            console.error('Fehler beim Verarbeiten der Datei:', error);
            this.showMessage('Fehler beim Lesen der JSON-Datei: ' + error.message, 'error');
            this.displayValidationResult({
                valid: false,
                errors: [`Fehler beim Parsen: ${error.message}`],
                warnings: []
            });
        }
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = e => resolve(e.target.result);
            reader.onerror = e => reject(new Error('Fehler beim Lesen der Datei'));
            reader.readAsText(file);
        });
    }

    validateJsonStructure(data) {
        const errors = [];
        const warnings = [];

        // Basis-Struktur prüfen
        if (!data.metadata) {
            errors.push('Fehlende "metadata" Sektion');
        } else {
            if (!data.metadata.title) warnings.push('Fehlender Titel in metadata');
            if (!data.metadata.version) warnings.push('Fehlende Version in metadata');
        }

        if (!data.categories) {
            errors.push('Fehlende "categories" Sektion');
        } else {
            let totalCodes = 0;
            Object.keys(data.categories).forEach(catKey => {
                const category = data.categories[catKey];
                if (!category.name) {
                    errors.push(`Kategorie "${catKey}" hat keinen Namen`);
                }
                if (!category.codes) {
                    errors.push(`Kategorie "${catKey}" hat keine Codes`);
                } else {
                    totalCodes += Object.keys(category.codes).length;
                }
            });

            if (totalCodes === 0) {
                errors.push('Keine Codes in den Kategorien gefunden');
            }
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            totalCategories: data.categories ? Object.keys(data.categories).length : 0,
            totalCodes: this.countTotalCodes(data)
        };
    }

    countTotalCodes(data) {
        if (!data.categories) return 0;
        let total = 0;
        Object.keys(data.categories).forEach(catKey => {
            if (data.categories[catKey].codes) {
                total += Object.keys(data.categories[catKey].codes).length;
            }
        });
        return total;
    }

    displayValidationResult(validation) {
        const resultSection = document.getElementById('validation-result');
        const detailsContainer = document.getElementById('validation-details');

        let html = '';

        if (validation.valid) {
            html += `
        <div class="validation-success">
          <div class="validation-icon">✅</div>
          <div class="validation-info">
            <strong>Validierung erfolgreich!</strong><br>
            📊 $${validation.totalCategories} Kategorien, $${validation.totalCodes} Codes gefunden
          </div>
        </div>
      `;
        } else {
            html += `
        <div class="validation-error">
          <div class="validation-icon">❌</div>
          <div class="validation-info">
            <strong>Validierung fehlgeschlagen!</strong>
          </div>
        </div>
      `;
        }

        if (validation.errors && validation.errors.length > 0) {
            html += `
        <div class="validation-errors">
          <strong>🚫 Fehler:</strong>
          <ul>
            $${validation.errors.map(error => `<li>$${error}</li>`).join('')}
          </ul>
        </div>
      `;
        }

        if (validation.warnings && validation.warnings.length > 0) {
            html += `
        <div class="validation-warnings">
          <strong>⚠️ Warnungen:</strong>
          <ul>
            $${validation.warnings.map(warning => `<li>$${warning}</li>`).join('')}
          </ul>
        </div>
      `;
        }

        detailsContainer.innerHTML = html;
        resultSection.style.display = 'block';
    }

    resetToDefault() {
        if (confirm('Möchten Sie wirklich zur Standard-Konfiguration zurückkehren? Alle hochgeladenen Daten gehen verloren.')) {
            localStorage.removeItem('customCodesData');
            localStorage.removeItem('customCodesSource');

            this.showMessage('Lade Standard-Konfiguration...', 'info');

            // Seite neu laden um Standard-Daten zu laden
            setTimeout(() => {
                window.location.reload();
            }, 1000);
        }
    }

    downloadCurrentConfig() {
        const dataStr = JSON.stringify(this.codes, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });

        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `einsatzcodes-backup-${new Date().toISOString().split('T')[0]}.json`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.showMessage('Konfiguration heruntergeladen!', 'success');
    }

    toggleConfigSection() {
        const configSection = document.getElementById('config-section');
        if (configSection.style.display === 'none') {
            configSection.style.display = 'block';
            this.updateConfigInfo();
            // Scroll zur Sektion
            configSection.scrollIntoView({ behavior: 'smooth' });
        } else {
            configSection.style.display = 'none';
        }
    }

    updateConfigInfo() {
        const sourceEl = document.getElementById('config-source');
        const versionEl = document.getElementById('config-version');
        const updatedEl = document.getElementById('config-updated');
        const categoriesEl = document.getElementById('config-categories');
        const versionInfoEl = document.getElementById('version-info');

        // Quelle bestimmen
        let sourceText = 'Standard-Datei';
        if (this.currentDataSource === 'localStorage') {
            const savedSource = localStorage.getItem('customCodesSource');
            sourceText = savedSource ? `Hochgeladen: ${savedSource}` : 'Hochgeladene Datei';
        } else if (this.currentDataSource === 'uploaded') {
            sourceText = 'Gerade hochgeladen';
        } else if (this.currentDataSource === 'fallback') {
            sourceText = 'Fallback (Fehler beim Laden)';
        }

        const totalCodes = this.countTotalCodes(this.codes);
        const categoriesCount = this.codes.categories ? Object.keys(this.codes.categories).length : 0;

        sourceEl.textContent = sourceText;
        versionEl.textContent = this.codes.metadata?.version || 'Unbekannt';
        updatedEl.textContent = this.codes.metadata?.lastUpdated || 'Unbekannt';
        categoriesEl.textContent = `$${categoriesCount} ($${totalCodes} Codes)`;

        // Header-Version aktualisieren
        const title = this.codes.metadata?.title || 'Rettungsdienst Codes';
        versionInfoEl.textContent = this.codes.metadata?.version || 'Unbekannt';
    }

    calculatePriority(codes) {
        const highPriorityCodes = ['237', '222', '232', '260', '268', '900', '901', '902', '239', '341'];
        const mediumPriorityCodes = ['221', '233', '236', '238', '261', '262', '230', '280', '340'];

        const hasHighPriority = codes.some(code => highPriorityCodes.includes(code.code));
        const hasMediumPriority = codes.some(code => mediumPriorityCodes.includes(code.code));

        if (hasHighPriority) {
            return {
                level: 'high',
                icon: '🚨',
                title: 'HOHE PRIORITÄT',
                details: 'Lebensbedrohlicher Zustand! Sofortige Maßnahmen erforderlich. RTW/NEF anfordern, ggf. Notarzt hinzuziehen.'
            };
        } else if (hasMediumPriority || codes.length >= 2) {
            return {
                level: 'medium',
                icon: '⚠️',
                title: 'MITTLERE PRIORITÄT',
                details: 'Schwerwiegender Zustand. Zeitnahe Versorgung und Transport ins Krankenhaus. Überwachung der Vitalwerte.'
            };
        } else {
            return {
                level: 'low',
                icon: '💚',
                title: 'NIEDRIGE PRIORITÄT',
                details: 'Stabile Situation. Routineversorgung und regulärer Transport. Kontinuierliche Überwachung.'
            };
        }
    }

    renderCategories() {
        const grid = document.getElementById('category-grid');

        const categoriesHtml = Object.keys(this.codes.categories).map(key => {
            const category = this.codes.categories[key];
            const codeCount = Object.keys(category.codes).length;

            return `
        <div class="category-card category-${key}" 
             onclick="window.app.filterByCategory('${key}')" 
             style="background-color: ${category.color}15; border-left: 4px solid ${category.color};">
          <div class="category-title" style="color: ${category.color};">${category.name}</div>
          <div class="category-count">${codeCount} Codes</div>
        </div>
      `;
        }).join('');

        grid.innerHTML = categoriesHtml;
    }

    filterCodes(query) {
        const container = document.getElementById('filtered-codes');
        const queryLower = query.toLowerCase();

        if (query.trim() === '') {
            const allCodes = [];
            Object.keys(this.codes.categories).forEach(categoryKey => {
                const category = this.codes.categories[categoryKey];
                Object.keys(category.codes).forEach(code => {
                    allCodes.push({
                        code,
                        description: category.codes[code],
                        category: categoryKey,
                        categoryName: category.name
                    });
                });
            });

            this.renderFilteredCodes(container, allCodes.slice(0, 100)); // Max 100 für Performance
            return;
        }

        const matches = this.searchCodes(query);
        this.renderFilteredCodes(container, matches.slice(0, 100));
    }

    renderFilteredCodes(container, codes) {
        if (codes.length === 0) {
            container.innerHTML = '<div class="empty-state"><h3>Keine Codes gefunden</h3><p>Versuchen Sie andere Suchbegriffe</p></div>';
            return;
        }

        const html = codes.map(code => `
      <div class="code-item" onclick="window.app.addCodeToSearch('${code.code}')">
        <div class="code-item-code">${code.code}</div>
        <div class="code-item-description">${code.description}</div>
        <span class="code-item-category category-${code.category}">${code.categoryName}</span>
      </div>
    `).join('');

        container.innerHTML = html;
    }

    setupEventListeners() {
        // Multi-Code-Suche
        const searchInput = document.getElementById('multi-search');
        const clearBtn = document.getElementById('clear-search-btn');

        searchInput.addEventListener('input', (e) => {
            this.handleMultiSearch(e.target.value);
            this.toggleClearButton(e.target.value);
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.clearSearch();
            }
        });

        // Clear Button
        clearBtn.addEventListener('click', () => {
            this.clearSearch();
        });

        // Config Icon
        document.getElementById('config-icon').addEventListener('click', () => {
            this.toggleConfigSection();
        });

        // Info Modal
        document.getElementById('info-icon').addEventListener('click', () => {
            this.openInfoModal();
        });

        document.getElementById('info-modal-close').addEventListener('click', () => {
            this.closeInfoModal();
        });

        // File Upload Events
        this.setupFileUploadEvents();

        // Global Click Handler
        document.addEventListener('click', (e) => {
            if (e.target === document.getElementById('info-modal')) {
                this.closeInfoModal();
            }
        });
    }

    toggleClearButton(value) {
        const clearBtn = document.getElementById('clear-search-btn');
        if (value.trim()) {
            clearBtn.style.display = 'flex';
        } else {
            clearBtn.style.display = 'none';
        }
    }

    clearSearch() {
        const searchInput = document.getElementById('multi-search');
        const clearBtn = document.getElementById('clear-search-btn');
        const searchResults = document.getElementById('search-results');
        const allCodesDisplay = document.getElementById('all-codes-display');

        searchInput.value = '';
        clearBtn.style.display = 'none';
        searchResults.style.display = 'none';
        allCodesDisplay.style.display = 'block';

        this.foundCodes = [];
        this.showAllCodes();
        this.showMessage('Suche geleert', 'info');

        // Focus zurück zum Eingabefeld
        searchInput.focus();
    }

    handleMultiSearch(query) {
        const searchResults = document.getElementById('search-results');
        const allCodesDisplay = document.getElementById('all-codes-display');

        if (!query.trim()) {
            searchResults.style.display = 'none';
            allCodesDisplay.style.display = 'block';
            this.foundCodes = [];
            return;
        }

        // Alle Codes ausblenden, Suchergebnisse anzeigen
        allCodesDisplay.style.display = 'none';

        // Query in einzelne Begriffe aufteilen (Leerzeichen als Trenner)
        const searchTerms = query.trim().split(/\s+/);
        const results = [];

        searchTerms.forEach(term => {
            const matches = this.searchCodes(term);
            matches.forEach(match => {
                // Duplikate vermeiden
                if (!results.find(r => r.code === match.code)) {
                    results.push(match);
                }
            });
        });

        this.foundCodes = results;
        this.displayMultiSearchResults(results);
    }

    searchCodes(query) {
        const results = [];
        const queryLower = query.toLowerCase(); // Case-insensitive

        Object.keys(this.codes.categories).forEach(categoryKey => {
            const category = this.codes.categories[categoryKey];
            Object.keys(category.codes).forEach(code => {
                const description = category.codes[code];
                const codeLower = code.toLowerCase();
                const descriptionLower = description.toLowerCase();

                // Case-insensitive Suche
                if (codeLower.includes(queryLower) ||
                    descriptionLower.includes(queryLower)) {
                    results.push({
                        code,
                        description,
                        category: categoryKey,
                        categoryName: category.name,
                        color: category.color
                    });
                }
            });
        });

        return results.sort((a, b) => {
            const queryLower = query.toLowerCase();
            const aCodeLower = a.code.toLowerCase();
            const bCodeLower = b.code.toLowerCase();

            // Zuerst exakte Code-Matches (case-insensitive)
            if (aCodeLower === queryLower && bCodeLower !== queryLower) return -1;
            if (bCodeLower === queryLower && aCodeLower !== queryLower) return 1;

            // Dann Code-Präfix-Matches (case-insensitive)
            if (aCodeLower.startsWith(queryLower) && !bCodeLower.startsWith(queryLower)) return -1;
            if (bCodeLower.startsWith(queryLower) && !aCodeLower.startsWith(queryLower)) return 1;

            // Schließlich alphabetisch nach Code
            return a.code.localeCompare(b.code);
        });
    }

    displayMultiSearchResults(codes) {
        const searchResults = document.getElementById('search-results');
        const foundCodesContainer = document.getElementById('found-codes');
        const priorityAssessment = document.getElementById('priority-assessment');

        if (codes.length === 0) {
            searchResults.style.display = 'block';
            foundCodesContainer.innerHTML = '<div class="empty-state"><h3>Keine Codes gefunden</h3><p>Versuchen Sie andere Suchbegriffe</p></div>';
            priorityAssessment.style.display = 'none';
            return;
        }

        const resultsHtml = codes.map(code => `
      <div class="result-item">
        <div class="result-code">${code.code}</div>
        <div class="result-description">${code.description}</div>
        <span class="result-category category-${code.category}">${code.categoryName}</span>
      </div>
    `).join('');

        foundCodesContainer.innerHTML = resultsHtml;

        if (codes.length > 0) {
            const priority = this.calculatePriority(codes);
            priorityAssessment.className = `priority-assessment priority-${priority.level}`;
            priorityAssessment.innerHTML = `
        <div class="priority-title">
          ${priority.icon} ${priority.title}
        </div>
        <div class="priority-details">${priority.details}</div>
      `;
            priorityAssessment.style.display = 'block';
        } else {
            priorityAssessment.style.display = 'none';
        }

        searchResults.style.display = 'block';
    }

    showAllCodes() {
        const container = document.getElementById('all-codes-list');
        const allCodes = [];

        Object.keys(this.codes.categories).forEach(categoryKey => {
            const category = this.codes.categories[categoryKey];
            Object.keys(category.codes).forEach(code => {
                allCodes.push({
                    code,
                    description: category.codes[code],
                    category: categoryKey,
                    categoryName: category.name
                });
            });
        });

        // Nach Code-Nummer sortieren
        allCodes.sort((a, b) => {
            return parseInt(a.code) - parseInt(b.code);
        });

        this.renderFilteredCodes(container, allCodes.slice(0, 100));
    }

    filterByCategory(categoryKey) {
        const searchInput = document.getElementById('multi-search');
        const category = this.codes.categories[categoryKey];

        // Den Kategorienamen in die Suche einsetzen für bessere Ergebnisse
        searchInput.value = category.name.toLowerCase();

        this.handleMultiSearch(searchInput.value);
        this.toggleClearButton(searchInput.value);

        document.querySelector('.multi-search-section').scrollIntoView({
            behavior: 'smooth'
        });

        this.showMessage(`${category.name} Codes gefiltert`, 'success');
    }

    addCodeToSearch(code) {
        const multiSearchInput = document.getElementById('multi-search');
        const currentValue = multiSearchInput.value.trim();

        // Prüfen ob Code bereits vorhanden (case-insensitive)
        const currentCodes = currentValue.split(/\s+/).filter(c => c);
        const codeExists = currentCodes.some(c => c.toLowerCase() === code.toLowerCase());

        if (codeExists) {
            this.showMessage(`Code ${code} bereits in der Suche`, 'info');
            return;
        }

        // Code hinzufügen
        const newValue = currentValue ? `${currentValue} ${code}` : code;
        multiSearchInput.value = newValue;
        this.handleMultiSearch(newValue);
        this.toggleClearButton(newValue);

        // Nach oben scrollen zur Suche
        document.querySelector('.multi-search-section').scrollIntoView({
            behavior: 'smooth'
        });

        this.showMessage(`Code ${code} zur Suche hinzugefügt`, 'success');
    }

    openInfoModal() {
        document.getElementById('info-modal').style.display = 'block';
    }

    closeInfoModal() {
        document.getElementById('info-modal').style.display = 'none';
    }

    showMessage(text, type = 'info') {
        const container = document.getElementById('message-container') || this.createMessageContainer();

        const message = document.createElement('div');
        message.className = `message ${type}`;
        message.textContent = text;

        container.appendChild(message);

        setTimeout(() => {
            if (message.parentNode) {
                message.parentNode.removeChild(message);
            }
        }, 4000);
    }

    createMessageContainer() {
        const container = document.createElement('div');
        container.id = 'message-container';
        container.style.position = 'fixed';
        container.style.top = '80px';
        container.style.right = '1rem';
        container.style.zIndex = '1001';
        document.body.appendChild(container);
        return container;
    }

    async registerServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.register('./sw.js');
                console.log('Service Worker registriert:', registration);
            } catch (error) {
                console.error('Service Worker Registrierung fehlgeschlagen:', error);
            }
        }
    }
}

// App initialisieren
window.app = new RettungsdienstApp();
document.addEventListener('DOMContentLoaded', () => {
    window.app.init();
});