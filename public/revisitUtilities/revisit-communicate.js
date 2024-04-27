(function () {
  const PREFIX = "@REVISIT_COMMS";

  const queryString = window.location.search;
  const urlParams = new URLSearchParams(queryString);

  const id = urlParams.get("id");

  const sendMessage = (tag, message) => {
    window.top.postMessage(
      {
        error: false,
        type: `${PREFIX}/${tag}`,
        iframeId: id,
        message,
      },
      "*"
    );
  };

  let onDataReceiveCallback = null;

  window.addEventListener('message', function (e) {
    const data = e.data;
    if (typeof data === 'object' && id === data.iframeId) {
      if (data.type === `${PREFIX}/STUDY_DATA` && onDataReceiveCallback) {
        onDataReceiveCallback(data.message);
      }
    }
  });

  window.Revisit = {
    postAnswers: (answers) => {
      sendMessage("ANSWERS", answers);
    },
    postProvenance: (provenance) => {
      sendMessage("PROVENANCE", provenance);
    },
    postEvent: (eventName, objectId) => {
      sendMessage("EVENT", { eventName, objectId });
    },
    // Inform Revisit that the stimuli is ready in the iframe.
    postReady: () => {
      sendMessage("READY", {
        documentHeight: document.documentElement.scrollHeight,
        documentWidth: document.documentElement.scrollWidth,
      });
    },
    onDataReceive: (fn) => {
      onDataReceiveCallback = fn;
    },
  };

  window.addEventListener(
    'load',
    function () {
      sendMessage('WINDOW_READY');
    },
    false
  );
})();
