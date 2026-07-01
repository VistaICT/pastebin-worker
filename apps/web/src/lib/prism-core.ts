import Prism from 'prismjs';

// Prism language packs reference a global `Prism` symbol.
// Ensure it exists before any language side-effect modules execute.
(globalThis as { Prism?: typeof Prism }).Prism = Prism;

export default Prism;
