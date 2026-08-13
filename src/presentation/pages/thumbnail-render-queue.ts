import type {
  PdfPageRenderHandle,
  PdfPageRenderResult,
} from "../../infrastructure/pdf/pdfjs-page-renderer";

export interface ThumbnailRenderQueue {
  enqueue(start: () => PdfPageRenderHandle): PdfPageRenderHandle;
}

const cancelledBeforeStart = (): PdfPageRenderResult => ({
  ok: false,
  cancelled: true,
  error: { code: "RenderFailed", message: "The PDF thumbnail render was cancelled." },
});

const unexpectedFailure = (): PdfPageRenderResult => ({
  ok: false,
  cancelled: false,
  error: { code: "RenderFailed", message: "The PDF thumbnail could not be rendered." },
});

/** Bounds how many thumbnail renders PDF.js runs at once so opening a document does not fire a render for every page simultaneously. */
export const createThumbnailRenderQueue = (concurrency: number): ThumbnailRenderQueue => {
  let active = 0;
  const pending: (() => void)[] = [];

  const runNext = (): void => {
    if (active >= concurrency) {
      return;
    }
    const next = pending.shift();
    next?.();
  };

  return {
    enqueue(start) {
      let settled = false;
      let realHandle: PdfPageRenderHandle | undefined;
      let resolvePromise: (result: PdfPageRenderResult) => void = () => undefined;
      const promise = new Promise<PdfPageRenderResult>((resolve) => {
        resolvePromise = resolve;
      });

      const finishTask = (result: PdfPageRenderResult): void => {
        settled = true;
        active -= 1;
        resolvePromise(result);
        runNext();
      };

      const beginTask = (): void => {
        active += 1;
        const handle = start();
        realHandle = handle;
        void handle.promise.then(finishTask, () => {
          finishTask(unexpectedFailure());
        });
      };

      if (active < concurrency) {
        beginTask();
      } else {
        pending.push(beginTask);
      }

      return {
        promise,
        cancel: () => {
          if (settled) {
            return;
          }
          if (realHandle !== undefined) {
            realHandle.cancel();
            return;
          }
          const index = pending.indexOf(beginTask);
          if (index !== -1) {
            pending.splice(index, 1);
          }
          settled = true;
          resolvePromise(cancelledBeforeStart());
        },
      };
    },
  };
};
