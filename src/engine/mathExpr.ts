/**
 * Tiny, safe math expression compiler used by the DrawScript `plot` command.
 * It never uses eval/Function: expressions are tokenized, parsed into a small
 * AST and evaluated by a closure, so untrusted LLM output cannot run code.
 *
 * Supports: numbers, x (or t), pi, e, tau, + - * / % ^ (and **), unary minus,
 * parentheses, implicit multiplication ("2x", "3(x+1)", "2pi x"), and the
 * functions sin cos tan asin acos atan atan2 sinh cosh tanh sqrt cbrt abs ln
 * log log2 exp floor ceil round sign min max pow.
 */

type Node =
  | { k: 'num'; v: number }
  | { k: 'var' }
  | { k: 'un'; op: '-' | '+'; a: Node }
  | { k: 'bin'; op: '+' | '-' | '*' | '/' | '%' | '^'; a: Node; b: Node }
  | { k: 'call'; fn: string; args: Node[] };

type Token =
  | { t: 'num'; v: number }
  | { t: 'id'; v: string }
  | { t: 'op'; v: string };

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
  tau: Math.PI * 2,
};

const FUNCTIONS: Record<string, (...a: number[]) => number> = {
  sin: Math.sin,
  cos: Math.cos,
  tan: Math.tan,
  asin: Math.asin,
  acos: Math.acos,
  atan: Math.atan,
  atan2: Math.atan2,
  sinh: Math.sinh,
  cosh: Math.cosh,
  tanh: Math.tanh,
  sqrt: Math.sqrt,
  cbrt: Math.cbrt,
  abs: Math.abs,
  ln: Math.log,
  log: Math.log10,
  log2: Math.log2,
  exp: Math.exp,
  floor: Math.floor,
  ceil: Math.ceil,
  round: Math.round,
  sign: Math.sign,
  min: Math.min,
  max: Math.max,
  pow: Math.pow,
};

function tokenize(src: string): Token[] {
  const out: Token[] = [];
  const s = src.replace(/π/g, ' pi ').replace(/\s+/g, ' ');
  let i = 0;
  while (i < s.length) {
    const ch = s[i];
    if (ch === ' ') {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      const m = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(s.slice(i));
      if (!m) throw new Error(`bad number near "${s.slice(i, i + 6)}"`);
      out.push({ t: 'num', v: parseFloat(m[0]) });
      i += m[0].length;
      continue;
    }
    if (/[a-zA-Z_]/.test(ch)) {
      const m = /^[a-zA-Z_][a-zA-Z0-9_]*/.exec(s.slice(i))!;
      out.push({ t: 'id', v: m[0].toLowerCase() });
      i += m[0].length;
      continue;
    }
    if (ch === '*' && s[i + 1] === '*') {
      out.push({ t: 'op', v: '^' });
      i += 2;
      continue;
    }
    if ('+-*/%^(),'.includes(ch)) {
      out.push({ t: 'op', v: ch });
      i++;
      continue;
    }
    throw new Error(`unexpected character "${ch}"`);
  }
  return out;
}

// `in` would also match inherited names such as "constructor", so check own keys only.
const hasOwn = (obj: object, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(obj, key);

class Parser {
  private pos = 0;
  constructor(private readonly tokens: Token[]) {}

  parse(): Node {
    const node = this.expr();
    if (this.pos < this.tokens.length) {
      throw new Error('unexpected trailing input');
    }
    return node;
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos];
  }

  private isOp(v: string): boolean {
    const t = this.peek();
    return !!t && t.t === 'op' && t.v === v;
  }

  private expr(): Node {
    let left = this.term();
    while (this.isOp('+') || this.isOp('-')) {
      const op = (this.tokens[this.pos++] as { v: '+' | '-' }).v;
      left = { k: 'bin', op, a: left, b: this.term() };
    }
    return left;
  }

  private startsPrimary(): boolean {
    const t = this.peek();
    if (!t) return false;
    return t.t === 'num' || t.t === 'id' || (t.t === 'op' && t.v === '(');
  }

  private term(): Node {
    let left = this.unary();
    for (;;) {
      if (this.isOp('*') || this.isOp('/') || this.isOp('%')) {
        const op = (this.tokens[this.pos++] as { v: '*' | '/' | '%' }).v;
        left = { k: 'bin', op, a: left, b: this.unary() };
      } else if (this.startsPrimary()) {
        // implicit multiplication: 2x, 3(x+1), 2 pi x
        left = { k: 'bin', op: '*', a: left, b: this.unary() };
      } else {
        break;
      }
    }
    return left;
  }

  private unary(): Node {
    if (this.isOp('-') || this.isOp('+')) {
      const op = (this.tokens[this.pos++] as { v: '-' | '+' }).v;
      return { k: 'un', op, a: this.unary() };
    }
    return this.power();
  }

  private power(): Node {
    const base = this.primary();
    if (this.isOp('^')) {
      this.pos++;
      return { k: 'bin', op: '^', a: base, b: this.unary() };
    }
    return base;
  }

  private primary(): Node {
    const t = this.tokens[this.pos++];
    if (!t) throw new Error('unexpected end of expression');
    if (t.t === 'num') return { k: 'num', v: t.v };
    if (t.t === 'id') {
      if (this.isOp('(')) {
        if (!hasOwn(FUNCTIONS, t.v)) throw new Error(`unknown function "${t.v}"`);
        this.pos++;
        const args: Node[] = [];
        if (!this.isOp(')')) {
          args.push(this.expr());
          while (this.isOp(',')) {
            this.pos++;
            args.push(this.expr());
          }
        }
        if (!this.isOp(')')) throw new Error('missing ")"');
        this.pos++;
        return { k: 'call', fn: t.v, args };
      }
      if (t.v === 'x' || t.v === 't') return { k: 'var' };
      if (hasOwn(CONSTANTS, t.v)) return { k: 'num', v: CONSTANTS[t.v] };
      throw new Error(`unknown name "${t.v}"`);
    }
    if (t.v === '(') {
      const inner = this.expr();
      if (!this.isOp(')')) throw new Error('missing ")"');
      this.pos++;
      return inner;
    }
    throw new Error(`unexpected "${t.v}"`);
  }
}

function evaluate(node: Node, x: number): number {
  switch (node.k) {
    case 'num':
      return node.v;
    case 'var':
      return x;
    case 'un':
      return node.op === '-' ? -evaluate(node.a, x) : evaluate(node.a, x);
    case 'bin': {
      const a = evaluate(node.a, x);
      const b = evaluate(node.b, x);
      switch (node.op) {
        case '+':
          return a + b;
        case '-':
          return a - b;
        case '*':
          return a * b;
        case '/':
          return a / b;
        case '%':
          return a % b;
        case '^':
          return Math.pow(a, b);
      }
      return NaN;
    }
    case 'call':
      return FUNCTIONS[node.fn](...node.args.map((arg) => evaluate(arg, x)));
  }
}

/** Compiles "sin(x)/x", "2x^2 - 3", "y = sqrt(x)" ... into a callable f(x). */
export function compileExpression(source: string): (x: number) => number {
  const cleaned = source
    .trim()
    .replace(/^(?:y|f\s*\(\s*x\s*\))\s*=\s*/i, '')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3');
  if (!cleaned) throw new Error('empty expression');
  const ast = new Parser(tokenize(cleaned)).parse();
  return (x: number) => evaluate(ast, x);
}
