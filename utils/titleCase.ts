const SMALL_WORDS = new Set([
  'a',
  'an',
  'and',
  'as',
  'at',
  'but',
  'by',
  'for',
  'from',
  'in',
  'nor',
  'of',
  'on',
  'or',
  'per',
  'the',
  'to',
  'via',
  'with',
]);

function formatWordCore(word: string, shouldCapitalize: boolean) {
  if (!word) return word;
  if (word === word.toUpperCase() && word.length <= 5) return word;

  const lower = word.toLowerCase();
  if (!shouldCapitalize) return lower;
  return `${lower.charAt(0).toUpperCase()}${lower.slice(1)}`;
}

function formatHyphenatedWord(word: string, shouldCapitalize: boolean) {
  if (!word.includes('-')) return formatWordCore(word, shouldCapitalize);
  return word
    .split('-')
    .map((part, idx) => formatWordCore(part, shouldCapitalize || idx > 0))
    .join('-');
}

export function formatTitleCase(input: string) {
  const normalized = String(input || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';

  const parts = normalized.split(' ');
  const out: string[] = [];

  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    const match = part.match(/^([^A-Za-z0-9]*)([A-Za-z0-9][A-Za-z0-9'’.-]*)([^A-Za-z0-9]*)$/);
    if (!match) {
      out.push(part);
      continue;
    }

    const [, lead, core, tail] = match;
    const lowerCore = core.toLowerCase();
    const isFirst = i === 0;
    const isLast = i === parts.length - 1;
    const prev = out[i - 1] || '';
    const afterTerminalPunctuation = /[:.!?]$/.test(prev);
    const isSmall = SMALL_WORDS.has(lowerCore);
    const shouldCapitalize = isFirst || isLast || afterTerminalPunctuation || !isSmall;
    out.push(`${lead}${formatHyphenatedWord(core, shouldCapitalize)}${tail}`);
  }

  return out.join(' ');
}
