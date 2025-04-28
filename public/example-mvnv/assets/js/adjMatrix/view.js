// Work on importing class file
var View = /** @class */ (function () {
    function View(controller) {
        var _this = this;
        this.controller = controller;
        this.margins = { left: 75, top: 75, right: 0, bottom: 10 };
        this.mouseoverEvents = [];
        this.datumID = controller.datumID;
        this.clickFunction = function (d, i, nodes) {
            var nodeID = _this.controller.view.determineID(d);
            // remove hover or clicked from the class name of the objects that are interacted
            // this is necessary as the click events are attached to the hovered rect in attrRow
            var interaction = _this.sanitizeInteraction(d3.select(nodes[i]).attr('class'));
            var action = _this.controller.view.changeInteractionWrapper(nodeID, nodes[i], interaction);
            action.applyAction();
            pushProvenance(_this.controller.model.app.currentState());
        };
        // set up loading screen
        // Add scroll handler to containers
        /*d3.selectAll('.container').on('mousewheel', scrollHandler);
    
        function scrollHandler() {
          // determine which didn't scroll and update it's scroll.
          let scrollHeight = d3.select(this).node().scrollTop;
          if (d3.select(this).attr('id') == "attributes") {
            // scroll topology
            let element: any = d3.select('#topology').node();
            element.scrollTop = scrollHeight;
          } else {
            // scroll attributes
            let element: any = d3.select('#attributes').node()
            element.scrollTop = scrollHeight;
          }
        }*/
    }
    /*
    private edgeSVGWidth: number;
    private edgeSVGHeight: number;
    private edgeSVGMargin: any;
    private edgeSVG: any;
  
    private xScale: d3.ScaleBand<string>;
    private edgeValueScale: d3.ScaleLinear<number,number>;
    private colorScale: d3.ScaleOrdinal<any,any>;
    private orders: any;
  */
    /**
     * Changes the input string by any conflicting class names given to the
     * elements that were interacted with.
     * @param  interaction class of the interacted element
     * @return             string - elements class name with no style classes
     */
    View.prototype.sanitizeInteraction = function (interaction) {
        interaction = interaction.replace(' hoveredCell', '');
        interaction = interaction.replace(' hovered', '');
        interaction = interaction.replace(' clicked', '');
        interaction = interaction.replace(' answer', '');
        interaction = interaction.replace(' neighbor', '');
        return interaction;
    };
    /**
     * Searchs for the inputted node according to the data's shortName.
     * @param  searchNode string corresponding to the short name to search for.
     * @return            1 if short name was found, 0 if already selected, -1 if not found
     */
    View.prototype.search = function (searchNode) {
        var selectedOption = searchNode.toLowerCase(); //d3.select(nodes[i]).property("value");
        if (selectedOption.length === 0) {
            return;
        }
        //find the right nodeObject
        var name = this.nodes.filter(function (node) { return node.shortName.toLowerCase() == selectedOption; });
        if (name[0] == null || name[0][this.datumID] == '')
            return -1; // node was not found
        name = name[0][this.datumID];
        var state = this.controller.model.app.currentState();
        if (name in state.selections.search) {
            return 0;
        }
        var action = this.controller.view.changeInteractionWrapper(name, null, 'search');
        action.applyAction();
        pushProvenance(this.controller.model.app.currentState());
        return 1;
    };
    /**
     * Takes in the data, hides the loading screen, and
     * initalizes visualization.
     * @param  data [description]
     * @return      [description]
     */
    View.prototype.loadData = function (nodes, edges, matrix) {
        this.nodes = nodes;
        this.edges = edges;
        this.matrix = matrix;
        this.renderView();
    };
    /**
     * Initializes the adjacency matrix and row views with placeholder visualizations
     * @return none
     */
    View.prototype.renderView = function () {
        d3.select('.loading').style('display', 'block').style('opacity', 1);
        this.initalizeEdges();
        this.initalizeAttributes();
        d3.select('.loading').style('display', 'none');
    };
    /**
     * Initalizes the edges view, renders all SVG elements and attaches listeners
     * to elements.
     * @return None
     */
    View.prototype.initalizeEdges = function () {
        // Float edges so put edges and attr on same row
        // d3.select('#topology').style('float', 'left');
        var _this = this;
        // Set width and height based upon the calculated layout size
        var width = this.controller.visWidth * this.controller.edgePorportion;
        var height = this.controller.visHeight;
        this.edgeWidth = width - (this.margins.left + this.margins.right); //*this.controller.edgePorportion;
        this.edgeHeight = height - (this.margins.top + this.margins.bottom); //*this.controller.edgePorportion;
        // Creates scalable SVG
        this.edges = d3.select('#topology').append('svg')
            .attr('viewBox', '0 0 ' + (width) + ' ' + height + '')
            .attr('preserveAspectRatio', 'xMinYMin meet')
            .append('g')
            .classed('svg-content', true)
            .attr('id', 'edgeMargin')
            .attr('transform', 'translate(' + this.margins.left + ',' + this.margins.top + ')');
        // sets the vertical scale
        this.orderingScale = d3.scaleBand().range([0, this.edgeWidth]).domain(d3.range(this.nodes.length));
        // creates column groupings
        this.edgeColumns = this.edges.selectAll('.column')
            .data(this.matrix)
            .enter().append('g')
            .attr('class', 'column')
            .attr('id', function (d, i) {
            return 'groupCol' + d[i].colid;
        })
            .attr('transform', function (d, i) {
            return 'translate(' + _this.orderingScale(i) + ')rotate(-90)';
        });
        // Draw each row
        this.edgeRows = this.edges.selectAll('.row')
            .data(this.matrix)
            .enter().append('g')
            .attr('class', 'row')
            .attr('id', function (d, i) {
            return 'groupRow' + d[i].colid;
        })
            .attr('transform', function (d, i) {
            return 'translate(0,' + _this.orderingScale(i) + ')';
        });
        this.drawGridLines();
        this.drawHighlightElements();
        this.edgeScales = this.generateEdgeScales();
        this.generateColorLegend();
        var cells = this.edgeRows.selectAll('.cell')
            .data(function (d) { return d; /*.filter(item => item.z > 0)*/ })
            .enter().append('g')
            .attr('class', 'cell')
            .attr('id', function (d) { return d.cellName; })
            .attr('transform', function (d) { return 'translate(' + _this.orderingScale(d.x) + ',0)'; });
        cells
            .append('rect')
            .classed('baseCell', true)
            .attr('x', function (d) { return 0; })
            .attr('height', this.orderingScale.bandwidth())
            .attr('width', this.orderingScale.bandwidth())
            .attr('fill-opacity', 0);
        // render edges
        this.controller.configuration.adjMatrix.edgeBars ? this.drawEdgeBars(cells) : this.drawFullSquares(cells);
        cells
            .on('mouseover', function (cell, i, nodes) {
            _this.showEdgeTooltip(cell, i, nodes);
            _this.hoverEdge(cell);
        })
            .on('mouseout', function (cell) {
            _this.tooltip.transition(25)
                .style('opacity', 0);
            _this.unhoverEdge(cell);
        })
            .filter(function (d) { return d.interacted != 0 || d.retweet != 0 || d.mentions != 0; })
            .on('click', function (d, i, nodes) {
            // only trigger click if edge exists
            _this.clickFunction(d, i, nodes);
        })
            .attr('cursor', 'pointer');
        cells.filter(function (d) { return d.rowid == d.colid; })
            .on('click', function (d, i, nodes) {
            if (d.rowid in _this.controller.model.app.currentState().selections.search) {
                var action = _this.changeInteractionWrapper(d.rowid, null, 'search');
                action.applyAction();
                pushProvenance(_this.controller.model.app.currentState());
            }
            // only trigger click if edge exists
        });
        this.controller.answerRow = {};
        this.controller.hoverRow = {};
        this.controller.hoverCol = {};
        this.order = this.controller.getOrder();
        this.appendEdgeLabels();
        // add tooltip
        this.tooltip = d3.select('body')
            .append('div')
            .attr('class', 'tooltip')
            .style('opacity', 0);
    };
    /**
     * Draws the nested edge bars
     * @param  cells d3 selection corresponding to the matrix cell groups
     * @return       none
     */
    View.prototype.drawEdgeBars = function (cells) {
        var _this = this;
        // bind squares to cells for the mouse over effect
        var dividers = this.controller.configuration.isMultiEdge ? 2 : 1;
        //let squares = cells
        var offset = 0;
        var squareSize = this.orderingScale.bandwidth() - 2 * offset;
        var _loop_1 = function (index) {
            var type = this_1.controller.configuration.isMultiEdge ? this_1.controller.configuration.attributeScales.edge.type.domain[index] : 'interacted';
            cells
                .append('rect')
                .classed('nestedEdges nestedEdges' + type, true)
                .attr('x', offset) // index * this.orderingScale.bandwidth() / dividers })
                .attr('y', function (d) {
                return offset; //this.orderingScale.bandwidth() - scale(d[type]);
            })
                .attr('height', squareSize) //)
                .attr('width', squareSize)
                .attr('fill', function (d) { return _this.edgeScales[type](d[type]); });
            // adjust offset and square size for the next edge type
            offset = squareSize / 4;
            squareSize = squareSize - 2 * offset;
        };
        var this_1 = this;
        for (var index = 0; index < dividers; index++) {
            _loop_1(index);
        }
        // remove all edge rectangles that have no interactions
        cells
            .selectAll('.nestedEdges')
            .filter(function (d) {
            return d.mentions == 0 && d.retweet == 0 && d.interacted == 0;
        })
            .remove();
    };
    /**
     * Function to render the matrix edges as full squares
     * @param  cells d3 selection corresponding to the matrix cell groups
     * @return       none
     */
    View.prototype.drawFullSquares = function (cells) {
        var squares = cells
            .append('rect')
            .attr('x', 0) //d => this.orderingScale(d.x))
            //.filter(d=>{return d.item >0})
            .attr('width', this.orderingScale.bandwidth())
            .attr('height', this.orderingScale.bandwidth())
            .style('fill', 'white');
        squares
            .filter(function (d) { return d.z == 0; })
            .style('fill-opacity', 0);
        this.setSquareColors('all');
    };
    /**
     * Renders a tool tip over the provided cell node
     * @param  cell  Data element corresponding to the cell
     * @param  i     Index of that
     * @param  nodes The node elements of the d3 selection
     * @return       none
     */
    View.prototype.showEdgeTooltip = function (cell, i, nodes) {
        var matrix = nodes[i].getScreenCTM()
            .translate(+nodes[i].getAttribute('x'), +nodes[i].getAttribute('y'));
        var interactedMessage = cell.interacted > 0 ? cell.interacted.toString() + ' interactions' : ''; //
        if (cell.interacted == 1) {
            interactedMessage = interactedMessage.substring(0, interactedMessage.length - 1);
        }
        var retweetMessage = cell.retweet > 0 ? cell.retweet.toString() + ' retweets' : ''; //
        if (cell.retweet == 1) {
            retweetMessage = retweetMessage.substring(0, retweetMessage.length - 1);
        }
        var mentionsMessage = cell.mentions > 0 ? cell.mentions.toString() + ' mentions' : ''; //
        if (cell.mentions == 1) {
            mentionsMessage = mentionsMessage.substring(0, mentionsMessage.length - 1);
        }
        var message = [interactedMessage, retweetMessage, mentionsMessage].filter(Boolean).join('</br>'); //retweetMessage+'</br>'+mentionsMessage
        if (message !== '') {
            var yOffset = (retweetMessage !== '' && mentionsMessage !== '') ? 45 : 30;
            this.tooltip.html(message)
                .style('left', (window.pageXOffset + matrix.e - 45) + 'px')
                .style('top', (window.pageYOffset + matrix.f - yOffset) + 'px');
            this.tooltip.transition()
                .delay(100)
                .duration(200)
                .style('opacity', .9);
        }
    };
    /**
     * Renders hover interactions and logs interaction in mouseoverEvents.
     * @param  cell d3 datum corresponding to cell's data
     * @return      none
     */
    View.prototype.hoverEdge = function (cell) {
        var cellIDs = [cell.cellName, cell.correspondingCell];
        this.selectedCells = cellIDs;
        this.selectedCells.map(function (cellID) {
            d3.selectAll('#' + cellID).selectAll('.baseCell').classed('hoveredCell', true);
        });
        var cellID = cellIDs[0];
        this.addHighlightNodesToDict(this.controller.hoverRow, cell.rowid, cellID); // Add row (rowid)
        if (cell.colid !== cell.rowid) {
            this.addHighlightNodesToDict(this.controller.hoverRow, cell.colid, cellID); // Add row (colid)
            this.addHighlightNodesToDict(this.controller.hoverCol, cell.rowid, cellID); // Add col (rowid)
        }
        // add mouseover events
        this.mouseoverEvents.push({ time: new Date().getTime(), event: cellID });
        this.addHighlightNodesToDict(this.controller.hoverCol, cell.colid, cellID); // Add col (colid)
        d3.selectAll('.hovered').classed('hovered', false);
        this.renderHighlightNodesFromDict(this.controller.hoverRow, 'hovered', 'Row');
        this.renderHighlightNodesFromDict(this.controller.hoverCol, 'hovered', 'Col');
    };
    /**
     * Removes interaction highlight from a cell mouseover
     * @param  cell d3 datum element corresponding to the cell's data
     * @return      none
     */
    View.prototype.unhoverEdge = function (cell) {
        d3.selectAll('.hoveredCell').classed('hoveredCell', false);
        this.selectedCells = [];
        var cellID = cell.cellName;
        this.removeHighlightNodesToDict(this.controller.hoverRow, cell.rowid, cellID); // Add row (rowid)
        if (cell.colid !== cell.rowid) {
            this.removeHighlightNodesToDict(this.controller.hoverRow, cell.colid, cellID);
            this.removeHighlightNodesToDict(this.controller.hoverCol, cell.rowid, cellID); // Add col (rowid)
        }
        // Add row (colid)
        this.removeHighlightNodesToDict(this.controller.hoverCol, cell.colid, cellID); // Add col (colid)
        d3.selectAll('.hovered').classed('hovered', false);
    };
    /**
     * Renders column labels and row labels to the matrix.
     * @return none
     */
    View.prototype.appendEdgeLabels = function () {
        var _this = this;
        var labelSize = this.controller.configuration.nodeAttributes.length > 4 ? 9.5 : 11;
        this.nodes.length < 50 ? labelSize = labelSize + 2 : null;
        this.edgeRows
            .append('g')
            .attr('id', function (d, i) {
            return 'tourRowLabel' + d[i].rowid;
        })
            .append('text')
            .attr('class', 'rowLabel')
            .attr('id', function (d, i) {
            return 'rowLabel' + d[i].rowid;
        })
            .attr('z-index', 30)
            .attr('x', -3)
            .attr('y', this.orderingScale.bandwidth() / 2)
            .attr('dy', '.32em')
            .attr('text-anchor', 'end')
            .style('font-size', labelSize)
            .text(function (d, i) { return _this.nodes[i].shortName; })
            .on('mouseout', function (d, i, nodes) { _this.mouseOverLabel(d, i, nodes); })
            .on('mouseover', function (d, i, nodes) { _this.mouseOverLabel(d, i, nodes); })
            .on('click', function (d, i, nodes) {
            //d3.select(nodes[i]).classed('clicked',!d3.select(nodes[i]).classed('clicked'))
            _this.clickFunction(d, i, nodes);
        });
        var verticalOffset = 3;
        var scale = 0.0625;
        var rotation = 90;
        if (this.controller.configuration.adjMatrix.neighborSelect) {
            verticalOffset = this.nodes.length > 50 ? (this.orderingScale.bandwidth() / 11) / scale : 7.5 / scale;
            var horizontalOffset = ((this.orderingScale.bandwidth() + 15) / 2) / scale; //this.nodes.length < 50 ? 11/scale : (this.orderingScale.bandwidth()/1.2/scale// /2;
            if (rotation == 90 || rotation == -90) {
                var temp = verticalOffset;
                verticalOffset = horizontalOffset;
                horizontalOffset = temp;
            }
            var edgeSortGlyphs = this.edgeColumns /*.append('g')
            edgeSortGlyphs.append('rect')
              .attr('fill-opacity',1)
              .attr('x',horizontalOffset*scale)
              .attr('y',verticalOffset*scale)
              .attr('width',this.orderingScale.bandwidth()/1.2)
              .attr('height',this.orderingScale.bandwidth()/1.2)
              .attr('fill','pink')//.attr('cursor','pointer')
      
            edgeSortGlyphs*/
                .append('path')
                .attr('id', function (d) { return 'sortIcon' + d[0].rowid; })
                .attr('class', 'sortIcon').style('pointer-events', 'bounding-box')
                .attr('d', function (d) { return _this.controller.model.icons['cellSort'].d; })
                .style('fill', function (d) { return d == _this.controller.model.orderType ? '#EBB769' : '#8B8B8B'; })
                .attr('transform', 'scale(' + scale + ')translate(' + (verticalOffset) + ',' + (horizontalOffset) + ')rotate(' + rotation + ')')
                //edgeSortGlyphs
                .on('click', function (d, i, nodes) {
                var action = _this.generateSortAction(d[0].rowid);
                action.applyAction();
                pushProvenance(_this.controller.model.app.currentState());
            }).attr('cursor', 'pointer')
                .on('mouseout', function (d, i, nodes) { _this.mouseOverLabel(d, i, nodes); })
                .on('mouseover', function (d, i, nodes) { _this.mouseOverLabel(d, i, nodes); });
            verticalOffset = verticalOffset * scale + 5;
        }
        this.edgeColumns
            .append('g')
            .attr('id', function (d, i) {
            return 'tourColLabel' + d[i].rowid;
        })
            .append('text')
            .attr('id', function (d, i) {
            return 'colLabel' + d[i].rowid;
        })
            .attr('class', 'colLabel')
            .attr('z-index', 30)
            .attr('y', this.orderingScale.bandwidth() / 2)
            .attr('x', verticalOffset)
            .attr('dy', '.32em')
            .attr('text-anchor', 'start')
            .style('font-size', labelSize)
            .text(function (d, i) { return _this.nodes[i].shortName; })
            .on('click', function (d, i, nodes) {
            if (_this.controller.configuration.adjMatrix.neighborSelect) {
                //this.sort(d[0].rowid)
                _this.clickFunction(d, i, nodes);
                var action = _this.controller.view.changeInteractionWrapper(null, nodes[i], 'neighborSelect');
                action.applyAction();
            }
            else {
                _this.clickFunction(d, i, nodes);
            }
        })
            .on('mouseout', function (d, i, nodes) { _this.mouseOverLabel(d, i, nodes); })
            .on('mouseover', function (d, i, nodes) { _this.mouseOverLabel(d, i, nodes); });
    };
    /**
     * renders the relevent highlights for mousing over a label. Logs the interaction
     * in mouseoverEvents.
     * @param  data  d3 data element
     * @param  i     d3 index
     * @param  nodes d3 nodes
     * @return       none
     */
    View.prototype.mouseOverLabel = function (data, i, nodes) {
        var elementID = data[0].rowid;
        var flag = this.addHighlightNodesToDict(this.controller.hoverRow, elementID, elementID);
        this.addHighlightNodesToDict(this.controller.hoverCol, elementID, elementID);
        // add interaction to mouseover events
        flag ? this.mouseoverEvents.push({ time: new Date().getTime(), event: d3.select(nodes[i]).attr('id') }) : null;
        d3.selectAll('.hovered').classed('hovered', false);
        this.renderHighlightNodesFromDict(this.controller.hoverRow, 'hovered', 'Row');
        this.renderHighlightNodesFromDict(this.controller.hoverCol, 'hovered', 'Col');
    };
    /**
     * Generates the edge scales for the topology matrix
     * @return An object where keys are strings of types and values are d3 scales
     */
    View.prototype.generateEdgeScales = function () {
        var _this = this;
        var edgeScales = {};
        this.controller.configuration.attributeScales.edge.type.domain.forEach(function (type) {
            // calculate the max
            var extent = [0, _this.controller.configuration.attributeScales.edge.count.domain[1]];
            //model.maxTracker[type]]
            // set up scale
            var typeIndex = _this.controller.configuration.attributeScales.edge.type.domain.indexOf(type);
            //let scale = d3.scaleLinear().domain(extent).range(["white", this.controller.configuration.attributeScales.edge.type.range[typeIndex]]);
            //let otherColors = ['#064B6E', '#4F0664', '#000000']
            var scale = d3.scaleSqrt().domain(extent).range(['white', _this.controller.configuration.attributeScales.edge.type.range[typeIndex]]);
            scale.clamp(true);
            // store scales
            edgeScales[type] = scale;
        });
        return edgeScales;
    };
    /**
     * Draws the grid lines for the adjacency matrix.
     * @return none
     */
    View.prototype.drawGridLines = function () {
        var _this = this;
        var gridLines = this.edges
            .append('g')
            .attr('class', 'gridLines');
        var lines = gridLines
            .selectAll('line')
            .data(this.matrix)
            .enter();
        lines.append('line')
            .attr('transform', function (d, i) {
            return 'translate(' + _this.orderingScale(i) + ',' + '0' + ')rotate(-90)';
        })
            .attr('x1', -this.edgeWidth);
        /*.attr("stroke-width", 5)
        .attr('stroke','red')*/
        lines.append('line')
            .attr('transform', function (d, i) {
            return 'translate(0,' + _this.orderingScale(i) + ')';
        })
            .attr('x2', this.edgeWidth + this.margins.right);
        //.attr("stroke-width", 2)
        //.attr('stroke','blue')
        var one = gridLines
            .append('line')
            .attr('x1', this.edgeWidth)
            .attr('x2', this.edgeWidth)
            .attr('y1', 0)
            .attr('y2', this.edgeHeight + this.margins.bottom)
            .style('stroke', '#aaa')
            .style('opacity', 0.3);
        var two = gridLines
            .append('line')
            .attr('x1', 0)
            .attr('x2', this.edgeWidth)
            .attr('y1', this.edgeHeight + this.margins.bottom)
            .attr('y2', this.edgeHeight + this.margins.bottom)
            .style('stroke', '#aaa')
            .style('opacity', 0.3);
        // adds column lines
        /*this.edgeColumns.append("line")
          .attr("x1", -this.edgeWidth)
          .attr("z-index", 10);
        // append final line to end of topology matrix
    
        this.edges
          .append("line")
          .attr("x1", this.edgeWidth)
          .attr("x2", this.edgeWidth)
          .attr("y1", 0)
          .attr("y2", this.edgeHeight)
    
        // append horizontal grid lines
        this.edgeRows.append("line")
        .attr("x2", this.edgeWidth + this.margins.right);*/
    };
    /**
     * Renders the highlight rows and columns for the adjacency matrix.
     * @return [description]
     */
    View.prototype.drawHighlightElements = function () {
        // add the highlight rows
        this.edgeColumns
            .append('rect')
            .classed('topoCol', true)
            .attr('id', function (d, i) {
            return 'topoCol' + d[i].colid;
        })
            .attr('x', -this.edgeHeight - this.margins.bottom)
            .attr('y', 0)
            .attr('width', this.edgeHeight + this.margins.bottom + this.margins.top) // these are swapped as the columns have a rotation
            .attr('height', this.orderingScale.bandwidth())
            .attr('fill-opacity', 0);
        // added highlight rows
        this.edgeRows
            .append('rect')
            .classed('topoRow', true)
            .attr('id', function (d, i) {
            return 'topoRow' + d[i].rowid;
        })
            .attr('x', -this.margins.left)
            .attr('y', 0)
            .attr('width', this.edgeWidth + this.margins.right + this.margins.left)
            .attr('height', this.orderingScale.bandwidth())
            .attr('fill-opacity', 0);
    };
    /**
     * [changeInteractionWrapper description]
     * @param  nodeID ID of the node being changed with
     * @param  node   nodes corresponding to the element class interacted with (from d3 select nodes[i])
     * @param  interactionType class name of element interacted with
     * @return        [description]
     */
    View.prototype.changeInteractionWrapper = function (nodeID, node, interactionType) {
        var _this = this;
        return this.controller.model.provenance.addAction(interactionType, function () {
            var currentState = _this.controller.model.app.currentState();
            currentState.selections.previousMouseovers = _this.mouseoverEvents;
            _this.mouseoverEvents.length = 0;
            //add time stamp to the state graph
            currentState.time = Date.now();
            currentState.event = interactionType;
            var interactionName = interactionType; //cell, search, etc
            var interactedElement = interactionType;
            if (interactionName == 'cell') {
                var cellData = d3.select(node).data()[0]; //
                nodeID = cellData.colid;
                interactedElement = cellData.cellName; // + cellData.rowid;
                _this.changeInteraction(currentState, nodeID, interactionName + 'col', interactedElement);
                _this.changeInteraction(currentState, nodeID, interactionName + 'row', interactedElement);
                if (cellData.cellName != cellData.correspondingCell) {
                    interactedElement = cellData.correspondingCell; // + cellData.rowid;
                    nodeID = cellData.rowid;
                    _this.changeInteraction(currentState, nodeID, interactionName + 'col', interactedElement);
                    _this.changeInteraction(currentState, nodeID, interactionName + 'row', interactedElement);
                }
                return currentState;
                //nodeID = cellData.rowid;
                //interactionName = interactionName + 'row'
            }
            else if (interactionName == 'neighborSelect') {
                //this.controller.model.provenance.applyAction(action);
                var columnData = d3.select(node).data()[0];
                interactedElement = 'colClick' + d3.select(node).data()[0][0].rowid;
                columnData.map(function (node) {
                    if (node.mentions != 0 || node.interacted != 0 || node.retweet != 0) {
                        var neighbor = node.colid;
                        _this.changeInteraction(currentState, neighbor, interactionName, interactedElement);
                    }
                });
                return currentState;
            }
            else if (interactionName == 'attrRow') {
                interactionName;
            }
            _this.changeInteraction(currentState, nodeID, interactionName, interactedElement);
            return currentState;
        });
    };
    /**
     * Used to determine the ID based upon the datum element.
     * @param  data data returned as the first argument of d3 selection
     * @return      a list containing the id (ID's) of data elements
     */
    View.prototype.determineID = function (data) {
        // if attr Row
        if (data[this.datumID]) {
            return data[this.datumID];
        }
        else if (data.colid) { // if cell
            return data.colid + data.rowid;
        }
        else { // if colLabel or rowLabel
            return data[0].rowid;
        }
    };
    View.prototype.alreadyCellInState = function (state, nodeID) {
        var cellNames = splitCellNames(nodeID);
        var flag = false;
        cellNames.map(function (name) {
            if (state.selections['cell'][name]) {
                delete state.selections['cell'][name];
                flag = true;
            }
        });
        return flag;
    };
    /**
     * Adds the interacted node to the state object.
     * @param  state           [description]
     * @param  nodeID          [description]
     * @param  interaction     [description]
     * @param  interactionName [description]
     * @return                 [description]
     */
    View.prototype.changeInteraction = function (state, nodeID, interaction, interactionName) {
        // if there have been any mouseover events since the last submitted action, log them in provenance
        //if (this.mouseoverEvents.length > 1) {
        if (interactionName === void 0) { interactionName = interaction; }
        //}
        if (nodeID in state.selections[interaction]) {
            // Remove element if in list, if list is empty, delete key
            var currentIndex = state.selections[interaction][nodeID].indexOf(interactionName);
            if (currentIndex > -1) {
                state.selections[interaction][nodeID].splice(currentIndex, 1);
                if (state.selections[interaction][nodeID].length == 0)
                    delete state.selections[interaction][nodeID];
            }
            else {
                state.selections[interaction][nodeID].push(interactionName);
            }
        }
        else {
            state.selections[interaction][nodeID] = [interactionName];
        }
    };
    /**
     * [mouseoverEdge description]
     * @return [description]
     */
    View.prototype.mouseoverEdge = function () {
    };
    View.prototype.linspace = function (startValue, stopValue, cardinality) {
        var arr = [];
        var step = (stopValue - startValue) / (cardinality - 1);
        for (var i = 0; i < cardinality; i++) {
            arr.push(startValue + (step * i));
        }
        return arr;
    };
    View.prototype.setSquareColors = function (type) {
    };
    View.prototype.generateScaleLegend = function (type, numberOfEdge) {
        var _this = this;
        var yOffset = 30;
        var xOffset = 10;
        if (this.controller.configuration.adjMatrix.edgeBars && this.controller.configuration.isMultiEdge) {
            var legendFile = 'assets/adj-matrix/';
            legendFile += this.controller.configuration.isMultiEdge ? 'nestedSquaresLegend' : 'edgeBarsLegendSingleEdge';
            legendFile += '.png';
            d3.select('#legend-svg').append('g').append('svg:image')
                .attr('x', 0)
                .attr('y', 10)
                .attr('width', 50)
                .attr('height', 70)
                .attr('xlink:href', legendFile);
            //return;
            xOffset = 100;
        }
        var rectWidth = 18;
        var rectHeight = 10;
        var legendWidth = 130;
        var legendHeight = 60;
        xOffset += legendWidth * numberOfEdge;
        var scale = this.edgeScales[type];
        var extent = scale.domain();
        var number = 5;
        var sampleNumbers = [0, 1, 3, 5]; //this.linspace(extent[0], extent[1], number);
        var svg = d3.select('#legend-svg').append('g')
            .attr('id', 'legendLinear' + type)
            .attr('transform', function (d, i) { return 'translate(' + xOffset + ',' + yOffset + ')'; })
            .on('click', function (d, i, nodes) {
            if (_this.controller.configuration.adjMatrix.selectEdgeType == true) { //
                var edgeType = _this.controller.configuration.state.adjMatrix.selectedEdgeType == type ? 'all' : type;
                _this.controller.configuration.state.adjMatrix.selectedEdgeType = edgeType;
                _this.setSquareColors(edgeType);
                if (edgeType == 'all') {
                    d3.selectAll('.selectedEdgeType').classed('selectedEdgeType', false);
                }
                else {
                    d3.selectAll('.selectedEdgeType').classed('selectedEdgeType', false);
                    d3.selectAll('#legendLinear' + type).select('.edgeLegendBorder').classed('selectedEdgeType', true);
                }
            }
        });
        var boxWidth = (number + 1) * rectWidth + 15;
        svg.append('rect')
            .classed('edgeLegendBorder', true)
            .attr('stroke', 'gray')
            .attr('stroke-width', 1)
            .attr('width', boxWidth)
            .attr('height', 50)
            .attr('fill-opacity', 0)
            .attr('x', 0)
            .attr('y', -9)
            .attr('ry', 2)
            .attr('rx', 2);
        var pluralType = type;
        if (pluralType == 'retweet') {
            pluralType = 'retweets';
        }
        else if (pluralType == 'interacted') {
            pluralType = 'interactions';
        }
        svg.append('text')
            .attr('x', boxWidth / 2)
            .attr('y', 8)
            .attr('text-anchor', 'middle')
            .style("font-size", "12px")
            .text('# of ' + pluralType);
        var sideMargin = ((boxWidth) - (sampleNumbers.length * (rectWidth + 5))) / 2;
        var groups = svg.selectAll('g')
            .data(sampleNumbers)
            .enter()
            .append('g')
            .attr('transform', function (d, i) { return 'translate(' + (sideMargin + i * (rectWidth + 5)) + ',' + 15 + ')'; });
        groups
            .append('rect')
            .attr('width', rectWidth)
            .attr('height', rectHeight)
            .attr('fill', function (d) {
            return scale(d);
        })
            .attr('stroke', function (d) {
            return d == 0 ? '#bbb' : 'white';
        });
        groups
            .append('text')
            .attr('x', rectWidth / 2)
            .attr('y', 22)
            .attr('text-anchor', 'middle')
            .style("font-size", "12px")
            .text(function (d) {
            return Math.round(d);
        });
    };
    View.prototype.generateColorLegend = function () {
        var counter = 0;
        for (var type in this.edgeScales) {
            if (this.controller.configuration.isMultiEdge) {
                if (type == 'interacted') {
                    continue;
                }
                this.generateScaleLegend(type, counter);
                counter += 1;
            }
            else {
                if (type != 'interacted') {
                    continue;
                }
                this.generateScaleLegend(type, counter);
            }
        }
    };
    /**
     * [selectRow description]
     * @param  node [description]
     * @return      [description]
     */
    View.prototype.classHighlights = function (nodeID, rowOrCol, className) {
        if (rowOrCol === void 0) { rowOrCol = 'Row'; }
        // select attr and topo highlight
        d3.selectAll('Attr' + rowOrCol + nodeID + ',' + 'Topo' + rowOrCol + nodeID)
            .classed(className, true);
        //d3.selectAll('#highlight' + 'Topo' + rowOrCol + nodeID)
        //  .classed(className, true);*
        // highlight row text
        //d3.selectAll('')rowOrCol
        // else highlight column text
    };
    /**
     * [highlightRow description]
     * @param  node [description]
     * @return      [description]
     */
    /*highlightRow(node) {
      let nodeID = node[this.datumID];
      if (nodeID == null) {
        nodeID = node.rowid;
      }
      // highlight attr
      this.highlightNode(nodeID, 'attr');
      this.highlightNode(nodeID, 'topo');
    }
  
    highlightRowAndCol(node) {
      let nodeID = node.screen_name;
      if (node.screen_name == null) {
        nodeID = node.colid;
      }
  
      this.highlightNode(nodeID, 'attr');
      this.highlightNode(nodeID, '', 'Col');
    }
  
    highlightNode(nodeID: string, attrOrTopo: string, rowOrCol: string = 'Row') {
      d3.selectAll('.' + attrOrTopo + rowOrCol + nodeID)
        .classed('hovered', true);
    }*/
    //u: BCC    BCCINVITADOS2019
    //p:
    //private selectedNodes : any;
    // DOESNT GET ADDED
    View.prototype.addHighlightNode = function (addingNode) {
        // if node is in
        var nodeIndex = this.nodes.findIndex(function (item, i) {
            return item[this.datumID] == addingNode;
        });
        for (var i = 0; i < this.matrix[0].length; i++) {
            if (this.matrix[i][nodeIndex].z > 0) {
                var nodeID = this.matrix[i][nodeIndex].rowid;
                if (this.controller.configuration.state.adjMatrix.highlightedNodes.hasOwnProperty(nodeID) && !this.controller.configuration.state.adjMatrix.highlightedNodes[nodeID].includes(addingNode)) {
                    // if array exists, add it
                    this.controller.configuration.state.adjMatrix.highlightedNodes[nodeID].push(addingNode);
                }
                else {
                    // if array non exist, create it and add node
                    this.controller.configuration.state.adjMatrix.highlightedNodes[nodeID] = [addingNode];
                }
            }
        }
    };
    /**
     * [removeHighlightNode description]
     * @param  nodeID       [description]
     * @param  removingNode [description]
     * @return              [description]
  
    removeHighlightNode(removingNode: string) {
      // remove from selected nodes
  
      for (let nodeID in this.controller.configuration.state.adjMatrix.highlightedNodes) {
        //finds the position of removing node in the nodes array
        let index = this.controller.configuration.state.adjMatrix.highlightedNodes[nodeID].indexOf(removingNode);
        // keep on removing all places of removing node
        if (index > -1) {
          this.controller.configuration.state.adjMatrix.highlightedNodes[nodeID].splice(index, 1);
          // delete properties if no nodes left
          if (this.controller.configuration.state.adjMatrix.highlightedNodes[nodeID].length == 0) {
            delete this.controller.configuration.state.adjMatrix.highlightedNodes[nodeID];
          }
        }
      }
    }*/
    View.prototype.nodeDictContainsPair = function (dict, nodeToHighlight, interactedElement) {
        if (nodeToHighlight in dict) {
            return dict[nodeToHighlight].has(interactedElement);
        }
        return false;
    };
    /**
     * If an interactedElement has not been interacted with, it will add the nodeToHighlight
     * to the provided highlight dict. If it has, it will remove it and return false. Otherwise,
     * it will add the interacted element connection to the nodeToHighlight.
     * @param  dict       The underlying storage to show which
     * @param  nodeToHighlight  [description]
     * @param  interactedElement [description]
     * @return            [description]
     */
    View.prototype.addHighlightNodesToDict = function (dict, nodeToHighlight, interactedElement) {
        // if node already in highlight, remove it
        if (this.nodeDictContainsPair(dict, nodeToHighlight, interactedElement)) {
            this.removeHighlightNodesToDict(dict, nodeToHighlight, interactedElement);
            return false;
        }
        // create new set if set exists
        if (!(nodeToHighlight in dict)) {
            dict[nodeToHighlight] = new Set();
        }
        // add element to set
        dict[nodeToHighlight].add(interactedElement);
        return true;
    };
    View.prototype.removeHighlightNodesToDict = function (dict, nodeToHighlight, interactedElement) {
        // if node is not in list, simply return
        if (!this.nodeDictContainsPair(dict, nodeToHighlight, interactedElement)) {
            return;
        }
        // if there are other elements highlighting the node to highlight
        if (dict[nodeToHighlight].size > 1) { // if set has more than 1 object
            dict[nodeToHighlight]['delete'](interactedElement); // delete element from set
        }
        else {
            delete dict[nodeToHighlight];
        }
    };
    View.prototype.renderHighlightNodesFromDict = function (dict, classToRender, rowOrCol) {
        //unhighlight all other nodes
        if (rowOrCol === void 0) { rowOrCol = 'Row'; }
        //highlight correct nodes
        var cssSelector = '';
        for (var nodeID in dict) {
            if (rowOrCol == 'Row') {
                cssSelector += '#attr' + rowOrCol + nodeID + ',';
            }
            cssSelector += '#topo' + rowOrCol + nodeID + ',';
            if (classToRender == 'answer' && rowOrCol == 'Row') {
                cssSelector += '#nodeLabelRow' + nodeID + ',';
            }
        }
        // remove last comma
        cssSelector = cssSelector.substring(0, cssSelector.length - 1);
        if (cssSelector == '') {
            return;
        }
        d3.selectAll(cssSelector).classed(classToRender, true);
    };
    View.prototype.selectNode = function (nodeID) {
        var index = this.controller.configuration.state.selectedNodes.indexOf(nodeID);
        if (index > -1) {
            this.controller.configuration.state.selectedNodes.splice(index, 1);
        }
        else {
            this.controller.configuration.state.selectedNodes.push(nodeID);
        }
        var attrRow = d3.selectAll('attr' + 'Row' + nodeID);
        attrRow
            .classed('selected', !attrRow.classed('selected'));
        var topoRow = d3.selectAll('topo' + 'Row' + nodeID);
        topoRow
            .classed('selected', !topoRow.classed('selected'));
    };
    View.prototype.selectColumnNode = function (nodeID) {
        // highlight
    };
    /**
     * Old implementation to select the neighboring nodes.
     * @param  nodeID [description]
     * @return        [description]
     */
    View.prototype.selectNeighborNodes = function (nodeID) {
        var nodeIndex = this.controller.configuration.state.adjMatrix.columnSelectedNodes.indexOf(nodeID);
        if (nodeIndex > -1) {
            // find all neighbors and remove them
            this.controller.configuration.state.adjMatrix.columnSelectedNodes.splice(nodeIndex, 1);
            this.removeHighlightNode(nodeID);
            this.controller.configuration.state.adjMatrix.columnSelectedNodes.splice(nodeIndex, 1);
            // remove node from column selected nodes
        }
        else {
            this.addHighlightNode(nodeID);
            this.controller.configuration.state.adjMatrix.columnSelectedNodes.push(nodeID);
        }
        this.renderNeighborHighlightNodes();
        /*let index = this.controller.configuration.state.selectedNodes.indexOf(nodeID);
    
        if(index > -1){ // if in selected node, remove it (unless it is )
          this.controller.configuration.state.selectedNodes.splice(index,1);
          //find all partner nodes
          // if still exists keep,
        } else {
          // add node
          this.controller.configuration.state.selectedNodes.push(nodeID);
    
        }
    
        let attrRow = d3.selectAll('#highlight'+'Attr'+'Row'+nodeID);
        attrRow
          .classed('selected',(d)=>{
            // need to remove if clicked, but not if clicked from another node
            // store hashmap with counts
            // iterate through each time a click and change values
            // if lengths > 0
    
            // Add all elements to set
            // at each click, readd and remove all
    
            // if already selected, remove  and uncolor nodes
            // if not, add and color nodes
    
    
    
            return !
          });//!attrRow.classed('selected')
    
    
        let topoRow = d3.selectAll('#highlight'+'Topo'+'Row'+nodeID);
        topoRow
            .classed('selected',!topoRow.classed('selected'));
    
    
            */
    };
    View.prototype.generateSortAction = function (sortKey) {
        var _this = this;
        return this.controller.model.provenance.addAction('sort', function (currentState) {
            _this.orderType = sortKey;
            _this.controller.configuration.adjMatrix.sortKey = sortKey;
            //add time stamp to the state graph
            currentState.time = Date.now();
            currentState.event = 'sort';
            currentState.sortKey = sortKey;
            if (_this.controller.view, _this.controller.view.mouseoverEvents) {
                currentState.selections.previousMouseovers = _this.controller.view.mouseoverEvents;
                _this.controller.view.mouseoverEvents.length = 0;
            }
            return currentState;
        });
    };
    /**
     * [sort description]
     * @return [description]
     */
    View.prototype.sort = function (orderType) {
        var _this = this;
        var sortKey = orderType;
        var nodeIDs = this.nodes.map(function (node) { return node.id; });
        if (nodeIDs.includes(parseInt(sortKey))) {
            this.order = this.controller.changeOrder(sortKey, true);
        }
        else {
            this.order = this.controller.changeOrder(sortKey);
        }
        this.orderingScale.domain(this.order);
        d3.selectAll('.row')
            //.transition()
            //.duration(transitionTime)
            //.delay((d, i) => { return this.orderingScale(i) * 4; })
            .attr('transform', function (d, i) {
            if (i > _this.order.length - 1)
                return;
            return 'translate(0,' + _this.orderingScale(i) + ')';
        });
        this.attributeRows
            //.transition()
            //.duration(transitionTime)
            //.delay((d, i) => { return this.orderingScale(i) * 4; })
            .attr('transform', function (d, i) { return 'translate(0,' + _this.orderingScale(i) + ')'; });
        // update each highlightRowsIndex
        // if any other method other than neighbors sort
        if (!nodeIDs.includes(parseInt(sortKey))) {
            var t = this.edges; //.transition().duration(transitionTime);
            t.selectAll('.column')
                //.delay((d, i) => { return this.orderingScale(i) * 4; })
                .attr('transform', function (d, i) { return 'translate(' + _this.orderingScale(i) + ',0)rotate(-90)'; });
        }
        /*d3.selectAll('.highlightRow') // taken care of as they're apart of row and column groupings already
          .transition()
          .duration(transitionTime)
          .delay((d, i) => { return this.orderingScale(i) * 4; })
          .attr("transform", (d, i) => { return "translate(0," + this.orderingScale(i) + ")"; })
    
        d3.selectAll('.highlightCol')
          .transition()
          .duration(transitionTime)
          .delay((d, i) => { return this.orderingScale(i) * 4; })
          .attr("transform", (d, i) => { return "translate(" + this.orderingScale(i) + ")rotate(-90)"; });*/
        // change glyph coloring for sort
        d3.selectAll('.glyph').attr('fill', '#8B8B8B');
        // for quantitative values, change their color
        if (this.controller.view.columnGlyphs[sortKey]) {
            this.controller.view.columnGlyphs[sortKey].attr('fill', '#EBB769');
        }
        d3.selectAll('.sortIcon').style('fill', '#8B8B8B').filter(function (d) { return d == sortKey; }).style('fill', '#EBB769');
        if (!nodeIDs.includes(parseInt(sortKey))) {
            var cells = d3.selectAll('.cell') //.selectAll('rect')
                //.transition()
                //.duration(transitionTime)
                //.delay((d, i) => { return this.orderingScale(i) * 4; })
                //.delay((d) => { return this.orderingScale(d.x) * 4; })
                .attr('transform', function (d, i) {
                return 'translate(' + _this.orderingScale(d.x) + ',0)';
            });
        }
        else {
            d3.select('#sortIcon' + sortKey).style('fill', '#EBB769');
        }
    };
    View.prototype.updateCheckBox = function (state) {
        var _this = this;
        if (this.controller.configuration.attributeScales.node.selected == undefined) {
            return;
        }
        var color = this.controller.configuration.attributeScales.node.selected.range[0];
        d3.selectAll('.answerBox').selectAll('rect').transition().duration(250)
            .style('fill', function (d) {
            var answerStatus = d[_this.datumID] in state.selections.answerBox;
            return answerStatus ? color : 'white';
        });
    };
    View.prototype.updateAnswerToggles = function (state) {
        var _this = this;
        if (this.controller.configuration.attributeScales.node.selected == undefined) {
            return;
        }
        var color = this.controller.configuration.attributeScales.node.selected.range[0];
        d3.selectAll('.answerBox').selectAll('circle').transition().duration(500)
            .attr('cx', function (d) {
            var answerStatus = d[_this.datumID] in state.selections.answerBox;
            return (answerStatus ? 3 * _this.columnWidths['selected'] / 4 : 1.15 * _this.columnWidths['selected'] / 4);
        })
            .style('fill', function (d) {
            var answerStatus = d[_this.datumID] in state.selections.answerBox;
            return answerStatus ? color : 'white';
        });
        d3.select('.answerBox').selectAll('rect').transition().duration(500)
            .style('fill', function (d) {
            var answerStatus = d[_this.datumID] in state.selections.answerBox;
            return answerStatus ? '#8B8B8B' : 'lightgray';
        });
    };
    /**
     * [initalizeAttributes description]
     * @return [description]
     */
    View.prototype.initalizeAttributes = function () {
        var _this = this;
        var width = this.controller.visWidth * this.controller.attributePorportion; //this.edgeWidth + this.margins.left + this.margins.right;
        var height = this.controller.visHeight; //this.edgeHeight + this.margins.top + this.margins.bottom;
        this.attributeWidth = width - (this.margins.left + this.margins.right); //* this.controller.attributePorportion;
        this.attributeHeight = height - (this.margins.top + this.margins.bottom); // * this.controller.attributePorportion;
        this.attributes = d3.select('#attributes').append('svg')
            .attr('viewBox', '0 0 ' + (width) + ' ' + height + '')
            .attr('preserveAspectRatio', 'xMinYMin meet')
            .append('g')
            .classed('svg-content', true)
            .attr('id', 'attributeMargin')
            .attr('transform', 'translate(' + 0 + ',' + this.margins.top + ')');
        // add zebras and highlight rows
        /*
        this.attributes.selectAll('.highlightRow')
          .data(this.nodes)
          .enter()
          .append('rect')
          .classed('highlightRow', true)
          .attr('x', 0)
          .attr('y', (d, i) => this.orderingScale(i))
          .attr('width', this.attributeWidth)
          .attr('height', this.orderingScale.bandwidth())
          .attr('fill', (d, i) => { return i % 2 == 0 ? "#fff" : "#eee" })
          */
        var barMargin = { top: 1, bottom: 1, left: 5, right: 5 };
        var barHeight = this.orderingScale.bandwidth() - barMargin.top - barMargin.bottom;
        // Draw each row (translating the y coordinate)
        this.attributeRows = this.attributes.selectAll('.row')
            .data(this.nodes)
            .enter().append('g')
            .attr('class', 'row')
            .attr('transform', function (d, i) {
            return 'translate(0,' + _this.orderingScale(i) + ')';
        });
        this.attributeRows.append('line')
            .attr('x1', 0)
            .attr('x2', this.controller.attrWidth)
            .attr('stroke', '2px')
            .attr('stroke-opacity', 0.3);
        var attributeMouseOver = function (d) {
            _this.addHighlightNodesToDict(_this.controller.hoverRow, d[_this.datumID], d[_this.datumID]); // Add row (rowid)
            _this.addHighlightNodesToDict(_this.controller.hoverCol, d[_this.datumID], d[_this.datumID]); // Add row (rowid)
            _this.mouseoverEvents.push({ time: new Date().getTime(), event: 'attrRow' + d[_this.datumID] });
            d3.selectAll('.hovered').classed('hovered', false);
            _this.renderHighlightNodesFromDict(_this.controller.hoverRow, 'hovered', 'Row');
            _this.renderHighlightNodesFromDict(_this.controller.hoverCol, 'hovered', 'Col');
        };
        this.attributeMouseOver = attributeMouseOver;
        var attributeMouseOut = function (d) {
            _this.removeHighlightNodesToDict(_this.controller.hoverRow, d[_this.datumID], d[_this.datumID]); // Add row (rowid)
            _this.removeHighlightNodesToDict(_this.controller.hoverCol, d[_this.datumID], d[_this.datumID]); // Add row (rowid)
            d3.selectAll('.hovered').classed('hovered', false);
            _this.renderHighlightNodesFromDict(_this.controller.hoverRow, 'hovered', 'Row');
        };
        this.attributeMouseOut = attributeMouseOut;
        this.attributeRows.append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .classed('attrRow', true)
            .attr('id', function (d, i) {
            return 'attrRow' + d[_this.datumID];
        })
            .attr('width', width)
            .attr('height', this.orderingScale.bandwidth()) // end addition
            .attr('fill-opacity', 0)
            .on('mouseover', attributeMouseOver)
            .on('mouseout', attributeMouseOut).on('click', this.clickFunction);
        var columns = this.controller.configuration.nodeAttributes;
        //columns.unshift('selected'); // ANSWER COLUMNS
        var formatCurrency = d3.format('$,.0f'), formatNumber = d3.format(',.0f');
        // generate scales for each
        var attributeScales = {};
        this.columnScale = d3.scaleOrdinal().domain(columns);
        // Calculate Column Scale
        var columnRange = [];
        var xRange = 0;
        var columnWidths = this.determineColumnWidths(columns); // ANSWER COLUMNS
        //450 / columns.length;
        this.columnWidths = columnWidths;
        var categoricalAttributes = ['type', 'continent'];
        var quantitativeAttributes = ['followers_count', 'friends_count', 'statuses_count', 'count_followers_in_query', 'favourites_count', 'listed_count', 'memberFor_days', 'query_tweet_count'];
        columns.forEach(function (col, index) {
            // calculate range
            columnRange.push(xRange);
            var domain = _this.controller.configuration.attributeScales.node[col].domain;
            if (quantitativeAttributes.indexOf(col) > -1) {
                var scale = d3.scaleLinear().domain(domain).range([barMargin.left, columnWidths[col] - barMargin.right]);
                scale.clamp(true);
                attributeScales[col] = scale;
            }
            else {
                // append colored blocks
                // placeholder scale
                var range = _this.controller.configuration.attributeScales.node[col].range;
                var scale = d3.scaleOrdinal().domain(domain).range(range);
                //.domain([true,false]).range([barMargin.left, colWidth-barMargin.right]);
                attributeScales[col] = scale;
            }
            xRange += columnWidths[col];
        });
        this.attributeScales = attributeScales;
        // need max and min of each column
        /*this.barWidthScale = d3.scaleLinear()
          .domain([0, 1400])
          .range([0, 140]);*/
        var placementScale = {};
        this.columnScale.range(columnRange);
        for (var _i = 0, _a = Object.entries(attributeScales); _i < _a.length; _i++) {
            var _b = _a[_i], column = _b[0], scale = _b[1];
            if (categoricalAttributes.indexOf(column) > -1) { // if not selected categorical
                placementScale[column] = this.generateCategoricalLegend(column, columnWidths[column]);
            }
            else if (quantitativeAttributes.indexOf(column) > -1) {
                this.attributes.append('g')
                    .attr('class', 'attr-axis')
                    .attr('transform', 'translate(' + this.columnScale(column) + ',' + -15 + ')')
                    .call(d3.axisTop(scale)
                    .tickValues(scale.domain())
                    .tickFormat(function (d) {
                    if ((d / 1000) >= 1) {
                        d = Math.round(d / 1000) + 'K';
                    }
                    return d;
                }))
                    .selectAll('text')
                    .style('text-anchor', function (d, i) { return i % 2 ? 'end' : 'start'; });
            }
        }
        this.columnGlyphs = {};
        /* Create data columns data */
        columns.forEach(function (column, index) {
            var columnPosition = _this.columnScale(column);
            if (categoricalAttributes.indexOf(column) > -1) { // if categorical
                _this.createUpsetPlot(column, columnWidths[index], placementScale[column]);
                return;
            }
            else if (quantitativeAttributes.indexOf(column) > -1) { // if quantitative
                _this.columnGlyphs[column] = _this.attributeRows
                    .append('rect')
                    .attr('class', 'glyph ' + column)
                    .attr('height', barHeight)
                    .attr('width', 10) // width changed later on transition
                    .attr('x', columnPosition + barMargin.left)
                    .attr('y', barMargin.top) // as y is set by translate
                    .attr('fill', function (d) {
                    return _this.controller.model.orderType == column ? '#EBB769' : '#8B8B8B';
                })
                    .on('mouseover', function (d) {
                    //if (that.columnNames[d] && that.columnNames[d].length > maxcharacters) {
                    //that.tooltip.transition().delay(1000).duration(200).style("opacity", .9);
                    var matrix = this.getScreenCTM()
                        .translate(+this.getAttribute('x'), +this.getAttribute('y'));
                    that.tooltip.html(Math.round(d[column]))
                        .style('left', (window.pageXOffset + matrix.e + columnWidths[column] / 2 - 35) + 'px')
                        .style('top', (window.pageYOffset + matrix.f - 5) + 'px');
                    that.tooltip.transition()
                        .duration(200)
                        .style('opacity', .9);
                    attributeMouseOver(d);
                    //}
                })
                    .on('mouseout', function (d) {
                    that.tooltip.transition().duration(25).style('opacity', 0);
                    attributeMouseOut(d);
                });
                _this.columnGlyphs[column]
                    .transition()
                    .duration(2000)
                    .attr('width', function (d, i) { return attributeScales[column](d[column]); });
                _this.attributeRows
                    .append('div')
                    .attr('class', 'glyphLabel')
                    .text(function (d, i) {
                    return (d);
                });
            }
            else {
                barMargin.left = 1;
                var answerBox = _this.attributeRows
                    .append('g')
                    .attr('id', function (d, i) {
                    return 'tourAnswerBox' + d[_this.datumID];
                })
                    .append('g')
                    .attr('class', 'answerBox')
                    .attr('id', function (d) { return 'answerBox' + d[_this.datumID]; })
                    .attr('transform', 'translate(' + (columnPosition + barMargin.left) + ',' + 0 + ')');
                if (_this.controller.configuration.adjMatrix.toggle) {
                    var rect = answerBox.append('rect')
                        .attr('x', (columnWidths[column] / 4)) // if column with is 1, we want this at 1/4, and 1/2 being mid point
                        .attr('y', barMargin.top)
                        .attr('rx', barHeight / 2)
                        .attr('ry', barHeight / 2)
                        .style('fill', 'lightgray')
                        .attr('width', columnWidths[column] / 2)
                        .attr('height', barHeight)
                        .attr('stroke', 'lightgray')
                        .on('mouseover', attributeMouseOver)
                        .on('mouseout', attributeMouseOut);
                    var circle = answerBox.append('circle')
                        .attr('cx', (1.15 * columnWidths[column] / 4))
                        .attr('cy', barHeight / 2 + barMargin.top)
                        .attr('r', barHeight / 2)
                        .style('fill', 'white')
                        .style('stroke', 'lightgray');
                }
                else {
                    var initalHeight = barHeight;
                    var newBarHeight = d3.min([barHeight, 15]);
                    var rect = answerBox.append('rect')
                        .attr('x', (columnWidths[column] / 2) - newBarHeight / 2) // if column with is 1, we want this at 1/4, and 1/2 being mid point
                        .attr('y', barMargin.top + (initalHeight - newBarHeight) / 2)
                        //.attr("rx", barHeight / 2)
                        //.attr("ry", barHeight / 2)
                        .style('fill', 'white')
                        .attr('width', newBarHeight)
                        .attr('height', newBarHeight)
                        .attr('stroke', 'lightgray')
                        .on('mouseover', attributeMouseOver)
                        .on('mouseout', attributeMouseOut);
                }
                answerBox
                    .on('click', function (d, i, nodes) {
                    var color = _this.controller.configuration.attributeScales.node.selected.range[0];
                    //if already answer
                    var nodeID = _this.determineID(d);
                    /*Visual chagne */
                    var answerStatus = false; // TODO, remove?
                    if (_this.controller.configuration.adjMatrix.toggle) {
                        d3.select(nodes[i]).selectAll('circle').transition().duration(500)
                            .attr('cx', (answerStatus ? 3 * columnWidths[column] / 4 : 1.15 * columnWidths[column] / 4))
                            .style('fill', answerStatus ? color : 'white');
                        d3.select(nodes[i]).selectAll('rect').transition().duration(500)
                            .style('fill', answerStatus ? '#8B8B8B' : 'lightgray');
                    }
                    else {
                    }
                    _this.clickFunction(d, i, nodes);
                    //let action = this.changeInteractionWrapper(nodeID, i, nodes);
                    //this.controller.model.provenance.applyAction(action);
                    //d3.select(nodes[i]).transition().duration(500).attr('fill',)
                });
            }
        });
        // Add Verticle Dividers
        this.attributes.selectAll('.column')
            .data(columns)
            .enter()
            .append('line')
            .style('stroke', '1px')
            .attr('x1', function (d) { return _this.columnScale(d); })
            .attr('y1', -20)
            .attr('x2', function (d) { return _this.columnScale(d); })
            .attr('y2', this.attributeHeight + this.margins.bottom)
            .attr('stroke-opacity', 0.4);
        // Add headers
        var attributeNames = Object.keys(this.controller.configuration.attributeScales.node);
        var attributeLabels = Object.values(this.controller.configuration.attributeScales.node).map(function (obj) { return obj.label; });
        this.columnNames = {};
        for (var i = 0; i < attributeNames.length; i++) {
            this.columnNames[attributeNames[i]] = attributeLabels[i];
        }
        this.columnNames['selected'] = 'Answer';
        /*this.columnNames = {
          "followers_count": "Followers",
          "query_tweet_count": "On-Topic Tweets", // not going to be used (how active this person was on the conference)
          "friends_count": "Friends",
          "statuses_count": "Tweets",
          "favourites_count": "Liked Tweets",
          "count_followers_in_query": "In-Network Followers",
          "continent": "Continent",
          "type": "Type",
          "memberFor_days": "Account Age",
          "listed_count": "In Lists",
          "selected": "Answer"
        }*/
        var that = this;
        function calculateMaxChars(numColumns) {
            switch (numColumns) {
                case 1:
                    return { 'characters': 20, 'font': 13 };
                case 2:
                    return { 'characters': 20, 'font': 13 };
                case 3:
                    return { 'characters': 20, 'font': 12 };
                case 4:
                    return { 'characters': 19, 'font': 12 };
                case 5:
                    return { 'characters': 18, 'font': 12 };
                case 6:
                    return { 'characters': 16, 'font': 11 };
                case 7:
                    return { 'characters': 14, 'font': 10 };
                case 8:
                    return { 'characters': 12, 'font': 10 };
                case 9:
                    return { 'characters': 10, 'font': 10 };
                case 10:
                    return { 'characters': 8, 'font': 10 };
                default:
                    return { 'characters': 8, 'font': 10 };
            }
        }
        var options = calculateMaxChars(columns.length); // 10 attr => 8
        var maxcharacters = options.characters;
        var fontSize = options.font; //*1.1;
        //this.createColumnHeaders();
        var columnHeaders = this.attributes.append('g')
            .classed('column-headers', true);
        var columnHeaderGroups = columnHeaders.selectAll('.header')
            .data(columns)
            .enter()
            .append('g')
            .attr('transform', function (d) { return 'translate(' + (_this.columnScale(d)) + ',' + (-65) + ')'; });
        columnHeaderGroups.on('click', function (d) {
            if (d !== 'selected') {
                var action = _this.generateSortAction(d);
                action.applyAction();
                pushProvenance(_this.controller.model.app.currentState());
                //this.sort(d);
            }
        }).attr('cursor', 'pointer').attr('pointer-events', 'bounding-box');
        columnHeaderGroups
            .append('rect')
            .attr('width', function (d) { return _this.columnWidths[d]; })
            .attr('height', 20)
            .attr('y', 0)
            .attr('x', 0)
            .attr('fill-opacity', 0)
            /*.attr('fill', 'none')*/
            .attr('stroke', 'lightgray')
            .attr('stroke-width', 1)
            .attr('stroke-opacity', 1);
        columnHeaderGroups
            .append('text')
            .classed('header', true)
            //.attr('y', -45)
            //.attr('x', (d) => this.columnScale(d) + barMargin.left)
            .style('font-size', fontSize.toString() + 'px')
            .attr('text-anchor', 'middle')
            //.attr('transform','rotate(-10)')
            .text(function (d, i) {
            if (_this.columnNames[d] && _this.columnNames[d].length > maxcharacters) {
                return _this.columnNames[d].slice(0, maxcharacters - 2) + '...'; // experimentally determine how big
            }
            return _this.columnNames[d];
        })
            .attr('x', function (d) { return _this.columnWidths[d] / 2; })
            .attr('y', 14)
            .on('mouseover', function (d) {
            if (that.columnNames[d] && that.columnNames[d].length > maxcharacters) {
                that.tooltip.transition().duration(200).style('opacity', .9);
                var matrix = this.getScreenCTM()
                    .translate(+this.getAttribute('x'), +this.getAttribute('y'));
                that.tooltip.transition()
                    .duration(200)
                    .style('opacity', .9);
                that.tooltip.html(that.columnNames[d])
                    .style('left', (window.pageXOffset + matrix.e - 25) + 'px')
                    .style('top', (window.pageYOffset + matrix.f - 20) + 'px');
            }
        })
            .on('mouseout', function (d) {
            that.tooltip.transition().duration(250).style('opacity', 0);
        });
        columnHeaderGroups;
        if (columns.length < 6) {
            var path = columnHeaderGroups.filter(function (d) { return d !== 'selected'; }).append('path').attr('class', 'sortIcon').attr('d', function (d) {
                var variable = _this.isCategorical(d) ? 'categorical' : 'quant';
                return _this.controller.model.icons[variable].d;
            }).style('fill', function (d) { return d == _this.controller.model.orderType ? '#EBB769' : '#8B8B8B'; }).attr('transform', 'scale(0.1)translate(' + (-50) + ',' + (-300) + ')')
                .attr('cursor', 'pointer');
        }
        var answerColumn = columnHeaders.selectAll('.header').filter(function (d) { return d == 'selected'; });
        answerColumn.attr('font-weight', 650);
        var nonAnswerColumn = columnHeaders.selectAll('.header').filter(function (d) { return d !== 'selected'; });
        nonAnswerColumn.attr('cursor', 'pointer');
        d3.select('.loading').style('display', 'none');
        this.controller.model.setUpProvenance();
        window.focus();
        // Draw buttons for alternative sorts
        var initalY = -this.margins.left + 10;
        var buttonHeight = 15;
        var text = ['Name', 'Cluster']; //, 'interacts'];
        var sortNames = ['shortName', 'clusterLeaf']; //, 'edges']
        var iconNames = ['alphabetical', 'categorical']; //, 'quant']
        var sortWrapper = this.edges.append('g').attr('class', 'tourSortWrapper');
        var _loop_2 = function (i) {
            var button = sortWrapper //this.edges
                .append('g')
                .attr('transform', 'translate(' + (-this_2.margins.left) + ',' + (initalY) + ')');
            button.attr('cursor', 'pointer').on('click', function () {
                var action = _this.generateSortAction(sortNames[i]);
                action.applyAction();
                pushProvenance(_this.controller.model.app.currentState());
                //this.sort();
            });
            var rect = button.append('rect').attr('width', this_2.margins.left - 5).attr('height', buttonHeight).attr('fill', '#fafafa').attr('stroke', 'gray').attr('stroke-width', 1);
            button.on('mouseover', function (d, i, nodes) {
                d3.select(nodes[i]).select('rect').attr('fill', '#ffffff');
            }).on('mouseout', function (d, i, nodes) {
                d3.select(nodes[i]).select('rect').attr('fill', '#fafafa');
            });
            button.append('text').attr('x', 27).attr('y', 11.5).attr('font-size', 11).text(text[i]);
            var path = button.datum([sortNames[i]]);
            var realPath = path
                .append('path').attr('class', 'sortIcon').attr('d', function (d) {
                return _this.controller.model.icons[iconNames[i]].d;
            }).style('fill', function () { return sortNames[i] == _this.controller.model.orderType ? '#EBB769' : '#8B8B8B'; }).attr('transform', 'scale(0.1)translate(' + (-195) + ',' + (-320) + ')'); /*.on('click', (d,i,nodes) => {
            this.sort(d);
          })*/
            //button
            initalY += buttonHeight + 5;
        };
        var this_2 = this;
        for (var i = 0; i < text.length; i++) {
            _loop_2(i);
        }
        // Append g's for table headers
        // For any data row, add
        /*.on("click", clicked)
        .select(".g-table-column")
        .classed("g-table-column-" + (sortOrder === d3.ascending ? "ascending" : "descending"), function(d) {
          return d === sortKey;
        });*/
    };
    View.prototype.isCategorical = function (column) {
        return column == 'type' || column == 'continent' || column == 'selected';
    };
    View.prototype.determineColumnWidths = function (columns) {
        var widths = {};
        // set all column widths to 0
        // set all categorical column width to their width, keep track of total width
        // set all other columns widths based off width - categorical
        var widthOffset = this.controller.attrWidth / columns.length;
        var totalCategoricalWidth = 0;
        var bandwidthScale = 2;
        if (this.nodes.length < 50) {
            bandwidthScale = (1 / 3);
        }
        var itemSize = d3.min([(bandwidthScale * bandwidth), 30]);
        var bandwidth = this.orderingScale.bandwidth();
        // fill in categorical column sizes
        for (var i = 0; i < columns.length; i++) {
            var column = columns[i];
            // if column is categorical
            if (this.isCategorical(column)) {
                var width = itemSize * (this.controller.configuration.attributeScales.node[column].domain.length + 1.5) + 20;
                if (column == 'selected') {
                    width = 60;
                }
                // place max size of width
                width = d3.min([160, width]);
                widths[column] = width;
                totalCategoricalWidth += width; // add width
            }
        }
        var quantitativeWidth = this.controller.attrWidth - totalCategoricalWidth, quantitativeColumns = columns.length - Object.keys(widths).length, quantitativeColumnSize = quantitativeWidth / quantitativeColumns;
        // fill in remaining columns based off the size remaining for quantitative variables
        for (var i = 0; i < columns.length; i++) {
            var column = columns[i];
            if (!(column in widths)) {
                widths[column] = quantitativeColumnSize;
            }
        }
        return widths;
        // add categorical column width
    };
    View.prototype.createUpsetPlot = function (column, columnWidth, placementScaleForAttr) {
        var _this = this;
        var columnPosition = this.columnScale(column);
        var topMargin = 1;
        var height = this.orderingScale.bandwidth() - 2 * topMargin;
        var bandwidthScale = this.nodes.length < 50 ? (1 / 3) : 2;
        var width = this.orderingScale.bandwidth() * bandwidthScale;
        var numberCategories = this.controller.configuration.attributeScales.node[column].domain.length;
        var legendItemSize = (this.columnWidths[column]) / (numberCategories + 1.5); ///bandwidth * bandwidthScale;
        var _loop_3 = function (index) {
            this_3.attributeRows
                .append('rect')
                .attr('x', placementScaleForAttr[index].position)
                .attr('y', 1)
                .attr('fill', function (d) {
                return d[column] == placementScaleForAttr[index].value ? _this.attributeScales[column](d[column]) : '#dddddd'; // gray version: '#333333'
            })
                .attr('width', legendItemSize)
                .attr('height', height)
                .on('mouseover', function (d, i, nodes) {
                if (d[column] == placementScaleForAttr[index].value) {
                    var matrix = nodes[i].getScreenCTM()
                        .translate(+nodes[i].getAttribute('x'), +nodes[i].getAttribute('y'));
                    _this.tooltip.html(d[column])
                        .style('left', (window.pageXOffset + matrix.e - 25) + 'px')
                        .style('top', (window.pageYOffset + matrix.f - 25) + 'px');
                    _this.tooltip.transition()
                        .duration(200)
                        .style('opacity', .9);
                }
                _this.attributeMouseOver(d);
            })
                .on('mouseout', function (d, i, nodes) {
                _this.tooltip.transition()
                    .duration(25)
                    .style('opacity', 0);
                //that.tooltip.transition().duration(25).style("opacity", 0);
                _this.attributeMouseOut(d);
            });
        };
        var this_3 = this;
        for (var index = 0; index < placementScaleForAttr.length; index++) {
            _loop_3(index);
        }
        return;
    };
    View.prototype.generateCategoricalLegend = function (attribute, legendWidth) {
        var _this = this;
        var numberCategories = this.controller.configuration.attributeScales.node[attribute].domain.length;
        var attributeInfo = this.controller.configuration.attributeScales.node[attribute];
        var dividers = attributeInfo.domain.length;
        var legendHeight = d3.min([25, this.orderingScale.bandwidth()]);
        var bandwidthScale = 2;
        if (this.nodes.length < 50) {
            bandwidthScale = (1 / 3);
        }
        var bandwidth = this.orderingScale.bandwidth();
        var marginEquivalents = 1.5;
        var legendItemSize = (this.columnWidths[attribute] - 5) / (dividers + marginEquivalents); ///bandwidth * bandwidthScale;
        var height = d3.min([bandwidth * bandwidthScale, legendHeight]);
        //(legendWidth) / (dividers + 3/bandwidthScale);
        var margin = marginEquivalents * legendItemSize / dividers;
        var xRange = [];
        var rects = this.attributes.append('g')
            .attr('transform', 'translate(' + (this.columnScale(attribute) + 1 * margin) + ',' + (-legendHeight - 5) + ')'); //
        var _loop_4 = function (i) {
            var rect1 = rects
                .append('g')
                .attr('transform', 'translate(' + (i * (legendItemSize + margin)) + ',0)');
            xRange.push({
                'attr': attribute,
                'value': attributeInfo.domain[i],
                'position': (this_4.columnScale(attribute) + 1 * margin) + (i * (legendItemSize + margin))
            });
            rect1
                .append('rect')
                .attr('x', 0) //(legendItemSize + margin)/2 -this.orderingScale.bandwidth()
                .attr('y', 0)
                .attr('fill', attributeInfo.range[i])
                .attr('width', legendItemSize)
                .attr('height', height);
            rect1
                .append('text')
                .text(attributeInfo.legendLabels[i])
                .attr('x', legendItemSize / 2)
                .attr('y', -3)
                .attr('text-anchor', 'middle')
                .style('font-size', 11);
            //.attr('transform', 'rotate(-90)')
            rect1.on('mouseover', function (d, index, nodes) {
                var matrix = nodes[index].getScreenCTM()
                    .translate(+nodes[index].getAttribute('x'), +nodes[index].getAttribute('y'));
                _this.tooltip.html(attributeInfo.domain[i])
                    .style('left', (window.pageXOffset + matrix.e - 45) + 'px')
                    .style('top', (window.pageYOffset + matrix.f - 20) + 'px');
                _this.tooltip.transition()
                    .duration(200)
                    .style('opacity', .9);
            })
                .on('mouseout', function () {
                _this.tooltip.transition(25)
                    .style('opacity', 0);
            });
        };
        var this_4 = this;
        for (var i = 0; i < dividers; i++) {
            _loop_4(i);
        }
        return xRange;
    };
    /**
     * [selectHighlight description]
     * @param  nodeToSelect    the
     * @param  rowOrCol        String, "Row" or "Col"
     * @param  selectAttribute Boolean of to select attribute or topology highlight
     * @return                 [description]
     */
    View.prototype.selectHighlight = function (nodeToSelect, rowOrCol, attrOrTopo, orientation) {
        if (attrOrTopo === void 0) { attrOrTopo = 'Attr'; }
        if (orientation === void 0) { orientation = 'x'; }
        var selection = d3.selectAll('.' + attrOrTopo + rowOrCol)
            .filter(function (d, i) {
            if (attrOrTopo == 'Attr' && d.index == null) {
                // attr
                return nodeToSelect.index == d[i][orientation];
            }
            //topology
            return nodeToSelect.index == d.index;
        });
        return selection;
    };
    return View;
}());
