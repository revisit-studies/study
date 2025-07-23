/* eslint-disable @typescript-eslint/no-explicit-any */
export function initEventManager() {
    const eventsMap = new Map<string, Array<(args: any) => void>>();

    return {
        listen(event: string, listener: (args: any) => void) {
            if (!eventsMap.has(event)) eventsMap.set(event, []);
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            eventsMap.get(event)!.push(listener);

            return () => {
                eventsMap.set(
                    event,
                    (eventsMap.get(event) || []).filter((e) => e !== listener)
                );
            };
        },
        fire(event: string, args?: any) {
            const events = eventsMap.get(event);

            if (events) {
                events.forEach((e) => e(args));
            }
        },
    };
}
