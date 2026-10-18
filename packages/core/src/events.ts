/** Mapa de evento a su carga. Un nombre inexistente es un error de compilación. */
export interface ChartEventMap {
  hover: {
    readonly seriesId: string;
    readonly index: number;
    readonly x: number;
    readonly y: number;
  } | null;
  click: {
    readonly seriesId: string;
    readonly index: number;
    readonly x: number;
    readonly y: number;
  };
  zoom: { readonly x: readonly [number, number]; readonly y: readonly [number, number] };
  dataChanged: { readonly reason: 'update' | 'filter' };
  resize: { readonly width: number; readonly height: number };
}

export type Listener<K extends keyof ChartEventMap> = (payload: ChartEventMap[K]) => void;

/** Emisor mínimo y tipado para comunicar el núcleo con los plugins. */
export class Emitter {
  private readonly listeners = new Map<keyof ChartEventMap, Set<Listener<keyof ChartEventMap>>>();

  on<K extends keyof ChartEventMap>(name: K, listener: Listener<K>): () => void {
    let set = this.listeners.get(name);
    if (!set) {
      set = new Set();
      this.listeners.set(name, set);
    }
    set.add(listener as Listener<keyof ChartEventMap>);
    return () => this.off(name, listener);
  }

  off<K extends keyof ChartEventMap>(name: K, listener: Listener<K>): void {
    this.listeners.get(name)?.delete(listener as Listener<keyof ChartEventMap>);
  }

  emit<K extends keyof ChartEventMap>(name: K, payload: ChartEventMap[K]): void {
    const set = this.listeners.get(name);
    if (!set) return;
    for (const listener of [...set]) (listener as Listener<K>)(payload);
  }

  clear(): void {
    this.listeners.clear();
  }
}
