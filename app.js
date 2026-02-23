class RettungsdienstApp {
    constructor() {
        this.codes = {};
        this.foundCodes = [];
        this.currentDataSource = 'default';
        this.currentAppVersion = '1.8'; // Version synchron mit sw.js halten
    }

    async init() {
        console.log('🚀 Initialisiere App...');

        try {
            // Sofort Version anzeigen
            this.updateVersionDisplay();

            await this.loadCodes();
            this.setupEventListeners();
            this.safeRenderCategories();
            this.safeShowAllCodes();
            this.updateConfigInfo(); // Jetzt mit Daten aktualisieren
            this.registerServiceWorker();

            console.log('✅ App erfolgreich initialisiert');
            this.showMessage('App geladen', 'success');
        } catch (error) {
            console.error('❌ Fehler bei der App-Initialisierung:', error);
            this.showMessage('Fehler beim Start der App', 'error');
        }
    }

    // Sofortige Version-Anzeige ohne auf Service Worker zu warten
    updateVersionDisplay() {
        const versionInfoEl = document.getElementById('version-info');
        if (versionInfoEl) {
            versionInfoEl.textContent = `v${this.currentAppVersion}`;
        }
    }

    async loadCodes() {
        try {
            // Zuerst prüfen ob lokale Daten vorhanden sind
            const savedData = localStorage.getItem('customCodesData');
            if (savedData) {
                console.log('📂 Lade Daten aus localStorage');
                const parsedData = JSON.parse(savedData);

                if (parsedData && parsedData.categories) {
                    this.codes = parsedData;
                    this.currentDataSource = 'localStorage';
                    console.log('✅ Lokale Daten geladen:', this.codes.metadata);
                    return;
                } else {
                    console.warn('⚠️ Lokale Daten sind ungültig, lösche sie');
                    localStorage.removeItem('customCodesData');
                    localStorage.removeItem('customCodesSource');
                }
            }

            // Fallback: Standard-Datei laden
            console.log('📥 Lade Standard-Datei einsatzcodes.json');
            const response = await fetch('./einsatzcodes.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (!data || !data.categories) {
                throw new Error('Standard-Datei hat ungültiges Format');
            }

            this.codes = data;
            this.currentDataSource = 'default';
            console.log('✅ Standard-Codes geladen:', this.codes.metadata);

        } catch (error) {
            console.error('❌ Fehler beim Laden der Codes:', error);
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

    setupEventListeners() {
        console.log('🔗 Setup Event Listeners...');

        // Multi-Code-Suche
        const searchInput = document.getElementById('multi-search');
        const clearBtn = document.getElementById('clear-search-btn');

        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.handleMultiSearch(e.target.value);
                this.toggleClearButton(e.target.value);
            });

            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.clearSearch();
                }
            });
        }

        // Clear Button
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.clearSearch();
            });
        }

        // Config Icon
        const configIcon = document.getElementById('config-icon');
        if (configIcon) {
            configIcon.addEventListener('click', () => {
                this.toggleConfigSection();
            });
        }

        // Info Modal
        const infoIcon = document.getElementById('info-icon');
        const infoModalClose = document.getElementById('info-modal-close');

        if (infoIcon) {
            infoIcon.addEventListener('click', () => {
                this.openInfoModal();
            });
        }

        if (infoModalClose) {
            infoModalClose.addEventListener('click', () => {
                this.closeInfoModal();
            });
        }

        // File Upload Events
        this.setupFileUploadEvents();

        // Global Click Handler
        document.addEventListener('click', (e) => {
            if (e.target === document.getElementById('info-modal')) {
                this.closeInfoModal();
            }
        });
    }

    setupFileUploadEvents() {
        const fileInput = document.getElementById('file-input');
        const fileUploadArea = document.getElementById('file-upload-area');
        const mobileUploadArea = document.getElementById('mobile-upload-area');
        const selectFileBtn = document.getElementById('select-file-btn');
        const resetBtn = document.getElementById('reset-to-default-btn');
        const downloadBtn = document.getElementById('download-current-btn');

        if (!fileInput) {
            console.warn('⚠️ file-input Element nicht gefunden');
            return;
        }

        // File Input Change
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFileUpload(e.target.files[0]);
            }
        });

        // Drag & Drop (nur Desktop)
        if (fileUploadArea) {
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

            fileUploadArea.addEventListener('click', () => {
                fileInput.click();
            });
        }

        // Mobile upload area click
        if (mobileUploadArea) {
            mobileUploadArea.addEventListener('click', () => {
                fileInput.click();
            });
        }

        // Buttons
        if (selectFileBtn) {
            selectFileBtn.addEventListener('click', () => {
                fileInput.click();
            });
        }

        if (resetBtn) {
            resetBtn.addEventListener('click', () => {
                this.resetToDefault();
            });
        }

        if (downloadBtn) {
            downloadBtn.addEventListener('click', () => {
                this.downloadCurrentConfig();
            });
        }
    }

    setupUpdateSystem() {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.addEventListener('message', event => {
                const message = event.data;

                if (message.type === 'UPDATE_AVAILABLE') {
                    console.log('🔄 Update verfügbar:', message.version);
                    this.handleUpdateAvailable(message.version);
                }
            });

            // Automatischer Update-Check alle 60 Minuten
            setInterval(() => {
                this.silentUpdateCheck();
            }, 60 * 60 * 1000);

            // Update-Check beim App-Start (nach 30 Sekunden)
            setTimeout(() => {
                this.silentUpdateCheck();
            }, 30000);
        }
    }

    async silentUpdateCheck() {
        if ('serviceWorker' in navigator) {
            try {
                const registration = await navigator.serviceWorker.getRegistration();
                if (registration) {
                    await registration.update();
                }
            } catch (error) {
                console.error('Stiller Update-Check Fehler:', error);
            }
        }
    }

    handleUpdateAvailable(newVersion) {
        // Prüfen ob es wirklich eine neue Version ist
        if (newVersion !== this.currentAppVersion) {
            this.showUpdateNotification(newVersion);
        }
    }

    showUpdateNotification(newVersion) {
        // Bestehende Notification entfernen
        const existingNotification = document.getElementById('update-notification');
        if (existingNotification) {
            existingNotification.remove();
        }

        const notification = document.createElement('div');
        notification.id = 'update-notification';
        notification.className = 'update-notification';
        notification.innerHTML = `
            <div class="update-content">
                <div class="update-icon">🔄</div>
                <div class="update-text">
                    <strong>Update verfügbar!</strong>
                    <span>Version ${newVersion} ist verfügbar</span>
                </div>
                <div class="update-actions">
                    <button id="update-now-btn" class="btn-primary btn-sm">
                        Jetzt aktualisieren
                    </button>
                    <button id="update-later-btn" class="btn-secondary btn-sm">
                        Später
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(notification);

        // Event Listeners
        document.getElementById('update-now-btn').addEventListener('click', () => {
            this.performUpdate();
        });

        document.getElementById('update-later-btn').addEventListener('click', () => {
            notification.remove();
        });

        // Auto-Hide nach 15 Sekunden
        setTimeout(() => {
            if (document.getElementById('update-notification')) {
                notification.remove();
            }
        }, 15000);
    }

    async performUpdate() {
        try {
            this.showMessage('Update wird durchgeführt...', 'info');

            if ('serviceWorker' in navigator) {
                const registration = await navigator.serviceWorker.getRegistration();
                if (registration && registration.waiting) {
                    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
                }
            }

            // Update-Notification entfernen
            const notification = document.getElementById('update-notification');
            if (notification) {
                notification.remove();
            }

            // Seite neu laden nach kurzem Delay
            setTimeout(() => {
                window.location.reload();
            }, 1000);

        } catch (error) {
            console.error('Fehler beim Update:', error);
            this.showMessage('Fehler beim Update. Bitte Seite manuell neu laden.', 'error');
        }
    }

    safeRenderCategories() {
        try {
            const grid = document.getElementById('category-grid');
            if (!grid) {
                console.warn('⚠️ category-grid Element nicht gefunden');
                return;
            }

            if (!this.codes.categories) {
                console.warn('⚠️ Keine Kategorien vorhanden');
                grid.innerHTML = '<div class="empty-state"><p>Keine Kategorien verfügbar</p></div>';
                return;
            }

            // Kategorien nach Namen sortieren
            const sortedCategories = Object.keys(this.codes.categories)
                .map(key => ({
                    key,
                    category: this.codes.categories[key]
                }))
                .sort((a, b) => a.category.name.localeCompare(b.category.name));

            const categoriesHtml = sortedCategories.map(({ key, category }) => {
                const codeCount = Object.keys(category.codes || {}).length;

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
        } catch (error) {
            console.error('❌ Fehler in safeRenderCategories:', error);
        }
    }

    safeShowAllCodes() {
        try {
            const container = document.getElementById('all-codes-list');
            if (!container) {
                console.warn('⚠️ all-codes-list Element nicht gefunden');
                return;
            }

            if (!this.codes.categories) {
                console.warn('⚠️ Keine Kategorien für showAllCodes vorhanden');
                container.innerHTML = '<div class="empty-state"><h3>Keine Codes verfügbar</h3><p>Bitte laden Sie eine gültige JSON-Datei hoch</p></div>';
                return;
            }

            const allCodes = [];
            Object.keys(this.codes.categories).forEach(categoryKey => {
                const category = this.codes.categories[categoryKey];
                if (category.codes) {
                    Object.keys(category.codes).forEach(code => {
                        allCodes.push({
                            code,
                            description: category.codes[code],
                            category: categoryKey,
                            categoryName: category.name
                        });
                    });
                }
            });

            // Nach Code-Nummer sortieren
            allCodes.sort((a, b) => {
                return parseInt(a.code) - parseInt(b.code);
            });

            this.safeRenderFilteredCodes(container, allCodes.slice(0, 100));

            // All-Codes-Display anzeigen
            const allCodesDisplay = document.getElementById('all-codes-display');
            if (allCodesDisplay) {
                allCodesDisplay.style.display = 'block';
            }

        } catch (error) {
            console.error('❌ Fehler in safeShowAllCodes:', error);
        }
    }

    safeRenderFilteredCodes(container, codes) {
        try {
            if (!container) {
                console.warn('⚠️ Container für renderFilteredCodes ist null');
                return;
            }

            if (!codes || codes.length === 0) {
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
        } catch (error) {
            console.error('❌ Fehler in safeRenderFilteredCodes:', error);
        }
    }

    handleMultiSearch(query) {
        const searchResults = document.getElementById('search-results');
        const allCodesDisplay = document.getElementById('all-codes-display');

        if (!query.trim()) {
            if (searchResults) searchResults.style.display = 'none';
            if (allCodesDisplay) allCodesDisplay.style.display = 'block';
            this.foundCodes = [];
            return;
        }

        if (allCodesDisplay) allCodesDisplay.style.display = 'none';

        // Prüfen ob es eine Kategoriesuche ist
        if (query.startsWith('Kategorie: ')) {
            return; // Kategorie-Filter bereits angewendet
        }

        // Sowohl Minus als auch Leerzeichen als Trenner akzeptieren
        const searchTerms = query.trim().split(/[\s\-]+/).filter(term => term.length > 0);
        const results = [];

        searchTerms.forEach(term => {
            const matches = this.searchCodes(term);
            matches.forEach(match => {
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
        const queryLower = query.toLowerCase();

        Object.keys(this.codes.categories).forEach(categoryKey => {
            const category = this.codes.categories[categoryKey];
            Object.keys(category.codes).forEach(code => {
                const description = category.codes[code];
                const codeLower = code.toLowerCase();
                const descriptionLower = description.toLowerCase();

                if (codeLower.includes(queryLower) || descriptionLower.includes(queryLower)) {
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

            if (aCodeLower === queryLower && bCodeLower !== queryLower) return -1;
            if (bCodeLower === queryLower && aCodeLower !== queryLower) return 1;
            if (aCodeLower.startsWith(queryLower) && !bCodeLower.startsWith(queryLower)) return -1;
            if (bCodeLower.startsWith(queryLower) && !aCodeLower.startsWith(queryLower)) return 1;

            return a.code.localeCompare(b.code);
        });
    }

    displayMultiSearchResults(codes) {
        const searchResults = document.getElementById('search-results');
        const foundCodesContainer = document.getElementById('found-codes');
        const priorityAssessment = document.getElementById('priority-assessment');

        if (codes.length === 0) {
            if (searchResults) searchResults.style.display = 'block';
            if (foundCodesContainer) {
                foundCodesContainer.innerHTML = '<div class="empty-state"><h3>Keine Codes gefunden</h3><p>Versuchen Sie andere Suchbegriffe</p></div>';
            }
            if (priorityAssessment) priorityAssessment.style.display = 'none';
            return;
        }

        const resultsHtml = codes.map(code => `
            <div class="result-item">
                <div class="result-code">${code.code}</div>
                <div class="result-description">${code.description}</div>
                <span class="result-category category-${code.category}">${code.categoryName}</span>
            </div>
        `).join('');

        if (foundCodesContainer) foundCodesContainer.innerHTML = resultsHtml;

        if (searchResults) searchResults.style.display = 'block';
    }

    toggleClearButton(value) {
        const clearBtn = document.getElementById('clear-search-btn');
        if (clearBtn) {
            if (value.trim()) {
                clearBtn.style.display = 'flex';
            } else {
                clearBtn.style.display = 'none';
            }
        }
    }

    clearSearch() {
        const searchInput = document.getElementById('multi-search');
        const clearBtn = document.getElementById('clear-search-btn');
        const searchResults = document.getElementById('search-results');
        const allCodesDisplay = document.getElementById('all-codes-display');

        if (searchInput) searchInput.value = '';
        if (clearBtn) clearBtn.style.display = 'none';
        if (searchResults) searchResults.style.display = 'none';
        if (allCodesDisplay) allCodesDisplay.style.display = 'block';

        this.foundCodes = [];
        this.safeShowAllCodes();
        this.showMessage('Filter zurückgesetzt', 'info');

        if (searchInput) searchInput.focus();
    }

    filterByCategory(categoryKey) {
        const category = this.codes.categories[categoryKey];
        const searchResults = document.getElementById('search-results');
        const allCodesDisplay = document.getElementById('all-codes-display');
        const searchInput = document.getElementById('multi-search');

        if (!category) return;

        // Alle Codes dieser Kategorie sammeln
        const categoryResults = [];
        Object.keys(category.codes).forEach(code => {
            categoryResults.push({
                code,
                description: category.codes[code],
                category: categoryKey,
                categoryName: category.name,
                color: category.color
            });
        });

        // Codes nach Code-Nummer sortieren
        categoryResults.sort((a, b) => {
            return parseInt(a.code) - parseInt(b.code);
        });

        // Suchergebnisse anzeigen
        this.foundCodes = categoryResults;
        this.displayMultiSearchResults(categoryResults);

        // Suchfeld mit Kategorienamen füllen (für visuelles Feedback)
        if (searchInput) {
            searchInput.value = `Kategorie: ${category.name}`;
            this.toggleClearButton(searchInput.value);
        }

        // All-Codes-Display verstecken
        if (allCodesDisplay) allCodesDisplay.style.display = 'none';

        // Zur Suchergebnis-Sektion scrollen
        document.querySelector('.multi-search-section').scrollIntoView({
            behavior: 'smooth'
        });

        this.showMessage(`${categoryResults.length} Codes in ${category.name} gefunden`, 'success');
    }

    addCodeToSearch(code) {
        const multiSearchInput = document.getElementById('multi-search');
        if (!multiSearchInput) return;

        const currentValue = multiSearchInput.value.trim();
        const currentCodes = currentValue.split(/[\s\-]+/).filter(c => c.length > 0);
        const codeExists = currentCodes.some(c => c.toLowerCase() === code.toLowerCase());

        if (codeExists) {
            this.showMessage(`Code ${code} bereits in der Suche`, 'info');
            return;
        }

        // Minus als Trenner verwenden
        const newValue = currentValue ? `${currentValue}-${code}` : code;
        multiSearchInput.value = newValue;
        this.handleMultiSearch(newValue);
        this.toggleClearButton(newValue);

        document.querySelector('.multi-search-section').scrollIntoView({
            behavior: 'smooth'
        });

        this.showMessage(`Code ${code} zur Suche hinzugefügt`, 'success');
    }

    toggleConfigSection() {
        const configSection = document.getElementById('config-section');
        if (!configSection) return;

        if (configSection.style.display === 'none') {
            configSection.style.display = 'block';
            this.updateConfigInfo();
            configSection.scrollIntoView({ behavior: 'smooth' });
        } else {
            configSection.style.display = 'none';
        }
    }

    async updateConfigInfo() {
        const sourceEl = document.getElementById('config-source');
        const versionEl = document.getElementById('config-version');
        const updatedEl = document.getElementById('config-updated');
        const categoriesEl = document.getElementById('config-categories');
        const versionInfoEl = document.getElementById('version-info');
        const appVersionEl = document.getElementById('app-version');

        // Sofort App-Version anzeigen (ohne auf Service Worker zu warten)
        if (versionInfoEl) {
            versionInfoEl.textContent = `App: ${this.currentAppVersion}`;
        }

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

        if (sourceEl) sourceEl.textContent = sourceText;
        if (versionEl) versionEl.textContent = this.codes.metadata?.version || 'Unbekannt';
        if (updatedEl) updatedEl.textContent = this.codes.metadata?.lastUpdated || 'Unbekannt';
        if (categoriesEl) categoriesEl.textContent = `${categoriesCount} (${totalCodes} Codes)`;

        // App-Version in Config anzeigen
        if (appVersionEl) {
            appVersionEl.textContent = this.currentAppVersion;
        }

        // Nur App-Version anzeigen
        if (versionInfoEl) {
            versionInfoEl.textContent = `v${this.currentAppVersion}`;
        }
    }

    async getVersionInfo() {
        return new Promise((resolve) => {
            if ('serviceWorker' in navigator) {
                const channel = new MessageChannel();
                channel.port1.onmessage = (event) => {
                    resolve(event.data);
                };

                navigator.serviceWorker.controller?.postMessage(
                    { type: 'GET_VERSION' },
                    [channel.port2]
                );
            } else {
                resolve({
                    version: this.currentAppVersion,
                    appName: 'Rettungsdienst Codes RLP'
                });
            }
        });
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

    resetToDefault() {
        if (confirm('Möchten Sie wirklich zur Standard-Konfiguration zurückkehren? Alle hochgeladenen Daten gehen verloren.')) {
            try {
                localStorage.removeItem('customCodesData');
                localStorage.removeItem('customCodesSource');

                this.showMessage('Lösche eigene Daten und lade Standard-Konfiguration...', 'info');

                this.currentDataSource = 'default';

                this.loadCodes().then(() => {
                    this.safeRenderCategories();
                    this.safeShowAllCodes();
                    this.updateConfigInfo();

                    const configSection = document.getElementById('config-section');
                    if (configSection) {
                        configSection.style.display = 'none';
                    }

                    this.showMessage('Standard-Konfiguration erfolgreich wiederhergestellt!', 'success');

                }).catch(error => {
                    console.error('Fehler beim Laden der Standard-Daten:', error);
                    this.showMessage('Fehler beim Wiederherstellen. Seite wird neu geladen...', 'error');

                    setTimeout(() => {
                        window.location.reload();
                    }, 2000);
                });

            } catch (error) {
                console.error('Fehler in resetToDefault:', error);
                this.showMessage('Fehler beim Reset. Seite wird neu geladen...', 'error');

                setTimeout(() => {
                    window.location.reload();
                }, 1500);
            }
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

    async handleFileUpload(file) {
        try {
            const content = await this.readFileAsText(file);
            const jsonData = JSON.parse(content);

            const validation = this.validateJsonStructure(jsonData);
            this.displayValidationResult(validation);

            if (validation.valid) {
                this.codes = jsonData;
                this.currentDataSource = 'uploaded';

                localStorage.setItem('customCodesData', JSON.stringify(jsonData));
                localStorage.setItem('customCodesSource', file.name);

                this.safeRenderCategories();
                this.safeShowAllCodes();
                this.updateConfigInfo();

                this.showMessage(`Datei "${file.name}" erfolgreich geladen!`, 'success');

                const configSection = document.getElementById('config-section');
                if (configSection) {
                    configSection.style.display = 'none';
                }

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

    displayValidationResult(validation) {
        const resultSection = document.getElementById('validation-result');
        const detailsContainer = document.getElementById('validation-details');

        if (!resultSection || !detailsContainer) return;

        let html = '';

        if (validation.valid) {
            html += `
                <div class="validation-success">
                  <div class="validation-icon">✅</div>
                  <div class="validation-info">
                    <strong>Validierung erfolgreich!</strong><br>
                    📊 ${validation.totalCategories} Kategorien, ${validation.totalCodes} Codes gefunden
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
                    ${validation.errors.map(error => `<li>${error}</li>`).join('')}
                  </ul>
                </div>
            `;
        }

        if (validation.warnings && validation.warnings.length > 0) {
            html += `
                <div class="validation-warnings">
                  <strong>⚠️ Warnungen:</strong>
                  <ul>
                    ${validation.warnings.map(warning => `<li>${warning}</li>`).join('')}
                  </ul>
                </div>
            `;
        }

        detailsContainer.innerHTML = html;
        resultSection.style.display = 'block';
    }

    openInfoModal() {
        const modal = document.getElementById('info-modal');
        if (modal) modal.style.display = 'block';
    }

    closeInfoModal() {
        const modal = document.getElementById('info-modal');
        if (modal) modal.style.display = 'none';
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
                console.log('✅ Service Worker registriert:', registration);

                // Automatisches Update-System starten
                this.setupUpdateSystem();

            } catch (error) {
                console.error('❌ Service Worker Registrierung fehlgeschlagen:', error);
            }
        }
    }

    // Debug-Funktion für Troubleshooting
    debug() {
        console.log('=== 🔍 DEBUG INFO ===');
        console.log('Codes:', this.codes);
        console.log('Categories:', this.codes?.categories ? Object.keys(this.codes.categories) : 'none');
        console.log('Current Data Source:', this.currentDataSource);
        console.log('Current App Version:', this.currentAppVersion);
        console.log('DOM Elements:');
        console.log('- category-grid:', document.getElementById('category-grid'));
        console.log('- all-codes-list:', document.getElementById('all-codes-list'));
        console.log('- file-input:', document.getElementById('file-input'));
        console.log('- multi-search:', document.getElementById('multi-search'));
        console.log('- config-section:', document.getElementById('config-section'));
        console.log('==================');
    }
}

// App initialisieren
console.log('🎯 Starte RettungsdienstApp...');
window.app = new RettungsdienstApp();

// DOM Content Loaded Event
document.addEventListener('DOMContentLoaded', () => {
    console.log('📄 DOM Content Loaded');
    window.app.init();
});

// Fallback für den Fall, dass DOMContentLoaded bereits gefeuert hat
if (document.readyState === 'loading') {
    console.log('⏳ DOM lädt noch...');
} else {
    console.log('✅ DOM bereits geladen, starte App sofort');
    if (!window.app) {
        window.app = new RettungsdienstApp();
    }
    window.app.init();
}