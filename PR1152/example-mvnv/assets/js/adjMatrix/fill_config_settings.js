
function setPanelValuesFromFile(config, graph) {
  function isQuant(attr){
    return Object.keys(config.attributeScales.node).includes(attr) && config.attributeScales.node[attr].range === undefined;
  }

  function isCategorical(attr){
    return Object.keys(config.attributeScales.node).includes(attr) && config.attributeScales.node[attr].range !== undefined;
  }
  //create internal dictionary of defaultDomains for each attribute;
  var defaultDomains = { node: {}, edge: {} };

  [['node', 'nodes'], ['edge', 'links']].map((node_edge) => {
    Object.keys(config.attributeScales[node_edge[0]]).map((attr) => {
      let graphElements = graph[node_edge[1]];
      //use d3.extent for quantitative attributes
      if (typeof graphElements[0][attr] === typeof 2) {
        defaultDomains[node_edge[0]][attr] = d3.extent(
          graphElements,
          (n) => n[attr]
        );
      } else {
        //use .filter to find unique categorical values
        defaultDomains[node_edge[0]][attr] = graphElements
          .map((n) => n[attr])
          .filter((value, index, self) => self.indexOf(value) === index);
      }

      //set domainValues in config.attributeScales if there are none
      config.attributeScales[node_edge[0]][attr].domain =
        config.attributeScales[node_edge[0]][attr].domain ||
        defaultDomains[node_edge[0]][attr];
    });
  });

  //ser values for radioButtons
  d3.selectAll('input[type=\'radio\']').property('checked', function() {

    if (this.name === 'graphSize'){
      return config[this.name] === this.value;
    } else {
      return config[this.name] === eval(this.value);
    }

  });

  d3.select('#fontSlider').on('input', function() {
    d3.select('#fontSliderValue').text(this.value);
    config.nodeLink.labelSize[config.graphSize] = eval(this.value);
  });

  d3.select('#fontSlider').property(
    'value',
    config.nodeLink.labelSize[config.graphSize]
  );
  d3.select('#fontSliderValue').text(config.nodeLink.labelSize[config.graphSize]);

  d3.select('#fontSlider').on('change', function(val) {
    console.log(val, this,this.value,d3.selectAll('text'));
    d3.selectAll('.nodeLabel').style('font-size',this.value);
  });

  d3.select('#markerSize').property(
    'value',
    config.nodeLink.nodeWidth[config.graphSize] +
      ',' +
      config.nodeLink.nodeHeight[config.graphSize]
  );

  d3.select('#markerSize').on('change', function() {
    let markerSize = this.value.split(',');
    config.nodeLink.nodeWidth[config.graphSize] = eval(markerSize[0]);
    config.nodeLink.nodeHeight[config.graphSize] = eval(markerSize[1]);

  });

  //set Panel Values

  d3.selectAll('input[name=\'isDirected\']')
    .filter(function() {
      return d3.select(this).property('value') === config.isDirected.toString();
    })
    .attr('checked', 'checked');

  d3.selectAll('input[name=\'isMultiEdge\']')
    .filter(function() {
      return (
        d3.select(this).property('value') === config.isMultiEdge.toString()
      );
    })
    .attr('checked', 'checked');


  d3.selectAll('input[type=\'radio\']').on('change', async function() {
    config[this.name] =
      this.name === 'graphSize' ? this.value : eval(this.value);

    let file =
      config.graphSize +
      (config.isDirected ? '_directed' : '_undirected') +
      (config.isMultiEdge ? '_multiEdge' : '_singleEdge');

    config.loadedGraph = file;

    setDisabledRadioButtons();

    window.controller.reload();

  });


  let setDisabledRadioButtons  = function (){

      //cannot have directed graph that is of single edge type, so disable that if it is the case;
  d3.selectAll('input[name=\'isDirected\']').property('disabled', function() {
    return (
      eval(d3.select(this).property('value')) === true &&
      config.isMultiEdge === false
    );
  });

    //cannot have directed graph that is of single edge type, so disable that if it is the case;
  d3.selectAll('input[name=\'isMultiEdge\']').property('disabled', function() {
    return (
      eval(d3.select(this).property('value')) === false &&
      config.isDirected === true
    );
  });


  };

  setDisabledRadioButtons();

  d3.select('#renderBarsCheckbox').property('checked', config.adjMatrixValues.edgeBars);

  //get attribute list from baseConfig file;
  let nodeAttrs = Object.entries(config.attributeScales.node);
  let edgeAttrs = Object.entries(config.attributeScales.edge);

  let menuItems = [
    {
      name: 'nodeFillSelect',
      type: typeof 'string',
      configAttr: 'nodeFillAttr'
    },
    {
      name: 'nodeSizeSelect',
      type: typeof 2,
      configAttr: 'nodeSizeAttr'
    },
    {
      name: 'edgeStrokeSelect',
      type: typeof 'string',
      configAttr: 'edgeStrokeAttr'
    },
    {
      name: 'edgeWidthSelect',
      type: typeof 2,
      configAttr: 'edgeWidthAttr'
    },
    // {
    //   name: "nodeQuantSelect",
    //   type: typeof 2,
    //   configAttr: "quantAttrs"
    // },
    {
      name: 'nodeCatSelect',
      type: typeof 'string',
      configAttr: 'catAttrs'
    },
    {
      name: 'nodeQuantAttributes',
      type: typeof 2,
      configAttr: undefined
    }
  ];

  menuItems.map((m) => {
    let item = d3.select('#' + m.name);

    let isNode = m.name.includes('node');
    let isCategorical = m.type === typeof 'string';

    let menuOptions = isNode ? nodeAttrs : edgeAttrs;
    let attrScales = isNode
      ? config.attributeScales.node
      : config.attributeScales.edge;

    //filter to only those that match the type
    menuOptions = menuOptions
      .filter((option) => {
        return (
          (option[1].range && isCategorical) ||
          (!option[1].range && !isCategorical)
        );
      })
      .map((d) => {
        return { attr: d[0], domain: d[1].domain };
      });


    //update domain box only for quant attributes domain input boxes
    d3.select('#' + m.name)
      .select('.input')
      .property(
        'value',
        () => '[' + attrScales[config.nodeLink[m.configAttr]].domain + ']'
      );

    let selectMenu = item
      .select('select')
      .selectAll('option')
      .data(menuOptions);

    let selectEnter = selectMenu.enter().append('option');

    selectMenu.exit().remove();

    selectMenu = selectEnter.merge(selectMenu);

    selectMenu.attr('value', (d) => d.attr).text((d) => d.attr);

    selectMenu
      .selectAll('option')
      .filter((d, i) => config.nodeLink[m.configAttr] === d.attr)
      .property('selected', true);

    //  //Set up callbacks for the config panel on the left.
    item.select('select').on('change', function() {
      console.log('value is ', this.value);
      createHist(
        this.value,
        d3.select('#' + m.name + '_histogram'),
        isNode ? graph.nodes : graph.links,
        isNode,true,config,graph
      );
    });

    //set selected element according to config file;

    //add svgs for quant attr selectors
    if (m.type !== typeof 'string') {
      let newSvg = item.selectAll('svg').data([0]);

      let svgEnter = newSvg.enter().append('svg');

      newSvg = svgEnter.merge(newSvg);

      newSvg.attr('id', m.name + '_histogram');

      let attr = m.configAttr ? config.nodeLink[m.configAttr] : config.nodeAttributes.filter(isQuant)[0];
      createHist(attr, newSvg, isNode ? graph.nodes : graph.links, isNode,config,graph);
    }
  });

  //set behavior for bar selections
  let sortSelect = d3.select('#order').select('ul');



  let barAttrs = config.nodeAttributes.filter(isQuant);
  let catAttrs = config.nodeAttributes.filter(isCategorical);

  let section = d3.select('#nodeQuantSelect').select('ul');

  //filter to only those that are quantitative
  attrOptions = nodeAttrs
    .filter((option) => {
      return !option[1].range;
    })
    .map((d) => {
      return { attr: d[0], domain: d[1].domain };
    });

  let fields = section.selectAll('.field').data(attrOptions);

  let fieldsEnter = fields
    .enter()
    .append('div')
    .attr('class', 'field');

  fieldsEnter
    .append('input')
    .attr('class', 'is-checkradio')
    .attr('type', 'checkbox');

  fieldsEnter.append('label');

  fieldsEnter
    .append('div')
    .attr('class', 'control is-inline-flex')
    .append('input')
    .attr('class', 'input domain')
    .attr('type', 'text')
    .attr('placeholder', '[min,max]');

  fields.exit().remove();

  fields = fieldsEnter.merge(fields);

  fields.select('.domain').property('value', (d) => '[' + d.domain + ']');

  fields
    .select('.is-checkradio')
    .attr('id', (d) => d.attr + '-checkbox')
    .attr('name', (d) => d.attr + '-checkbox')
    .property('checked', (d) => {
      return barAttrs.includes(d.attr) ? 'checked' : false;
    })
    .on('change', function(d) {
      let includeAttr = d3.select(this).property('checked');
      if (includeAttr) {
        config.nodeAttributes.push(d.attr);

        //call createHist for that attribute
        d3.select('#nodeQuantAttributes')
          .selectAll('option')
          .filter((opt, i) => {
            return d.attr === opt.attr;
          })
          .property('selected', true);

        createHist(
          d.attr,
          d3.select('#nodeQuantAttributes_histogram'),
          graph.nodes,true,config,graph
        );

      } else {
        config.nodeAttributes = config.nodeAttributes.filter((el) => el !== d.attr);

      }
      window.controller.reload();
    });

  fields
    .select('label')
    .attr('id', (d) => d.attr + '-label')
    .attr('for', (d) => d.attr + '-checkbox')
    .text((d) => d.attr);

  fields
    .select('.domain')
    .attr('id', (d) => d.attr + '-domain')
    .on('change', function(d) {
      if (this.value) {
        config.attributeScales.node[d.attr].domain = eval(this.value);
      } else {
        // if value is empty, use 'default ranges';
        this.value = '[' + defaultDomains.node[d.attr] + ']';
        config.attributeScales.node[d.attr].domain = eval(this.value);
      }

      //

      //call createHist for that attribute
      d3.select('#nodeQuantAttributes')
        .selectAll('option')
        .filter((opt, i) => {
          return d.attr === opt.attr;
        })
        .property('selected', true);

      createHist(
        d.attr,
        d3.select('#nodeQuantAttributes_histogram'),
        graph.nodes,true,config,graph
      );
    });

  let catSections = d3.select('#nodeCatSelect').select('ul');

  //filter to only those that are categorical
  attrOptions = nodeAttrs
    .filter((option) => {
      return option[1].range;
    })
    .map((d) => d[0]);

  fields = catSections.selectAll('.field').data(attrOptions);

  fieldsEnter = fields
    .enter()
    .append('div')
    .attr('class', 'field');

  fieldsEnter
    .append('input')
    .attr('class', 'is-checkradio')
    .attr('type', 'checkbox');

  fieldsEnter.append('label');

  fields.exit().remove();

  fields = fieldsEnter.merge(fields);

  fields
    .select('.is-checkradio')
    .attr('id', (d) => d + '-checkbox')
    .attr('name', (d) => d + '-checkbox')
    .property('checked', (d) => {
      return catAttrs.includes(d) ? 'checked' : false;
    })
    .on('change', function(d) {
      let includeAttr = d3.select(this).property('checked');
      if (includeAttr) {
        config.nodeAttributes.push(d);

      } else {
        config.nodeAttributes = config.nodeAttributes.filter((el) => el !== d);

      }
      window.controller.reload();
    });

  fields
    .select('label')
    .attr('id', (d) => d + '-label')
    .attr('for', (d) => d + '-checkbox')
    .text((d) => d);

  d3.select('#nodeFillSelect')
    .select('select')
    .on('change', function() {
      config.nodeLink.nodeFillAttr = this.value;
      config.nodeLink.drawBars = false;

      d3.select('#renderBarsCheckbox').property('checked', false);

    });

  d3.select('#nodeStrokeSelect')
    .select('select')
    .on('change', function() {
      config.nodeStroke = this.value;
      // config.nodeLink.drawBars = false;

      // d3.select('#renderBarsCheckbox').property('checked', false)

    });

  d3.select('#nodeSizeSelect')
    .select('select')
    .on('change', function() {
      config.nodeLink.nodeSizeAttr = this.value;
      config.nodeLink.drawBars = false;

      d3.select('#renderBarsCheckbox').property('checked', false);

      createHist(
        this.value,
        d3.select('#nodeSizeSelect_histogram'),
        graph.nodes,true,config,graph
      );

      d3.select('#nodeSizeSelect')
        .select('input')
        .property(
          'value',
          () =>
            '[' + config.attributeScales.node[config.nodeLink.nodeSizeAttr].domain + ']'
        );


    });

  d3.select('#nodeSizeSelect')
    .selectAll('option')
    .property('selected', (d) => d.attr === config.nodeLink.nodeSizeAttr);

  d3.select('#nodeSizeSelect')
    .select('input')
    .on('change', function() {
      console.log('d is ', config.nodeLink.nodeSizeAttr);
      if (this.value) {
        config.attributeScales.node[config.nodeLink.nodeSizeAttr].domain = eval(
          this.value
        );
      } else {
        // if value is empty, use 'default ranges';
        this.value = '[' + defaultDomains.node[config.nodeLink.nodeSizeAttr] + ']';
        config.attributeScales.node[config.nodeLink.nodeSizeAttr].domain = eval(
          this.value
        );
      }

      console.log(
        'new domain is',
        config.attributeScales.node[config.nodeLink.nodeSizeAttr]
      );

      //also update the string for the corresponding domain input above
      d3.select('#' + config.nodeLink.nodeSizeAttr + '-domain').property(
        'value',
        () =>
          '[' + config.attributeScales.node[config.nodeLink.nodeSizeAttr].domain + ']'
      );

      createHist(
        config.nodeLink.nodeSizeAttr,
        d3.select('#nodeSizeSelect_histogram'),
        graph.nodes,true,config,graph
      );
      window.controller.reload();


    });

  d3.select('#renderBarsCheckbox').on('input', function() {
    config.adjMatrixValues.edgeBars = d3.select(this).property('checked');
    window.controller.reload();

  });

  d3.select('#edgeWidthScale').on('change', function() {
    if (this.value) {
      config.attributeScales.edge[config.nodeLink.edgeWidthAttr].domain = eval(
        this.value
      );
    } else {
      // if value is empty, use 'default ranges';
      this.value = '[' + defaultDomains.edge[config.nodeLink.edgeWidthAttr] + ']';
      config.attributeScales.edge[config.nodeLink.edgeWidthAttr].domain =
        defaultDomains.edge[config.nodeLink.edgeWidthAttr];
    }
    createHist(
      config.nodeLink.edgeWidthAttr,
      d3.select('#edgeWidthSelect_histogram'),
      graph.links,
      false,config,graph
    );
    function isQuant(attr){
      return Object.keys(config.attributeScales.node).includes(attr) && config.attributeScales.node[attr].range === undefined;
    }

    function isCategorical(attr){
      return Object.keys(config.attributeScales.node).includes(attr) && config.attributeScales.node[attr].range !== undefined;
    }


  });



}


function createHist(attrName, svgSelection, data, isNode = true,config,graph) {
  function isQuant(attr){
    return Object.keys(config.attributeScales.node).includes(attr) && config.attributeScales.node[attr].range === undefined;
  }

  function isCategorical(attr){
    return Object.keys(config.attributeScales.node).includes(attr) && config.attributeScales.node[attr].range !== undefined;
  }
  let nBins = 10;

  let margin = { top: 20, right: 10, bottom: 50, left: 20 },
    width = 300 - margin.left - margin.right,
    height = 200 - margin.top - margin.bottom;
    console.log(config,graph);
  let histHeight = height;
  domain = isNode
    ? config.attributeScales.node[attrName].domain
    : config.attributeScales.edge[attrName].domain;

  var x = d3
    .scaleLinear()
    .domain(domain)
    .range([0, width])
    .clamp(true)
    .nice(nBins);

  // y scale for histogram
  var y = d3.scaleLinear().range([histHeight, 0]);

  var barColors = d3
    .scaleOrdinal()
    .range([
      '#ffc388',
      '#ffb269',
      '#ffa15e',
      '#fd8f5b',
      '#f97d5a',
      '#f26c58',
      '#e95b56',
      '#e04b51',
      '#d53a4b',
      '#c92c42',
      '#bb1d36',
      '#ac0f29',
      '#9c0418',
      '#8b0000'
    ]);

  // set parameters for histogram
  var histogram = d3
    .histogram()
    .value(function(d) {
      return d[attrName];
    })
    .domain(x.domain())
    .thresholds(x.ticks(nBins));

  var svg = svgSelection
    .attr('width', width + margin.left + margin.right)
    .attr('height', height + margin.top + margin.bottom);

  var hist = svg.selectAll('.histogram').data([0]);

  let histEnter = hist
    .enter()
    .append('g')
    .attr('class', 'histogram')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

  hist.exit().remove();

  hist = histEnter.merge(hist);

  ////////// load data //////////

  // group data for bars
  var bins = histogram(data);

  // console.log('bins', bins)

  // y domain based on binned data
  y.domain([
    0,
    d3.max(bins, function(d) {
      return d.length;
    })
  ]);

  barColors.domain(bins.map((b) => b.length).sort());

  var bar = hist.selectAll('.barGroup').data(bins);

  barEnter = bar
    .enter()
    .append('g')
    .attr('class', 'barGroup');

  barEnter
    .append('rect')
    .attr('class', 'bar')
    .attr('x', 1);

  barEnter
    .append('text')
    .attr('dy', '-.1em')
    // .attr("y", "0")
    .attr('text-anchor', 'middle')
    .style('fill', 'black');

  bar.exit().remove();

  bar = barEnter.merge(bar);

  bar.attr('transform', function(d) {
    return 'translate(' + x(d.x0) + ',' + y(d.length) + ')';
  });

  bar
    .select('rect')
    .attr('width', function(d) {
      return x(d.x1) - x(d.x0);
    })
    .attr('height', function(d) {
      return histHeight - y(d.length);
    });
    // .attr("fill", function(d) {
    //   return barColors(d.length);
    // });

  bar
    .select('text')
    .attr('x', function(d) {
      return (x(d.x1) - x(d.x0)) / 2;
    })
    .text((d) => (d.length > 0 ? d.length : ''));

  ////////// slider //////////

  var currentValue = 0;

  var slider = svg.selectAll('.slider').data([0]);

  let sliderEnter = slider
    .enter()
    .append('g')
    .attr('class', 'slider')
    .attr(
      'transform',
      'translate(' + margin.left + ',' + (margin.top + histHeight) + ')'
    );

  sliderEnter
    .insert('g')
    .attr('class', 'ticks')
    .attr('transform', 'translate(0,' + 15 + ')');

  slider.exit().remove();

  slider = sliderEnter.merge(slider);

  slider;

  let text = slider
    .select('.ticks')
    .selectAll('text')
    .data(x.ticks(nBins));

  let textEnter = text
    .enter()
    .append('text')
    .attr('text-anchor', 'middle');

  text.exit().remove();

  text = textEnter.merge(text);

  text
    .attr('transform', (d) => 'translate(' + x(d) + ',10) rotate(-30)')
    .text((d) => {
      let format;

      switch (d){
        case (d < 10):
          format = d3.format('2.2s');
          break;
        case (d < 1000):
          format = d3.format('2.0s');
          break;
        default :
          format = d3.format('.2s');
      }
      return format(d);
    });

}

function exportConfig(baseKeys,nodeLinkKeys,isTaskConfig){

  let configCopy = JSON.parse(JSON.stringify(window.controller.configuration));

  //only keep keys for this particular config file;

  Object.keys(configCopy).map((key)=>{
    if (!baseKeys.includes(key)){
      delete configCopy[key];
    }
  });

  Object.keys(configCopy.nodeLink).map((nKey)=>{
    if (!nodeLinkKeys.includes(nKey)){
      delete configCopy.nodeLink[nKey];
    }
  });

  //find out which 'state' you're saving : optimal, 5attr, or 10attr;
  let state = 'exportConfig';//d3.select('.button.clicked').attr('id')
  let fileName={
    'optimalConfig':'task'+ (window.controller.taskNum+1) + 'Config.json',
    'nodeLinkConfig':'5AttrConfig.json',
    'saturatedConfig':'10AttrConfig.json'
  };

  saveToFile(configCopy, isTaskConfig ? fileName[state] : 'baseConfig.json');
}

//Function to save exportedGraph to file automatically;
function saveToFile(data, filename) {
  if (!data) {
    console.error('Console.save: No data');
    return;
  }

  if (!filename) filename = 'output.json';

  if (typeof data === 'object') {
    data = JSON.stringify(data, undefined, 4);
  }

  var blob = new Blob([data], { type: 'text/json' }),
    e = document.createEvent('MouseEvents'),
    a = document.createElement('a');

  a.download = filename;
  a.href = window.URL.createObjectURL(blob);
  a.dataset.downloadurl = ['text/json', a.download, a.href].join(':');
  e.initMouseEvent(
    'click',
    true,
    false,
    window,
    0,
    0,
    0,
    0,
    0,
    false,
    false,
    false,
    false,
    0,
    null
  );
  a.dispatchEvent(e);
}
