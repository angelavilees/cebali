/** Al cambiar de herramienta, mantener su encabezado visible tras cerrar la anterior. */
export function revealDisclosure(panel: HTMLDetailsElement) {
  if (!panel.open || !panel.name) return;
  panel.querySelector('summary')?.scrollIntoView({
    block: 'start',
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
  });
}
