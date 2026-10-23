(function () {
  const PREFIX = "@REVISIT_COMMS";

  const queryString = window.location.search;
  const urlParams = new URLSearchParams(queryString);

  // Templated websites are rendered from their compiled contents rather than from their URL,
  // so they have no query string; reVISit injects the same values on window.__REVISIT_PARAMS__.
  const injectedParams =
    window.__REVISIT_PARAMS__ && typeof window.__REVISIT_PARAMS__ === "object"
      ? window.__REVISIT_PARAMS__
      : {};

  let id = urlParams.get("id") || injectedParams.id || null;

  const sendMessage = (tag, message) => {
    window.parent.postMessage(
      {
        error: false,
        type: `${PREFIX}/${tag}`,
        iframeId: id,
        requestId: resume?.requestId,
        message,
      },
      "*"
    );
  };

  let onDataReceiveCallback = null;
  let onProvenanceReceiveCallback = null;
  let onAnswerReceiveCallback = null;
  const managedTrrackSubscriptions = new Set();
  const managedTrracks = new Set();
  let restoreCallback = null;
  let registrationComplete = false;
  let resume = null;
  let restoring = false;
  let restored = false;
  let queuedAnswers;
  let legacyMode = false;
  const documentId = crypto.randomUUID();
  let announced = null;
  const announce = () => {
    const version = registrationComplete || restoreCallback ? 1 : 0;
    if (announced === version) return;
    announced = version;
    sendMessage('WINDOW_READY', { protocolVersion: version, documentId });
  };

  const publish = (tag, message) => {
    if (resume?.isAnalysis) return;
    if (!legacyMode && (managedTrracks.size > 0 || restoreCallback)) {
      if (!restored || restoring) {
        if (tag === 'ANSWERS') queuedAnswers = message;
        return;
      }
    }
    sendMessage(tag, message);
  };

  const restore = async () => {
    if (!resume || !registrationComplete || restoring || restored) return;
    restoring = true;
    const request = resume;
    const supported = !!restoreCallback;
    sendMessage('RESTORATION_CAPABILITY', { protocolVersion: 1, requestId: request.requestId, supported });
    try {
      if (supported && !request.isAnalysis) {
        if (request.provenanceGraph || Object.keys(request.answers ?? {}).length > 0) queuedAnswers = undefined;
        for (const managed of managedTrracks) {
          if (request.provenanceGraph) {
            managed.previous = request.provenanceGraph;
            const graph = structuredClone(request.provenanceGraph);
            managed.trrack.graph.update(managed.trrack.graph.load(graph));
          }
        }
        await restoreCallback?.({
          answers: request.answers,
          provenanceGraph: request.provenanceGraph,
        });
      }
      if (request !== resume) return;
      restoring = false;
      restored = true;
      if (supported) sendMessage('RESTORED', { protocolVersion: 1, requestId: request.requestId });
      if (!request.isAnalysis) {
        if (queuedAnswers !== undefined) sendMessage('ANSWERS', queuedAnswers);
        managedTrracks.forEach((managed) => {
          // Existing graphs are already retained by the host. Only new trials need an initial graph.
          if (!request.provenanceGraph) managed.publish();
        });
      }
    } catch {
      restoring = false;
      sendMessage('RESTORATION_ERROR', { protocolVersion: 1, requestId: request.requestId });
    }
  };

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
    const isBootstrap = data?.type === `${PREFIX}/RESUME` && data.message?.documentId === documentId;
    if (data && typeof data === 'object' && (id === data.iframeId || isBootstrap) && e.source === window.parent) {
      if (isBootstrap) id = data.iframeId;
      if (data.type === `${PREFIX}/RESUME` && data.message?.protocolVersion === 1 && data.message.documentId === documentId) {
        if (resume?.requestId !== data.message.requestId) {
          resume = data.message;
          restored = false;
          restore();
        }
      }
      if (data.type === `${PREFIX}/RETRY_RESTORE` && data.message?.requestId === resume?.requestId) restore();
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
      publish("ANSWERS", answers);
    },
    /**
     * @deprecated Use Revisit.createTrrack so every traversal is reported automatically.
     */
    postProvenance: (provenance) => {
      publish("PROVENANCE", provenance);
    },
    createTrrack: ({ initializeTrrack, ...options }) => {
      if (typeof initializeTrrack !== 'function') {
        throw new TypeError('Revisit.createTrrack requires the Trrack initializeTrrack function.');
      }

      const trrack = initializeTrrack(options);
      const managed = { trrack, previous: undefined, publish: null };
      managedTrracks.add(managed);
      const publishProvenance = () => {
        const provenance = appendTraversalEvent(
          managed.previous,
          trrack.graph.backend,
          Date.now(),
        );
        managed.previous = provenance;
        publish("PROVENANCE", provenance);
      };
      managed.publish = publishProvenance;
      const unsubscribe = trrack.currentChange(() => {
        if (!restoring) publishProvenance();
      });

      managedTrrackSubscriptions.add(unsubscribe);
      publishProvenance();

      return trrack;
    },
    // Call after asynchronous editors/charts and their handlers have been initialized.
    onRestore: (fn) => {
      restoreCallback = fn;
      legacyMode = false;
      announced = null;
      announce();
      restored = false;
      restore();
    },
    completeRegistration: () => {
      registrationComplete = true;
      announce();
      restore();
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
      announce();
      if (!restoreCallback && !registrationComplete) {
        // Keep old pages working without treating an absent registration as a failure.
        legacyMode = true;
        if (queuedAnswers !== undefined) publish('ANSWERS', queuedAnswers);
        managedTrracks.forEach((managed) => managed.publish());
      }
    },
    false
  );
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) {
      disposeManagedTrracks();
    }
  });
})();
