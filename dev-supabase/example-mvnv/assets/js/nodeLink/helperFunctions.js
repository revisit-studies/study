// Helper functions to export config files


  function exportConfig(baseKeys, nodeLinkKeys, isTaskConfig) {
    let configCopy = JSON.parse(JSON.stringify(config));

    console.log(baseKeys,nodeLinkKeys,isTaskConfig);
    //only keep keys for this particular config file;

    let removeKeys = ['graphFiles', 'attributeScales', 'style'];
    Object.keys(configCopy).map((key) => {
      if (removeKeys.includes(key)) {
        delete configCopy[key];
      }
    });

    Object.keys(configCopy.nodeLink).map((nKey) => {
      if (!nodeLinkKeys.includes(nKey)) {
        delete configCopy.nodeLink[nKey];
      }
    });

    let fileName = 'taskConfig.json';
    // //find out which 'state' you're saving : optimal, 5attr, or 10attr;
    // let state = d3.select(".button.clicked").attr("id");
    // let fileName = {
    //   optimalConfig: "task" + (taskNum + 1) + "Config.json",
    //   nodeLinkConfig: "5AttrConfig.json",
    //   saturatedConfig: "10AttrConfig.json"
    // };

    saveToFile(configCopy, isTaskConfig ? fileName : 'baseConfig.json');
  }



  //Helper functions for node-link layout;
//Helper functions to compute edge arcs
function countSiblingLinks(graph, source, target) {
    var count = 0;
    let links = graph.links;

    for (var i = 0; i < links.length; ++i) {
      if (
        (links[i].source.id == source.id && links[i].target.id == target.id) ||
        (links[i].source.id == target.id && links[i].target.id == source.id)
      )
        count++;
    }
    return count;
  }

  function getSiblingLinks(graph, source, target) {
    var siblings = [];
    let links = graph.links;
    for (var i = 0; i < links.length; ++i) {
      if (
        (links[i].source.id == source.id && links[i].target.id == target.id) ||
        (links[i].source.id == target.id && links[i].target.id == source.id)
      )
        siblings.push(links[i].type);
    }
    return siblings;
  }



  //Functions related to the control panel.

  //function that populates the control Panel. assumes access to the global variable graph and config;
function setPanelValuesFromFile() {    [['node', 'nodes'], ['edge', 'links']].map((node_edge) => {
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
    d3.select('#panelDiv').selectAll('input[type=\'radio\']').property('checked', function() {
      if (this.name === 'graphSize') {
        return config[this.name] === this.value;
      } else {
        return config[this.name] === eval(this.value);
      }
    });

    d3.select('#fontSlider').on('input', function() {
      d3.select('#fontSliderValue').text(this.value);
      config.nodeLink.labelSize = eval(this.value);
    });

    d3.select('#fontSlider').property(
      'value',
      config.nodeLink.labelSize
    );
    d3.select('#fontSliderValue').text(
      config.nodeLink.labelSize
    );

    d3.select('#fontSlider').on('change', function() {
      updateVis();
    });

    d3.select('#markerSize').property(
      'value',
      config.nodeLink.nodeWidth +
        ',' +
        config.nodeLink.nodeHeight
    );

    d3.select('#markerSize').on('change', function() {
      let markerSize = this.value.split(',');

      config.nodeLink.nodeWidth = eval(markerSize[0]);
      config.nodeLink.nodeHeight= eval(markerSize[1]);
      updateVis();
    });

    //set Panel Values

    d3.selectAll('input[name=\'isDirected\']')
      .filter(function() {
        return d3.select(this).property('value') === config.isDirected.toString();
      })
      .property('checked', 'checked');


    d3.selectAll('input[name=\'selectNeighbors\']')
    .filter(function() {
      return d3.select(this).property('value') === config.nodeLink.selectNeighbors.toString();
    })
    .property('checked', 'checked');


    d3.selectAll('input[name=\'isMultiEdge\']')
      .filter(function() {
        return (
          d3.select(this).property('value') === config.isMultiEdge.toString()
        );
      })
      .property('checked', 'checked');

      d3.select('#panelDiv').selectAll('input[type=\'radio\']').on('change', async function() {

      if (this.name === 'selectNeighbors'){
        config.nodeLink[this.name] = eval(this.value);
        return;
      }
      config[this.name] =
        this.name === 'graphSize' ? this.value : eval(this.value);

      let file =
        config.graphSize +
        (config.isDirected ? '_directed' : '_undirected') +
        (config.isMultiEdge ? '_multiEdge' : '_singleEdge');

      config.loadedGraph = file;

      setDisabledRadioButtons();

      await loadNewGraph(config.graphFiles[file]);
      updateVis();
    });

    let setDisabledRadioButtons = function() {
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

    d3.select('#renderBarsCheckbox').property(
      'checked',
      config.nodeLink.drawBars
    );

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

        menuOptions.push({ attr: 'None', domain: null });

      //update domain box only for quant attributes domain input boxes
      d3.select('#' + m.name)
        .select('.input')
        .property(
          'value',
          () => config.nodeLink[m.configAttr] ? '[' + attrScales[config.nodeLink[m.configAttr]].domain + ']' : ''
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
        if (this.value === 'None'){
          config.nodeLink[m.configAttr] = null;
        } else {
          config.nodeLink[m.configAttr] = this.value;
          createHist(
            this.value,
            d3.select('#' + m.name + '_histogram'),
            isNode ? graph.nodes : graph.links,
            isNode
          );
        }

        updateVis();

      });

      //set selected element according to config file;

      //add svgs for quant attr selectors
      if (m.type !== typeof 'string') {
        let newSvg = item.selectAll('svg').data([0]);

        let svgEnter = newSvg.enter().append('svg');

        newSvg = svgEnter.merge(newSvg);

        newSvg.attr('id', m.name + '_histogram');

        let attr = m.configAttr
          ? config.nodeLink[m.configAttr]
          : config.nodeAttributes.filter(isQuant)[0];
        createHist(attr, newSvg, isNode ? graph.nodes : graph.links, isNode);
      }
    });

    //set behavior for bar selections

    let barAttrs = config.nodeAttributes.filter(isQuant);
    let catAttrs = config.nodeAttributes.filter(isCategorical);

    let section = d3.select('#nodeQuantSelect').select('ul');

    //filter to only those that are quantitative
    attrOptions = nodeAttrs
      .filter((option) => {
        return !option[1].range;
      })
      .map((d) => {
        return { attr: d[0], domain: d[1].domain,  label:d[1].label};
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
            graph.nodes
          );
          updateVis();
        } else {
          config.nodeAttributes = config.nodeAttributes.filter(
            (el) => el !== d.attr
          );
          updateVis();
        }
      });

    fields
      .select('label')
      .attr('id', (d) => d.attr + '-label')
      .attr('for', (d) => d.attr + '-checkbox')
      .text((d) => d.label);

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

        updateVis();

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
          graph.nodes
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
          updateVis();
        } else {
          config.nodeAttributes = config.nodeAttributes.filter((el) => el !== d);
          updateVis();
        }
      });

    fields
      .select('label')
      .attr('id', (d) => d + '-label')
      .attr('for', (d) => d + '-checkbox')
      .text((d) => d);

    d3.select('#nodeFillSelect')
      .select('select')
      .on('change', function() {

        // debugger
        //filter out any categorical attributes in config.nodeAttrs (only works because there can only be one at a time)
        //update to include currently selected categorical value;
        config.nodeAttributes = config.nodeAttributes.filter((n)=>!isCategorical(n));

        if (this.value === 'None'){
          config.nodeLink.nodeFillAttr = null;
        } else {
          config.nodeAttributes.push(this.value);
          config.nodeLink.nodeFillAttr = this.value;
        }

        config.nodeLink.drawBars = false;

        //update the array of attributes

        d3.select('#renderBarsCheckbox').property('checked', false);
        updateVis();
      });

    d3.select('#nodeStrokeSelect')
      .select('select')
      .on('change', function() {
        config.nodeStroke = this.value;
        // config.nodeLink.drawBars = false;

        // d3.select('#renderBarsCheckbox').property('checked', false)
        updateVis();
      });

    d3.select('#nodeSizeSelect')
      .select('select')
      .on('change', function() {
        config.nodeLink.drawBars = false;

        //filter out any categorical attributes in config.nodeAttrs (only works because there can only be one at a time)
        //update to include currently selected categorical value;

        config.nodeAttributes = config.nodeAttributes.filter((n)=>!isQuant(n));
        d3.select('#renderBarsCheckbox').property('checked', false);
        if (this.value === 'None'){
          config.nodeLink.nodeSizeAttr= null;
        } else {
          config.nodeAttributes.push(this.value);
          config.nodeLink.nodeSizeAttr = this.value;

          createHist(
            this.value,
            d3.select('#nodeSizeSelect_histogram'),
            graph.nodes
          );

          d3.select('#nodeSizeSelect')
            .select('input')
            .property(
              'value',
              () =>
                '[' +
                config.attributeScales.node[config.nodeLink.nodeSizeAttr].domain +
                ']'
            );
        }



        updateVis();
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
          this.value =
            '[' + defaultDomains.node[config.nodeLink.nodeSizeAttr] + ']';
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
            '[' +
            config.attributeScales.node[config.nodeLink.nodeSizeAttr].domain +
            ']'
        );

        createHist(
          config.nodeLink.nodeSizeAttr,
          d3.select('#nodeSizeSelect_histogram'),
          graph.nodes
        );

        updateVis();
      });

    d3.select('#renderBarsCheckbox').on('input', function() {
      config.nodeLink.drawBars = d3.select(this).property('checked');

      updateVis();
    });

    d3.select('#edgeWidthScale').on('change', function() {
      if (this.value) {
        config.attributeScales.edge[config.nodeLink.edgeWidthAttr].domain = eval(
          this.value
        );
      } else {
        // if value is empty, use 'default ranges';
        if (config.nodeLink.edgeWidthAttr){

          this.value =
          '[' + defaultDomains.edge[config.nodeLink.edgeWidthAttr] + ']';
        config.attributeScales.edge[config.nodeLink.edgeWidthAttr].domain =
          defaultDomains.edge[config.nodeLink.edgeWidthAttr];
          createHist(
            config.nodeLink.edgeWidthAttr,
            d3.select('#edgeWidthSelect_histogram'),
            graph.links,
            false
          );
        }
      }

      updateVis();


    });

    // updateVis();
}

  function update(){
      setPanelValuesFromFile();
      updateVis();
  }

  //Function that creates histograms for the controlPanel
  function createHist(attrName, svgSelection, data, isNode = true) {

    if (!attrName){
      return;
    }
    let nBins = 10;

    let margin = { top: 20, right: 10, bottom: 50, left: 20 },
      width = 300 - margin.left - margin.right,
      height = 200 - margin.top - margin.bottom;

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

        switch (d) {
          case d < 10:
            format = d3.format('2.2s');
            break;
          case d < 1000:
            format = d3.format('2.0s');
            break;
          default:
            format = d3.format('.2s');
        }
        return format(d);
      });
  }




//function that determines whether an attribute (as defined by a string) is quant based on the attributeScales defined;
function isQuant(attr) {
    return (
      Object.keys(config.attributeScales.node).includes(attr) &&
      config.attributeScales.node[attr].range === undefined
    );
  }

  //function that determines whether an attribute (as defined by a string) is categorical based on the attributeScales defined;
  function isCategorical(attr) {
    return (
      Object.keys(config.attributeScales.node).includes(attr) &&
      config.attributeScales.node[attr].range !== undefined
    );
  }

  async function loadConfigs(taskID) {

    // let baseConfig = await d3.json("../../configs/baseConfig.json");
    // let taskConfig = await d3.json("../../configs/" + taskID + "Config.json");

    // setConfigCallbacks(baseConfig,taskConfig);

    // await loadNewGraph(config.graphFiles[config.loadedGraph]);
  }

  // function getNodeState(nodes){
  //   return nodes.map(n=>{return {x:n.x,y:n.y,selected:n.selected || false ,answerSelected:n.answerSelected || false}})
  // }

  //function that initializes the state object for node positions;
  function nodePositionMap(nodes){
    let nodeMap={};
    nodes.map((n)=>nodeMap[n.id]={x:n.x,y:n.y});
    return nodeMap;
  }

  d3.select('#exportBaseConfig').on('click', function() {
    exportConfig(
      Object.keys(baseConfig),
      Object.keys(baseConfig.nodeLink),
      false
    );
  });

  d3.select('#exportConfig').on('click', function() {
    exportConfig(
      Object.keys(config),
      Object.keys(config.nodeLink),
      true
    );
  });


  // function setConfigCallbacks(baseConfig,taskConfig){

  //       d3.select("#exportBaseConfig").on("click", function() {
  //           exportConfig(
  //             Object.keys(baseConfig),
  //             Object.keys(baseConfig.nodeLink),
  //             false
  //           );
  //         });

  //         d3.select("#exportConfig").on("click", function() {

  //           exportConfig(
  //             Object.keys(taskConfig),
  //             Object.keys(taskConfig.nodeLink),
  //             true
  //           );
  //         });

  //         // rehape relevant config values into a single dictionary.
  //         config = mergeConfigs(baseConfig, taskConfig);

  //         allConfigs.optimalConfig = config;

  //         let task = tasks[taskNum];


  //         d3.select("#optimalConfig").on("click", () =>
  //           applyConfig("optimalConfig")
  //         );

  //         d3.select("#nodeLinkConfig").on("click", () =>
  //           applyConfig("nodeLinkConfig")
  //         );

  //         d3.select("#saturatedConfig").on("click", () =>
  //           applyConfig("saturatedConfig")
  //         );

  //         d3.select("#next").on("click", async () => {
  //           taskNum = d3.min([taskNum + 1, tasks.length - 1]);
  //           await loadConfigs(tasks[taskNum].id);
  //           applyConfig("optimalConfig");
  //         });

  //         d3.select("#previous").on("click", async () => {
  //           taskNum = d3.max([taskNum - 1, 0]);
  //           await loadConfigs(tasks[taskNum].id);
  //           applyConfig("optimalConfig");
  //         });

  // }

  // function applyConfig(configType) {
  //   d3
  //     .selectAll(".button")
  //     .classed("clicked", false);
  //   d3.select("#" + configType).classed("clicked", true);
  //   config = JSON.parse(JSON.stringify(allConfigs[configType]));


  //   //Update Task Header and Answer type

  //    // update global variables from config;
  //    setGlobalScales();

  //   update();
  // }

  function setUpProvenance(nodes,taskID = 'noID', order = 'noOrder'){

    let nodePos = nodePositionMap(nodes);

    const initialState = {
       nodePos: nodePos,//map of node positions,
       userSelectedNeighbors:{}, //map of nodes that have neighbors selected (so they can be non-muted)
       selected:[], //set of nodes that have been 'soft selected'
       hardSelected:[], //set of nodes that have been 'hard selected'
       search:[] //field to store the id of a searched node;
      };

      function nodeLink(provenance) {
        return {
          currentState: () => provenance.current().getState()
        };
      }

      //set global variables
      console.log('setting up track');
      provenance = Trrack.initProvenance(initialState, false);
      app = nodeLink(provenance);

      //push initial state to firestore
      pushProvenance(app.currentState(),true);
  }

  function setUpObserver(stateField,callback){
    provenance.addObserver([stateField], callback);
  }
