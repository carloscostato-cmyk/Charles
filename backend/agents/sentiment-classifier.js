module.exports = {
  classificar(texto) {
    const textoLower = texto.toLowerCase();
    if (textoLower.includes('olá') || textoLower.includes('oi') || textoLower.includes('oi!')) {
      return 'alegria';
    }
    if (textoLower.includes('triste') || textoLower.includes('sad')) {
      return 'tristeza';
    }
    return 'neutro';
  }
};