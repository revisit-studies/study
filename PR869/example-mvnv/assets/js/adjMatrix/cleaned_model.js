//import * as d3 from 'd3';
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator['throw'](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), 'throw': verb(1), 'return': verb(2) }, typeof Symbol === 'function' && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError('Generator is already executing.');
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y['return'] : op[0] ? y['throw'] || ((t = y['return']) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
var Model = /** @class */ (function () {
    function Model(controller) {
        var _this = this;
        this.controller = controller;
        this.datumID = controller.datumID;
        d3.json(controller.configuration.graphFiles[controller.configuration.loadedGraph]).then(function (data) {
            _this.graph = data;
            _this.edges = data.links;
            //setPanelValuesFromFile(controller.configuration, data);
            _this.matrix = [];
            _this.scalarMatrix = [];
            _this.nodes = data.nodes;
            _this.populateSearchBox();
            _this.idMap = {};
            // sorts adjacency matrix, if a cluster method, sort by shortname, then cluster later
            var clusterFlag = false;
            if (_this.controller.configuration.adjMatrix.sortKey in ['clusterBary', 'clusterLeaf', 'clusterSpectral']) {
                _this.orderType = 'shortName'; //this.controller.configuration.adjMatrix.sortKey;
                clusterFlag = true;
            }
            else {
                _this.orderType = _this.controller.configuration.adjMatrix.sortKey;
            }
            _this.order = _this.changeOrder(_this.orderType);
            // sorts quantitative by descending value, sorts qualitative by alphabetical
            if (!_this.isQuant(_this.orderType)) {
                _this.nodes = _this.nodes.sort(function (a, b) { return a[_this.orderType].localeCompare(b[_this.orderType]); });
            }
            else {
                _this.nodes = _this.nodes.sort(function (a, b) { return b[_this.orderType] - a[_this.orderType]; });
            }
            _this.nodes.forEach(function (node, index) {
                node.index = index;
                _this.idMap[node.id] = index;
            });
            _this.controller = controller;
            _this.processData();
            if (clusterFlag) {
                _this.orderType = _this.controller.configuration.adjMatrix.sortKey;
                _this.order = _this.changeOrder(_this.orderType);
            }
            _this.controller.loadData(_this.nodes, _this.edges, _this.matrix);
        });
    }
    /**
     * Determines if the attribute is quantitative
     * @param  attr [string that corresponds to attribute type]
     * @return      [description]
     */
    Model.prototype.isQuant = function (attr) {
        // if not in list
        if (!Object.keys(this.controller.configuration.attributeScales.node).includes(attr)) {
            return false;
        }
        else if (this.controller.configuration.attributeScales.node[attr].range === undefined) {
            return true;
        }
        else {
            return false;
        }
    };
    Model.prototype.populateSearchBox = function () {
        /*
        d3.select("#search-input").attr("list", "characters");
        let inputParent = d3.select("#search-input").node().parentNode;
    
        let datalist = d3
        .select(inputParent).selectAll('#characters').data([0]);
    
        let enterSelection = datalist.enter()
        .append("datalist")
        .attr("id", "characters");
    
        datalist.exit().remove();
    
        datalist= enterSelection.merge(datalist);
    
        let options = datalist.selectAll("option").data(this.nodes);
    
        let optionsEnter = options.enter().append("option");
        options.exit().remove();
    
        options = optionsEnter.merge(options);
        options.attr("value", d => d.shortName);
        options.attr("id", d => d.id);
    
        d3.select("#search-input").on("change", (d,i,nodes) => {
          let selectedOption = d3.select(nodes[i]).property("value");
          console.log(this.controller.view.search(selectedOption))
        });
    */
    };
    /**
     * returns an object containing the current provenance state.
     * @return [the provenance state]
     */
    Model.prototype.getApplicationState = function () {
        var _this = this;
        return {
            currentState: function () { return _this.provenance.graph().current.state; }
        };
    };
    /**
     * Initializes the provenance library and sets observers.
     * @return [none]
     */
    Model.prototype.setUpProvenance = function () {
        var initialState = {
            workerID: workerID,
            taskID: this.controller.tasks[this.controller.taskNum],
            nodes: '',
            search: '',
            startTime: Date.now(),
            endTime: '',
            time: Date.now(),
            count: 0,
            clicked: [],
            sortKey: this.controller.configuration.adjMatrix.sortKey,
            selections: {
                answerBox: {},
                attrRow: {},
                rowLabel: {},
                colLabel: {},
                neighborSelect: {},
                cellcol: {},
                cellrow: {},
                search: {}
            }
        };
        var provenance = ProvenanceLibrary.initProvenance(initialState);
        this.provenance = provenance;
        var app = this.getApplicationState();
        this.app = app;
        // creates the document with the name and worker ID
        //pushProvenance(app.currentState());
        var columnElements = ['topoCol'];
        var rowElements = ['topoRow', 'attrRow'];
        var elementNamesFromSelection = {
            cellcol: rowElements.concat(columnElements),
            colLabel: rowElements.concat(columnElements).concat(['colLabel']),
            rowLabel: rowElements.concat(columnElements).concat(['rowLabel']),
            attrRow: rowElements.concat(['rowLabel']),
            cellrow: rowElements.concat(columnElements),
            neighborSelect: rowElements,
            answerBox: rowElements.concat(columnElements),
            search: rowElements.concat(columnElements)
        };
        function classAllHighlights(state) {
            var clickedElements = new Set();
            var answerElements = new Set();
            var neighborElements = new Set();
            // go through each interacted element, and determine which rows/columns should
            // be highlighted due to it's interaction
            for (var selectionType in state.selections) {
                for (var index in elementNamesFromSelection[selectionType]) {
                    var selectionElement = elementNamesFromSelection[selectionType][index];
                    for (var node in state.selections[selectionType]) {
                        if (selectionType == 'answerBox') {
                            answerElements.add('#' + selectionElement + node);
                        }
                        else if (selectionType == 'neighborSelect') {
                            neighborElements.add('#' + selectionElement + node);
                        }
                        else {
                            // if both in attrRow and rowLabel, don't highlight element
                            if (selectionType == 'attrRow' || selectionType == 'rowLabel') {
                                if (node in state.selections['attrRow'] && node in state.selections['rowLabel'])
                                    continue;
                            }
                            clickedElements.add('#' + selectionElement + node);
                        }
                    }
                }
            }
            var clickedSelectorQuery = Array.from(clickedElements).join(',');
            var answerSelectorQuery = Array.from(answerElements).join(',');
            var neighborSelectQuery = Array.from(neighborElements).join(',');
            clickedSelectorQuery != [] ? d3.selectAll(clickedSelectorQuery).classed('clicked', true) : null;
            answerSelectorQuery != [] ? d3.selectAll(answerSelectorQuery).classed('answer', true) : null;
            neighborSelectQuery != [] ? d3.selectAll(neighborSelectQuery).classed('neighbor', true) : null;
            return;
        }
        function setUpObservers() {
            var _this = this;
            var updateHighlights = function (state) {
                d3.selectAll('.clicked').classed('clicked', false);
                d3.selectAll('.answer').classed('answer', false);
                d3.selectAll('.neighbor').classed('neighbor', false);
                classAllHighlights(state);
            };
            var updateCellClicks = function (state) {
                var cellNames = [];
                Object.keys(state.selections.cellcol).map(function (key) {
                    var names = state.selections.cellcol[key];
                    names.map(function (name) {
                        var cellsNames = splitCellNames(name);
                        cellNames = cellNames.concat(cellsNames);
                    });
                    //names.map(name=>{
                    //})
                });
                var cellSelectorQuery = '#' + cellNames.join(',#');
                // if no cells selected, return
                d3.selectAll('.clickedCell').classed('clickedCell', false);
                if (cellSelectorQuery == '#')
                    return;
                d3.selectAll(cellSelectorQuery).selectAll('.baseCell').classed('clickedCell', true);
            };
            var updateAnswerBox = function (state) {
                window.controller.configuration.adjMatrix['toggle'] ? window.controller.view.updateAnswerToggles(state) : window.controller.view.updateCheckBox(state);
                //window.controller.view.updateAnswerToggles(state)
                var answer = [];
                for (var i = 0; i < window.controller.model.nodes.length; i++) {
                    if (window.controller.model.nodes[i][_this.controller.view.datumID] in state.selections.answerBox) {
                        answer.push(window.controller.model.nodes[i]);
                    }
                }
                updateAnswer(answer);
            };
            provenance.addObserver('selections.attrRow', updateHighlights);
            provenance.addObserver('selections.rowLabel', updateHighlights);
            provenance.addObserver('selections.colLabel', updateHighlights);
            provenance.addObserver('selections.cellcol', updateHighlights);
            provenance.addObserver('selections.cellrow', updateHighlights);
            provenance.addObserver('selections.neighborSelect', updateHighlights);
            provenance.addObserver('selections.cellcol', updateCellClicks);
            provenance.addObserver('selections.search', updateHighlights);
            provenance.addObserver('selections.answerBox', updateHighlights);
            provenance.addObserver('selections.answerBox', updateAnswerBox);
        }
        setUpObservers();
        return [app, provenance];
    };
    Model.prototype.reload = function () {
        this.controller.loadData(this.nodes, this.edges, this.matrix);
    };
    /**
     *   Determines the order of the current nodes
     * @param  type A string corresponding to the attribute screen_name to sort by.
     * @return      A numerical range in corrected order.
     */
    Model.prototype.changeOrder = function (type) {
        var _this = this;
        var order;
        this.orderType = type;
        this.controller.configuration.adjMatrix.sortKey = type;
        if (type == 'clusterSpectral' || type == 'clusterBary' || type == 'clusterLeaf') {
            var graph = reorder.graph()
                .nodes(this.nodes)
                .links(this.edges)
                .init();
            if (type == 'clusterBary') {
                var barycenter = reorder.barycenter_order(graph);
                order = reorder.adjacent_exchange(graph, barycenter[0], barycenter[1])[1];
            }
            else if (type == 'clusterSpectral') {
                order = reorder.spectral_order(graph);
            }
            else if (type == 'clusterLeaf') {
                var mat = reorder.graph2mat(graph);
                order = reorder.optimal_leaf_order()(mat);
            }
            //
            //order = reorder.optimal_leaf_order()(this.scalarMatrix);
        }
        else if (this.orderType == 'edges') {
            order = d3.range(this.nodes.length).sort(function (a, b) { return _this.nodes[a][type].length - _this.nodes[b][type].length; });
        }
        else if (!this.isQuant(this.orderType)) { // == "screen_name" || this.orderType == "name") {
            order = d3.range(this.nodes.length).sort(function (a, b) { return _this.nodes[a][type].localeCompare(_this.nodes[b][type]); });
        }
        else {
            order = d3.range(this.nodes.length).sort(function (a, b) { return _this.nodes[b][type] - _this.nodes[a][type]; });
        }
        this.order = order;
        return order;
    };
    /**
     * [processData description]
     * @return [description]
     */
    Model.prototype.processData = function () {
        var _this = this;
        // generate a hashmap of id's?
        // Set up node data
        this.nodes.forEach(function (rowNode, i) {
            rowNode.count = 0;
            /* Numeric Conversion */
            rowNode.followers_count = +rowNode.followers_count;
            rowNode.query_tweet_count = +rowNode.query_tweet_count;
            rowNode.friends_count = +rowNode.friends_count;
            rowNode.statuses_count = +rowNode.statuses_count;
            rowNode.favourites_count = +rowNode.favourites_count;
            rowNode.count_followers_in_query = +rowNode.count_followers_in_query;
            //rowNode.id = +rowNode.id;
            rowNode.y = i;
            /* matrix used for edge attributes, otherwise should we hide */
            _this.matrix[i] = _this.nodes.map(function (colNode) { return { cellName: 'cell' + rowNode[_this.datumID] + '_' + colNode[_this.datumID], correspondingCell: 'cell' + colNode[_this.datumID] + '_' + rowNode[_this.datumID], rowid: rowNode[_this.datumID], colid: colNode[_this.datumID], x: colNode.index, y: rowNode.index, count: 0, z: 0, interacted: 0, retweet: 0, mentions: 0 }; });
            _this.scalarMatrix[i] = _this.nodes.map(function (colNode) { return 0; });
        });
        function checkEdge(edge) {
            if (typeof edge.source !== 'number')
                return false;
            if (typeof edge.target !== 'number')
                return false;
            return true;
        }
        this.edges = this.edges.filter(checkEdge);
        this.maxTracker = { 'reply': 0, 'retweet': 0, 'mentions': 0 };
        // Convert links to matrix; count character occurrences.
        this.edges.forEach(function (link) {
            var addValue = 1;
            _this.matrix[_this.idMap[link.source]][_this.idMap[link.target]][link.type] += link.count;
            //
            _this.scalarMatrix[_this.idMap[link.source]][_this.idMap[link.target]] += link.count;
            /* could be used for varying edge types */
            //this.maxTracker = { 'reply': 3, 'retweet': 3, 'mentions': 2 }
            _this.matrix[_this.idMap[link.source]][_this.idMap[link.target]].z += addValue;
            _this.matrix[_this.idMap[link.source]][_this.idMap[link.target]].count += 1;
            // if not directed, increment the other values
            if (!_this.controller.configuration.isDirected) {
                _this.matrix[_this.idMap[link.target]][_this.idMap[link.source]].z += addValue;
                _this.matrix[_this.idMap[link.target]][_this.idMap[link.source]][link.type] += link.count;
                _this.scalarMatrix[_this.idMap[link.source]][_this.idMap[link.target]] += link.count;
            }
            link.source = _this.idMap[link.source];
            link.target = _this.idMap[link.target];
        });
    };
    Model.prototype.getOrder = function () {
        return this.order;
    };
    /**
     * Returns the node data.
     * @return Node data in JSON Array
     */
    Model.prototype.getNodes = function () {
        return this.nodes;
    };
    /**
     * Returns the edge data.
     * @return Edge data in JSON Array
     */
    Model.prototype.getEdges = function () {
        return this.edges;
    };
    return Model;
}());
// Work on importing class file
var Controller = /** @class */ (function () {
    function Controller() {
        this.hoverRow = {};
        this.hoverCol = {};
        this.datumID = 'id';
        this.clickedCells = new Set();
        this.loadClearButton();
        this.loadTasks();
        this.sizeLayout();
    }
    Controller.prototype.setupExports = function (base, task) {
        d3.select('#exportBaseConfig').on('click', function () {
            exportConfig(Object.keys(base), Object.keys(base.adjMatrix), false);
        });
        d3.select('#exportConfig').on('click', function () {
            exportConfig(Object.keys(task), Object.keys(task.adjMatrixValues), true);
        });
    };
    Controller.prototype.setupCSS = function (base) {
        return;
        /*set css values for 'clicked' nodes;
        //set fill or stroke of selected node;
    
        //find the appropriate style sheet
        var sheet = Object.values(document.styleSheets).find(s =>
          s.href.includes("styles.css")
        );
    
        // let nodeIsRect = config.style.nodeShape === 'rect';
        // sheet.addRule(".node", (nodeIsRect? 'rx: 2; ry:2'  : 'rx:20; ry:20' ) , 1);
    
          let ruleString = "fill :" + base.style.selectedNodeColor +" !important;";
          sheet.addRule(".rect.selected", ruleString, 1);
          */
    };
    Controller.prototype.finishConstructing = function (config) {
        this.configuration = config;
        this.view = new View(this); // initalize view,
        this.model = new Model(this); // start reading in data
    };
    Controller.prototype.loadTask = function (taskNum) {
        this.taskNum = taskNum;
        this.task = this.tasks[this.taskNum];
        this.configuration = this.task.config;
        //let prompt = 'Task ' + (this.taskNum + 1) + ' - ' + this.task.prompt;
        //this.configuration.adjMatrix.edgeBars = true;
        if (this.task.replyType.includes('singleNodeSelection') || this.task.replyType.includes('multipleNodeSelection')) {
            if (!this.configuration.nodeAttributes.includes('selected')) {
                this.configuration.nodeAttributes.unshift('selected');
                var obj = {
                    'domain': [true, false],
                    'range': ['#e86b45', '#fff'],
                    'labels': ['answer', 'not answer'],
                    'glyph': 'rect',
                    'label': 'selected'
                };
                this.configuration.attributeScales.node['selected'] = obj;
            }
        }
        this.configuration.adjMatrix['toggle'] = false;
        //this.configuration.adjMatrix.neighborSelect = true;
        this.attrWidth = d3.min([125 * this.configuration.nodeAttributes.length, 650]);
        this.configuration.state = {};
        this.configuration.state.adjMatrix = {};
        if (this.configuration.adjMatrix.sortKey == null || this.configuration.adjMatrix.sortKey == '') {
            this.configuration.adjMatrix.sortKey = 'shortName';
        }
        this.sizeLayout();
        //configuration.adjMatrix.sortKey
        this.reload();
        // load data file
        // render vis from configurations
        // add observers and new provenance graph
        // create new field to store in fB?
    };
    Controller.prototype.loadTasks = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                this.taskNum = 0;
                this.tasks = taskList;
                return [2 /*return*/];
            });
        });
    };
    Controller.prototype.loadClearButton = function () {
        var _this = this;
        d3.select('#clearButton').on('click', function () {
            var action = {
                label: 'clear',
                action: function () {
                    var currentState = _this.model.app.currentState();
                    //add time stamp to the state graph
                    currentState.time = Date.now();
                    currentState.event = 'clear';
                    console.log('before Clear:', currentState);
                    currentState.selections = {
                        answerBox: {},
                        attrRow: {},
                        rowLabel: {},
                        colLabel: {},
                        cellcol: {},
                        cellrow: {},
                        search: {},
                        neighborSelect: {}
                    };
                    console.log('after Clear:', currentState);
                    return currentState;
                },
                args: []
            };
            _this.model.provenance.applyAction(action);
            //pushProvenance(this.model.app.currentState())
        });
    };
    Controller.prototype.sizeLayout = function () {
        var targetDiv = d3.select('#targetSize');
        var width = targetDiv.style('width').replace('px', ''), height = targetDiv.style('height').replace('px', '');
        var taskBarHeight = 74;
        var panelDimensions = {};
        panelDimensions.width = 800;
        panelDimensions.height = 400;
        d3.select('#visPanel').style('width', panelDimensions.width + 'px');
        d3.select('#panelDiv').style('display', 'none');
        document.getElementById('visContent').style.width = '100vw';
        document.getElementById('visContent').style.overflowX = 'scroll';
        this.visHeight = panelDimensions.height;
        this.visWidth = width * 0.8 - 40;
        this.edgeWidth = this.visWidth - this.attrWidth;
        var filler = 0;
        if (panelDimensions.height < this.edgeWidth) {
            this.edgeWidth = panelDimensions.height;
            filler = this.visWidth - this.attrWidth - this.edgeWidth;
            this.visWidth = this.visWidth;
        }
        this.attributePorportion = this.attrWidth / (this.edgeWidth + this.attrWidth + filler);
        this.edgePorportion = this.edgeWidth / (this.edgeWidth + this.attrWidth + filler);
        if (this.edgeWidth < panelDimensions.height) {
            this.visHeight = this.visWidth * this.edgePorportion;
        }
        d3.select('.topocontainer').style('width', (100 * this.edgePorportion).toString() + '%');
        d3.select('.topocontainer').style('height', (this.visHeight).toString() + 'px');
        d3.select('.attrcontainer').style('width', (100 * this.attributePorportion).toString() + '%');
        d3.select('.attrcontainer').style('height', (this.visHeight).toString() + 'px');
        //d3.select('.adjMatrix.vis').style('width',width*0.8);
        d3.select('.adjMatrix.vis').style('width', (this.visWidth).toString() + 'px');
    };
    Controller.prototype.clearView = function () {
        d3.select('.tooltip').remove();
        d3.select('#topology').selectAll('*').remove();
        d3.select('#attributes').selectAll('*').remove();
        d3.select('#legend-svg').selectAll('*').remove();
    };
    Controller.prototype.reload = function () {
        this.clearView();
        //this.loadCurrentTask();
        d3.select('.loading').style('display', 'block');
        this.view = new View(this); // initalize view,
        this.model = new Model(this); //.reload();
    };
    /**
     * Passes the processed edge and node data to the view.
     * @return None
     */
    Controller.prototype.loadData = function (nodes, edges, matrix) {
        this.view.loadData(nodes, edges, matrix);
    };
    /**
     * Obtains the order from the model and returns it to the view.
     * @return [description]
     */
    Controller.prototype.getOrder = function () {
        return this.model.getOrder();
    };
    /**
     * Obtains the order from the model and returns it to the view.
     * @return [description]
     */
    Controller.prototype.changeOrder = function (order) {
        this.configuration.adjMatrix.sortKey = order;
        return this.model.changeOrder(order);
    };
    return Controller;
}());
window.controller = new Controller();
function splitCellNames(name) {
    //remove cell
    var cleanedCellName = name.replace('cell', '');
    var ids = cleanedCellName.split('_');
    return ['cell' + ids[0] + '_' + ids[1], 'cell' + ids[1] + '_' + ids[0]];
}
