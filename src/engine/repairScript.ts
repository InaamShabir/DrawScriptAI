/**
 * Forgiving pre-processor for LLM replies.
 *
 * The system prompt asks the model to write every command as `\(command ...\)`,
 * but real replies drift: several commands inside one `\( ... \)` block, bare
 * commands with no delimiters at all, several commands run together on one
 * line, or commands wrapped in `$...$`. ChatGPT's math renderer then shows the
 * result as red KaTeX errors. `repairDrawScript` rewrites all of those into the
 * strict one-command-per-`\(...\)` form that the engines understand.
 *
 * It is idempotent (already-correct input is returned unchanged) and
 * conservative: a word such as "line" or "point" is only treated as a command
 * when it is followed by enough numeric arguments to be a real command.
 */

/** Minimum number of numeric arguments each command needs to be recognised. */
const MIN_NUMBERS: Record<string, number> = {
  grid: 5,
  axes: 4,
  line: 4,
  arrow: 4,
  doublearrow: 4,
  circle: 3,
  ellipse: 4,
  arc: 5,
  rect: 4,
  triangle: 6,
  polygon: 6,
  quadratic: 6,
  bezier: 8,
  cylinder: 5,
  cone: 5,
  point: 2,
  text: 2,
  highlight: 2,
  pentagon: 3,
  hexagon: 3,
  heptagon: 3,
  octagon: 3,
  ngon: 4,
  regular: 4,
  star: 4,
  sphere: 3,
  cube: 3,
  box: 6,
  pyramid: 5,
  helix: 6,
  spiral: 4,
  axes2d: 7,
  plot: 2,
  function: 2,
  numberline: 5,
  pie: 4,
  bars: 5,
  angle: 5,
  dimension: 4,
  wait: 1,
  // These take no numbers, so they must be followed by at least one argument
  // and sit at the start of a line (or directly after another command).
  background: 0,
  camera: 0,
};

const hasOwn = (obj: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key);

const COLOR_WORDS =
  /^(red|green|blue|yellow|orange|purple|pink|white|black|cyan|magenta|lime|gold|gray|grey|brown|navy|teal|aqua|maroon|silver|indigo|violet|coral|salmon|crimson|olive|turquoise|skyblue|lightblue|orchid|tomato|khaki|plum|slategray|slategrey|transparent)$/i;

const FLAG_WORDS = /^(rays|square|grid|iso|front|reset)$/i;
const NUMBER = /^[-+]?(?:\d+(?:\.\d+)?|\.\d+)(?:e[-+]?\d+)?x?$/i;

// Quoted strings (optionally `key="..."`), `key=fn(a, b)` values, then any other word.
// Curly quotes count too; a quote that starts mid-word (an apostrophe) does not.
const TOKEN =
  /(?:[\w-]+=)?["\u201C][^"\u201D]*["\u201D]|(?<![\w])(?:[\w-]+=)?['\u2018][^'\u2019]*['\u2019]|(?:[\w-]+=)?[a-z]+\([^)]*\)|\S+/gi;

interface Tok {
  text: string;
  start: number;
  end: number;
}

/** Removes `$` math delimiters and curly quotes that wrap or touch a token. */
function clean(token: string): string {
  return token
    .replace(/^\$+|\$+$/g, '')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");
}

function isNumber(token: string): boolean {
  return NUMBER.test(token);
}

function isArgument(token: string): boolean {
  if (!token) return false;
  if (isNumber(token)) return true;
  if (/^(?:[\w-]+=)?(["']).*\1$/.test(token)) return true; // quoted string
  if (/^[\w-]+=\S/.test(token)) return true; // key=value (width=4, fill=rgba(...))
  if (/^#[0-9a-f]{3,8}$/i.test(token)) return true;
  if (COLOR_WORDS.test(token)) return true;
  if (FLAG_WORDS.test(token)) return true;
  return false;
}

function tokenize(text: string): Tok[] {
  const toks: Tok[] = [];
  const re = new RegExp(TOKEN.source, 'gi');
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    toks.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return toks;
}

/** Counts the arguments that directly follow token `i` (not crossing a line break). */
function lookahead(text: string, toks: Tok[], i: number): { numbers: number; args: number } {
  let numbers = 0;
  let args = 0;
  for (let j = i + 1; j < toks.length; j++) {
    if (text.slice(toks[j - 1].end, toks[j].start).includes('\n')) break;
    const c = clean(toks[j].text);
    if (c === '') continue;
    if (!isArgument(c)) break;
    args++;
    if (isNumber(c)) numbers++;
  }
  return { numbers, args };
}

function qualifiesAsStart(text: string, toks: Tok[], i: number, atLineStart: boolean): boolean {
  const name = clean(toks[i].text).toLowerCase();
  if (!hasOwn(MIN_NUMBERS, name)) return false;
  const min = MIN_NUMBERS[name];
  const { numbers, args } = lookahead(text, toks, i);
  if (min > 0) return numbers >= min;
  return atLineStart && args >= 1;
}

interface Found {
  /** Wrapped commands, in order. */
  commands: string[];
  /** The text with every command replaced by `\(command\)`. */
  rewritten: string;
  /** True when anything other than whitespace remained outside the commands. */
  hasLeftover: boolean;
}

function scan(text: string): Found {
  const toks = tokenize(text);
  const commands: string[] = [];
  let rewritten = '';
  let cursor = 0;
  let leftover = '';
  let i = 0;
  let lastEndIndex = -1;

  while (i < toks.length) {
    const atLineStart =
      i === 0 || i === lastEndIndex || text.slice(toks[i - 1].end, toks[i].start).includes('\n');
    if (!qualifiesAsStart(text, toks, i, atLineStart)) {
      i++;
      continue;
    }

    const name = clean(toks[i].text).toLowerCase();
    const args: string[] = [];
    let trailing = 0; // punctuation after the last argument stays in the sentence
    let j = i + 1;
    while (j < toks.length) {
      if (text.slice(toks[j - 1].end, toks[j].start).includes('\n')) break;
      const raw = toks[j].text;
      const c = clean(raw);
      if (c === '') {
        j++;
        continue;
      }
      const startsNext = hasOwn(MIN_NUMBERS, c.toLowerCase()) && qualifiesAsStart(text, toks, j, true);
      if (startsNext) break;
      if (isArgument(c)) {
        args.push(c);
        j++;
        continue;
      }
      // "... #22c55e." -> keep the colour, end the command at the sentence end.
      const trimmed = c.replace(/[.,;:!?]+$/, '');
      if (trimmed && trimmed !== c && !isNumber(trimmed) && isArgument(trimmed)) {
        args.push(trimmed);
        trailing = c.length - trimmed.length;
        j++;
      }
      break;
    }

    const command = [name, ...args].join(' ');
    commands.push(command);
    leftover += text.slice(cursor, toks[i].start);
    rewritten += text.slice(cursor, toks[i].start) + '\\(' + command + '\\)';
    cursor = toks[j - 1].end - trailing;
    lastEndIndex = j;
    i = j;
  }

  leftover += text.slice(cursor);
  rewritten += text.slice(cursor);
  return { commands, rewritten, hasLeftover: leftover.trim() !== '' };
}

/** Rewrites loose or malformed commands into one `\(command\)` per command. */
export function repairDrawScript(source: string): string {
  if (!source) return source;
  const normalized = source.replace(/\\\\\(/g, '\\(').replace(/\\\\\)/g, '\\)');

  // Odd indexes are existing \( ... \) blocks; even indexes are everything else.
  const pieces = normalized.split(/(\\\([\s\S]*?\\\))/g);
  return pieces
    .map((piece, index) => {
      if (index % 2 === 1) {
        const inner = piece.slice(2, -2);
        const found = scan(inner);
        // A block holding several commands (and nothing else) is split apart;
        // anything else, such as real LaTeX, is left exactly as written.
        if (found.commands.length > 1 && !found.hasLeftover) {
          return found.commands.map((c) => '\\(' + c + '\\)').join(' ');
        }
        return piece;
      }
      return scan(piece).rewritten;
    })
    .join('');
}

/** True if the text starts with a known command name (used by the extension). */
export function startsWithCommand(text: string): boolean {
  const first = clean((text.trim().split(/\s+/)[0] || '')).toLowerCase();
  return hasOwn(MIN_NUMBERS, first);
}
