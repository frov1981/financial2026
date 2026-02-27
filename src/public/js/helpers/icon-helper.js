/* ============================
   Íconos SVG reutilizables
============================ */

/* Insertar / Nuevo */
function iconInsert() {
    return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"/>
      <line x1="5" y1="12" x2="19" y2="12"/>
    </svg>
  `
}

/* Editar */
function iconEdit() {
    return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">
      <path d="M12 20h9"/>
      <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4Z"/>
    </svg>
  `
}

/* Clonar */
function iconClone() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2"/>
      <rect x="2" y="2" width="13" height="13" rx="2"/>
    </svg>
  `
}

/* Eliminar */
function iconDelete() {
    return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6 17.5 20H6.5L5 6"/>
      <path d="M10 11v6"/>
      <path d="M14 11v6"/>
    </svg>
  `
}

/* Ver / Ojo */
function iconView() {
    return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12Z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  `
}

/* Oculto / Ojo cruzado */
function iconViewOff() {
    return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">
      <path d="M17.94 17.94C16.23 19.21 14.21 20 12 20
        5 20 1 12 1 12a21.77 21.77 0 0 1 5.06-5.94"/>
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4
        c7 0 11 8 11 8a21.94 21.94 0 0 1-2.88 4.88"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
      <path d="M14.12 14.12a3 3 0 0 1-4.24-4.24"/>
    </svg>
  `
}

/* Lista / Detalles */
function iconList() {
    return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">
      <line x1="8" y1="6" x2="21" y2="6"/>
      <line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/>
      <circle cx="3" cy="6" r="1"/>
      <circle cx="3" cy="12" r="1"/>
      <circle cx="3" cy="18" r="1"/>
    </svg>
  `
}

/* Refrescar / Recargar */
function iconRefresh() {
    return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">
      <polyline points="23 4 23 10 17 10"/>
      <polyline points="1 20 1 14 7 14"/>
      <path d="M3.51 9a9 9 0 0 1 14.13-3.36L23 10"/>
      <path d="M20.49 15a9 9 0 0 1-14.13 3.36L1 14"/>
    </svg>
  `
}

/* ============================
   Flechas navegación
============================ */

/* Flecha derecha (siguiente / avanzar) */
function iconArrowRight({ size = 4, color = 'currentColor' } = {}) {
    return `
    <svg class="w-${size} h-${size}" fill="none" stroke="${color}" stroke-width="2"
      viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round"
        d="M5 12h14M12 5l7 7-7 7"/>
    </svg>
  `
}

/* Flecha izquierda (anterior / retroceder) */
function iconArrowLeft({ size = 4, color = 'currentColor' } = {}) {
    return `
    <svg class="w-${size} h-${size}" fill="none" stroke="${color}" stroke-width="2"
      viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round"
        d="M19 12H5M12 19l-7-7 7-7"/>
    </svg>
  `
}

/* Chevron abierto */
function iconChevronOpen() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round" width="24" height="24">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  `;
}

/* Chevron cerrado */
function iconChevronClose() {
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round" width="24" height="24">
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  `;
}

/* ============================
   Iconos transferencia
============================ */

/* Origen (sale dinero) */
function iconTransferOut() {
  return iconArrowLeft({ size: 3, color: '#dc2626' })
}

/* Destino (entra dinero) */
function iconTransferIn() {
  return iconArrowRight({ size: 3, color: '#16a34a' })
}

function iconCarouselPrev() {
  return `
    <svg width="20" height="20" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">
      <polyline points="15 18 9 12 15 6"></polyline>
    </svg>
  `
}

function iconCarouselNext() {
  return `
    <svg width="20" height="20" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round">
      <polyline points="9 18 15 12 9 6"></polyline>
    </svg>
  `
}