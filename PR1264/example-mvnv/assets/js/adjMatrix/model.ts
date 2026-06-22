
class Model {
  /*
  The Model handels the loading, sorting, and ordering of the data.
   */
  private data: any;
  private matrix: any;
  private nodes: any;
  private edges: any;
  private order: any;
  private controller: any;
  private idMap: any;
  private orderType: string;
  public graph: any;
  private scalarMatrix: any;
  private datumID: string;
  private provenance: any;
  private app: any;

  constructor(controller: any) {
    this.controller = controller;
    this.datumID = controller.datumID;

    //console.log(controller,controller.configuration,controller.configuration.graphFiles[controller.configuration.loadedGraph])
    d3.json(controller.configuration.graphFiles[controller.configuration.loadedGraph]).then((data: any) => {
      this.graph = data;
      this.edges = data.links;

      //setPanelValuesFromFile(controller.configuration, data);
      this.matrix = [];
      this.scalarMatrix = [];
      /*
      d3.request('../../assets/adj-matrix/alphabeticalSort.svg').mimeType("image/svg+xml").get(function(error, svg) {
        console.log(svg,error)
        this.alphabeticalSortSvg = svg;
      })

      d3.request('../../assets/adj-matrix/categoricalSort.svg').mimeType("image/svg+xml").get(function(error, svg) {
        this.categoricalSortSvg = svg;
      })*/

      // = "M401,330.7H212c-3.7,0-6.6,3-6.6,6.6v116.4c0,3.7,3,6.6,6.6,6.6h189c3.7,0,6.6-3,6.6-6.6V337.3 C407.7,333.7,404.7,330.7,401,330.7z M280,447.3c0,2-1.6,3.6-3.6,3.6h-52.8v-18.8h52.8c2,0,3.6,1.6,3.6,3.6V447.3z M309.2,417.9c0,2-1.6,3.6-3.6,3.6h-82v-18.8h82c2,0,3.6,1.6,3.6,3.6V417.9z M336.4,388.4c0,2-1.6,3.6-3.6,3.6H223.6v-18.8h109.2c2,0,3.6,1.6,3.6,3.6V388.4z M367.3,359c0,2-1.6,3.6-3.6,3.6H223.6v-18.8h140.1c2,0,3.6,1.6,3.6,3.6V359z";

      this.icons = {
        'quant': {
          'd': "M401,330.7H212c-3.7,0-6.6,3-6.6,6.6v116.4c0,3.7,3,6.6,6.6,6.6h189c3.7,0,6.6-3,6.6-6.6V337.3C407.7,333.7,404.7,330.7,401,330.7z M280,447.3c0,2-1.6,3.6-3.6,3.6h-52.8v-18.8h52.8c2,0,3.6,1.6,3.6,3.6V447.3z M309.2,417.9c0,2-1.6,3.6-3.6,3.6h-82v-18.8h82c2,0,3.6,1.6,3.6,3.6V417.9z M336.4,388.4c0,2-1.6,3.6-3.6,3.6H223.6v-18.8h109.2c2,0,3.6,1.6,3.6,3.6V388.4z M367.3,359c0,2-1.6,3.6-3.6,3.6H223.6v-18.8h140.1c2,0,3.6,1.6,3.6,3.6V359z"
        },
        'alphabetical': {
          'd': "M401.1,331.2h-189c-3.7,0-6.6,3-6.6,6.6v116.4c0,3.7,3,6.6,6.6,6.6h189c3.7,0,6.6-3,6.6-6.6V337.8C407.7,334.2,404.8,331.2,401.1,331.2z M223.7,344.3H266c2,0,3.6,1.6,3.6,3.6v11.6c0,2-1.6,3.6-3.6,3.6h-42.3V344.3z M223.7,373H300c2,0,3.6,1.6,3.6,3.6v11.6c0,2-1.6,3.6-3.6,3.6h-76.3V373.7z M263.6,447.8c0,2-1.6,3.6-3.6,3.6h-36.4v-18.8H260c2,0,3.6,1.6,3.6,3.6V447.8z M321.5,418.4c0,2-1.6,3.6-3.6,3.6h-94.2v-18.8h94.2c2,0,3.6,1.6,3.6,3.6V418.4z M392.6,449.5h-34.3V442l22.6-27h-21.7v-8.8h33.2v7.5l-21.5,27h21.7V449.5z M381,394.7l-3.7,6.4l-3.7-6.4h2.7v-14.6h2v14.6H381z M387,380l-3.4-9.7h-13.5l-3.3,9.7h-10.2l15.8-43.3h9l15.8,43.3H387z M371.8,363.4H382l-5.1-15.3L371.8,363.4z"
        },
        'categorical': {
          'd': "M401,330.7H212c-3.7,0-6.6,3-6.6,6.6v116.4c0,3.7,3,6.6,6.6,6.6h189c3.7,0,6.6-3,6.6-6.6V337.4C407.7,333.7,404.7,330.7,401,330.7z M272.9,374.3h-52.4v-17.1h52.4V374.3z M272.9,354h-52.4v-17h52.4V354z M332.1,414.9h-52.4v-17h52.4V414.9z M332.1,394.6h-52.4v-17h52.4V394.6z M394.8,456.5h-52.4v-17h52.4V456.5z M394.8,434.9h-52.4v-17h52.4V434.9z"
        },
        'cellSort': {
          'd': "M150.2,0H15.8C7.1,0,0,7.1,0,15.8v149.3c0,8.8,7.1,15.8,15.8,15.8h134.3c8.8,0,15.8-7.1,15.8-15.8V15.8C166,7.1,158.9,0,150.2,0z M82.7,136.8L27.5,54.2l111-1L82.7,136.8z"
        }

      }
      this.nodes = data.nodes
      this.populateSearchBox();
      this.idMap = {};

      // sorts adjacency matrix, if a cluster method, sort by shortname, then cluster later
      /*let clusterFlag = '';
      if (this.controller.configuration.adjMatrix.sortKey in ['clusterBary', 'clusterLeaf', 'clusterSpectral']) {
        clusterFlag = this.orderType;
        this.orderType = 'shortName';//this.controller.configuration.adjMatrix.sortKey;

      } else {
      }
      this.controller.configuration.adjMatrix.sortKey = 'continent'
      this.controller.configuration.secondarySortKey = "statuses_count"
      if(this.controller.configuration.secondarySortKey){
        //this.controller.configuration.secondarySortKey = 'Tweets'
        this.order = this.changeOrder(this.controller.configuration.secondarySortKey);
      } else {*/
      let initalOrderType = this.controller.configuration.adjMatrix.sortKey;

        this.order = this.changeOrder('id');
      //}


      // sorts quantitative by descending value, sorts qualitative by alphabetical
      //if (!this.isQuant(this.orderType)) {
      //  this.nodes = this.nodes.sort((a, b) => a[this.orderType].localeCompare(b[this.orderType]));
      //} else {
      //this.nodes = this.nodes.sort((a, b) => { return b['id'] - a['id']; });
      //}

      this.nodes.forEach((node, index) => {
        node.index = index;
        this.idMap[node.id] = index;
      })

      this.controller = controller;
      if (initalOrderType == "clusterSpectral" || initalOrderType == "clusterBary" || initalOrderType == "clusterLeaf") {
        this.processData();
      }
      //sort again based on sortkey
      //this.orderType = clusterFlag;
      this.order = this.changeOrder(initalOrderType);
      this.nodes = this.sortNodesOnArray(this.nodes,this.order);
      this.nodes.forEach((node, index) => {
        node.index = index;
        this.idMap[node.id] = index;
      })
      this.processData();

      //

      this.controller.loadData(this.nodes, this.edges, this.matrix);
    })
  }

  /**
   * [sortNodesOnArray description]
   * @param  arrayOne [Array to sort]
   * @param  arrayTwo [Array to base sorting off of]
   * @return          [description]
   */
  sortNodesOnArray(arrayOne,arrayTwo){
    let sortedArrayOne = new Array(arrayOne);
    let counter = 0;
    arrayTwo.map(index=>{
      sortedArrayOne[counter] = arrayOne[index];
      counter++;
    })
    return sortedArrayOne;
  }

  /**
   * Determines if the attribute is quantitative
   * @param  attr [string that corresponds to attribute type]
   * @return      [description]
   */
  isQuant(attr) {
    // if not in list
    if (!Object.keys(this.controller.configuration.attributeScales.node).includes(attr)) {
      return false;
    } else if (this.controller.configuration.attributeScales.node[attr].range === undefined) {
      return true;
    } else {
      return false;
    }
  }


  populateSearchBox() {

  }

  /**
   * returns an object containing the current provenance state.
   * @return [the provenance state]
   */
  getApplicationState() {
    return {
      currentState: () => this.provenance.current().getState();
    };
  }

  /**
   * Initializes the provenance library and sets observers.
   * @return [none]
   */
  setUpProvenance() {
    const initialState = {
      workerID: workerID, // workerID is a global variable
      taskID: this.controller.tasks[this.controller.taskNum],
      nodes: '',//array of nodes that keep track of their position, whether they were softSelect or hardSelected;
      search: '', //field to store the id of a searched node;
      startTime: Date.now(), //time this provenance graph was created and the task initialized;
      endTime: '', // time the submit button was pressed and the task ended;
      time: Date.now(), //timestamp for the current state of the graph;
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
        search: {},
        previousMouseovers: []
      }
    };

    const provenance = Trrack.initProvenance(initialState, false);

    this.provenance = provenance;

    const app = this.getApplicationState();
    this.app = app;


    // creates the document with the name and worker ID
    pushProvenance(app.currentState());

    let columnElements = ['topoCol'];
    let rowElements = ['topoRow', 'attrRow']

    let elementNamesFromSelection = {
      cellcol: rowElements.concat(columnElements),
      colLabel: rowElements.concat(columnElements).concat(['colLabel']),
      rowLabel: rowElements.concat(columnElements).concat(['rowLabel']),
      attrRow: rowElements.concat(['rowLabel']),
      cellrow: rowElements.concat(columnElements),
      neighborSelect: rowElements,
      answerBox: rowElements.concat(columnElements),
      search: rowElements.concat(columnElements)
    }

    function classAllHighlights(state) {

      let clickedElements = new Set();
      let answerElements = new Set();
      let neighborElements = new Set();

      // go through each interacted element, and determine which rows/columns should
      // be highlighted due to it's interaction
      for (let selectionType in state.selections) {
        if(selectionType == 'previousMouseovers') continue;
        for (let index in elementNamesFromSelection[selectionType]) {
          let selectionElement = elementNamesFromSelection[selectionType][index];

          for (let node in state.selections[selectionType]) {
            if (selectionType == 'answerBox') {
              answerElements.add('#' + selectionElement + node)
            } else if (selectionType == 'neighborSelect') {
              neighborElements.add('#' + selectionElement + node)
            } else {

              // if both in attrRow and rowLabel, don't highlight element
              if (selectionType == 'attrRow' || selectionType == 'rowLabel') {
                if (node in state.selections['attrRow'] && node in state.selections['rowLabel']) continue;
              }

              clickedElements.add('#' + selectionElement + node)
            }
          }

        }
      }

      let clickedSelectorQuery = Array.from(clickedElements).join(',')
      let answerSelectorQuery = Array.from(answerElements).join(',')
      let neighborSelectQuery = Array.from(neighborElements).join(',')

      clickedSelectorQuery != [] ? d3.selectAll(clickedSelectorQuery).classed('clicked', true) : null;
      answerSelectorQuery != [] ? d3.selectAll(answerSelectorQuery).classed('answer', true) : null;
      neighborSelectQuery != [] ? d3.selectAll(neighborSelectQuery).classed('neighbor', true) : null;

      return;
    }

    function setUpObservers() {
      let updateHighlights = (state) => {
        d3.selectAll('.clicked').classed('clicked', false);
        d3.selectAll('.answer').classed('answer', false);
        d3.selectAll('.neighbor').classed('neighbor', false);

        classAllHighlights(state);
      };

      let updateCellClicks = (state) => {
        let cellNames = [];
        Object.keys(state.selections.cellcol).map(key => {
          let names = state.selections.cellcol[key];
          names.map(name => {
            let cellsNames = splitCellNames(name);
            cellNames = cellNames.concat(cellsNames)
          })

          //names.map(name=>{
          //})
        })
        let cellSelectorQuery = '#' + cellNames.join(',#')
        // if no cells selected, return
        d3.selectAll('.clickedCell').classed('clickedCell', false);
        if (cellSelectorQuery == '#') return;
        d3.selectAll(cellSelectorQuery).selectAll('.baseCell').classed('clickedCell', true)

      }

      let updateAnswerBox = (state) => {
        window.controller.configuration.adjMatrix['toggle'] ? window.controller.view.updateAnswerToggles(state) : window.controller.view.updateCheckBox(state);
        //window.controller.view.updateAnswerToggles(state)
        let answer = [];
        for (let i = 0; i < window.controller.model.nodes.length; i++) {
          if (window.controller.model.nodes[i][this.controller.view.datumID] in state.selections.answerBox) {
            answer.push(window.controller.model.nodes[i]);
          }
        }
        updateAnswer(answer);


      }

      let updateSearchCells = (state)=>{
        let cellNames = [];
        Object.keys(state.selections.search).map(key => {

          //let names = state.selections.search[key];
          cellNames.push('cell'+key.toString()+'_'+key.toString())
          /*names.map(name => {
            let cellsNames = splitCellNames(name);
            cellNames = cellNames.concat(cellsNames)
          })*/

          //names.map(name=>{
          //})
        })
        let cellSelectorQuery = '#' + cellNames.join(',#')
        // if no cells selected, return
        d3.selectAll('.searchCell').classed('searchCell', false);
        if (cellSelectorQuery == '#') return;
        d3.selectAll(cellSelectorQuery).selectAll('.baseCell').classed('searchCell', true)
      }

      let sortObserver = (state)=>{
        window.controller.view.sort(state.sortKey);
      }
      provenance.addObserver(["selections","attrRow"], updateHighlights)
      provenance.addObserver(["selections", "rowLabel"], updateHighlights)
      provenance.addObserver(["selections", "colLabel"], updateHighlights)
      provenance.addObserver(["selections", "cellcol"], updateHighlights)
      provenance.addObserver(["selections", "cellrow"], updateHighlights)
      provenance.addObserver(["selections", "neighborSelect"], updateHighlights)
      provenance.addObserver(["selections", "cellcol"], updateCellClicks)

      provenance.addObserver(["selections", "search"], updateHighlights)
      provenance.addObserver(["selections", "search"], updateSearchCells)

      provenance.addObserver(["selections", "answerBox"], updateHighlights)
      provenance.addObserver(["selections", "answerBox"], updateAnswerBox)
      provenance.addObserver(["sortKey"], sortObserver)

      const urlParams = new URLSearchParams(window.location.search);

      if(urlParams.get("taskID") && urlParams.get("participantID"))
      {
        readFire.connect();
        let prom = readFire.readTask(urlParams.get("participantID"), urlParams.get("taskID"));

        prom.then((graph) => {
          provenance.importProvenanceGraph(JSON.stringify(graph));

          provenance.goToNode(provenance.graph().nodes[provenance.graph().root].children[0])

          window.onmessage = function(e){
            console.log("message recieved!", e.data);
            console.log(provenance.graph());
            if (provenance.graph().nodes[e.data]) {
                provenance.goToNode(e.data);
            }
            console.log(provenance.graph());

          };
        });
      }
    }

    setUpObservers();

    return [app, provenance];
  }




  reload() {
    this.controller.loadData(this.nodes, this.edges, this.matrix);
  }
  /**
   * [changeInteractionWrapper description]
   * @param  nodeID ID of the node being changed with
   * @param  node   nodes corresponding to the element class interacted with (from d3 select nodes[i])
   * @param  interactionType class name of element interacted with
   * @return        [description]
   */
  generateSortAction(sortKey) {

  }


  /**
   *   Determines the order of the current nodes
   * @param  type A string corresponding to the attribute screen_name to sort by.
   * @return      A numerical range in corrected order.
   */
  changeOrder(type: string, node: boolean = false) {
      let val = this.sortObserver(type,node);
      // trigger sort
      return val;


  }

  sortObserver(type: string, node: boolean = false){
    let order;
    this.orderType = type;
    this.controller.configuration.adjMatrix.sortKey = type;

    if (type == "clusterSpectral" || type == "clusterBary" || type == "clusterLeaf") {
      this.edges= this.edges.filter(edge=>{
        return edge.source !== undefined && edge.target !== undefined;
      })

      var graph = reorder.graph()
        .nodes(this.nodes)
        .links(this.edges)
        .init();

      if (type == "clusterBary") {
        var barycenter = reorder.barycenter_order(graph);
        order = reorder.adjacent_exchange(graph, barycenter[0], barycenter[1])[1];
      } else if (type == "clusterSpectral") {
        order = reorder.spectral_order(graph);
      } else if (type == "clusterLeaf") {
        let mat = reorder.graph2mat(graph);
        order = reorder.optimal_leaf_order()(mat);
      }

      //

      //order = reorder.optimal_leaf_order()(this.scalarMatrix);
    }
    else if (this.orderType == 'edges') {
      order = d3.range(this.nodes.length).sort((a, b) => this.nodes[b][type].length - this.nodes[a][type].length);
    } else if (this.orderType == 'id'){
      order = d3.range(this.nodes.length).sort((a, b) => { return this.nodes[b][type] - this.nodes[a][type]; });
    } else if (node == true) {
      //order = d3.range(this.nodes.length).sort((a, b) => this.nodes[a]['shortName'].localeCompare(this.nodes[b]['shortName']));
      order = d3.range(this.nodes.length).sort((a, b) => { return this.nodes[b]['neighbors'].includes(parseInt(type)) - this.nodes[a]['neighbors'].includes(parseInt(type)); });
    }
    else if (!this.isQuant(this.orderType)) {// == "screen_name" || this.orderType == "name") {
      order = d3.range(this.nodes.length).sort((a, b) => this.nodes[a][this.orderType].localeCompare(this.nodes[b][this.orderType]));
    } else {
      order = d3.range(this.nodes.length).sort((a, b) => { return this.nodes[b][type] - this.nodes[a][type]; });
    }

    this.order = order;
    return order;

  }
  private maxTracker: any;
  /**
   * [processData description]
   * @return [description]
   */
  processData() {
    // generate a hashmap of id's?
    // Set up node data
    this.nodes.forEach((rowNode, i) => {
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

      //Problem: ID isn't set correctly for edges, causes highlights to be off

      /* matrix used for edge attributes, otherwise should we hide */
      this.matrix[i] = this.nodes.map((colNode) => { return { cellName: 'cell' + rowNode[this.datumID] + '_' + colNode[this.datumID], correspondingCell: 'cell' + colNode[this.datumID] + '_' + rowNode[this.datumID], rowid: rowNode[this.datumID], colid: colNode[this.datumID], x: colNode.index, y: rowNode.index, count: 0, z: 0, interacted: 0, retweet: 0, mentions: 0 }; });
      this.scalarMatrix[i] = this.nodes.map(function(colNode) { return 0; });

    });
     let checkEdge = (edge)=> {
      if (edge.source == undefined || edge.target == undefined) return false;

      if (typeof edge.source !== "number"){
        if(edge.source.id){
          edge.source = this.idMap[edge.source.id];
        } else {
          return false
        }
      }
      if (typeof edge.target !== "number"){
        if(edge.target.id){
          edge.target = this.idMap[edge.target.id];
        } else {
          return false
        }
      }
      //if (typeof edge.target !== "number") return false;
      return true
    }

    this.edges = this.edges.filter(checkEdge);
    this.maxTracker = { 'reply': 0, 'retweet': 0, 'mentions': 0 }
    // Convert links to matrix; count character occurrences.
    this.edges.forEach((link) => {
      let addValue = 1;
      let sourceIndex = this.processedData ? link.source : this.idMap[link.source];
      let targetIndex = this.processedData ? link.target : this.idMap[link.target];
      this.matrix[sourceIndex][targetIndex][link.type] += link.count;

      this.scalarMatrix[sourceIndex][targetIndex] += link.count;

      /* could be used for varying edge types */
      //this.maxTracker = { 'reply': 3, 'retweet': 3, 'mentions': 2 }
      this.matrix[sourceIndex][targetIndex].z += addValue;
      this.matrix[sourceIndex][targetIndex].count += 1;
      // if not directed, increment the other values
      if (!this.controller.configuration.isDirected) {
        this.matrix[targetIndex][sourceIndex].z += addValue;
        this.matrix[targetIndex][sourceIndex][link.type] += link.count;
        this.scalarMatrix[targetIndex][sourceIndex] += link.count;
      }
        link.source = sourceIndex;
        link.target = targetIndex;


    });
    this.processedData = true;
  }

  getOrder() {
    return this.order;
  }

  /**
   * Returns the node data.
   * @return Node data in JSON Array
   */
  getNodes() {
    return this.nodes;
  }

  /**
   * Returns the edge data.
   * @return Edge data in JSON Array
   */
  getEdges() {
    return this.edges;
  }

}
