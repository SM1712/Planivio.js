import { state } from './state.js';

export function updateRgbVariables() {
  const computedStyle = getComputedStyle(document.body);
  const textColorHex = computedStyle.getPropertyValue('--text-base').trim();
  const rgbArray = hexToRgb(textColorHex);
  if (rgbArray) {
    document.body.style.setProperty('--text-base-rgb', rgbArray.join(', '));
  }
}

export function cargarDatos() {
  const datosGuardados = localStorage.getItem('planivioData');
  if (datosGuardados) {
    try {
      const estadoGuardado = JSON.parse(datosGuardados);
      // Ojo: esta es la única función que modifica directamente el state importado.
      Object.assign(state, estadoGuardado, { paginaActual: 'tareas' });
    } catch (error) {
      console.error('Error al parsear los datos de localStorage:', error);
    }
  }
}

export function guardarDatos() {
  localStorage.setItem('planivioData', JSON.stringify(state));
}

export function hexToRgb(hex) {
  let r = 0,
    g = 0,
    b = 0;
  if (!hex || hex.length < 4) return null;

  if (hex.length === 4) {
    r = '0x' + hex[1] + hex[1];
    g = '0x' + hex[2] + hex[2];
    b = '0x' + hex[3] + hex[3];
  } else if (hex.length === 7) {
    r = '0x' + hex[1] + hex[2];
    g = '0x' + hex[3] + hex[4];
    b = '0x' + hex[5] + hex[6];
  } else {
    return null;
  }
  return [parseInt(r), parseInt(g), parseInt(b)];
}

export function getTextColorForBg(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#000000';
  const [r, g, b] = rgb;
  const yiq = (r * 299 + g * 587 + b * 114) / 1000;
  return yiq >= 128 ? '#000000' : '#FFFFFF';
}

export function darkenColor(hex, percent) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const amount = Math.floor(255 * (percent / 100));
  const newRgb = rgb.map((col) => Math.max(0, col - amount));
  return `#${newRgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}
