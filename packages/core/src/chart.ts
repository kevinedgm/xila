export interface ChartOptions {
  /** Elemento HTML donde se dibuja el gráfico. */
  container: HTMLElement;
}

/**
 * Punto de entrada de la librería. Por ahora solo crea y limpia el canvas;
 * el ciclo completo (config, escalas, renderer, plugins) llega en la Etapa 3.
 */
export class Chart {
  readonly canvas: HTMLCanvasElement;
  private readonly container: HTMLElement;

  constructor(options: ChartOptions) {
    this.container = options.container;
    this.canvas = document.createElement('canvas');
    this.container.appendChild(this.canvas);
  }

  destroy(): void {
    this.canvas.remove();
  }
}
