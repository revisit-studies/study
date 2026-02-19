console.log('🎯 Enhanced ReVISit Answer Tracker loaded');

// Global storage for answers with enhanced persistence
window.answerTracker = {
    currentComponent: null,
    answers: {},
    startTime: null,
    sessionId: null,
    
    init() {
        // Generate unique session ID ONCE per study session (persistent across components)
        // Enhanced to prevent conflicts between multiple users
        if (!localStorage.getItem('studySessionId')) {
            this.sessionId = this.generateSessionId();
            localStorage.setItem('studySessionId', this.sessionId);
            console.log('🆔 New study session started');
        } else {
            this.sessionId = localStorage.getItem('studySessionId');
            console.log('🆔 Continuing existing study session');
        }
        
        // Get component name from URL
        this.currentComponent = window.location.pathname.split('/').pop().replace('.html', '');
        this.startTime = Date.now();
        
        console.log(`📋 Enhanced Answer Tracker initialized for: ${this.currentComponent}`);
        console.log(`🆔 Session ID: ${this.sessionId}`);
        
        // CRITICAL: Load existing data first (DON'T clear between components)
        this.loadExistingData();
        
        // Set up ReVISit form monitoring
        this.setupReVisitFormMonitoring();
        
        // Hook into ReVISit API if available
        this.hookIntoReVisitAPI();
        
        // Enhanced save strategies
        this.setupAutoSave();
        
        // Also save when the component starts
        this.saveAllFormats();
    },
    
    generateSessionId() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 15);
        // Add browser fingerprint to prevent collisions
        const userInfo = navigator.userAgent.slice(-10);
        const browserFingerprint = screen.width + 'x' + screen.height;
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        
        // Create a more unique session ID
        const fingerprint = btoa(userInfo + browserFingerprint + timezone).slice(0,8);
        return `session_${timestamp}_${random}_${fingerprint}`;
    },
    
    loadExistingData() {
        try {
            // DON'T CLEAR DATA - we want to preserve data across components!
            // localStorage.removeItem('answerTracker'); // REMOVED THIS LINE
            
            // Try localStorage first
            const existingData = localStorage.getItem('answerTracker');
            if (existingData) {
                const parsed = JSON.parse(existingData);
                if (parsed.answers) {
                    // Load ALL data, regardless of session (preserve cross-component data)
                    this.answers = parsed.answers;
                    console.log(`📥 Loaded existing data for ${Object.keys(this.answers).length} components`);
                    
                    // Show multi-user warning
                    this.showMultiUserWarning();
                } else {
                    console.log('🚫 No valid answers in stored data');
                    this.answers = {};
                }
            } else {
                console.log('📄 No existing data found - starting fresh');
                this.answers = {};
            }
            
            // Also try to load from server if available
            this.loadFromServer();
        } catch (error) {
            console.error('❌ Error loading existing data:', error);
            this.answers = {};
        }
    },
    
    showMultiUserWarning() {
        const componentCount = Object.keys(this.answers).length;
        if (componentCount > 0) {
            console.log('\n' + '⚠️'.repeat(30));
            console.log('⚠️  MULTI-USER NOTICE');
            console.log('⚠️'.repeat(30));
            console.log('⚠️  This browser contains data from a previous session.');
            console.log('⚠️  If multiple users are taking this study:');
            console.log('⚠️  - Each user\'s data stays on their own computer');
            console.log('⚠️  - Visit each computer individually to collect data');
            console.log('⚠️  - Data collection pages only show THIS browser\'s data');
            console.log('⚠️');
            console.log(`⚠️  Current Session ID: ${this.sessionId}`);
            console.log(`⚠️  Previous Components Found: ${componentCount}`);
            console.log('⚠️'.repeat(30) + '\n');
        }
    },
    
    setupAutoSave() {
        // Save every 2 seconds
        setInterval(() => this.saveAllFormats(), 2000);
        
        // Save on critical events
        window.addEventListener('beforeunload', () => {
            this.saveAllFormats();
            console.log('💾 Final save before page unload');
        });
        
        window.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.saveAllFormats();
                console.log('💾 Saved data on visibility change');
            }
        });
        
        // Save every 30 seconds to server
        setInterval(() => this.saveToServer(), 30000);
    },
    
    setupReVisitFormMonitoring() {
        const self = this;
        
        function findAndMonitorReVisitForms() {
            // ReVISit creates forms in the parent document or in specific containers
            // Look for common ReVISit form patterns
            const possibleContainers = [
                document, // Current document
                window.parent?.document, // Parent iframe document
                document.querySelector('iframe')?.contentDocument, // Child iframe
            ].filter(doc => doc); // Remove null/undefined
            
            let totalInputsFound = 0;
            
            possibleContainers.forEach(doc => {
                if (!doc) return;
                
                // Look for ReVISit-style form inputs - EXPANDED for Mantine UI
                const selectors = [
                    // Standard form elements
                    'input[type="number"]',
                    'input[type="text"]', 
                    'select',
                    'textarea',
                    
                    // ReVISit/Mantine specific selectors
                    'input[id^="mantine-"]',           // Mantine input IDs
                    'div[role="combobox"]',            // Mantine Select dropdowns
                    'button[role="combobox"]',         // Mantine Select buttons
                    '[data-combobox-target]',          // Mantine combobox targets
                    '.mantine-Select-input',           // Mantine CSS classes
                    '.mantine-NumberInput-input',      // Mantine number inputs
                    
                    // Generic patterns
                    'input[name*="bloodGlucose"]',
                    'input[name*="bloodPressure"]',
                    'select[name*="normal"]',
                    '[data-testid*="response"]',
                    '.response-input',
                    '.revisit-input',
                    'input[placeholder*="mmol"]',
                    'input[placeholder*="mmHg"]',
                    'select[placeholder*="Yes"]'
                ];
                
                selectors.forEach(selector => {
                    try {
                        const inputs = doc.querySelectorAll(selector);
                        
                        inputs.forEach(input => {
                            // Skip if already has our listener
                            if (input.hasAnswerTracker) return;
                            input.hasAnswerTracker = true;
                            
                            const fieldName = input.name || 
                                           input.id || 
                                           input.getAttribute('data-question-id') || 
                                           input.getAttribute('data-testid') ||
                                           input.getAttribute('data-combobox-target') ||
                                           input.placeholder ||
                                           `unknown_${totalInputsFound}`;
                            
                            // For number/text inputs (including Mantine)
                            if (input.type === 'number' || input.type === 'text' || 
                                input.classList.contains('mantine-NumberInput-input') ||
                                input.id && input.id.startsWith('mantine-')) {
                                
                                input.addEventListener('input', function(e) {
                                    const value = e.target.value;
                                    self.recordAnswer(fieldName, value, 'typing');
                                    console.log(`📝 ${self.currentComponent} - ${fieldName}: ${value}`);
                                });
                                
                                input.addEventListener('change', function(e) {
                                    const value = e.target.value;
                                    self.recordAnswer(fieldName, value, 'final');
                                    console.log(`✅ ${self.currentComponent} - ${fieldName} FINAL: ${value}`);
                                });
                                
                                input.addEventListener('blur', function(e) {
                                    const value = e.target.value;
                                    self.recordAnswer(fieldName, value, 'blur');
                                    console.log(`👋 ${self.currentComponent} - ${fieldName} BLUR: ${value}`);
                                });
                            }
                            
                            // For standard dropdowns
                            if (input.tagName === 'SELECT') {
                                input.addEventListener('change', function(e) {
                                    const value = e.target.value;
                                    self.recordAnswer(fieldName, value, 'selection');
                                    console.log(`🔽 ${self.currentComponent} - ${fieldName}: "${value}"`);
                                });
                            }
                            
                            // For Mantine Select dropdowns (role="combobox")
                            if (input.getAttribute('role') === 'combobox' || 
                                input.classList.contains('mantine-Select-input')) {
                                
                                // Listen for click events on Mantine selects
                                input.addEventListener('click', function(e) {
                                    console.log(`👆 ${self.currentComponent} - Mantine select clicked: ${fieldName}`);
                                    
                                    // Set up observer for dropdown options appearing
                                    setTimeout(() => {
                                        self.setupMantineDropdownListener(fieldName);
                                    }, 100);
                                });
                                
                                // Also listen for direct value changes
                                input.addEventListener('change', function(e) {
                                    const value = e.target.value || e.target.textContent;
                                    self.recordAnswer(fieldName, value, 'mantine_select');
                                    console.log(`🔽 ${self.currentComponent} - ${fieldName} (Mantine): "${value}"`);
                                });
                            }
                            
                            totalInputsFound++;
                        });
                    } catch (error) {
                        // Ignore cross-origin errors
                        console.log(`❌ Error accessing ${selector}:`, error.message);
                    }
                });
            });
            
            if (totalInputsFound > 0) {
                console.log(`👂 Found and monitoring ${totalInputsFound} form inputs`);
            } else {
                console.log(`⚠️ No form inputs found - ReVISit may not have loaded forms yet`);
            }
            return totalInputsFound;
        }
        
        // Try multiple times with increasing delays
        const attempts = [100, 500, 1000, 2000, 3000, 5000, 8000];
        attempts.forEach(delay => {
            setTimeout(() => {
                const found = findAndMonitorReVisitForms();
                if (found > 0) {
                    console.log(`✅ Successfully attached to ${found} ReVISit form inputs after ${delay}ms`);
                }
            }, delay);
        });
        
        // Use MutationObserver to watch for ReVISit dynamically adding forms
        const observer = new MutationObserver(function(mutations) {
            let shouldCheck = false;
            mutations.forEach(mutation => {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) { // Element node
                        const hasFormElements = node.querySelector && (
                            node.querySelector('input') ||
                            node.querySelector('select') ||
                            node.querySelector('[role="combobox"]') ||
                            node.matches('input') ||
                            node.matches('select') ||
                            node.matches('[role="combobox"]')
                        );
                        
                        if (hasFormElements) {
                            shouldCheck = true;
                        }
                    }
                });
            });
            
            if (shouldCheck) {
                console.log('🔄 New form elements detected, rescanning...');
                setTimeout(findAndMonitorReVisitForms, 200);
            }
        });
        
        // Observe both current document and parent (for iframe scenarios)
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Also try to observe parent document if in iframe
        try {
            if (window.parent && window.parent.document && window.parent !== window) {
                observer.observe(window.parent.document.body, {
                    childList: true,
                    subtree: true
                });
                console.log('👁️ Also observing parent document for form changes');
            }
        } catch (e) {
            console.log('❌ Cannot observe parent document (likely cross-origin)');
        }
    },
    
    setupMantineDropdownListener(fieldName) {
        const self = this;
        
        // Look for Mantine dropdown options that appear
        const possibleContainers = [document, window.parent?.document].filter(doc => doc);
        
        possibleContainers.forEach(doc => {
            // Look for Mantine dropdown options
            const dropdownOptions = doc.querySelectorAll([
                '.mantine-Select-option',
                '[data-combobox-option]',
                '.mantine-Combobox-option',
                '[role="option"]'
            ].join(','));
            
            dropdownOptions.forEach(option => {
                if (option.hasAnswerTracker) return;
                option.hasAnswerTracker = true;
                
                option.addEventListener('click', function(e) {
                    const value = e.target.textContent || e.target.innerText || e.target.value;
                    self.recordAnswer(fieldName, value, 'mantine_option_click');
                    console.log(`🎯 ${self.currentComponent} - ${fieldName} selected: "${value}"`);
                });
            });
            
            if (dropdownOptions.length > 0) {
                console.log(`🎯 Added listeners to ${dropdownOptions.length} Mantine dropdown options`);
            }
        });
    },
    
    hookIntoReVisitAPI() {
        const self = this;
        
        // Try to hook into ReVISit's communication system
        if (typeof window.Revisit !== 'undefined') {
            console.log('🔗 Found ReVISit API, hooking into answer submission...');
            
            // Override ReVISit's postAnswers method to intercept data
            const originalPostAnswers = window.Revisit.postAnswers;
            window.Revisit.postAnswers = function(answers) {
                console.log('🎯 ReVISit submitting answers:', answers);
                
                // Record these answers in our tracker
                Object.keys(answers).forEach(key => {
                    const value = answers[key];
                    self.recordAnswer(key, value, 'revisit_submit');
                });
                
                // Call the original method
                return originalPostAnswers.call(this, answers);
            };
        } else {
            console.log('⚠️ ReVISit API not found yet, will check again...');
            
            // Check for ReVISit API periodically
            const checkReVisit = setInterval(() => {
                if (typeof window.Revisit !== 'undefined') {
                    console.log('🔗 ReVISit API now available, hooking in...');
                    clearInterval(checkReVisit);
                    this.hookIntoReVisitAPI(); // Recursive call now that it exists
                }
            }, 1000);
            
            // Stop checking after 10 seconds
            setTimeout(() => {
                clearInterval(checkReVisit);
                console.log('⏰ Stopped checking for ReVISit API');
            }, 10000);
        }
    },
    
    recordAnswer(fieldName, value, type) {
        const timestamp = Date.now();
        
        // Initialize component data if not exists
        if (!this.answers[this.currentComponent]) {
            this.answers[this.currentComponent] = {
                startTime: this.startTime,
                sessionId: this.sessionId,
                fields: {},
                history: []
            };
        }
        
        // Store current answer
        this.answers[this.currentComponent].fields[fieldName] = {
            value: value,
            timestamp: timestamp,
            type: type
        };
        
        // Add to history
        this.answers[this.currentComponent].history.push({
            fieldName,
            value,
            timestamp,
            type,
            timeFromStart: timestamp - this.startTime
        });
        
        // PRINT ALL ANSWERS AFTER IMPORTANT ANSWER TYPES (expanded to include dropdown selections)
        if (type === 'final' || type === 'selection' || type === 'mantine_option_click' || type === 'revisit_submit') {
            this.printAllAnswers();
            
            // Log completion message for data collection page
            const fieldCount = Object.keys(this.answers[this.currentComponent].fields).length;
            console.log(`📊 Component progress: ${fieldCount}/4 fields completed for ${this.currentComponent}`);
            
            if (fieldCount >= 4) {
                console.log('✅ Component fully completed! Data ready for collection.');
            }
        }
        
        // Save immediately for important events
        if (type === 'final' || type === 'selection' || type === 'revisit_submit' || 
            type === 'mantine_select' || type === 'mantine_option_click') {
            this.saveAllFormats();
        }
    },
    
    // NEW METHOD: Print all current answers
    printAllAnswers() {
        console.log('\n' + '='.repeat(60));
        console.log(`📊 ALL CURRENT ANSWERS (Session: ${this.sessionId})`);
        console.log('='.repeat(60));
        
        const componentCount = Object.keys(this.answers).length;
        console.log(`📋 Components completed: ${componentCount}`);
        
        if (componentCount === 0) {
            console.log('❌ No answers recorded yet');
            console.log('='.repeat(60) + '\n');
            return;
        }
        
        Object.keys(this.answers).forEach((componentName, compIndex) => {
            const component = this.answers[componentName];
            const fieldCount = Object.keys(component.fields || {}).length;
            
            console.log(`\n🎯 ${compIndex + 1}. ${componentName}`);
            console.log(`   ⏱️  Started: ${new Date(component.startTime).toLocaleTimeString()}`);
            console.log(`   📝 Fields: ${fieldCount}`);
            
            if (component.fields && fieldCount > 0) {
                // Get field order from history for consistent display
                const fieldOrder = [];
                const seenFields = new Set();
                
                if (component.history && Array.isArray(component.history)) {
                    component.history.forEach(interaction => {
                        if (!seenFields.has(interaction.fieldName)) {
                            fieldOrder.push(interaction.fieldName);
                            seenFields.add(interaction.fieldName);
                        }
                    });
                }
                
                // Add any remaining fields that weren't in history
                Object.keys(component.fields).forEach(fieldName => {
                    if (!seenFields.has(fieldName)) {
                        fieldOrder.push(fieldName);
                    }
                });
                
                fieldOrder.forEach((fieldName, fieldIndex) => {
                    const field = component.fields[fieldName];
                    const fieldType = field.type || 'unknown';
                    const timeAgo = ((Date.now() - field.timestamp) / 1000).toFixed(1);
                    
                    // Determine likely question type based on position and component
                    let questionType = 'Unknown';
                    if (componentName.includes('bloodGlucose')) {
                        if (fieldIndex === 0) questionType = 'Fasting Value';
                        else if (fieldIndex === 1) questionType = 'Postprandial Value';
                        else if (fieldIndex === 2) questionType = 'Fasting Normal?';
                        else if (fieldIndex === 3) questionType = 'Postprandial Normal?';
                    } else if (componentName.includes('bloodPressure')) {
                        if (fieldIndex === 0) questionType = 'Systolic Value';
                        else if (fieldIndex === 1) questionType = 'Diastolic Value';
                        else if (fieldIndex === 2) questionType = 'Systolic Normal?';
                        else if (fieldIndex === 3) questionType = 'Diastolic Normal?';
                    }
                    
                    console.log(`      ${fieldIndex + 1}. ${questionType}`);
                    console.log(`         Field: ${fieldName}`);
                    console.log(`         Answer: "${field.value}" (${fieldType}, ${timeAgo}s ago)`);
                });
            } else {
                console.log('      ❌ No fields recorded');
            }
        });
        
        // Summary statistics
        const totalFields = Object.values(this.answers)
            .reduce((total, comp) => total + Object.keys(comp.fields || {}).length, 0);
        const totalInteractions = this.getTotalInteractions();
        const studyDuration = componentCount > 0 ? 
            ((Date.now() - Math.min(...Object.values(this.answers).map(c => c.startTime))) / 1000 / 60).toFixed(1) : 0;
        
        console.log(`\n📈 SUMMARY:`);
        console.log(`   Components: ${componentCount}`);
        console.log(`   Total Fields: ${totalFields}`);
        console.log(`   Total Interactions: ${totalInteractions}`);
        console.log(`   Study Duration: ${studyDuration} minutes`);
        console.log(`   Last Updated: ${new Date().toLocaleTimeString()}`);
        
        console.log('='.repeat(60) + '\n');
    },
    
    saveAllFormats() {
        this.saveToLocalStorage();
        this.saveToCSV();
        this.saveToJSON();
    },
    
    saveToLocalStorage() {
        try {
            const data = {
                sessionId: this.sessionId, // Use the persistent session ID
                answers: this.answers,
                lastUpdate: Date.now(),
                browserFingerprint: this.getBrowserFingerprint()
            };
            localStorage.setItem('answerTracker', JSON.stringify(data));
            
            // Create timestamped backup
            const backupKey = `answerTracker_backup_${new Date().toISOString().slice(0,16).replace(/:/g, '-')}`;
            localStorage.setItem(backupKey, JSON.stringify(data));
            
            console.log(`💾 Saved to localStorage: ${Object.keys(this.answers).length} components`);
            
            // Log message for data collection page users - check URL path
            if (Object.keys(this.answers).length > 0) {
                console.log(`📋 Visit your data collection page to view/copy data`);
            }
        } catch (error) {
            console.error('❌ Failed to save to localStorage:', error);
        }
    },
    
    getBrowserFingerprint() {
        return {
            screen: `${screen.width}x${screen.height}`,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            language: navigator.language,
            userAgent: navigator.userAgent.slice(-20),
            timestamp: Date.now()
        };
    },
    
    saveToCSV() {
        try {
            const csv = this.generateCSV();
            
            // Save to a downloadable blob
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            
            // Store URL for later download
            sessionStorage.setItem('answerTrackerCSVUrl', url);
            
            // Also try to save to a file if possible (modern browsers)
            if ('showSaveFilePicker' in window) {
                this.saveCSVToFile(csv);
            }
            
            console.log('📊 CSV generated and ready for export');
        } catch (error) {
            console.error('❌ Failed to generate CSV:', error);
        }
    },
    
    saveToJSON() {
        try {
            const jsonData = {
                sessionId: this.sessionId,
                exportTime: Date.now(),
                answers: this.answers,
                browserFingerprint: this.getBrowserFingerprint(),
                metadata: {
                    totalComponents: Object.keys(this.answers).length,
                    totalInteractions: this.getTotalInteractions(),
                    studyDuration: this.answers && Object.keys(this.answers).length > 0 ? 
                        Date.now() - Math.min(...Object.values(this.answers).map(c => c.startTime)) : 0
                }
            };
            
            const json = JSON.stringify(jsonData, null, 2);
            const blob = new Blob([json], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            sessionStorage.setItem('answerTrackerJSONUrl', url);
            
            console.log('📁 JSON export ready');
        } catch (error) {
            console.error('❌ Failed to generate JSON:', error);
        }
    },
    
    async saveCSVToFile(csvContent) {
        try {
            const fileHandle = await window.showSaveFilePicker({
                suggestedName: `study_answers_${this.sessionId}_${new Date().toISOString().slice(0,10)}.csv`,
                types: [{
                    description: 'CSV files',
                    accept: { 'text/csv': ['.csv'] }
                }]
            });
            
            const writable = await fileHandle.createWritable();
            await writable.write(csvContent);
            await writable.close();
            
            console.log('💾 CSV saved to file');
        } catch (error) {
            console.log('ℹ️ File save not available or cancelled');
        }
    },
    
    saveToServer() {
        try {
            const data = {
                sessionId: this.sessionId,
                answers: this.answers,
                timestamp: Date.now(),
                browserFingerprint: this.getBrowserFingerprint()
            };
            
            fetch('/api/study/save-answers', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            })
            .then(response => {
                if (response.ok) {
                    console.log('☁️ Data saved to server');
                } else {
                    console.log('⚠️ Server save failed, but localStorage backup active');
                }
            })
            .catch(error => {
                console.log('⚠️ Server not available, but localStorage backup active');
            });
        } catch (error) {
            console.log('⚠️ Server save error, but localStorage backup active');
        }
    },
    
    loadFromServer() {
        try {
            fetch(`/api/study/load-answers/${this.sessionId}`)
            .then(response => {
                if (response.ok) {
                    return response.json();
                }
            })
            .then(data => {
                if (data && data.answers) {
                    // Merge server data with local data
                    this.answers = { ...data.answers, ...this.answers };
                    console.log('☁️ Merged data from server');
                }
            })
            .catch(error => {
                console.log('ℹ️ No server data available');
            });
        } catch (error) {
            console.log('ℹ️ Server not available');
        }
    },
    
    generateCSV() {
        const headers = [
            'sessionId',
            'participantId', 
            'component',
            'fieldName',
            'finalValue',
            'interactionType',
            'timestamp',
            'isoTimestamp',
            'timeFromComponentStart',
            'interactionSequence',
            'browserFingerprint'
        ];
        
        const rows = [headers.join(',')];
        
        let participantId = this.sessionId; // Default to session ID
        const fingerprint = JSON.stringify(this.getBrowserFingerprint());
        
        // Try to extract participant ID from responses
        Object.values(this.answers).forEach(component => {
            if (component.fields) {
                Object.keys(component.fields).forEach(fieldName => {
                    if (fieldName.toLowerCase().includes('participant') || 
                        fieldName.toLowerCase().includes('id')) {
                        participantId = component.fields[fieldName].value || participantId;
                    }
                });
            }
        });
        
        Object.keys(this.answers).forEach(componentName => {
            const component = this.answers[componentName];
            
            if (component.history && Array.isArray(component.history)) {
                component.history.forEach((interaction, index) => {
                    const row = [
                        `"${this.sessionId}"`,
                        `"${participantId}"`,
                        `"${componentName}"`,
                        `"${interaction.fieldName}"`,
                        `"${interaction.value}"`,
                        `"${interaction.type}"`,
                        `"${interaction.timestamp}"`,
                        `"${new Date(interaction.timestamp).toISOString()}"`,
                        `"${interaction.timeFromStart}"`,
                        `"${index + 1}"`,
                        `"${fingerprint}"`
                    ];
                    rows.push(row.join(','));
                });
            }
        });
        
        return rows.join('\n');
    },
    
    getTotalInteractions() {
        return Object.values(this.answers)
            .reduce((total, component) => total + (component.history?.length || 0), 0);
    },
    
    // Enhanced export methods
    downloadCSV() {
        const csvUrl = sessionStorage.getItem('answerTrackerCSVUrl');
        if (csvUrl) {
            const a = document.createElement('a');
            a.href = csvUrl;
            a.download = `study_answers_${this.sessionId}_${new Date().toISOString().slice(0,10)}.csv`;
            a.click();
        } else {
            console.log('❌ No CSV data available for download');
        }
    },
    
    downloadJSON() {
        const jsonUrl = sessionStorage.getItem('answerTrackerJSONUrl');
        if (jsonUrl) {
            const a = document.createElement('a');
            a.href = jsonUrl;
            a.download = `study_answers_${this.sessionId}_${new Date().toISOString().slice(0,10)}.json`;
            a.click();
        } else {
            console.log('❌ No JSON data available for download');
        }
    },
    
    // Method to get all answers for a component
    getAnswers(componentName) {
        return this.answers[componentName] || null;
    },
    
    // Method to export all data
    exportAllData() {
        return {
            sessionId: this.sessionId,
            answers: this.answers,
            exportTime: Date.now(),
            browserFingerprint: this.getBrowserFingerprint()
        };
    },
    
    // Method to clear all data
    clearData() {
        this.answers = {};
        localStorage.removeItem('answerTracker');
        localStorage.removeItem('studySessionId');
        console.log('🗑️ Cleared all answer data');
    }
};

// Initialize when DOM is ready
function initAnswerTracker() {
    if (window.answerTracker) {
        window.answerTracker.init();
    }
}

// Multiple initialization attempts
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAnswerTracker);
} else {
    initAnswerTracker();
}

window.addEventListener('load', initAnswerTracker);

// Enhanced global functions
window.viewAnswerData = function() {
    return window.answerTracker?.exportAllData() || null;
};

window.downloadAnswerCSV = function() {
    window.answerTracker?.downloadCSV();
};

window.downloadAnswerJSON = function() {
    window.answerTracker?.downloadJSON();
};

console.log('🚀 Enhanced ReVISit Answer Tracker fully loaded!');
console.log('💡 Commands: viewAnswerData(), downloadAnswerCSV(), downloadAnswerJSON()');