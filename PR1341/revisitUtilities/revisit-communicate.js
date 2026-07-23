(function () {
  const PREFIX = "@REVISIT_COMMS";

  const queryString = window.location.search;
  const urlParams = new URLSearchParams(queryString);

  const id = urlParams.get("id");

  const sendMessage = (tag, message) => {
    window.parent.postMessage(
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
  let onProvenanceReceiveCallback = null;
  let onAnswerReceiveCallback = null;
  const managedTrrackSubscriptions = new Set();

  const appendTraversalEvent = (previousProvenance, incomingProvenance, observedAt) => {
    const isSameGraph = previousProvenance?.root === incomingProvenance.root;
    const previousEvents = isSameGraph && Array.isArray(previousProvenance?.traversalEvents)
      ? previousProvenance.traversalEvents
      : [];
    const incomingEvents = Array.isArray(incomingProvenance.traversalEvents)
      ? incomingProvenance.traversalEvents
      : [];
    const traversalEvents = incomingEvents.length >= previousEvents.length
      ? incomingEvents
      : previousEvents;
    const currentNodeId = incomingProvenance.current;
    const currentNode = incomingProvenance.nodes?.[currentNodeId];

    if (!currentNode || traversalEvents.at(-1)?.nodeId === currentNodeId) {
      return traversalEvents.length > 0
        ? { ...incomingProvenance, traversalEvents }
        : incomingProvenance;
    }

    const isNewNode = !isSameGraph || !previousProvenance?.nodes?.[currentNodeId];
    const eventTime = isNewNode ? currentNode.createdOn : observedAt;
    const previousEventTime = traversalEvents.at(-1)?.createdOn ?? Number.NEGATIVE_INFINITY;

    return {
      ...incomingProvenance,
      traversalEvents: [
        ...traversalEvents,
        {
          nodeId: currentNodeId,
          createdOn: Math.max(eventTime, previousEventTime + 1),
        },
      ],
    };
  };

  const disposeManagedTrracks = () => {
    managedTrrackSubscriptions.forEach((unsubscribe) => unsubscribe());
    managedTrrackSubscriptions.clear();
  };

  window.addEventListener('message', function (e) {
    const data = e.data;
    if (typeof data === 'object' && id === data.iframeId) {
      if (data.type === `${PREFIX}/STUDY_DATA` && onDataReceiveCallback) {
        onDataReceiveCallback(data.message);
      }
      if (data.type === `${PREFIX}/PROVENANCE` && onProvenanceReceiveCallback) {
        onProvenanceReceiveCallback(data.message);
      }
      if (data.type === `${PREFIX}/ANSWERS` && onAnswerReceiveCallback) {
        onAnswerReceiveCallback(data.message);
      }
    }
  });

  window.Revisit = {
    postAnswers: (answers) => {
      sendMessage("ANSWERS", answers);
    },
    /**
     * @deprecated Use Revisit.createTrrack so every traversal is reported automatically.
     */
    postProvenance: (provenance) => {
      sendMessage("PROVENANCE", provenance);
    },
    createTrrack: ({ initializeTrrack, ...options }) => {
      if (typeof initializeTrrack !== 'function') {
        throw new TypeError('Revisit.createTrrack requires the Trrack initializeTrrack function.');
      }

      const trrack = initializeTrrack(options);
      let previousProvenance;
      const publishProvenance = () => {
        const provenance = appendTraversalEvent(
          previousProvenance,
          trrack.graph.backend,
          Date.now(),
        );
        previousProvenance = provenance;
        sendMessage("PROVENANCE", provenance);
      };
      const unsubscribe = trrack.currentChange(publishProvenance);

      managedTrrackSubscriptions.add(unsubscribe);
      publishProvenance();

      return trrack;
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
    onProvenanceReceive: (fn) => {
      onProvenanceReceiveCallback = fn;
    },
    onAnswersReceive: (fn) => {
      onAnswerReceiveCallback = fn;
    },
  };

  window.addEventListener(
    'load',
    function () {
      sendMessage('WINDOW_READY');
    },
    false
  );
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) {
      disposeManagedTrracks();
    }
  });
})();
