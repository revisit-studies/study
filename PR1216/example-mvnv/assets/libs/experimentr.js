experimentr = function() {
  var experimentr = { version: '0.0.1' }
    , sequence
    , current
    , mainDiv
    , data = {};

  // Add a random postId for each new participant
  data.postId = (+new Date()).toString(36);

  // Accessor for postId
  experimentr.postId = function() {
    return data.postId;
  };
  // Accessor for data
  experimentr.data = function() {
    return data;
  };

  // Starts the experiment by loading the first module
  experimentr.start = function() {
    init();
    current = 0;
    activate(current);
    experimentr.startTimer('experiment');
  };

  // Add a function to be called when a person clicks next.
  // (This can be cleared with clearNext()).
  experimentr.onNext = function(cb) {
    d3.select('#next-button').on('click', function() {
      cb();
      experimentr.next();
    });
  };

  // Reset the callbacks on next click.
  experimentr.clearNext = function() {
    d3.select('#next-button').on('click', experimentr.next);
  };


  // Create the divs for the experiment content and controls.
  function init() {
    if(mainDiv) return;
    mainDiv = d3.select('body').append('div')
      .attr('id', 'experimentr');
    mainDiv.append('div')
      .attr('id', 'module');
    mainDiv.append('div')
      .attr('id', 'control')
      .append('button')
        .attr('type', 'button')
        .attr('id', 'next-button')
        .attr('disabled', true)
        .text('Next')
        .on('click', experimentr.next);
  }

  // Load the next module.
  experimentr.next = function() {
    experimentr.clearNext();
    experimentr.showNext();
    current = current + 1;
    activate(current);
  };

  // This just ends the experiment timer right now, but it might be a good place to send final experiment data (if we are using CSV on the backend).
  experimentr.end = function() {
    experimentr.endTimer('experiment');
  };

  // Adds the data in `d` to the experiment data, and saves to server.
  experimentr.addData = function(d) {
    merge(data, d);
    experimentr.save(); 
  };

  // The HTTP POST code for saving experiment data.
  experimentr.save = function(d) {
    //d3.xhr('/foresight/') //d3 v3
    d3.request('/') //d3 v4
      .header('Content-Type', 'application/json')
      .post(JSON.stringify(data), function(err, res) {
        if(err) console.log(err);
      });
  };

  // Merges object o2 into o1.
  function merge(o1, o2) {
    for (var attr in o2) { o1[attr] = o2[attr]; }
  }

  // Enables the Next button so the user can proceed in the experiment.
  experimentr.release = function() {
    d3.select('#next-button').attr('disabled', null);
  };

  // On some multi-part modules, it is helpful to hide the next button until it is needed.
  experimentr.hideNext = function() {
    d3.select('#next-button').style('display', 'none');
  };

  // Make the Next button visible.
  experimentr.showNext = function() {
    d3.select('#next-button').style('display', 'inline');
  };

  // Disables the Next button until the module code decides the user is done with the current module (release by experimentr.release()).
  experimentr.hold = function() {
    d3.select('#next-button').attr('disabled', true);
  };

  // Remove experiment content from the main div.
  function clearModule() {
    d3.select('#module').html('');
  }

  // Activate (load) a given module.
  async function activate(x) {
    clearModule();
    experimentr.hold();

    if (x === sequence.length - 1) {
      removeNextButton();
      experimentr.end();
    }


    //possible solution to d3.html not working the same when upgrading to d3 v5;

    // let domElement = await d3.text(sequence[x]);
    // var range = document.createRange();

    // var documentFragment = range.createContextualFragment(domElement);
    // d3.select('#module').node().appendChild(documentFragment);
    

    //another Solution to the same problem 
    
    // TODO do better than this serializer hack, if possible https://stackoverflow.com/a/49894968
    d3.html(sequence[x]).then((d) => {
      const serializer = new XMLSerializer();
      const document_fragment_string = serializer.serializeToString(d);
      var range = document.createRange();
      range.setStart(document.getElementById('module'), 0);
      var documentFragment = range.createContextualFragment(document_fragment_string);
      d3.select('#module').node().appendChild(documentFragment);
    });
  }

  // Remove the next button entirely (TODO ensure this is actually used).
  function removeNextButton() {
    d3.select('#next-button').remove();
  }

  // Define the experiment sequence via an array (see index.html for an example).
  experimentr.sequence = function(x) {
    if(!arguments.length) return sequence;
    sequence = x;
    return experimentr;
  };

  // Start a timer with a given String as key
  experimentr.startTimer = function(x) {
    console.log('starting timer: '+x);
    data['time_start_'+x] = Date.now(); 
  };

  // End an existing timer (using a String key)
  // TODO throw an error if a start wasn't called.
  experimentr.endTimer = function(x) {
    console.log('ending timer: '+x);
    data['time_end_'+x] = Date.now(); 
    data['time_diff_'+x] = parseFloat(data['time_end_'+x]) - parseFloat(data['time_start_'+x]); 
    // experimentr.save();
  };

  // attachTimer lets you show participants a visual countdown before advancing the experiment.
  // target should be a CSS id, so the d3.select works
  // seconds is the number of seconds in the countdown
  // cb is a function which executes at the end of the countdown (write a custom callback to suite your experiment needs)
  // Note, for an invisible timer, set target to null (e.g. attachTimer(null, 10, <insert your callback here>))
  experimentr.attachTimer = function(target, seconds, cb) {
    d3.select(target).text(seconds);

    var timesCalled = 0;

    var update = function() {
      d3.select(target).text(seconds - timesCalled);
      if( timesCalled === seconds )
        end();
      else
        timesCalled++;
    };

    var interval = setInterval(update, 1000);

    var end = function() {
      clearInterval(interval);
      cb();
    };
  };

  // Returns experimentr so we can use it in index.html
  return experimentr;
}();
