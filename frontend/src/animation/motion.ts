// Unico archivo del proyecto que hace `import ... from 'motion'`. El resto
// de la app consume los composables de esta carpeta (useSpringBack.ts, etc.),
// nunca la libreria directo - asi, si en el futuro se decide sacarla, alcanza
// con: 1) borrar src/animation/, 2) `npm uninstall motion`, 3) reemplazar los
// call sites (ver README.md de esta carpeta) por su equivalente en CSS puro.
//
// Motion One es la UNICA libreria de animacion que el DESIGN.md raiz del
// portafolio permite (GSAP/Framer Motion completos estan vetados por
// pesados) - reservada a los pocos casos que CSS nativo no puede resolver
// bien: fisica de resorte con velocidad inicial real (swipe-to-dismiss de
// BottomSheet). Todo lo demas de Berry (transiciones de pagina, hovers,
// fades) sigue siendo CSS puro en style.css, a proposito.
export { animate } from 'motion'
