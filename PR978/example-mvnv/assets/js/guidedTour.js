var shepherd;

var neighborRows = [];

function welcome(vis,mode) {
  shepherd = setupShepherd(vis,mode);

  if (vis === 'adjMatrix') {
    //set up a group wrapper for the sortIcon so as to not override the native click handler for the sort icon.
    let labelParent = d3.select('#groupCol247943631');
    let labelGroup = labelParent.append('g').attr('class', 'tourLabelGroup');

    labelGroup.node().append(document.querySelector('#sortIcon247943631')); //move the icon into the group wrapper

    //callback for when user clicks on Judge Label
    d3.select('#tourColLabel247943631').on('click', () => {
      if (shepherd.isActive()) {
        groupRows('neighbors','tourNeighborGroup');
        shepherd.next();
      }
    });

    d3.select('#tourAnswerBox247943631').on('click',()=>{
      if (shepherd.isActive()) {
        setTimeout(function(){shepherd.next();},100);
      }

    });

    //callback for when user clicks on Judge sort
    d3.select('.tourLabelGroup').attr('pointer-events','bounding-box').on('click', () => {
      if (shepherd.isActive()) {
        //slight timeout to give the sort time to do it's rearranging of rows
        setTimeout(function() {
          groupRows('neighbors','tourNeighborGroup');
          shepherd.next();
        }, 100);
      }
    });
  }

  shepherd.start();
}


function unGroupRows(){
  let parentSelector =
  vis === 'nodeLink' ? '.nodes' : '#edgeMargin';

neighborRows.map((n) => {
  let neighbor = document.querySelector(n.selector);
  d3.select(parentSelector)
    .node()
    .insertBefore(neighbor, n.insertBefore);
});

}

function highlightCells(){

  let ids = ['81658145','30009655','201277609','1652270612','16112517'] ;
  let cellIDs=[];

  ids.map((source)=>{
    ids.map((target)=>{
      cellIDs.push('#cell'+source + '_' + target);
      cellIDs.push('#cell'+target + '_' + source);
    });
  });

  cellIDs.map((id)=>{
    d3.select(id).classed('clusterSelected',true);
  });
}

function unHighlightCells(){
  d3.selectAll('.clusterSelected').classed('clusterSelected',false);
}
function groupRows(mode,className) {
  let parentSelector = vis === 'nodeLink' ? '.nodes' : '#edgeMargin';

  let group = d3.select('.' + className);
  if (group.size() === 0) {
    group = d3
      .select(parentSelector)
      .append('g')
      .attr('class',className);
    //move to before gridlines;
    document
      .querySelector(parentSelector)
      .insertBefore(group.node(), document.querySelector('.gridLines'));
  }

  let neighbors = mode === 'neighbors' ? [
    '#groupRow318046158',
    '#groupRow1652270612',
    '#groupRow136400506',
    '#groupRow16112517',
    '#groupRow1873322353',
    '#groupRow19299318',
    '#groupRow2873695769'
  ] : ['#groupRow81658145','#groupRow30009655','#groupRow201277609','#groupRow1652270612'] ;
  // "#groupCol81658145", "#groupCol30009655","#groupCol201277609","#groupCol1652270612"];

  let neighborFlag = false;
  d3.selectAll('.row').each(function(d, i) {
    let selector = '#groupRow' + d.id;
    let isNeighbor = neighbors.includes(selector);

    if (neighborFlag && !isNeighbor) {
      //tag this as the position you later want to reinsert the neighbor;
      neighborRows.map((row) =>
        row.insertBefore
          ? ''
          : (row.insertBefore = document.querySelector(selector))
      );
    }

    neighborFlag = false;
    if (isNeighbor) {
      neighborFlag = true;
      neighborRows.push({ selector });
    }
  });

  neighbors.map((n) => {
    let neighbor = document.querySelector(n);
    group.node().appendChild(neighbor);
  });
}

function setupShepherd(vis,mode) {
  //   var prefix = "demo-";


  var shepherd = new Shepherd.Tour({
    defaultStepOptions: {
      //   classes: "class-1 class-2",
      scrollTo: {
        behavior: 'smooth',
        block: 'center'
      },
      showCancelLink: false,
      tippyOptions: {
        maxWidth: '400px',
        popperOptions: {
          modifiers: {
            preventOverflow: {
              escapeWithReference: true
            }
          }
        }
      }
    },
    // classPrefix: prefix,
    // This should add the first tour step
    steps: [],
    useModalOverlay: true,
    styleVariables: {
      // arrowSize:2.5,
      shepherdThemePrimary: '#1b5486',
      shepherdThemeSecondary: '#e5e5e5',
      //   shepherdButtonBorderRadius: 6,
      //   shepherdElementBorderRadius: 6,
      // //   shepherdHeaderBackground: '#eeeeee',
      // //   shepherdThemePrimary: '#9b59b6',
      //   useDropShadow: true,
      overlayOpacity: 0.25
    }
  });

  let introSteps = [
    {
      title: 'Task Definition',
      text: 'This area contains the task you will be answering.',
      attachTo: {
        element: '.taskCard',
        on: 'right'
      },
      buttons: [
        // {
        //   action: function() {
        //     updateStudyProvenance("exited tour");
        //     return this.cancel();
        //   },
        //   secondary: true,
        //   text: "Exit"
        // },
        {
          action: function() {
            updateStudyProvenance('started guided tour');
            return this.next();
          },
          text: 'Next'
        }
      ],
      id: 'welcome'
    },
    {
      title: 'Searching for a Node',
      text: 'You can search for any node by name. <span class=\'instructions\'>Try searching for Judge</span>',
      attachTo: {
        element: '.searchInput',
        on: 'bottom'
      },
      buttons: [
        {
          action: function() {
            updateStudyProvenance('back');
            return this.back();
          },
          secondary: true,
          text: 'Back'
        }
      ],
      id: 'creating',
      modalOverlayOpeningPadding: '10'
    }
  ];

  //don't add introSteps for 'bubble' mode
  if (mode === undefined){
    shepherd.addSteps(introSteps);
  }

  if (vis === 'adjMatrix') {
    const steps = [
      {
        title: 'Highlighted Row',
        text: 'This has highlighted the row representing Judge. It also highlights the cell where Judge\'s row intersects with his column with a black frame.',
        attachTo: {
          element: '#groupRow247943631',
          // element:'#Judge_group',
          on: 'top'
        },
        buttons: [
          {
            action: function() {
              //clear the search bar
              d3.select('.searchInput').property('value','');
              updateStudyProvenance('back');
              window.controller.model.provenance.goBackOneStep();
              return this.back();
            },
            secondary: true,
            text: 'Back'
          },
          {
            action: function() {
              updateStudyProvenance('next');
              return this.next();
            },
            text: 'Next'
          }
        ],
        id: 'attaching'
      },
      {
        title: 'Highlighted Column ',
        text: 'Every row has a corresponding column. When you highlight a row, the corresponding column is also highlighted. ',
        attachTo: {
          element: '#groupCol247943631',
          on: 'right'
        },
        buttons: [
          {
            action: function() {
              updateStudyProvenance('back');
              return this.back();
            },
            secondary: true,
            text: 'Back'
          },
          {
            action: function() {
              updateStudyProvenance('next');
              return this.next();
            },
            text: 'Next'
          }
        ],
        id: 'attaching'
      },
      {
        title: 'Un-highlighting a search result',
        text: 'To un-highlight nodes that are highlighted through search, click on the black outlined cell at the intersection of that node\'s row and column. <span class=instructions> Try it here to unselect Judge\'s row and column</span>',
        attachTo: {
          element: '#cell247943631_247943631',
          on: 'right'
        },
        buttons: [
          {
            action: function() {
              window.controller.model.provenance.goBackOneStep();
              updateStudyProvenance('back');
              return this.back();
            },
            secondary: true,
            text: 'Back'
          },
          {
            action: function() {
              updateStudyProvenance('next');
              return this.next();
            },
            text: 'Next'
          }
        ],
        id: 'attaching',
        modalOverlayOpeningPadding: '5'

      },

      {
        title: 'Highlighting Neighbors',
        text: '<span class=instructions> Highlight judge\'s neighbors by clicking on the column label </span>',
        attachTo: {
          element: '#tourColLabel247943631',
          on: 'right'
        },
        buttons: [
          {
            action: function() {
              d3.select('#search-input').property('value','');
              d3.select('#search-input').property('value','Judge');
              updateStudyProvenance('back');
              return this.back();
            },
            secondary: true,
            text: 'Back'
          }
        ],
        id: 'attaching',
        modalOverlayOpeningPadding: '5'

      },
      {
        title: 'Neighbors ',
        text: 'This highlights all of Judge\'s neighbors in green.',
        attachTo: {
          element: '.tourNeighborGroup',
          on: 'right'
        },
        buttons: [
          {
            action: function() {
               unGroupRows();
              window.controller.model.provenance.goBackOneStep();
              updateStudyProvenance('back');
              return this.back();
            },
            secondary: true,
            text: 'Back'
          },
          {
            action: function() {
              unGroupRows();
              updateStudyProvenance('next');
              return this.next();
            },
            text: 'Next'
          }
        ],
        id: 'attaching',

      },
      {
        title: 'Grouping Neighbors ',
        text:
          'You can bring all neighbors to the top of the matrix by clicking on the sort icon. <span class=instructions>Try it out!</span>',
        attachTo: {
          element: '#sortIcon247943631',
          on: 'right'
        },
        buttons: [
          {
            action: function() {
              groupRows('neighbors','tourNeighborGroup');
              updateStudyProvenance('back');
              return this.back();
            },
            secondary: true,
            text: 'Back'
          }
        ],
        id: 'attaching',
        modalOverlayOpeningPadding: '10'

      },
      {
        title: 'Grouping Neighbors ',
        text:
          'All of judge\'s neighbors are now grouped at the top of the matrix',
        attachTo: {
          element: '.tourNeighborGroup',
          on: 'right'
        },
        buttons: [
          {
            action: function() {
              unGroupRows();
              // window.controller.view.sort('shortName');
              updateStudyProvenance('back');
              window.controller.model.provenance.goBackOneStep();
              return this.back();
            },
            secondary: true,
            text: 'Back'
          },
          {
            action: function() {
             unGroupRows();
             updateStudyProvenance('next');
              return this.next();
            },
            text: 'Next'
          }
        ],
        id: 'attaching',

      },
      {
        title: 'Attributes  ',
        text: 'You can see the attributes for all nodes in the adjacent table',
        attachTo: {
          element: '#attributeMargin',
          on: 'left'
        },
        buttons: [
          {
            action: function() {
              groupRows('neighbors','tourNeighborGroup');
              updateStudyProvenance('back');
              return this.back();
            },
            secondary: true,
            text: 'Back'
          },
          {
            action: function() {
              updateStudyProvenance('next');
              return this.next();
            },
            text: 'Next'
          }
        ],
        id: 'attaching'
      },
      {
        title: 'Sorting by Attribute',
        text: '<span class=instructions>Click on a column header to sort by that attribute </span>',
        attachTo: {
          element: '.column-headers',
          on: 'left'
        },
        buttons: [
          {
            action: function() {
              window.controller.view.sort('shortName');
              updateStudyProvenance('back');
              return this.back();
            },
            secondary: true,
            text: 'Back'
          },
          {
            action: function() {
              updateStudyProvenance('next');
              return this.next();
            },
            text: 'Next'
          }
        ],
        id: 'attaching'
      },
      {
        title: 'Clearing Highlights',
        text:
          ' <span class=\'instructions\'>Clear all highlights by clicking on the \'Clear Highlighted Nodes\' to the left</span> ',
        attachTo: {
          element: '#clear-selection',
          on: 'right'
        },
        buttons: [
          {
            action: function() {
              window.controller.view.sort('shortName');
              updateStudyProvenance('back');
              // window.controller.model.provenance.goBackOneStep();
              return this.back();
            },
            secondary: true,
            text: 'Back'
          }
        ],
        id: 'attaching'
      },
      {
        title: 'Sorting',
        text: 'You can also sort based on the node names [alphabetically] or clusters in the graph.<span class=instructions>Try sorting by cluster! </span>',
        attachTo: {
          element: '.tourSortWrapper',
          on: 'right'
        },
        buttons: [
          {
            action: function() {
              window.controller.model.provenance.goBackOneStep();
              updateStudyProvenance('back');
              return this.back();
            },
            secondary: true,
            text: 'Back'
          },
          {
            action: function() {
              groupRows('cluster','tourClusterWrapper');
              highlightCells();
              updateStudyProvenance('next');
              return this.next();
            },
            text: 'Next'
          }
        ],
        id: 'attaching'
      },
      {
        title: 'Clusters',
        text: 'The edges highlighted in orange connect the nodes in a cluster. You can generally identify clusters as groups of edges, meaning groups of filled in cells.',
        attachTo: {
          element: '.tourClusterWrapper',
          on: 'right'
        },
        buttons: [
          {
            action: function() {
              unGroupRows();
              unHighlightCells();
              window.controller.view.sort('shortName');
              updateStudyProvenance('back');
              return this.back();
            },
            secondary: true,
            text: 'Back'
          },
          {
            action: function() {
              unGroupRows();
              unHighlightCells();
              updateStudyProvenance('next');
              return this.next();
            },
            text: 'Next'
          }
        ],
        id: 'attaching'
      },
      {
        title: 'Edge Hover ',
        text:
          '<span class=instructions>Hover over a cell (the edge)  to highlight both the row and the column intersecting at the cell.</span> ' +
          ' Notice this also highlights the row corresponding to the selected column, and vice versa.',

        attachTo: {
          element: '.svg-content',
          // element:'#Judge_group',
          on: 'right'
        },
        buttons: [
          {
            action: function() {
              groupRows('cluster','tourClusterWrapper');
              highlightCells();
              updateStudyProvenance('back');
              return this.back();
            },
            secondary: true,
            text: 'Back'
          },
          {
            action: function() {
              updateStudyProvenance('next');
              return this.next();
            },
            text: 'Next'
          }
        ],
        id: 'attaching'
      },
      {
        title: 'Edge Click ',
        text:
          '<span class=instructions>Click on a cell (edge) to select the rows and cols highlighted on hover.</span> This also outlines the clicked edge  and the ‘mirror edge’ in red. ',

        attachTo: {
          element: '.svg-content',
          // element:'#Judge_group',
          on: 'right'
        },
        buttons: [
          {
            action: function() {
              window.controller.model.provenance.goBackOneStep();
              updateStudyProvenance('back');
              return this.back();
            },
            secondary: true,
            text: 'Back'
          },
          {
            action: function() {
              updateStudyProvenance('next');
              return this.next();
            },
            text: 'Next'
          }
        ],
        id: 'attaching'
      },
      {
        title: 'Selecting an Answer ',
        text:
          'To select a node as the answer to a task, use the checkbox under the \'answer column\' for that row.',

        attachTo: {
          element: '#tourAnswerBox247943631',
          on: 'left'
        },
        buttons: [
          {
            action: function() {
              window.controller.model.provenance.goBackOneStep();
              updateStudyProvenance('back');
              return this.back();
            },
            secondary: true,
            text: 'Back'
          }
        ],
        id: 'attaching'
      },
      {
        title: 'Answer List',
        text: 'This populates the answer panel so you can easily keep track of the node(s) you are going to submit as your answer',
        attachTo: {
          element: '.answerCard',
          on: 'right'
        },
        buttons: [
          {
            action: function() {
              window.controller.model.provenance.goBackOneStep();
              updateStudyProvenance('back');
              return this.back();
            },
            secondary: true,
            text: 'Back'
          },
          {
            action: function() {
              updateStudyProvenance('next');
              return this.next();
            },
            secondary: true,
            text: 'Next'
          }
        ],
        id: 'attaching',
        modalOverlayOpeningPadding: '10'
      },
      {
        title: 'And you\'re ready!',
        text: 'Thanks for taking the tour, you are ready to begin the practice tasks!',
        buttons: [
          {
            action: function() {

              window.controller.model.provenance.reset();
              updateStudyProvenance('ended guided tour');
              return this.next();
            },
            secondary: true,
            text: 'Let\'s Get Started'
          }
        ],
        id: 'attaching',
        modalOverlayOpeningPadding: '10'
      },
    ];

    shepherd.addSteps(steps);
  } else if (vis === 'nodeLink' && mode === undefined) {
    const steps = [
      {
        title: 'Highlighted Node',
        text: 'This has highlighted the Node representing Judge. <span class=instructions>Try clicking on the node [not on the label] to un-highlight, then re-highlight the same node.</span>',
        attachTo: {
          element: '#Judge_group',
          on: 'top'
        },
        buttons: [
          {
            action: function() {
              d3.select('.searchInput').property('value','');
              updateStudyProvenance('back');
              return this.back();
            },
            secondary: true,
            text: 'Back'
          },
          {
            action: function() {
              updateStudyProvenance('next');
              return this.next();
            },
            text: 'Next'
          }
        ],
        id: 'attaching',
        modalOverlayOpeningPadding: '10'

      },
      {
        title: 'Highlight Neighbors',
        text: 'Selecting a node, whether through click or search, also highlights all of its neighbors',
        attachTo: {
          element: '.nodes',
          on: 'left'
        },
        buttons: [
          {
            action: function() {
              updateStudyProvenance('back');
              return this.back();
            },
            secondary: true,
            text: 'Back'
          },
          {
            action: function() {
              updateStudyProvenance('next');
              return this.next();
            },
            text: 'Next'
          }
        ],
        id: 'attaching'
      },
      {
        title: 'Dragging Nodes',
        text: 'You can drag nodes around to get a better sense of the structure of the network. <span class=instructions>Try dragging a few nodes around.</span>',
        attachTo: {
          element: '.nodes',
          on: 'left'
        },
        buttons: [
          {
            action: function() {
              updateStudyProvenance('back');
              return this.back();
            },
            secondary: true,
            text: 'Back'
          },
          {
            action: function() {
              updateStudyProvenance('next');
              return this.next();
            },
            text: 'Next'
          }
        ],
        id: 'attaching'
      },
      {
        title: 'Attribute Encoding',
        text: 'For some tasks, you will see attribute encodings directly inside the nodes. Hovering over the node shows tooltips with exact values.',
        attachTo: {
          element: '#Troy_group',
          on: 'left'
        },
        buttons: [
          {
            action: function() {
              updateStudyProvenance('back');
              return this.back();
            },
            secondary: true,
            text: 'Back'
          },
          {
            action: function() {
              updateStudyProvenance('next');
              return this.next();
            },
            secondary: true,
            text: 'Next'
          }
        ],
        id: 'attaching',
        modalOverlayOpeningPadding: '10'
      },
      {
        title: 'Legend',
        text: 'The legend on the left shows what the bars and other icons represent. In this case, the bars represent the number of followers, and the number of friends, while the colored circles show if the node is a person or an institution.  <p> Note that \'1.2k\' (1.2 kilo) is a short form for 1200. </p>',
        attachTo: {
          element: '#legendDiv',
          on: 'right'
        },
        buttons: [
          {
            action: function() {
              updateStudyProvenance('back');
              return this.back();
            },
            secondary: true,
            text: 'Back'
          },
          {
            action: function() {
              unGroupRows();
              updateStudyProvenance('next');
              return this.next();
            },
            text: 'Next'
          }
        ],
        id: 'attaching'
      },
      {
        title: 'Clearing Highlights',
        text:
          'At any point you can clear your highlighted nodes with the clear highlights button. <span class=instructions>Try it out!</span> ',
        attachTo: {
          element: '#clear-selection',
          on: 'left'
        },
        buttons: [
          {
            action: function() {
              updateStudyProvenance('back');
              return this.back();
            },
            secondary: true,
            text: 'Back'
          }
        ],
        id: 'attaching'
      },
      {
        title: 'Selecting an Answer',
        text: 'To select a node as your answer, click anywhere on the top label of the node. <span class=instructions> Try selecting Sarah as an answer node</span>!',
        attachTo: {
          element: '#Sarah_group .labelBackground',
          on: 'left'
        },
        buttons: [
          {
            action: function() {
              updateStudyProvenance('back');
              return this.back();
            },
            secondary: true,
            text: 'Back'
          },
          {
            action: function() {
              updateStudyProvenance('next');
              return this.next();
            },
            secondary: true,
            text: 'Next'
          }
        ],
        id: 'attaching',
        modalOverlayOpeningPadding: '10'
      },
      {
        title: 'Answer List',
        text: 'This populates the answer panel so you can easily keep track of the node(s) you are going to submit as your answer',
        attachTo: {
          element: '.answerCard',
          on: 'right'
        },
        buttons: [
          {
            action: function() {
              updateStudyProvenance('back');
              return this.back();
            },
            secondary: true,
            text: 'Back'
          },
          {
            action: function() {
              updateStudyProvenance('next');
              return this.next();
            },
            secondary: true,
            text: 'Next'
          }
        ],
        id: 'attaching',
        modalOverlayOpeningPadding: '10'
      },
      {
        title: 'And you\'re ready!',
        text: 'Thanks for taking this tour, you are ready to start the practice tasks!',
        buttons: [
          {
            action: function() {
              provenance.reset();
              updateStudyProvenance('ended guided tour');

              return this.next();
            },
            secondary: true,
            text: 'Let\'s Get Started'
          }
        ],
        id: 'attaching',
        modalOverlayOpeningPadding: '10'
      }
    ];

    shepherd.addSteps(steps);

  } else if (vis === 'nodeLink' && mode === 'bubbles'){
    steps = [
      {
        title: 'Colored and Sized Nodes',
        text: 'You will also see representations of this network where color and size are used to encode attributes.',
        attachTo: {
          element: '.nodes',
          on: 'left'
        },
        buttons: [
          // {
          //   action: function() {
          //     updateStudyProvenance("exited tour");
          //     return this.cancel();
          //   },
          //   secondary: true,
          //   text: "Exit"
          // },
          {
            action: function() {
              updateStudyProvenance('started second guided tour');
              return this.next();
            },
            text: 'Next'
          }
        ],
        id: 'attaching',
        modalOverlayOpeningPadding: '10'

      },
      {
        title: 'Highlight Neighbors ',
        text: 'Just as with the previous task, clicking on a node [outside of its label] highlights the node as well as all of its neighbors. <span class=\'instructions\'>Try it out!</span>',
        attachTo: {
          element: '#Judge_group',
          on: 'left'
        },
        buttons: [
          {
            action: function() {
              updateStudyProvenance('back');
              return this.back();
            },
            secondary: true,
            text: 'Back'
          },
          {
            action: function() {
              updateStudyProvenance('next');
              return this.next();
            },
            text: 'Next'
          }
        ],
        id: 'attaching'
      },
      {
        title: 'Legend',
        text: '<p>The legend on the left shows what the color and size of the nodes represent.</p> ' +

        '<p>In this case, the color represents the continent of origin. <span class=\'instructions\'>You can hover over the legend labels to see the full names.</span> </p> ' +
        ' <p>The size is proportional to the the number of followers.</p>',
        attachTo: {
          element: '#legendDiv',
          on: 'right'
        },
        buttons: [
          {
            action: function() {
              updateStudyProvenance('back');
              return this.back();
            },
            secondary: true,
            text: 'Back'
          },
          {
            action: function() {
              unGroupRows();
              updateStudyProvenance('next');
              return this.next();
            },
            text: 'Next'
          }
        ],
        id: 'attaching'
      },
      {
        title: 'Answer Box',
        text: 'Answers that require a numeric or string value, provide an input text box such as this one.',
        attachTo: {
          element: '.answerCard',
          on: 'right'
        },
        buttons: [
          {
            action: function() {
              updateStudyProvenance('back');
              return this.back();
            },
            secondary: true,
            text: 'Back'
          },
          {
            action: function() {
              updateStudyProvenance('next');
              return this.next();
            },
            secondary: true,
            text: 'Next'
          }
        ],
        id: 'attaching',
        modalOverlayOpeningPadding: '10'
      },
      {
        title: 'And you\'re ready!',
        text: 'Thanks for taking this second tour, you are ready to take your last practice task!',
        buttons: [
          {
            action: function() {
              provenance.reset();
              updateStudyProvenance('ended second guided tour');

              return this.next();
            },
            secondary: true,
            text: 'Let\'s Get Started'
          }
        ],
        id: 'attaching',
        modalOverlayOpeningPadding: '10'
      }
    ];
    shepherd.addSteps(steps);
  }

  return shepherd;
}
