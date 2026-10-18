/// <reference types="vite/client" />

declare module 'plotly.js-dist-min' {
  const Plotly: {
    newPlot(el: HTMLElement, data: unknown[], layout?: unknown, config?: unknown): Promise<unknown>;
    relayout(el: HTMLElement, update: Record<string, unknown>): Promise<unknown>;
  };
  export default Plotly;
}
