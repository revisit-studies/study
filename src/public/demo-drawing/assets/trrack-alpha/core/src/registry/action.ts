/* eslint-disable @typescript-eslint/no-explicit-any */
import { PayloadAction } from '@reduxjs/toolkit';

export type TrrackActionFunction<
    DoActionType extends string,
    UndoActionType extends string,
    UndoActionPayload,
    DoActionPayload
> = (args: DoActionPayload) => {
    do?: PayloadAction<DoActionPayload, DoActionType>;
    undo: PayloadAction<UndoActionPayload, UndoActionType>;
};

export type ProduceWrappedStateChangeFunction<T> = (state: T, args: any) => T

export type StateChangeFunction<State, Payload> = (
    state: State,
    payload: Payload
) => ReturnType<ProduceWrappedStateChangeFunction<State>>;


export type Label = string;
export type LabelGenerator<Args> = (args: Args) => Label;

export type TrrackActionConfig<Args, Event> = {
    hasSideEffects: boolean;
    eventType: Event;
    label: LabelGenerator<Args>;
};

export type TrrackActionRecord<
    DoActionType extends string,
    DoActionPayload,
    UndoActionType extends string,
    UndoActionPayload
> = {
    do: PayloadAction<DoActionPayload, DoActionType>;
    undo: PayloadAction<UndoActionPayload, UndoActionType>;
};
