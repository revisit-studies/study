
//create small graph from large ones;
(async function() {
  let smallGraphPosName = 'smallGraphPos.json';

  let largeGraphs = ['network_large_undirected_singleEdge.json','network_large_undirected_multiEdge.json','network_large_directed_multiEdge.json'];
  
  largeGraphs.map(async (graphName)=>{
    let largeGraph = await d3.json('data/' + graphName);
    let smallGraphSubset = await d3.json('data/raw/' + smallGraphPosName);

    let smallGraph = {};
    smallGraph.nodes = largeGraph.nodes.filter((n)=>smallGraphSubset.nodes.find((sn)=>sn.id == n.id));
    smallGraph.links = largeGraph.links.filter((l)=>smallGraphSubset.nodes.find((n)=>n.id == l.source) && smallGraphSubset.nodes.find((n)=>n.id == l.target));

  
    //associate positions to smallGraphs;
    smallGraphSubset.nodes.map((n)=>{
      let node = smallGraph.nodes.find((nn)=>nn.id == n.id);
      node.x = n.x;
      node.y = n.y;
    });  

    // debugger

    // saveToFile(smallGraph, graphName.replace('large','small'));

  });
})();



// create large graphs
(async function() {
  let graph = await d3.json('data/raw/Eurovis2019Network.json');

  let tweets = await d3.json('data/raw/Eurovis2019Tweets.json');

  tweets = tweets.tweets;

  // let nodes = await d3.json("data/raw/sample_curated_info.json");
  let nodes = await d3.json('data/raw/curated_info.json');

  let config = await d3.json('configs/baseConfig.json');

  // let mds = await d3.json("data/raw/largeGraphVisone.json");
  // let mds = await d3.json("data/raw/sample_manual_pos.json");
  let mds = await d3.json('data/raw/large_manual_pos.json');


  
  // let mds = await d3.json("data/raw/smallGraphVisone.json")

  let users = await d3.json('data/raw/userInfo.json');



  //iterate through all graph nodes and add more information:
  graph.nodes.map((node) => {
    let moreInfo = users.find((n) => n.screen_name === node.screen_name);

    if (moreInfo) {
      node.memberSince = new Date(moreInfo.created_at);
      node.name = moreInfo.name;
      node.location = moreInfo.location;

      let today = new Date().getTime();
      let memberStart = new Date(node.memberSince).getTime();
      node.memberFor_days = Math.ceil(
        Math.abs(today - memberStart) / (1000 * 60 * 60 * 24)
      );
    }
  });

  let isDirected;
  let hasEdgeTypes;

  let graphSize;
  let newGraph;

  // console.log(JSON.stringify(graph.nodes.filter(n=>n.memberSince)[0]));
  let createEdge = function(source, target, type) {
    // console.log('calling createEdge')
    //stop adding edges if reached desired size of graph
    if (newGraph.nodes.length >= graphSize) {
      graphDone = true;
      return;
    }

    if (source && target) {
      //check to see that either source or target node already exists in the graph ( to ensure a connected graph)
      let sourceExists =
        newGraph.nodes.find((n) => n.id === source.id) !== undefined;
      let targetExists =
        newGraph.nodes.find((n) => n.id === target.id) !== undefined;

      if (!sourceExists && !targetExists && newGraph.nodes.length > 0) {
        //neither source or target already exists in the graph, don't add node to ensure only connected componetns.

        return;
      }

      let link = {
        source: source.id,
        target: target.id,
        type: hasEdgeTypes ? type : 'interacted', //set type based on flag to combine edges or not;
        count: 1,
        id: source.id + '_' + target.id + '_' + type,
        selected: false
      };

      let existingLink = newGraph.links.find((l) => {
        //check for source and target in that order;
        let directedCondition =
          l.source === link.source && l.target === link.target;

        //check for source and target or target and source combination
        let undirectedCondition =
          directedCondition ||
          (l.source === link.target && l.target === link.source);

        //Set condition based on directedFlag
        let condition = isDirected ? directedCondition : undirectedCondition;

        return condition && l.type === link.type;
      });

      //either increase the count of an existing link or add a new link
      if (!existingLink) {
        newGraph.links.push(link);
      } else {
        existingLink.count = existingLink.count + 1;
      }

    
      //Either add a new node or update neighbors and edge info for existing node;
      [source, target].map((node) => {
        let source_node = node;
        let target_node = node === source ? target : source;

        if (!newGraph.nodes.find((n) => n.id === source_node.id)) {
          source_node.type = nodes[source_node.id].type;
          source_node.continent = nodes[source_node.id].continent;
          source_node.shortName = nodes[source_node.id].shortName;

    
          source_node.x = mds.nodes.find(
            (m) => m.id == source_node.id
          ).x;
          source_node.y = mds.nodes.find(
            (m) => m.id == source_node.id
          ).y;

          if (!existingLink) {
            source_node.neighbors = [target_node.id];
            source_node.edges = [link.id];
          }
          source_node.userSelectedNeighbors = []; //Keep track of when users have selected it's neighbors to keep it highlighted.
          source_node.selected = false;
          newGraph.nodes.push(source_node);
          // console.log('pushing ' + source.screen_name + ' that connects to ' + target.screen_name)
        } else {
          if (!existingLink) {
            source_node.neighbors.push(target_node.id);
            source_node.edges.push(link.id);
          }
        }
      });
    }
  };

  //Iterate through all the combinations and write out a file for each
  //For each size

    graphSize = 'large';
    //With each directionality
    [false, true].map((isDirectedFlag) => {
      //For each edge type
      [false, true].map((hasEdgeTypesFlag) => {
        graph.links = [];
        newGraph = { nodes: [], links: [] };

        isDirected = isDirectedFlag;
        hasEdgeTypes = hasEdgeTypesFlag;

        //don't make a directed graph if edgeTypes are not set to true;
        if (isDirected && !hasEdgeTypes) {
          // do nothing
        } else {
          // while (!graphDone) {
          tweets.map((tweet) => {
            //if a tweet retweets another retweet, create a 'retweeted' edge between the re-tweeter and the original tweeter.
            if (tweet.retweeted_status) {
              let source = graph.nodes.find((n) => n.id === tweet.user.id);
              let target = graph.nodes.find(
                (n) => n.id === tweet.retweeted_status.user.id
              );

              createEdge(source, target, 'retweet');
            } else {
              //if a tweet mentions a person, create a 'mentions' edge between the tweeter, and the mentioned person.
              tweet.entities.user_mentions.map((mention) => {
                let source = graph.nodes.find((n) => n.id === tweet.user.id);
                let target = graph.nodes.find((n) => n.id === mention.id);

                createEdge(source, target, 'mentions');
              });
            }
          });

          //Manually add Edges; 

        
          newEdges = [{source:201277609, target:1652270612, type:'retweet'}, //edge between sample nodes
        {source:40219508,target:19283433,type:'mention'}, //edge between Noeska and giCentre
        {source:40219508,target:10414152,type:'mention'}, //edge between Noeska and Lane
        // {source:40219508,target:30009655,type:'retweet'}, //edge between Noeska and James
        // {source:40219508,target:201277609,type:'retweet'}, //edge between Noeska and Jon
        {source:40219508,target:81658145,type:'mention'}]; //edge between Alex and Noeska

          newEdges.map((edge)=>{
            let source = graph.nodes.find((n) => n.id === edge.source);
            let target = graph.nodes.find(
              (n) => n.id === edge.target
            );

            createEdge(source, target, edge.type);
          });

          //adjust node data that falls outside of the domains established in the config file;
          Object.keys(config.attributeScales.node).map((attr) => {
            let scale = config.attributeScales.node[attr];

            if (typeof scale.domain[0] === typeof 2) {
              //Randomly assign values within the top 20% of the scale for values that are greater than the established domain.
              let adjustmentWindow = (scale.domain[1] - scale.domain[0]) * 0.3;
              let maxValue = scale.domain[1];
              newGraph.nodes.map((n) => {
                n[attr] =
                  n[attr] >= maxValue
                    ? maxValue - Math.random() * adjustmentWindow
                    : n[attr];
              });
            }
          });

          //adjust edge data that falls outside of the domains established in the config file;
          Object.keys(config.attributeScales.edge).map((attr) => {
            let scale = config.attributeScales.edge[attr];

            if (typeof scale.domain[0] === typeof 2) {

              //Randomly assign values within the top 30% of the scale for values that are greater than the established domain.
              let adjustmentWindow = (scale.domain[1] - scale.domain[0]) * 0.3;
              let maxValue = scale.domain[1];

              newGraph.links.map((l) => {
                l[attr] =
                  l[attr] >= maxValue
                    ? Math.round(maxValue - Math.random() * adjustmentWindow)
                    : l[attr];
              });
            }
          });

          let filename =
            'network_large_' +
            (isDirected ? 'directed' : 'undirected') +
            '_' +
            (hasEdgeTypes ? 'multiEdge' : 'singleEdge') +
            '.json';
          // saveToFile(newGraph, filename);
        }
      });
    });
 

  //create a barebones graph to import into Visone; 
  let bareBonesGraph= {'nodes':[],'links':[]};

  newGraph.nodes.map((n)=>bareBonesGraph.nodes.push({'id':n.id,'name':n.name}));
  newGraph.links.map((l,i)=>{
    let source = newGraph.nodes.find((n)=>n.id === l.source);
    let target = newGraph.nodes.find((n)=>n.id === l.target);
    bareBonesGraph.links.push({'source':newGraph.nodes.indexOf(source),'target':newGraph.nodes.indexOf(target),'id':i});
  });
    
  // Inform revisit that the stimuli is loaded.
  Revisit.postReady();
  // saveToFile(bareBonesGraph,'layoutGraph.json')
  
})();

function saveToFile(data, filename) {

  console.log( 'saving ', filename);
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
