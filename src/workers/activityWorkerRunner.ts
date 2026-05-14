import ActivityWorker from './activityWorker.js?worker&inline';

let worker = null;
let workerSeq = 0;
const pendingWorkerCallbacks = new Map();

function getWorker() {
    if (!worker) {
        worker = new ActivityWorker();
        worker.onmessage = (event: any) => {
            const { type, seq, payload } = event.data;
            const callback = pendingWorkerCallbacks.get(seq);
            if (!callback) {
                return;
            }
            pendingWorkerCallbacks.delete(seq);
            if (type === 'error') {
                callback.reject(new Error(payload.message));
                return;
            }
            callback.resolve(payload);
        };
    }
    return worker;
}

export function runActivityWorkerTask(type: any, payload: any): Promise<any> {
    return new Promise((resolve: any, reject: any) => {
        const seq = ++workerSeq;
        pendingWorkerCallbacks.set(seq, { resolve, reject });
        getWorker().postMessage({ type, seq, payload });
    });
}
