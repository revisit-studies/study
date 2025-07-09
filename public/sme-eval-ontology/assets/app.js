// Digital Multimedia Forensics Ontology Application
// Version 2.3 - Fixed all null DOM element access issues
console.log('🔄 OntologyApp v2.3 loaded - DOM safety fixes applied!');

class OntologyApp {
    constructor() {
        // Prevent multiple initializations
        if (window.ontologyAppInitialized) {
            console.log('OntologyApp already initialized, skipping...');
            return;
        }

        this.ontologyData = {};
        this.expandedNodes = new Set();
        this.selectedNode = null;
        this.searchTerm = '';
        this.loadedCategories = new Set();
        this.currentView = 'tree';
        this.dendrogramRenderer = null;
        this.sunburstRenderer = null;
        this.papersDatabase = {}; // Central papers database for O(1) lookups
        this.papersLoaded = false;

        // JSON file mappings
        this.categoryMappings = {
            'Modality': 'data/modalities_extended.json',
            'Forensic Goal': 'data/forensic_goal_extended.json',
            'Evidentiary Features': 'data/evidentiary_features_extended.json',
            'Search & Analysis Scope': 'data/analysis_scope_extended.json'
        };

        window.ontologyAppInitialized = true;
        this.init();
    }

    async init() {
        this.setInitialState();
        this.showDefaultInfo();
        await this.loadInitialStructure();
        this.setupEventListeners();
        await this.loadPapersDatabase(); // Load central papers database
        this.renderTree();
        this.initializeDendrogram();
        this.initializeSunburst();
    }

    setInitialState() {
        // Set default states
        // Stats container: collapsed by default
        const statsContainer = document.getElementById('statsContainer');
        const mainLayout = document.querySelector('.main-layout');
        const statsToggleBtn = document.getElementById('statsToggleBtn');

        statsContainer.classList.add('collapsed');
        mainLayout.classList.remove('stats-expanded');
        statsToggleBtn.classList.remove('active');
        statsToggleBtn.setAttribute('title', 'Show statistics panel');

        // Sidebar: open by default
        const sidebar = document.getElementById('sidebar');
        const sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
        const sidebarIcon = sidebarToggleBtn.querySelector('.btn-icon');

        sidebar.classList.remove('collapsed');
        mainLayout.classList.remove('sidebar-collapsed');
        sidebarIcon.textContent = '→';
        sidebarToggleBtn.setAttribute('title', 'Hide sidebar');

        // Theme: detect system preference or default to light
        const html = document.documentElement;
        const themeToggleBtn = document.getElementById('themeToggleBtn');
        const themeIcon = themeToggleBtn.querySelector('.btn-icon');

        const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        if (prefersDark) {
            html.setAttribute('data-color-scheme', 'dark');
            themeIcon.textContent = '☀️';
            themeToggleBtn.setAttribute('title', 'Switch to light theme');
        } else {
            html.setAttribute('data-color-scheme', 'light');
            themeIcon.textContent = '🌙';
            themeToggleBtn.setAttribute('title', 'Switch to dark theme');
        }

        // Expand/collapse buttons: enabled by default (tree view)
        const expandBtn = document.getElementById('expandAllBtn');
        const collapseBtn = document.getElementById('collapseAllBtn');
        const resetZoomBtn = document.getElementById('resetZoomBtn');

        // Tree view is default, so show expand/collapse and hide reset zoom
        expandBtn.style.display = '';
        collapseBtn.style.display = '';
        expandBtn.disabled = false;
        collapseBtn.disabled = false;
        expandBtn.classList.remove('disabled');
        collapseBtn.classList.remove('disabled');
        resetZoomBtn.style.display = 'none';
    }

    async loadInitialStructure() {
        // Create initial structure with placeholders
        this.ontologyData = {
            'Modality': {
                name: 'Modality',
                description: 'Types of media content analyzed in digital forensics',
                children: null // Will be loaded lazily
            },
            'Forensic Goal': {
                name: 'Forensic Goal',
                description: 'Types of manipulations and alterations detected in media',
                children: null
            },
            'Evidentiary Features': {
                name: 'Evidentiary Features',
                description: 'Technical features and cues used for detection and analysis',
                children: null
            },
            'Search & Analysis Scope': {
                name: 'Search & Analysis Scope',
                description: 'Analysis scope and target areas in multimedia forensics',
                children: null
            }
        };
    }

    async loadCategoryData(categoryName) {
        if (this.loadedCategories.has(categoryName)) {
            return;
        }

        const filePath = this.categoryMappings[categoryName];
        if (!filePath) {
            console.error(`No file mapping found for category: ${categoryName}`);
            return;
        }

        try {
            const response = await fetch(filePath);
            if (!response.ok) {
                throw new Error(`Failed to load ${filePath}: ${response.statusText}`);
            }

            const data = await response.json();
            this.ontologyData[categoryName] = data;
            this.loadedCategories.add(categoryName);

            console.log(`Loaded category: ${categoryName}`);
        } catch (error) {
            console.error(`Error loading category ${categoryName}:`, error);
            // Fallback to error state
            this.ontologyData[categoryName] = {
                name: categoryName,
                description: `Failed to load ${categoryName} data. Please check the file path and network connection.`,
                children: [],
                error: true
            };
        }
    }

    async loadPapersDatabase() {
        if (this.papersLoaded) {
            return;
        }

        try {
            const response = await fetch('data/papers.json');
            if (!response.ok) {
                throw new Error(`Failed to load papers database: ${response.statusText}`);
            }

            this.papersDatabase = await response.json();
            this.papersLoaded = true;
            console.log(`Loaded papers database with ${Object.keys(this.papersDatabase).length} papers`);
        } catch (error) {
            console.error('Error loading papers database:', error);
            this.papersDatabase = {};
            this.papersLoaded = false;
        }
    }

    getPaperByID(paperId) {
        return this.papersDatabase[paperId] || null;
    }

    setupEventListeners() {
        console.log('Setting up event listeners...');

        // Search functionality
        const searchInput = document.getElementById('searchInput');
        const clearBtn = document.getElementById('clearSearchBtn');

        if (searchInput) {
            searchInput.addEventListener('input', async (e) => {
                this.searchTerm = e.target.value.toLowerCase();

                // Render the appropriate view based on current view type
                if (this.currentView === 'tree') {
                    this.renderTree();
                } else if (this.currentView === 'dendrogram') {
                    await this.renderDendrogram();
                } else if (this.currentView === 'sunburst') {
                    await this.renderSunburst();
                }

                // Show/hide clear button based on input content
                if (clearBtn && e.target.value.length > 0) {
                    clearBtn.classList.remove('hidden');
                } else if (clearBtn) {
                    clearBtn.classList.add('hidden');
                }
            });
        }

        // Clear search functionality
        if (clearBtn) {
            clearBtn.addEventListener('click', async () => {
                if (searchInput) {
                    searchInput.value = '';
                    this.searchTerm = '';
                    clearBtn.classList.add('hidden');

                    // Render the appropriate view based on current view type
                    if (this.currentView === 'tree') {
                        this.renderTree();
                    } else if (this.currentView === 'dendrogram') {
                        await this.renderDendrogram();
                    } else if (this.currentView === 'sunburst') {
                        await this.renderSunburst();
                    }

                    searchInput.focus(); // Return focus to input
                }
            });
        }

        // Helper function to safely add event listeners
        const safeAddEventListener = (elementId, event, handler) => {
            const element = document.getElementById(elementId);
            if (element) {
                element.addEventListener(event, handler);
                return true;
            } else {
                console.error(`Element ${elementId} not found when adding event listener`);
                return false;
            }
        };

        // Expand/Collapse all buttons
        safeAddEventListener('expandAllBtn', 'click', () => {
            this.expandAll();
        });

        safeAddEventListener('collapseAllBtn', 'click', () => {
            this.collapseAll();
        });

        // Accordion functionality
        safeAddEventListener('termsAccordionHeader', 'click', () => {
            this.toggleAccordion('terms');
        });

        safeAddEventListener('papersAccordionHeader', 'click', () => {
            this.toggleAccordion('papers');
        });

        // Modal functionality
        safeAddEventListener('modalCloseBtn', 'click', () => {
            this.closeModal();
        });

        // Close modal on background click
        safeAddEventListener('paperModal', 'click', (e) => {
            if (e.target.id === 'paperModal') {
                this.closeModal();
            }
        });

        // Close modal on Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeModal();
            }
        });

        // Toggle button functionality
        safeAddEventListener('statsToggleBtn', 'click', async () => {
            await this.toggleStats();
        });

        safeAddEventListener('themeToggleBtn', 'click', () => {
            this.toggleTheme();
        });

        safeAddEventListener('sidebarToggleBtn', 'click', () => {
            this.toggleSidebar();
        });

        // View switching functionality
        safeAddEventListener('treeViewBtn', 'click', async () => {
            await this.switchView('tree');
        });

        safeAddEventListener('dendrogramViewBtn', 'click', async () => {
            await this.switchView('dendrogram');
        });

        safeAddEventListener('sunburstViewBtn', 'click', async () => {
            await this.switchView('sunburst');
        });

        // Unified reset zoom functionality for dendrogram and sunburst views
        safeAddEventListener('resetZoomBtn', 'click', () => {
            if (this.currentView === 'sunburst' && this.sunburstRenderer) {
                this.sunburstRenderer.resetZoom();
            } else if (this.currentView === 'dendrogram' && this.dendrogramRenderer) {
                this.dendrogramRenderer.zoomToFit();
            }
        });
    }

    renderTree() {
        const treeContainer = document.getElementById('ontologyTree');
        if (!treeContainer) {
            console.error('ontologyTree container not found');
            return;
        }

        treeContainer.innerHTML = '';

        Object.keys(this.ontologyData).forEach(rootKey => {
            const rootNode = this.createTreeNode(rootKey, this.ontologyData[rootKey], [], rootKey);
            treeContainer.appendChild(rootNode);
        });
    }

    createTreeNode(name, data, path, rootCategory) {
        const nodeDiv = document.createElement('div');
        nodeDiv.className = 'tree-node';

        const fullPath = [...path, name];
        const nodeId = fullPath.join('.');
        const isExpanded = this.expandedNodes.has(nodeId);

        const contentDiv = this.createTreeNodeHeader(name, data, path, rootCategory);
        nodeDiv.appendChild(contentDiv);

        // If node is loading, show a loading message
        if (data.loading && isExpanded) {
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'tree-children expanded';
            loadingDiv.style.paddingLeft = '20px';
            loadingDiv.textContent = 'Loading...';
            nodeDiv.appendChild(loadingDiv);
        }

        // Children
        if (this.hasChildren(data) && isExpanded && !data.loading) {
            const childrenDiv = document.createElement('div');
            childrenDiv.className = 'tree-children expanded';

            if (data.children && Array.isArray(data.children)) {
                // Handle array-based children (from JSON files)
                data.children.forEach(child => {
                    const childNode = this.createTreeNode(child.name, child, fullPath, rootCategory);
                    childrenDiv.appendChild(childNode);
                });
            } else if (data.children && typeof data.children === 'object') {
                // Handle object-based children
                Object.keys(data.children).forEach(childKey => {
                    const childNode = this.createTreeNode(childKey, data.children[childKey], fullPath, rootCategory);
                    childrenDiv.appendChild(childNode);
                });
            }

            nodeDiv.appendChild(childrenDiv);
        }

        return nodeDiv;
    }

    createTreeNodeHeader(name, data, path, rootCategory) {
        const contentDiv = document.createElement('div');
        contentDiv.className = 'tree-node-content';
        contentDiv.setAttribute('data-category', rootCategory);

        const fullPath = [...path, name];
        const nodeId = fullPath.join('.');
        const isExpanded = this.expandedNodes.has(nodeId);
        const isSelected = this.selectedNode === nodeId;

        if (isSelected) {
            contentDiv.classList.add('selected');
        }

        // Check if this node or its children match the search term
        const matchesSearch = this.nodeMatchesSearch(name, data);
        if (this.searchTerm && !matchesSearch) {
            contentDiv.style.display = 'none';
        }

        // Toggle button
        const hasChildren = this.hasChildren(data);
        const toggleBtn = document.createElement('span');
        toggleBtn.className = hasChildren ? 'tree-node-toggle' : 'tree-node-toggle empty';
        toggleBtn.textContent = hasChildren ? (isExpanded ? '−' : '+') : '';

        if (hasChildren) {
            toggleBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await this.toggleNode(nodeId, rootCategory);
            });
        }

        // Label
        const labelSpan = document.createElement('span');
        labelSpan.className = 'tree-node-label';
        labelSpan.textContent = name;

        // Highlight search matches
        if (this.searchTerm && name.toLowerCase().includes(this.searchTerm)) {
            labelSpan.innerHTML = this.highlightText(name, this.searchTerm);
        }

        // Add toggle button and label only
        contentDiv.appendChild(toggleBtn);
        contentDiv.appendChild(labelSpan);

        // Click handler for selection
        contentDiv.addEventListener('click', async () => {
            await this.selectNode(nodeId, name, data, rootCategory);
        });

        return contentDiv;
    }

    hasChildren(data) {
        if (data.children === null) {
            // Not loaded yet, assume it has children for root categories
            return true;
        }

        if (Array.isArray(data.children)) {
            return data.children.length > 0;
        }

        if (typeof data.children === 'object') {
            return Object.keys(data.children).length > 0;
        }

        return false;
    }

    getChildren(data) {
        if (!data || typeof data !== 'object') return null;

        if (data.children) {
            if (Array.isArray(data.children)) {
                return data.children;
            } else if (typeof data.children === 'object') {
                return Object.values(data.children);
            }
        }

        return null;
    }

    nodeMatchesSearch(name, data) {
        if (!this.searchTerm) return true;

        // Check node name
        if (name.toLowerCase().includes(this.searchTerm)) return true;

        // Check associated terms
        if (data.associated_terms && data.associated_terms.some(term => term.toLowerCase().includes(this.searchTerm))) {
            return true;
        }

        // Check children recursively
        if (data.children) {
            if (Array.isArray(data.children)) {
                return data.children.some(child => this.nodeMatchesSearch(child.name, child));
            } else if (typeof data.children === 'object') {
                return Object.keys(data.children).some(key => {
                    return this.nodeMatchesSearch(key, data.children[key]);
                });
            }
        }

        return false;
    }

    highlightText(text, searchTerm) {
        const regex = new RegExp(`(${searchTerm})`, 'gi');
        return text.replace(regex, '<span class="highlight">$1</span>');
    }

    async toggleNode(nodeId, rootCategory) {
        // Load category data if it's a root category and not loaded yet
        if (nodeId.split('.').length === 1 && !this.loadedCategories.has(nodeId)) {
            // Set loading state and expand the node to show the loading indicator
            this.ontologyData[nodeId].loading = true;
            this.expandedNodes.add(nodeId);
            this.renderTree(); // Re-render to show loading indicator

            await this.loadCategoryData(nodeId);
            delete this.ontologyData[nodeId].loading; // Remove loading state

            // Re-render after loading is complete
            this.renderTree();
            return; // Exit here because renderTree is already called
        }

        if (this.expandedNodes.has(nodeId)) {
            this.expandedNodes.delete(nodeId);
        } else {
            this.expandedNodes.add(nodeId);
        }
        this.renderTree();
    }

    async selectNode(nodeId, name, data, rootCategory) {
        // Load category data if needed
        if (nodeId.split('.').length === 1 && !this.loadedCategories.has(nodeId)) {
            await this.loadCategoryData(nodeId);
            data = this.ontologyData[nodeId]; // Update data reference
        }

        // Do not proceed if data failed to load
        if (data.error) {
            return;
        }

        // Remove previous selection
        document.querySelectorAll('.tree-node-content.selected').forEach(el => {
            el.classList.remove('selected');
        });

        this.selectedNode = nodeId;
        this.showNodeInfo(name, data, rootCategory);
        this.renderTree();
    }

    showDefaultInfo() {
        document.getElementById('defaultInfo').classList.remove('hidden');
        document.getElementById('categoryInfo').classList.add('hidden');
        this.closeAllAccordions();
    }

    showNodeInfo(name, data, rootCategory) {
        document.getElementById('defaultInfo').classList.add('hidden');
        const categoryInfo = document.getElementById('categoryInfo');
        categoryInfo.classList.remove('hidden');

        // Update title and description
        document.getElementById('categoryTitle').textContent = name;
        document.getElementById('categoryDescription').textContent = data.description || 'No description available.';

        // Update accordion content
        this.updateTermsAccordion(data);
        this.updateExamplesSection(data);
        this.updatePapersAccordion(data);

        // Close all accordions initially
        this.closeAllAccordions();
    }

    updateTermsAccordion(data) {
        const termsList = document.getElementById('termsList');
        const header = document.getElementById('termsAccordionHeader');

        if (data.associated_terms && data.associated_terms.length > 0) {
            header.querySelector('span').textContent = `Associated Terms (${data.associated_terms.length})`;
            termsList.innerHTML = '';

            data.associated_terms.forEach(term => {
                const termTag = document.createElement('span');
                termTag.className = 'term-tag';
                termTag.textContent = term;
                termsList.appendChild(termTag);
            });
        } else {
            header.querySelector('span').textContent = 'Associated Terms (0)';
            termsList.innerHTML = '<p class="no-results">No associated terms available.</p>';
        }
    }

    updateExamplesSection(data) {
        const examplesList = document.getElementById('examplesList');
        const examplesSection = document.getElementById('examplesSection');

        if (data.examples && data.examples.length > 0) {
            examplesSection.style.display = 'block';
            examplesList.innerHTML = '';

            data.examples.forEach(example => {
                const exampleItem = document.createElement('div');
                exampleItem.className = 'example-item-simple';
                exampleItem.textContent = example;
                examplesList.appendChild(exampleItem);
            });
        } else {
            examplesSection.style.display = 'none';
        }
    }

    updatePapersAccordion(data) {
        const papersList = document.getElementById('papersList');
        const header = document.getElementById('papersAccordionHeader');

        if (data.associated_papers && data.associated_papers.length > 0) {
            header.querySelector('span').textContent = `Papers (${data.associated_papers.length})`;
            papersList.innerHTML = '';

            // Check if papers database is loaded
            if (!this.papersLoaded) {
                papersList.innerHTML = '<p class="no-results">Loading papers database...</p>';
                // Try to load papers database if not already loaded
                this.loadPapersDatabase().then(() => {
                    // Retry updating papers accordion after database loads
                    this.updatePapersAccordion(data);
                });
                return;
            }

            data.associated_papers.forEach(paperId => {
                const paper = this.getPaperByID(paperId);
                if (paper) {
                    const paperItem = document.createElement('div');
                    paperItem.className = 'paper-item';

                    const paperTitle = document.createElement('div');
                    paperTitle.className = 'paper-title';
                    paperTitle.textContent = paper.title;

                    paperItem.appendChild(paperTitle);
                    paperItem.addEventListener('click', () => {
                        this.showPaperModal(paper);
                    });

                    papersList.appendChild(paperItem);
                } else {
                    // Handle case where paper is not found in database
                    console.warn(`Paper not found in database: ${paperId}`);
                }
            });
        } else {
            header.querySelector('span').textContent = 'Papers (0)';
            papersList.innerHTML = '<p class="no-results">No papers available.</p>';
        }
    }

    toggleAccordion(type) {
        const header = document.getElementById(`${type}AccordionHeader`);
        const content = document.getElementById(`${type}AccordionContent`);

        if (!header || !content) {
            console.warn(`Accordion elements for '${type}' not found (header: ${!!header}, content: ${!!content})`);
            return;
        }

        const isActive = header.classList.contains('active');

        if (isActive) {
            header.classList.remove('active');
            content.classList.remove('active');
        } else {
            header.classList.add('active');
            content.classList.add('active');
        }
    }

    closeAllAccordions() {
        ['terms', 'papers'].forEach(type => {
            const header = document.getElementById(`${type}AccordionHeader`);
            const content = document.getElementById(`${type}AccordionContent`);

            if (header) {
                header.classList.remove('active');
            } else {
                console.warn(`Accordion header element '${type}AccordionHeader' not found`);
            }

            if (content) {
                content.classList.remove('active');
            } else {
                console.warn(`Accordion content element '${type}AccordionContent' not found`);
            }
        });
    }

    showPaperModal(paper) {
        const modal = document.getElementById('paperModal');

        // Update modal content
        document.getElementById('modalPaperTitle').textContent = paper.title;
        document.getElementById('modalPaperYear').textContent = `Year: ${paper.year}`;
        document.getElementById('modalPaperVenue').textContent = `Venue: ${paper.venue || 'Unknown'}`;
        document.getElementById('modalPaperCitations').textContent = `Citations: ${paper.citationCount || 0}`;

        // Update authors
        const authorsContainer = document.getElementById('modalPaperAuthors');
        if (paper.authors && paper.authors.length > 0) {
            authorsContainer.innerHTML = '<h4>Authors</h4>';
            const authorsList = document.createElement('div');
            authorsList.className = 'authors-list';

            paper.authors.forEach(author => {
                const authorTag = document.createElement('span');
                authorTag.className = 'author-tag';
                authorTag.textContent = author.name;
                authorsList.appendChild(authorTag);
            });

            authorsContainer.appendChild(authorsList);
        } else {
            authorsContainer.innerHTML = '';
        }

        // Update links
        this.updatePaperLinks(paper);

        // Update access info
        this.updateAccessInfo(paper);

        // Show modal
        modal.classList.remove('hidden');
    }

    updatePaperLinks(paper) {
        // Semantic Scholar URL
        const semanticLink = document.getElementById('modalSemanticScholarLink');
        if (paper.url) {
            semanticLink.innerHTML = `<a href="${paper.url}" target="_blank">📄 View on Semantic Scholar</a>`;
        } else {
            semanticLink.innerHTML = '';
        }

        // DOI Link
        const doiLink = document.getElementById('modalDoiLink');
        if (paper.doi) {
            doiLink.innerHTML = `<a href="https://doi.org/${paper.doi}" target="_blank">🔗 DOI Link</a>`;
        } else {
            doiLink.innerHTML = '';
        }

        // Open Access PDF
        const openAccessLink = document.getElementById('modalOpenAccessLink');
        if (paper.openAccessPdf && paper.openAccessPdf.url && paper.openAccessPdf.status !== 'CLOSED') {
            openAccessLink.innerHTML = `<a href="${paper.openAccessPdf.url}" target="_blank">📖 Open Access PDF</a>`;
        } else {
            openAccessLink.innerHTML = '';
        }
    }

    updateAccessInfo(paper) {
        const accessInfo = document.getElementById('modalAccessInfo');

        if (paper.openAccessPdf) {
            let statusText = 'Access Status: ';
            if (paper.isOpenAccess) {
                statusText += 'Open Access';
            } else {
                statusText += 'Restricted Access';
            }

            accessInfo.innerHTML = `
                <h4>Publication Info</h4>
                <div class="access-status">${statusText}</div>
                <div class="access-status">Status: ${paper.openAccessPdf.status || 'Unknown'}</div>
            `;
        } else {
            accessInfo.innerHTML = '';
        }
    }

    closeModal() {
        const modal = document.getElementById('paperModal');
        if (modal) {
            modal.classList.add('hidden');
        } else {
            console.warn('Paper modal element not found');
        }
    }

    async expandAll() {
        // Load all category data first
        const loadPromises = Object.keys(this.categoryMappings).map(category =>
            this.loadCategoryData(category)
        );
        await Promise.all(loadPromises);

        this.collectAllNodeIds().forEach(nodeId => {
            this.expandedNodes.add(nodeId);
        });
        this.renderTree();
    }

    collapseAll() {
        this.expandedNodes.clear();
        this.renderTree();
    }

    async toggleStats() {
        const statsContainer = document.getElementById('statsContainer');
        const mainLayout = document.querySelector('.main-layout');
        const toggleBtn = document.getElementById('statsToggleBtn');

        if (!statsContainer || !mainLayout || !toggleBtn) {
            console.warn('Stats elements not found:', {
                statsContainer: !!statsContainer,
                mainLayout: !!mainLayout,
                toggleBtn: !!toggleBtn
            });
            return;
        }

        if (statsContainer.classList.contains('collapsed')) {
            // Expand stats
            statsContainer.classList.remove('collapsed');
            mainLayout.classList.add('stats-expanded');
            toggleBtn.classList.add('active');
            toggleBtn.setAttribute('title', 'Hide statistics panel');

            // Load data and calculate statistics when opening for the first time
            await this.ensureStatisticsLoaded();
        } else {
            // Collapse stats
            statsContainer.classList.add('collapsed');
            mainLayout.classList.remove('stats-expanded');
            toggleBtn.classList.remove('active');
            toggleBtn.setAttribute('title', 'Show statistics panel');
        }
    }

    async ensureStatisticsLoaded() {
        // Use the same approach as dendrogram - load all categories in parallel
        const loadPromises = Object.keys(this.categoryMappings).map(category =>
            this.loadCategoryData(category)
        );
        await Promise.all(loadPromises);

        // Always update statistics when stats panel is opened
        this.updateStatistics();
    }

    toggleTheme() {
        const html = document.documentElement;
        const toggleBtn = document.getElementById('themeToggleBtn');

        if (!toggleBtn) {
            console.warn('Theme toggle button not found');
            return;
        }

        const icon = toggleBtn.querySelector('.btn-icon');
        if (!icon) {
            console.warn('Theme toggle icon not found');
            return;
        }

        const currentTheme = html.getAttribute('data-color-scheme');

        if (currentTheme === 'dark') {
            html.setAttribute('data-color-scheme', 'light');
            icon.textContent = '🌙';
            toggleBtn.setAttribute('title', 'Switch to dark theme');
        } else {
            html.setAttribute('data-color-scheme', 'dark');
            icon.textContent = '☀️';
            toggleBtn.setAttribute('title', 'Switch to light theme');
        }
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        const mainLayout = document.querySelector('.main-layout');
        const toggleBtn = document.getElementById('sidebarToggleBtn');

        if (!sidebar || !mainLayout || !toggleBtn) {
            console.warn('Sidebar elements not found:', {
                sidebar: !!sidebar,
                mainLayout: !!mainLayout,
                toggleBtn: !!toggleBtn
            });
            return;
        }

        const icon = toggleBtn.querySelector('.btn-icon');
        if (!icon) {
            console.warn('Sidebar toggle icon not found');
            return;
        }

        if (sidebar.classList.contains('collapsed')) {
            // Expand sidebar
            sidebar.classList.remove('collapsed');
            mainLayout.classList.remove('sidebar-collapsed');
            icon.textContent = '→';
            toggleBtn.setAttribute('title', 'Hide sidebar');
        } else {
            // Collapse sidebar
            sidebar.classList.add('collapsed');
            mainLayout.classList.add('sidebar-collapsed');
            icon.textContent = '←';
            toggleBtn.setAttribute('title', 'Show sidebar');
        }
    }

    collectAllNodeIds(data = this.ontologyData, path = []) {
        const nodeIds = [];

        Object.keys(data).forEach(key => {
            const fullPath = [...path, key];
            const nodeId = fullPath.join('.');
            nodeIds.push(nodeId);

            const item = data[key];
            if (this.hasChildren(item)) {
                if (item.children && Array.isArray(item.children)) {
                    item.children.forEach(child => {
                        const childPath = [...fullPath, child.name];
                        nodeIds.push(...this.collectAllNodeIds({ [child.name]: child }, fullPath));
                    });
                } else if (item.children && typeof item.children === 'object') {
                    nodeIds.push(...this.collectAllNodeIds(item.children, fullPath));
                }
            }
        });

        return nodeIds;
    }

    async switchView(viewType) {
        if (this.currentView === viewType) return;

        this.currentView = viewType;

        // Update view buttons
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.getElementById(`${viewType}ViewBtn`).classList.add('active');

        // Update visualization views
        document.querySelectorAll('.visualization-view').forEach(view => {
            view.classList.remove('active');
        });
        document.getElementById(`ontology${viewType.charAt(0).toUpperCase() + viewType.slice(1)}`).classList.add('active');

        // Update control buttons based on view
        const expandBtn = document.getElementById('expandAllBtn');
        const collapseBtn = document.getElementById('collapseAllBtn');
        const resetZoomBtn = document.getElementById('resetZoomBtn');

        if (viewType === 'tree') {
            // Tree view: show expand/collapse, hide reset zoom
            expandBtn.style.display = '';
            collapseBtn.style.display = '';
            expandBtn.disabled = false;
            collapseBtn.disabled = false;
            expandBtn.classList.remove('disabled');
            collapseBtn.classList.remove('disabled');
            resetZoomBtn.style.display = 'none';
        } else if (viewType === 'dendrogram' || viewType === 'sunburst') {
            // Dendrogram/Sunburst views: hide expand/collapse, show reset zoom
            expandBtn.style.display = 'none';
            collapseBtn.style.display = 'none';
            resetZoomBtn.style.display = '';
        }

        // Render the appropriate view
        if (viewType === 'tree') {
            this.renderTree();
        } else if (viewType === 'dendrogram') {
            await this.renderDendrogram();
        } else if (viewType === 'sunburst') {
            await this.renderSunburst();
        }
    }

    initializeDendrogram() {
        this.dendrogramRenderer = new DendrogramRenderer(this);
    }

    async renderDendrogram() {
        // Load all category data first for full expansion
        const loadPromises = Object.keys(this.categoryMappings).map(category =>
            this.loadCategoryData(category)
        );
        await Promise.all(loadPromises);

        if (this.dendrogramRenderer) {
            this.dendrogramRenderer.render(this.ontologyData);
        }

        // Update statistics after all data is loaded
        this.updateStatistics();
    }

    initializeSunburst() {
        this.sunburstRenderer = new SunburstRenderer(this);
        this.currentSunburstCategory = 'Modality';
    }

    async renderSunburst() {
        if (!this.sunburstRenderer) {
            this.sunburstRenderer = new SunburstRenderer(this);
        }

        // Load all category data
        const categories = ["Modality", "Forensic Goal", "Evidentiary Features", "Search & Analysis Scope"];
        for (const category of categories) {
            if (!this.ontologyData[category]) {
                await this.loadCategoryData(category);
            }
        }

        this.sunburstRenderer.render(this.ontologyData);

        // Update statistics after all data is loaded
        this.updateStatistics();
    }

    calculateStatistics() {
        const stats = {
            totalPapers: new Set(),
            mediaModalityTerms: 0,
            manipulationTypeTerms: 0,
            featuresCuesTerms: 0,
            searchScopeTerms: 0
        };

        // Calculate statistics for each category
        const categories = {
            "Modality": "mediaModalityTerms",
            "Forensic Goal": "manipulationTypeTerms",
            "Evidentiary Features": "featuresCuesTerms",
            "Search & Analysis Scope": "searchScopeTerms"
        };

        Object.keys(categories).forEach(categoryName => {
            const categoryData = this.ontologyData[categoryName];
            if (categoryData) {
                const termCount = this.countTermsRecursively(categoryData);
                stats[categories[categoryName]] = termCount;

                // Collect unique papers
                this.collectPapersRecursively(categoryData, stats.totalPapers);
            }
        });

        stats.totalPapers = stats.totalPapers.size;
        return stats;
    }

    countTermsRecursively(data) {
        let count = 0;

        // Count terms from this node
        if (data.associated_terms && Array.isArray(data.associated_terms)) {
            count += data.associated_terms.length;
        }

        // Count terms from children
        if (data.children) {
            const children = this.getChildren(data);
            if (children) {
                children.forEach(child => {
                    count += this.countTermsRecursively(child);
                });
            }
        }

        return count;
    }

    collectPapersRecursively(data, paperSet) {
        // Collect papers from this node (now paperIds instead of full objects)
        if (data.associated_papers && Array.isArray(data.associated_papers)) {
            data.associated_papers.forEach(paperId => {
                if (paperId) {
                    paperSet.add(paperId);
                }
            });
        }

        // Collect papers from children
        if (data.children) {
            const children = this.getChildren(data);
            if (children) {
                children.forEach(child => {
                    this.collectPapersRecursively(child, paperSet);
                });
            }
        }
    }

    updateStatistics() {
        const stats = this.calculateStatistics();

        console.log('Calculated statistics:', stats);
        console.log('Current ontology data keys:', Object.keys(this.ontologyData));

        // Update the DOM elements
        document.getElementById('statPapers').textContent = stats.totalPapers.toLocaleString();
        document.getElementById('statMediaModality').textContent = stats.mediaModalityTerms.toLocaleString();
        document.getElementById('statManipulationType').textContent = stats.manipulationTypeTerms.toLocaleString();
        document.getElementById('statFeaturesCues').textContent = stats.featuresCuesTerms.toLocaleString();
        document.getElementById('statSearchScope').textContent = stats.searchScopeTerms.toLocaleString();
    }
}

// Dendrogram Renderer Class
class DendrogramRenderer {
    constructor(app) {
        this.app = app;
        this.svg = null;
        this.g = null;
        this.zoom = null;
        this.nodeRadius = 5;
        this.levelHeight = 300;
        this.nodeSpacing = 50;
        this.margin = { top: 40, right: 0, bottom: 40, left: 0 };
    }

    render(data) {
        this.clearVisualization();
        this.setupSVG();
        this.createVisualization(data);
    }

    clearVisualization() {
        const container = document.getElementById('ontologyDendrogram');
        container.innerHTML = '';
    }

    setupSVG() {
        const container = document.getElementById('ontologyDendrogram');
        const containerRect = container.getBoundingClientRect();

        this.width = containerRect.width;
        this.height = containerRect.height;

        this.svg = d3.select('#ontologyDendrogram')
            .append('svg')
            .attr('width', this.width)
            .attr('height', this.height);

        // Setup zoom
        this.zoom = d3.zoom()
            .scaleExtent([0.1, 3])
            .on('zoom', (event) => {
                this.g.attr('transform', event.transform);
            });

        this.svg.call(this.zoom);

        this.g = this.svg.append('g')
            .attr('transform', `translate(${this.margin.left}, ${this.margin.top})`);
    }

    createVisualization(data) {
        // Convert data to D3 hierarchy
        const hierarchyData = this.convertToHierarchy(data);
        const root = d3.hierarchy(hierarchyData);

        // Calculate required space based on number of leaf nodes
        const leafCount = root.leaves().length;
        const minVerticalSpace = leafCount * 35; // 35px per leaf node for better spacing
        const availableHeight = this.height - this.margin.top - this.margin.bottom;
        const availableWidth = this.width - this.margin.left - this.margin.right;

        // Use the larger of calculated space or available space
        const treeHeight = Math.max(minVerticalSpace, availableHeight);

        // Increase horizontal spacing by expanding the effective width
        const expandedWidth = availableWidth * 1.5; // 50% more horizontal space

        // Create tree layout with dynamic sizing and node separation
        const tree = d3.tree()
            .size([treeHeight, expandedWidth])
            .separation((a, b) => {
                // Increase separation between sibling nodes
                return a.parent === b.parent ? 2 : 3;
            });

        tree(root);

        // Create links
        const links = this.g.selectAll('.link')
            .data(root.links())
            .enter()
            .append('path')
            .attr('class', 'link')
            .attr('d', d3.linkHorizontal()
                .x(d => d.y)
                .y(d => d.x));

        // Filter nodes based on search term
        const visibleNodes = this.app.searchTerm ?
            root.descendants().filter(d => this.app.nodeMatchesSearch(d.data.name, d.data.data || d.data)) :
            root.descendants();

        // Create nodes
        const nodes = this.g.selectAll('.node')
            .data(visibleNodes)
            .enter()
            .append('g')
            .attr('class', 'node')
            .attr('transform', d => `translate(${d.y}, ${d.x})`)
            .attr('data-category', d => d.data.category || '')
            .on('click', (event, d) => {
                this.handleNodeClick(event, d);
            });

        // Add circles to nodes
        nodes.append('circle')
            .attr('r', this.nodeRadius)
            .style('fill', d => this.getNodeColor(d.data));

        // Add text to nodes
        nodes.append('text')
            .attr('dy', '0.35em')
            .attr('x', d => d.children ? -20 : 20)
            .style('text-anchor', d => d.children ? 'end' : 'start')
            .text(d => d.data.name)
            .style('font-size', '11px')
            .style('font-weight', '500');

        // Initial zoom to fit
        this.zoomToFit();
    }

    convertToHierarchy(data) {
        const root = {
            name: 'Digital Multimedia Forensics',
            children: []
        };

        Object.keys(data).forEach(key => {
            const category = data[key];
            const categoryNode = {
                name: category.name || key,
                category: key,
                data: category,
                children: []
            };

            // Recursively build the full hierarchy
            if (this.app.hasChildren(category)) {
                categoryNode.children = this.buildChildrenRecursively(category, key);
            }

            root.children.push(categoryNode);
        });

        return root;
    }

    buildChildrenRecursively(parentData, category) {
        const children = [];

        if (Array.isArray(parentData.children)) {
            parentData.children.forEach(child => {
                const childNode = {
                    name: child.name,
                    category: category,
                    data: child,
                    children: []
                };

                // Recursively add grandchildren if they exist
                if (this.app.hasChildren(child)) {
                    childNode.children = this.buildChildrenRecursively(child, category);
                }

                children.push(childNode);
            });
        } else if (typeof parentData.children === 'object') {
            Object.keys(parentData.children).forEach(childKey => {
                const child = parentData.children[childKey];
                const childNode = {
                    name: child.name || childKey,
                    category: category,
                    data: child,
                    children: []
                };

                // Recursively add grandchildren if they exist
                if (this.app.hasChildren(child)) {
                    childNode.children = this.buildChildrenRecursively(child, category);
                }

                children.push(childNode);
            });
        }

        return children;
    }

    getNodeColor(data) {
        const category = data.category;
        const colors = {
            'Modality': '#3B82F6',
            'Forensic Goal': '#EF4444',
            'Evidentiary Features': '#10B981',
            'Search & Analysis Scope': '#5D878F'
        };
        return colors[category] || '#6B7280';
    }

    handleNodeClick(event, d) {
        // Handle node selection
        if (d.data.data) {
            // Build the proper node ID path
            let nodeId = d.data.category;
            if (d.data.name !== d.data.category) {
                nodeId += '.' + d.data.name;
            }

            // Update visual selection
            this.g.selectAll('.node').classed('selected', false);
            d3.select(event.currentTarget).classed('selected', true);

            this.app.selectNode(nodeId, d.data.name, d.data.data, d.data.category);
        }
    }

    zoomToFit() {
        // Wait a moment for the DOM to update
        setTimeout(() => {
            const bounds = this.g.node().getBBox();
            const fullWidth = this.width;
            const fullHeight = this.height;
            const width = bounds.width;
            const height = bounds.height;
            const midX = bounds.x + width / 2;
            const midY = bounds.y + height / 2;

            if (width === 0 || height === 0) return;

            // More conservative scaling to ensure text is readable
            const scale = Math.min(fullWidth / width, fullHeight / height) * 0.8;
            const translate = [fullWidth / 2 - scale * midX, fullHeight / 2 - scale * midY];

            this.svg.transition()
                .duration(750)
                .call(this.zoom.transform, d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale));
        }, 100);
    }
}

// Sunburst Renderer Class
class SunburstRenderer {
    constructor(app) {
        this.app = app;
        this.svg = null;
        this.g = null;
        this.radius = 0;
        this.partition = null;
        this.arc = null;
        this.tooltip = null;
        this.root = null;
        this.p = null; // Current focus node (following D3 pattern)
        this.currentCategory = null;
        this.color = null;
        this.format = d3.format(",d");
        this.width = 0;
        this.height = 0;
    }

    render(data) {
        this.clearVisualization();
        this.setupSVG();
        this.createVisualization(data);
    }

    clearVisualization() {
        const container = document.getElementById('sunburstChart');
        container.innerHTML = '';
    }

    setupSVG() {
        const container = document.getElementById('sunburstChart');
        const containerRect = container.getBoundingClientRect();

        this.width = containerRect.width;
        this.height = containerRect.height;
        this.radius = Math.min(this.width, this.height) / 6;

        this.svg = d3.select('#sunburstChart')
            .append('svg')
            .attr('viewBox', `${-this.width / 2} ${-this.height / 2} ${this.width} ${this.height}`)
            .style('width', '100%')
            .style('height', '100%')
            .style('font', '10px sans-serif');

        this.g = this.svg.append('g');

        // Get tooltip element
        this.tooltip = document.getElementById('sunburstTooltip');
    }

    createVisualization(data) {
        // Convert data to D3 hierarchy with all categories combined
        const hierarchyData = this.convertToHierarchy(data);

        this.root = d3.hierarchy(hierarchyData)
            .sum(d => d.value || 1)
            .sort((a, b) => b.value - a.value);

        // Create partition layout
        this.partition = d3.partition()
            .size([2 * Math.PI, this.root.height + 1]);

        this.partition(this.root);

        // Set initial focus to root
        this.p = this.root;

        // Setup color scale
        this.color = d3.scaleOrdinal(d3.quantize(d3.interpolateRainbow, this.root.children.length + 1));

        // Setup arc generator
        this.arc = d3.arc()
            .startAngle(d => d.x0)
            .endAngle(d => d.x1)
            .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
            .padRadius(this.radius * 1.5)
            .innerRadius(d => d.y0 * this.radius)
            .outerRadius(d => Math.max(d.y0 * this.radius, d.y1 * this.radius - 1));

        // Create paths
        this.path = this.g.append('g')
            .selectAll('path')
            .data(this.root.descendants().slice(1))
            .join('path')
            .attr('fill', d => {
                while (d.depth > 1) d = d.parent;
                return this.color(d.data.name);
            })
            .attr('fill-opacity', d => this.arcVisible(d.current = d) ? (d.children ? 0.6 : 0.4) : 0)
            .attr('pointer-events', d => this.arcVisible(d.current) ? 'auto' : 'none')
            .attr('d', d => this.arc(d.current))
            .style('cursor', 'pointer')
            .each(d => d.current = d)
            .on('click', (event, d) => this.clicked(event, d))
            .on('mouseover', (event, d) => this.handleSliceHover(event, d, true))
            .on('mouseout', (event, d) => this.handleSliceHover(event, d, false));

        // Add center circle for navigation
        this.g.append('circle')
            .attr('r', this.radius)
            .attr('fill', 'none')
            .attr('pointer-events', 'all')
            .on('click', () => {
                // Go to parent of current focus, not root
                if (this.p && this.p !== this.root) {
                    const parent = this.p.parent || this.root;
                    this.clicked(null, parent);
                }
                // If already at root, do nothing
            });

        // Initialize breadcrumb
        this.updateBreadcrumb();
        this.updateCenterText();
    }

    convertToHierarchy(data) {
        const root = {
            name: "Digital Multimedia Forensics",
            children: []
        };

        // Add all categories as top-level children
        const categories = ["Modality", "Forensic Goal", "Evidentiary Features", "Search & Analysis Scope"];

        categories.forEach(categoryName => {
            const categoryData = data[categoryName];
            if (categoryData && this.app.hasChildren(categoryData)) {
                const categoryNode = {
                    name: categoryName,
                    category: categoryName,
                    data: categoryData,
                    value: this.getTotalTermCount(categoryData),
                    children: this.buildChildrenRecursively(categoryData, categoryName)
                };
                root.children.push(categoryNode);
            }
        });

        return root;
    }

    getTotalTermCount(data) {
        let count = 0;
        if (data.associated_terms) {
            count += data.associated_terms.length;
        }
        if (this.app.hasChildren(data)) {
            const children = this.app.getChildren(data);
            children.forEach(child => {
                count += this.getTotalTermCount(child);
            });
        }
        return count || 1;
    }

    buildChildrenRecursively(parentData, category) {
        const children = [];

        if (Array.isArray(parentData.children)) {
            parentData.children.forEach(child => {
                const childNode = {
                    name: child.name,
                    category: category,
                    data: child,
                    value: child.associated_terms ? child.associated_terms.length : 1,
                    children: []
                };

                if (this.app.hasChildren(child)) {
                    childNode.children = this.buildChildrenRecursively(child, category);
                }

                children.push(childNode);
            });
        } else if (typeof parentData.children === 'object') {
            Object.keys(parentData.children).forEach(childKey => {
                const child = parentData.children[childKey];
                const childNode = {
                    name: child.name || childKey,
                    category: category,
                    data: child,
                    value: child.associated_terms ? child.associated_terms.length : 1,
                    children: []
                };

                if (this.app.hasChildren(child)) {
                    childNode.children = this.buildChildrenRecursively(child, category);
                }

                children.push(childNode);
            });
        }

        return children;
    }

    // Following D3 zoomable sunburst pattern
    arcVisible(d) {
        return d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0;
    }

    labelVisible(d) {
        return d.y1 <= 3 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03;
    }

    labelTransform(d) {
        const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
        const y = (d.y0 + d.y1) / 2 * this.radius;
        return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
    }

    clicked(event, p) {
        if (event) event.stopPropagation();

        // Handle slice selection for sidebar first
        if (p && p.data.data) {
            let nodeId = p.data.category;
            if (p.data.name !== p.data.category) {
                nodeId += '.' + p.data.name;
            }
            this.app.selectNode(nodeId, p.data.name, p.data.data, p.data.category);
        }

        // Only zoom if the node has children (not a leaf node)
        if (!p || !p.children || p.children.length === 0) {
            // This is a leaf node - just select it, don't zoom
            return;
        }

        // Proceed with zoom for nodes with children
        this.p = p;

        this.root.each(d => d.target = {
            x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
            x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
            y0: Math.max(0, d.y0 - p.depth),
            y1: Math.max(0, d.y1 - p.depth)
        });

        const t = this.g.transition().duration(750);

        // Transition the data on all arcs, even the ones that aren't visible
        const that = this;
        this.path.transition(t)
            .tween('data', d => {
                const i = d3.interpolate(d.current, d.target);
                return t => d.current = i(t);
            })
            .filter(function (d) {
                return +this.getAttribute('fill-opacity') || that.arcVisible(d.target);
            })
            .attr('fill-opacity', d => this.arcVisible(d.target) ? (d.children ? 0.6 : 0.4) : 0)
            .attr('pointer-events', d => this.arcVisible(d.target) ? 'auto' : 'none')
            .attrTween('d', d => () => this.arc(d.current));

        this.updateBreadcrumb();
        this.updateCenterText();
    }

    updateBreadcrumb() {
        const breadcrumb = document.getElementById('sunburstBreadcrumb');
        breadcrumb.innerHTML = '';

        // Build path from root to current focus
        const path = this.p.ancestors().reverse();

        path.forEach((node, index) => {
            if (index > 0) {
                // Add separator
                const separator = document.createElement('span');
                separator.className = 'sunburst-breadcrumb-separator';
                separator.textContent = '>';
                breadcrumb.appendChild(separator);
            }

            // Add breadcrumb item
            const item = document.createElement('span');
            item.className = 'sunburst-breadcrumb-item';
            item.textContent = node.data.name;

            // Make clickable if not current focus
            if (node !== this.p) {
                item.style.cursor = 'pointer';
                item.addEventListener('click', () => {
                    this.clicked(null, node);
                });
            } else {
                item.style.fontWeight = '600';
                item.style.color = 'var(--color-primary)';
            }

            breadcrumb.appendChild(item);
        });
    }

    updateCenterText() {
        // Remove existing center text
        this.g.selectAll('.center-text').remove();

        const isZoomed = this.p && this.p !== this.root;

        if (isZoomed) {
            // Show current node name and zoom out instruction
            this.g.append('text')
                .attr('class', 'center-text')
                .attr('text-anchor', 'middle')
                .attr('font-size', '14px')
                .attr('font-weight', '600')
                .text(this.p.data.name)
                .attr('y', -8);

            this.g.append('text')
                .attr('class', 'center-text')
                .attr('text-anchor', 'middle')
                .attr('font-size', '8px')
                .attr('opacity', '0.7')
                .text('Click on white space\n to zoom out')
                .attr('y', 8);
        } else {
            // Show main title
            this.g.append('text')
                .attr('class', 'center-text')
                .attr('text-anchor', 'middle')
                .text("Digital Multimedia Forensics")
                .attr('y', 0);
        }
    }

    resetZoom() {
        this.clicked(null, this.root);
    }

    handleSliceHover(event, d, isHover) {
        if (isHover) {
            // Show tooltip
            const name = d.data.name;
            const termCount = d.data.data && d.data.data.associated_terms ? d.data.data.associated_terms.length : 0;
            const tooltipText = termCount > 0 ? `${name} (${termCount} terms)` : name;

            this.tooltip.textContent = tooltipText;
            this.tooltip.style.opacity = '1';

            // Position tooltip relative to mouse
            const rect = document.getElementById('sunburstChart').getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;

            this.tooltip.style.left = mouseX + 'px';
            this.tooltip.style.top = (mouseY - 10) + 'px';
        } else {
            // Hide tooltip
            this.tooltip.style.opacity = '0';
        }
    }
}

// Initialize the application when the DOM is loaded
function initializeApp() {
    console.log('Initializing OntologyApp...');
    try {
        new OntologyApp();
    } catch (error) {
        console.error('Error initializing OntologyApp:', error);
        // Retry once after a delay
        setTimeout(() => {
            try {
                new OntologyApp();
            } catch (retryError) {
                console.error('Failed to initialize OntologyApp after retry:', retryError);
            }
        }, 500);
    }
}

// Handle different loading scenarios
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        // Additional delay for iframe context
        const delay = window.self !== window.top ? 300 : 100;
        setTimeout(initializeApp, delay);
    });
} else {
    // DOM already loaded
    const delay = window.self !== window.top ? 300 : 100;
    setTimeout(initializeApp, delay);
}