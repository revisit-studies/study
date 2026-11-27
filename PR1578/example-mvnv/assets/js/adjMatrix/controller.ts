// Work on importing class file
class Controller {
  /*
  The Model handels the loading, sorting, and ordering of the data.
   */
  private view: any;
  private model: any;
  private configuration: any;

  setupExports(base, task) {
    d3.select('#exportBaseConfig').on('click', function() {
      exportConfig(Object.keys(base), Object.keys(base.adjMatrix), false);
    });

    d3.select('#exportConfig').on('click', function() {
      exportConfig(Object.keys(task), Object.keys(task.adjMatrixValues), true);
    });
  }
  setupCSS(base) {
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

  }

  finishConstructing(config) {
    this.configuration = config;



    this.view = new View(this); // initalize view,
    this.model = new Model(this); // start reading in data

  }

  private tasks: any;
  private taskNum: number;

  loadTask(taskNum) {
    this.tasks = taskList;
    this.taskNum = taskNum;
    this.task = this.tasks[this.taskNum];
    this.configuration = this.task.config;
    //let prompt = 'Task ' + (this.taskNum + 1) + ' - ' + this.task.prompt;

    //this.configuration.adjMatrix.edgeBars = true;
    if (this.task.replyType.includes('singleNodeSelection') || this.task.replyType.includes('multipleNodeSelection')) {
      if (!this.configuration.nodeAttributes.includes('selected')) {
        this.configuration.nodeAttributes.unshift('selected');
        const obj = {
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
  }
  async loadTasks() {
    this.taskNum = 0;
    this.tasks = taskList;
    // work here to disambiguate task stuff TODO
    /*
    let taskConfigs = await d3.json("./../../taskLists/am_large.json").then((data) => {
      //this.tasks = data.tasks;
      this.configuration = data.task1.config;
      this.tasks = [data.task1];

      let obj = {
        "domain": [true, false],
        "range": ["#e86b45", '#fff'],
        "labels": ['answer', 'not answer'],
        'glyph': 'rect',
        'label': 'selected'
      }

      //this.configuration = result;
      this.configuration.attributeScales.node['selected'] = obj;
      this.configuration.state = {}
      this.configuration.state.adjMatrix = {};
      this.configuration.adjMatrix.sortKey = 'shortName'
      //configuration.adjMatrix.sortKey
      this.reload();

    });*/

    //let taskConfig = "../configs/task" + (this.taskNum + 1).toString() + "Config.json";
    //if (this.tenAttr) {
    //  taskConfig = "../configs/10AttrConfig.json"
    //} else if (this.fiveAttr) {
    //  taskConfig = "../configs/5AttrConfig.json"
    //}

    //let that = this;
    /*
    Promise.all([
      d3.json("../configs/baseConfig.json"),
      d3.json(taskConfig),
      d3.json("../configs/state.json")
    ]).then((configComponents) => {
      /*that.setupCSS(configComponents[0]);
      that.setupExports(configComponents[0], configComponents[1]);
      let components = [configComponents[0], configComponents[1], configComponents[2]];
      let result = deepmerge.all(components);
*/
    // added selected attribute scale

    //that.finishConstructing(result);
    //})




  }
  private clickedCells: any;
  clear() {

      const action = this.model.provenance.addAction(
        'clear',
        () => {
          const currentState = this.model.app.currentState();
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
        }
      );
      action.applyAction();
      pushProvenance(this.model.app.currentState());
  }


  private hoverRow: any;
  private hoverCol: any;

  sizeLayout() {
    const targetDiv = d3.select('#targetSize');
    const width = targetDiv.style('width').replace('px', ''),
      height = targetDiv.style('height').replace('px', '');
    const taskBarHeight = 74;
    const panelDimensions = {};
    /*panelDimensions.width = width * 0.245;*/
    panelDimensions.width = 480;//d3.select("#visPanel").style("width")//, panelDimensions.width + "px");
    panelDimensions.height = height - taskBarHeight;
    d3.select('#visPanel').style('width', panelDimensions.width + 'px');
    d3.select('#visPanel').style('height', panelDimensions.height + 'px');


    d3.select('#panelDiv').style('display', 'none');
    document.getElementById('visContent').style.width = '100vw';
    document.getElementById('visContent').style.overflowX = 'scroll';

    this.visHeight = panelDimensions.height;
    this.visWidth = width - panelDimensions.width - 10;
    this.edgeWidth = this.visWidth - this.attrWidth;

    let filler = 0;
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
  }

  constructor() {

    this.hoverRow = {};
    this.hoverCol = {};
    this.datumID = 'id';
    this.clickedCells = new Set();


    //this.loadClearButton();
    this.loadTasks();

    this.sizeLayout();
  }

  clearView() {
    d3.select('.tooltip').remove();

    d3.select('#topology').selectAll('*').remove();
    d3.select('#attributes').selectAll('*').remove();
    d3.select('#legend-svg').selectAll('*').remove();

  }

  reload() {
    this.clearView();
    //this.loadCurrentTask();
    d3.select('.loading').style('display', 'block');

    this.view = new View(this); // initalize view,
    this.model = new Model(this); //.reload();
    // this.tasks[this.taskNum].startTime = Date.now();
    //
    //this.model = new Model(this); // start reading in data
  }

  /**
   * Passes the processed edge and node data to the view.
   * @return None
   */
  loadData(nodes: any, edges: any, matrix: any) {
    this.view.loadData(nodes, edges, matrix);
  }

  /**
   * Obtains the order from the model and returns it to the view.
   * @return [description]
   */
  getOrder() {
    return this.model.getOrder();
  }

  /**
   * Obtains the order from the model and returns it to the view.
   * @return [description]
   */
  changeOrder(order: string, node  = false) {
    this.configuration.adjMatrix.sortKey = order;
    return this.model.changeOrder(order,node);
  }
}

window.controller = new Controller();
