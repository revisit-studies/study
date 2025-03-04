import { Registry, initializeTrrack } from 'https://cdn.jsdelivr.net/npm/@trrack/core@1.3.0/+esm'

export function createTrrack(){
    // Create our action registry
    const registry = Registry.create();

    // Initial state has one dot.
    const initialState = {
        
    };

    // Register a state action to update the dots.
    const updateBarGeoParameters = registry.register(
        "update-bar-geo-parameters",
        (state, parameters) => {
          state.bargeo = parameters
        }
    );

    const updateBarIconParameters = registry.register(
      "update-bar-icon-parameters",
      (state, parameters) => {
        state.baricon = parameters
      }
  );

  const updatePieGeoParameters = registry.register(
    "update-pie-geo-parameters",
    (state, parameters) => {
      state.piegeo = parameters
      console.log("trrack updatePieGeoParameters: ", parameters)
    }
);

  const updatePieIconParameters = registry.register(
    "update-pie-icon-parameters",
    (state, parameters) => {
      state.pieicon = parameters
      console.log('pieIconParameters updated')
    }
  );

const updateMapGeoParameters = registry.register(
  "update-map-geo-parameters",
  (state, parameters) => {
    state.mapgeo = parameters
  }
);

const updateMapIconParameters = registry.register(
  "update-map-icon-parameters",
  (state, parameters) => {
    state.mapicon = parameters
  }
);


    // Initialize Trrack
    const trrack = initializeTrrack({
        initialState,
        registry
    });

    return {
      actions: { updateBarGeoParameters, updateBarIconParameters, updatePieGeoParameters, updatePieIconParameters, updateMapGeoParameters, updateMapIconParameters },
      trrack: trrack,
    }
}