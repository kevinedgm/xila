<script setup lang="ts">
// Portada: los datos del README («Qué es Xila hoy») que deja el generador en el frontmatter. La pieza central es la
// tabla de preguntas: Xila parte de la pregunta del lector, así que la portada también. Cada pregunta lleva a su
// ejemplo en la galería.
import { withBase } from 'vitepress';
import emblema from '@marca/emblema-oscuro.svg?raw';
import wordmark from '@marca/xila-oscuro.svg?raw';

interface Pregunta {
  pregunta: string;
  clasica: string;
  nombre: string;
  code: string;
  detalle: string;
  href: string | null;
}
interface HomeData {
  description: string;
  estado: string;
  intro: string;
  features: { title: string; details: string }[];
  preguntas: Pregunta[];
}
defineProps<{ data: HomeData }>();
</script>

<template>
  <div class="x-home">
    <section class="x-hero">
      <div class="x-hero__main">
        <h1 class="x-hero__title">
          <span class="x-sr">Xila</span
          ><span class="x-hero__wordmark" aria-hidden="true" v-html="wordmark"></span>
        </h1>
        <p class="x-hero__lema">Primero la pregunta, después la gráfica.</p>
        <p class="x-hero__text">{{ data.description }}</p>
        <p class="x-hero__actions">
          <a class="x-btn x-btn--manta" :href="withBase('/guia/primer-grafico')"
            >Primer gráfico en 5 minutos</a
          >
          <a class="x-btn x-btn--bruma" :href="withBase('/galeria')">Galería</a>
          <a class="x-btn x-btn--bruma" href="https://github.com/kevinedgm/xila">GitHub</a>
        </p>
        <p class="x-hero__estado"><strong>Estado:</strong> {{ data.estado }}</p>
      </div>
      <div class="x-hero__mark" aria-hidden="true" v-html="emblema"></div>
    </section>

    <section class="x-preguntas" aria-labelledby="x-preguntas-title">
      <h2 id="x-preguntas-title" class="x-home__h2">Parte de la pregunta del lector</h2>
      <p class="x-home__lead" v-html="data.intro"></p>
      <ul class="x-preguntas__list">
        <li v-for="q in data.preguntas" :key="q.pregunta">
          <component
            :is="q.href ? 'a' : 'div'"
            class="x-q"
            :href="q.href ? withBase(q.href) : undefined"
          >
            <span class="x-q__pregunta">{{ q.pregunta }}</span>
            <span class="x-q__row">
              <span class="x-q__clasica">{{ q.clasica }}</span>
              <span class="x-stitch" aria-hidden="true"></span>
              <span class="x-q__nombre">{{ q.nombre }}</span>
            </span>
            <span class="x-q__detalle">{{ q.detalle }}</span>
            <code v-if="q.code" class="x-q__code">{{ q.code }}</code>
          </component>
        </li>
      </ul>
    </section>

    <section v-if="$slots.muestra" class="x-muestra" aria-labelledby="x-muestra-title">
      <h2 id="x-muestra-title" class="x-home__h2">Una muestra</h2>
      <p class="x-home__lead">
        «Ahora con estela», la primera alternativa de la tabla, con los datos reales de la galería:
        cifra actual por país, cambio en diez años y la historia como estela. Reproducir mueve el
        instante.
      </p>
      <slot name="muestra"></slot>
    </section>

    <section class="x-features" aria-label="Qué trae Xila">
      <div v-for="f in data.features" :key="f.title" class="x-feature">
        <h2 class="x-feature__title" v-html="f.title"></h2>
        <p class="x-feature__text" v-html="f.details"></p>
      </div>
    </section>
  </div>
</template>
