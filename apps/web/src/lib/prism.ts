import Prism from '@/lib/prism-core';

const LANGUAGE_ALIASES: Record<string, string> = {
  html: 'markup',
  xml: 'markup',
  md: 'markup',
  markdown: 'markup',
  text: 'none',
  plaintext: 'none',
  txt: 'none',
  shell: 'none',
  sh: 'none',
  yml: 'none',
  js: 'javascript',
  ts: 'javascript',
  tsx: 'javascript',
  json: 'javascript',
  css: 'css',
  sql: 'none',
  yaml: 'none',
  py: 'none',
  bash: 'none',
};

export function resolvePrismLanguage(input?: string): string {
  const lang = (input || '').trim().toLowerCase();
  if (!lang) return 'none';

  const normalized = LANGUAGE_ALIASES[lang] || lang;
  return Prism.languages[normalized] ? normalized : 'none';
}

export function highlightWithPrism(code: string, language?: string): string {
  const resolvedLanguage = resolvePrismLanguage(language);
  const grammar = Prism.languages[resolvedLanguage];

  if (!grammar || resolvedLanguage === 'none') {
    return Prism.util.encode(code) as string;
  }

  return Prism.highlight(code, grammar, resolvedLanguage);
}

export default Prism;
