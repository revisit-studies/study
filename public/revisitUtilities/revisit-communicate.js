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

  const receiveCallbacks = new Map();
  const pendingMessages = new Map();
  const onReceive = (tag, fn) => {
    receiveCallbacks.set(tag, fn);
    if (pendingMessages.has(tag)) {
      const message = pendingMessages.get(tag);
      pendingMessages.delete(tag);
      fn(message);
    }
  };
  let onGlobalStoreReceiveCallback = null;
  let globalStoreUpdater = null;
  let globalStore;
  const managedTrrackSubscriptions = new Set();
  const managedTrracks = new Set();
  let restoreCallback = null;
  let registrationStarted = false;
  let registrationComplete = false;
  let resume = null;
  let restoring = false;
  let restored = false;
  let queuedAnswers;
  let latestAnswers;
  let legacyMode = false;
  const documentId = crypto.randomUUID?.() ?? `document-${Date.now()}-${Math.random()}`;
  let announced = null;
  const announce = () => {
    const version = registrationStarted || registrationComplete || restoreCallback || globalStoreUpdater ? 1 : 0;
    if (announced === version) return;
    announced = version;
    sendMessage('WINDOW_READY', { protocolVersion: version, documentId, globalStoreUpdater: !!globalStoreUpdater });
  };

  const beginRegistration = () => {
    registrationStarted = true;
    legacyMode = false;
    announce();
  };

  const publish = (tag, message) => {
    if (resume?.isAnalysis) return;
    if (tag === 'ANSWERS') latestAnswers = message;
    if (!legacyMode && (registrationStarted || managedTrracks.size > 0 || restoreCallback)) {
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
        if (request.provenanceGraph || Object.keys(request.answers ?? {}).length > 0) {
          queuedAnswers = undefined;
          latestAnswers = request.answers;
        }
        for (const managed of managedTrracks) {
          if (request.provenanceGraph) {
            managed.previous = request.provenanceGraph;
            const { resetToInitialState, ...graph } = structuredClone(request.provenanceGraph);
            managed.trrack.graph.update(managed.trrack.graph.load(graph));
            if (resetToInitialState) {
              managed.trrack.record({ label: 'Start revised trial', state: structuredClone(managed.initialState), eventType: '__revisit_trial_reset', sideEffects: { do: [], undo: [] } });
            }
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
          if (!request.provenanceGraph || request.provenanceGraph.resetToInitialState) managed.publish();
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
        } else if (restored) {
          // A cached document returns with the same request; acknowledge without resetting its state.
          const supported = !!restoreCallback;
          sendMessage('RESTORATION_CAPABILITY', { protocolVersion: 1, requestId: resume.requestId, supported });
          if (supported) sendMessage('RESTORED', { protocolVersion: 1, requestId: resume.requestId });
          if (!resume.isAnalysis) {
            if (latestAnswers !== undefined) sendMessage('ANSWERS', latestAnswers);
            managedTrracks.forEach((managed) => managed.publish());
          }
        }
      }
      if (data.type === `${PREFIX}/RETRY_RESTORE` && data.message?.requestId === resume?.requestId) restore();
      ['STUDY_DATA', 'PROVENANCE', 'ANSWERS'].forEach((tag) => {
        if (data.type !== `${PREFIX}/${tag}`) return;
        const callback = receiveCallbacks.get(tag);
        if (callback) callback(data.message);
        else if (registrationStarted) pendingMessages.set(tag, data.message);
      });
      if (data.type === `${PREFIX}/GLOBAL_STORE`) {
        globalStore = Object.freeze({ ...data.message });
        onGlobalStoreReceiveCallback?.(globalStore);
      }
      if (data.type === `${PREFIX}/GLOBAL_STORE_UPDATE` && data.message?.documentId === documentId && !resume?.isAnalysis) {
        const request = data.message;
        Promise.resolve().then(() => {
          if (!globalStoreUpdater) throw new Error('The global store updater is no longer registered.');
          return globalStoreUpdater({ store: Object.freeze({ ...request.store }), answers: Object.freeze(request.answers) });
        }).then((value) => sendMessage('GLOBAL_STORE_RESULT', { requestId: request.requestId, documentId, value }))
          .catch((error) => sendMessage('GLOBAL_STORE_RESULT', { requestId: request.requestId, documentId, error: error.message || 'The global store updater failed.' }));
      }
    }
  });

  window.Revisit = {
    onGlobalStoreReceive: (fn) => {
      onGlobalStoreReceiveCallback = fn;
      if (globalStore !== undefined) fn(globalStore);
      return () => { if (onGlobalStoreReceiveCallback === fn) onGlobalStoreReceiveCallback = null; };
    },
    registerGlobalStoreUpdater: (fn) => {
      if (globalStoreUpdater) throw new Error('Only one global store updater may be registered for a stimulus.');
      globalStoreUpdater = fn;
      registrationComplete = true;
      announced = null;
      announce();
      restore();
      return () => {
        if (globalStoreUpdater !== fn) return;
        globalStoreUpdater = null;
        sendMessage('GLOBAL_STORE_UPDATER', { documentId, enabled: false });
      };
    },
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
      const managed = { trrack, initialState: structuredClone(options.initialState), previous: undefined, publish: null };
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
    // Call before asynchronous initialization can publish defaults. Legacy pages remain opt-in.
    beginRegistration,
    // Call after asynchronous editors/charts and their handlers have been initialized.
    onRestore: (fn) => {
      restoreCallback = fn;
      restored = false;
      beginRegistration();
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
    onDataReceive: (fn) => onReceive('STUDY_DATA', fn),
    onProvenanceReceive: (fn) => onReceive('PROVENANCE', fn),
    onAnswersReceive: (fn) => onReceive('ANSWERS', fn),
  };

  window.addEventListener(
    'load',
    function () {
      announce();
      if (!registrationStarted && !restoreCallback && !registrationComplete) {
        // Keep old pages working without treating an absent registration as a failure.
        legacyMode = true;
        if (queuedAnswers !== undefined) publish('ANSWERS', queuedAnswers);
        managedTrracks.forEach((managed) => managed.publish());
      }
    },
    false
  );
  window.addEventListener('pagehide', (event) => {
    if (globalStoreUpdater) sendMessage('GLOBAL_STORE_UPDATER', { documentId, enabled: false });
    if (!event.persisted) {
      disposeManagedTrracks();
    }
  });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) {
      announced = null;
      announce();
      if (legacyMode && latestAnswers !== undefined) sendMessage('ANSWERS', latestAnswers);
    }
  });
})();
