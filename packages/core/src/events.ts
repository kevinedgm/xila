import type { Hit } from './hit-test';

export interface HoverPayload {
  /** Posición del cursor en píxeles CSS relativos al gráfico. */
  readonly px: number;
  readonly py: number;
  /** El dato más cercano al cursor, o `null` si ninguno está al alcance. */
  readonly nearest: Hit | null;
  /** Un dato por serie en la misma x (líneas y barras); vacío en dispersión. */
  readonly hits: readonly Hit[];
}

/** Mapa de evento a su carga. Un nombre inexistente es un error de compilación. */
export interface ChartEventMap {
  /** `null` cuando el cursor sale del gráfico. */
  hover: HoverPayload | null;
  click: Hit;
  /** Una serie se mostró u ocultó (leyenda). */
  visibility: { readonly seriesId: string; readonly hidden: boolean };
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
