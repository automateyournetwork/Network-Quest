// Copyright 2026 John Capobianco. SPDX-License-Identifier: Apache-2.0
/** Executed before application code in an owned browser, never shipped in the game. */
export function installMeasurementProbe() {
  const state = { creates: {} as Record<string, number>, deletes: {} as Record<string, number>,
    live: {} as Record<string, number>, draws: 0, frameIntervals: [] as number[], renderedIntervals: 0,
    visibilityChanges: 0, sampling: false, droppedFrames: 0, releasedByContextLoss: {} as Record<string, number> };
  const kinds = ['Buffer', 'Texture', 'Program', 'Shader', 'Framebuffer', 'Renderbuffer', 'VertexArray', 'Query', 'Sampler', 'TransformFeedback', 'Sync'];
  const live = new Map<object, { kind: string; context: object }>(), contexts = new WeakSet<object>();
  for (const kind of kinds) { state.creates[kind] = 0; state.deletes[kind] = 0; state.live[kind] = 0; state.releasedByContextLoss[kind] = 0; }
  // GL handle counts are not driver/GPU memory. Deleting a handle is an observed
  // API request, not proof that the driver immediately returned physical memory.
  for (const proto of [globalThis.WebGLRenderingContext?.prototype, globalThis.WebGL2RenderingContext?.prototype]) {
    if (!proto) continue;
    const methods = proto as unknown as Record<string, (...args: unknown[]) => unknown>;
    for (const kind of kinds) {
      const create = kind === 'Sync' ? 'fenceSync' : `create${kind}`, remove = `delete${kind}`;
      if (typeof methods[create] === 'function') {
        const original = methods[create]!;
        methods[create] = function (...args) { const result = original.apply(this, args), context = this;
          if (!contexts.has(context)) {
            contexts.add(context);
            (context as unknown as WebGLRenderingContext).canvas.addEventListener('webglcontextlost', () => {
              for (const [handle, value] of live) if (value.context === context) {
                live.delete(handle); state.live[value.kind]!--; state.releasedByContextLoss[value.kind]!++;
              }
            });
          }
          if (result && typeof result === 'object' && !live.has(result)) { live.set(result, { kind, context }); state.creates[kind]!++; state.live[kind]!++; } return result; };
      }
      if (typeof methods[remove] === 'function') {
        const original = methods[remove]!;
        methods[remove] = function (...args) { const result = original.apply(this, args), handle = args[0];
          if (handle && typeof handle === 'object' && live.get(handle)?.kind === kind) { live.delete(handle); state.deletes[kind]!++; state.live[kind]!--; } return result; };
      }
    }
    for (const method of ['drawArrays', 'drawElements', 'drawArraysInstanced', 'drawElementsInstanced']) {
      if (typeof methods[method] !== 'function') continue;
      const original = methods[method]!;
      methods[method] = function (...args) { const value = original.apply(this, args); state.draws++; return value; };
    }
  }
  let previous = 0, draws = 0;
  const frame = (time: number) => {
    if (state.sampling) {
      if (previous) { if (state.frameIntervals.length < 100_000) state.frameIntervals.push(time - previous); else state.droppedFrames++; }
      if (state.draws !== draws) state.renderedIntervals++;
      previous = time; draws = state.draws;
    } else { previous = 0; draws = state.draws; }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', () => { if (state.sampling) state.visibilityChanges++; });
  const snapshot = () => ({ creates: { ...state.creates }, deletes: { ...state.deletes }, live: { ...state.live }, releasedByContextLoss: { ...state.releasedByContextLoss }, draws: state.draws });
  Object.defineProperty(globalThis, '__nqMeasurement', { value: {
    snapshot,
    begin() { state.frameIntervals = []; state.renderedIntervals = 0; state.visibilityChanges = 0; state.droppedFrames = 0; previous = 0; draws = state.draws; state.sampling = true; },
    end() { state.sampling = false; return { ...snapshot(), frameIntervals: [...state.frameIntervals], renderedIntervals: state.renderedIntervals,
      visibilityChanges: state.visibilityChanges, droppedFrames: state.droppedFrames, visibilityState: document.visibilityState }; },
  } });
}

export interface GlSnapshot { creates: Record<string, number>; deletes: Record<string, number>; live: Record<string, number>; releasedByContextLoss: Record<string, number>; draws: number }
export interface FrameSnapshot extends GlSnapshot { frameIntervals: number[]; renderedIntervals: number; visibilityChanges: number; droppedFrames: number; visibilityState: string }
declare global { interface Window { __nqMeasurement: { snapshot(): GlSnapshot; begin(): void; end(): FrameSnapshot } } }
