import { Registry } from '../registry/reg';

export type ConfigureTrrackOptions<S, E extends string = any> = {
    registry: Registry<E>;
    initialState: S;
    options?: {
        updatesBeforeCheckpoint?: number;
    };
};
