(function () {
  const PREFIX = '@REVISIT_COMMS';

  const queryString = window.location.search;
  const urlParams = new URLSearchParams(queryString);

  const id = urlParams.get('id');

  const sendMessage = (tag, message) => {
    window.top.postMessage(
      {
        error: false,
        type: `${PREFIX}/${tag}`,
        iframeId: id,
        message,
      },
      '*'
    );
  };

  window.Revisit = {
    postAnswers: (answers) => {
      sendMessage('ANSWERS', answers);
    },
    postEvent: (eventName, objectId) => {
      sendMessage('EVENT', { eventName, objectId });
    },
  };
})();
