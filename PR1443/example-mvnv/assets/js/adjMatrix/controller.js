var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator['throw'](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
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
// Work on importing class file
var Controller = /** @class */ (function () {
    function Controller() {
        this.hoverRow = {};
        this.hoverCol = {};
        this.datumID = 'id';
        this.clickedCells = new Set();
        //this.loadClearButton();
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
        this.tasks = taskList;
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
        this.attrWidth = d3.min([150 * this.configuration.nodeAttributes.length, 650]);
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
    Controller.prototype.clear = function () {
        var _this = this;
        var action = this.model.provenance.addAction('clear', function () {
            var currentState = _this.model.app.currentState();
            //add time stamp to the state graph
            currentState.time = Date.now();
            currentState.event = 'clear';
            currentState.selections = {
                answerBox: currentState.selections.answerBox,
                attrRow: {},
                rowLabel: {},
                colLabel: {},
                cellcol: {},
                cellrow: {},
                search: {},
                neighborSelect: {},
                previousMouseovers: []
            };
            return currentState;
        });
        action.applyAction();
        pushProvenance(this.model.app.currentState());
    };
    Controller.prototype.sizeLayout = function () {
        var targetDiv = d3.select('#targetSize');
        var width = targetDiv.style('width').replace('px', ''), height = targetDiv.style('height').replace('px', '');
        var taskBarHeight = 74;
        var panelDimensions = {};
        /*panelDimensions.width = width * 0.245;*/
        panelDimensions.width = 480; //d3.select("#visPanel").style("width")//, panelDimensions.width + "px");
        panelDimensions.height = height - taskBarHeight;
        d3.select('#visPanel').style('width', panelDimensions.width + 'px');
        d3.select('#visPanel').style('height', panelDimensions.height + 'px');
        d3.select('#panelDiv').style('display', 'none');
        document.getElementById('visContent').style.width = '100vw';
        document.getElementById('visContent').style.overflowX = 'scroll';
        this.visHeight = panelDimensions.height;
        this.visWidth = width - panelDimensions.width - 10;
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
        // this.tasks[this.taskNum].startTime = Date.now();
        //
        //this.model = new Model(this); // start reading in data
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
    Controller.prototype.changeOrder = function (order, node) {
        if (node === void 0) { node = false; }
        this.configuration.adjMatrix.sortKey = order;
        return this.model.changeOrder(order, node);
    };
    return Controller;
}());
window.controller = new Controller();
