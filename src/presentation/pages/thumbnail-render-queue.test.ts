import { describe, expect, it, vi } from "vitest";

import type {
  PdfPageRenderHandle,
  PdfPageRenderResult,
} from "../../infrastructure/pdf/pdfjs-page-renderer";
import { createThumbnailRenderQueue } from "./thumbnail-render-queue";

interface Deferred<T> {
  readonly promise: Promise<T>;
  resolve(value: T): void;
}

const deferred = <T>(): Deferred<T> => {
  let resolvePromise: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
};

const success: PdfPageRenderResult = {
  ok: true,
  cssWidth: 100,
  cssHeight: 140,
  backingWidth: 200,
  backingHeight: 280,
};

const createDeferredHandle = (): {
  handle: PdfPageRenderHandle;
  cancel: ReturnType<typeof vi.fn>;
  resolve: (result: PdfPageRenderResult) => void;
} => {
  const cancel = vi.fn();
  const task = deferred<PdfPageRenderResult>();
  return {
    handle: { promise: task.promise, cancel },
    cancel,
    resolve: (result) => {
      task.resolve(result);
    },
  };
};

describe("createThumbnailRenderQueue", () => {
  it("starts tasks immediately while under the concurrency limit", () => {
    const queue = createThumbnailRenderQueue(2);
    const start = vi.fn(() => createDeferredHandle().handle);

    queue.enqueue(start);
    queue.enqueue(start);

    expect(start).toHaveBeenCalledTimes(2);
  });

  it("queues additional tasks once the concurrency limit is reached", () => {
    const queue = createThumbnailRenderQueue(2);
    const start = vi.fn(() => createDeferredHandle().handle);

    queue.enqueue(start);
    queue.enqueue(start);
    queue.enqueue(start);

    expect(start).toHaveBeenCalledTimes(2);
  });

  it("starts the next queued task once an active task settles", async () => {
    const queue = createThumbnailRenderQueue(1);
    const first = createDeferredHandle();
    const second = createDeferredHandle();
    const starters = [first.handle, second.handle];
    const start = vi.fn(() => starters.shift() ?? first.handle);

    queue.enqueue(start);
    queue.enqueue(start);
    expect(start).toHaveBeenCalledTimes(1);

    first.resolve(success);
    await Promise.resolve();
    await Promise.resolve();

    expect(start).toHaveBeenCalledTimes(2);
  });

  it("resolves the caller's handle with the underlying render result", async () => {
    const queue = createThumbnailRenderQueue(1);
    const fixture = createDeferredHandle();
    const handle = queue.enqueue(() => fixture.handle);

    fixture.resolve(success);

    await expect(handle.promise).resolves.toEqual(success);
  });

  it("frees its slot and advances the queue even if a task's promise rejects unexpectedly", async () => {
    const queue = createThumbnailRenderQueue(1);
    const rejecting = Promise.reject(new Error("boom"));
    const secondStart = vi.fn(() => createDeferredHandle().handle);

    const firstHandle = queue.enqueue(() => ({ promise: rejecting, cancel: vi.fn() }));
    queue.enqueue(secondStart);
    expect(secondStart).not.toHaveBeenCalled();

    await expect(firstHandle.promise).resolves.toMatchObject({ ok: false, cancelled: false });
    await Promise.resolve();
    await Promise.resolve();

    expect(secondStart).toHaveBeenCalledTimes(1);
  });

  it("delegates cancel to the real handle once a task has started", () => {
    const queue = createThumbnailRenderQueue(1);
    const fixture = createDeferredHandle();
    const handle = queue.enqueue(() => fixture.handle);

    handle.cancel();

    expect(fixture.cancel).toHaveBeenCalledTimes(1);
  });

  it("cancels a still-queued task without ever starting it and frees no slot", async () => {
    const queue = createThumbnailRenderQueue(1);
    const first = createDeferredHandle();
    const secondStart = vi.fn(() => createDeferredHandle().handle);

    queue.enqueue(() => first.handle);
    const queuedHandle = queue.enqueue(secondStart);

    queuedHandle.cancel();

    expect(secondStart).not.toHaveBeenCalled();
    await expect(queuedHandle.promise).resolves.toMatchObject({ ok: false, cancelled: true });

    first.resolve(success);
    await Promise.resolve();
    await Promise.resolve();
    expect(secondStart).not.toHaveBeenCalled();
  });

  it("never runs more tasks concurrently than the configured limit across a burst", () => {
    const queue = createThumbnailRenderQueue(3);
    let concurrent = 0;
    let maxConcurrent = 0;
    const handles: (() => void)[] = [];
    const start = (): PdfPageRenderHandle => {
      concurrent += 1;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      const task = deferred<PdfPageRenderResult>();
      handles.push(() => {
        concurrent -= 1;
        task.resolve(success);
      });
      return { promise: task.promise, cancel: vi.fn() };
    };

    for (let index = 0; index < 10; index += 1) {
      queue.enqueue(start);
    }

    expect(maxConcurrent).toBeLessThanOrEqual(3);
  });
});
