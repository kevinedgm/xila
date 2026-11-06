/** Las pruebas leen CSV de ejemplo con `import texto from '…csv?raw'` (Vite), sin tipos de Node. */
declare module '*?raw' {
  const text: string;
  export default text;
}
