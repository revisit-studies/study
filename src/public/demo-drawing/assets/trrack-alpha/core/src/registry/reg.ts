/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAction } from '@reduxjs/toolkit';
import { enablePatches, produce } from 'immer';

import {
  Label,
  LabelGenerator,
  ProduceWrappedStateChangeFunction,
  StateChangeFunction,
  TrrackActionConfig,
  TrrackActionFunction,
} from './action';

enablePatches();

type TrrackActionRegisteredObject = {
    func: TrrackActionFunction<any, any, any, any> | ProduceWrappedStateChangeFunction<any>;
    config: TrrackActionConfig<any, any>;
};

function prepareAction(action: TrrackActionFunction<any, any, any, any> | StateChangeFunction<any, any>) {
  return action.length === 2 ? produce(action) as unknown as ProduceWrappedStateChangeFunction<any> : action as TrrackActionFunction<any, any, any, any>;
}

export class Registry<Event extends string> {
  static create<Event extends string>(): Registry<Event> {
    return new Registry<Event>();
  }

  private registry: Map<string, TrrackActionRegisteredObject>;

  private constructor() {
    this.registry = new Map();
  }

  has(name: string) {
    return this.registry.has(name);
  }

  register<
        DoActionType extends string,
        UndoActionType extends string,
        DoActionPayload = any,
        UndoActionPayload = any,
        State = any
    >(
    type: DoActionType,
    actionFunction: TrrackActionFunction<
            DoActionType,
            UndoActionType,
            UndoActionPayload,
            DoActionPayload
        > | StateChangeFunction<State, DoActionPayload>,
    config?: {
            eventType: Event;
            label: Label | LabelGenerator<DoActionPayload>
        },
  ) {
    const isState = actionFunction.length === 2;

    if (actionFunction.length > 2) throw new Error('Incorrect action function signature. Action function can only have two arguments at most!');

    if (this.has(type)) throw new Error(`Already registered: ${type}`);

    const { label = type, eventType = type as unknown as Event } = config || {};

    this.registry.set(type, {
      func: prepareAction(actionFunction),
      config: {
        hasSideEffects: !isState,
        label:
                    typeof label === 'string'
                      ? ((() => label) as LabelGenerator<void>)
                      : label,
        eventType,
      },
    });

    return createAction<DoActionPayload>(type);
  }

  get(type: string) {
    const action = this.registry.get(type);

    if (!action) throw new Error(`Not registered: ${type}`);

    return action;
  }
}
