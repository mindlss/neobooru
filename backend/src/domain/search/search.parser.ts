export type SearchSort =
    | 'new'
    | 'old'
    | 'updated'
    | 'rating'
    | 'rating_count'
    | 'random'
    | 'last_page';

export type FilterOp = 'eq' | 'gt' | 'gte' | 'lt' | 'lte' | 'range';

export type Filter =
    | {
          kind: 'number';
          field:
              | 'width'
              | 'height'
              | 'duration'
              | 'size'
              | 'rating'
              | 'rating_count'
              | 'comments';
          op: FilterOp;
          value?: number;
          min?: number;
          max?: number;
      }
    | {
          kind: 'type';
          value: 'IMAGE' | 'VIDEO';
      }
    | {
          kind: 'uploaded';
          op: FilterOp; // eq/gt/gte/lt/lte/range
          value?: string; // YYYY-MM-DD
          min?: string;
          max?: string;
      }
    | {
          kind: 'ratio';
          // поддерживаем парсинг, но исполнение ограничим в сервисе
          op: FilterOp;
          value?: number;
          min?: number;
          max?: number;
      };

export type Term =
    | { kind: 'tag'; name: string }
    | { kind: 'filter'; filter: Filter };

export type Expr =
    | { kind: 'term'; term: Term }
    | { kind: 'and'; items: Expr[] }
    | { kind: 'or'; items: Expr[] }
    | { kind: 'not'; item: Expr };

export type ParseResult = {
    expr: Expr | null;

    // directives
    includeComic: boolean; // token `comic`
    excludeComic: boolean; // token `-comic`
    sort?: SearchSort; // token sort:*
};

function normalizeTagName(name: string) {
    return name.trim().toLowerCase().replace(/\s+/g, '_');
}

function isWordChar(ch: string) {
    return /[a-zA-Z0-9_:/.\-]/.test(ch);
}

function tokenize(q: string): string[] {
    const s = (q ?? '').replace(/,/g, ' ').trim();
    if (!s) return [];

    const out: string[] = [];
    let i = 0;

    while (i < s.length) {
        const c = s[i];

        if (/\s/.test(c)) {
            i++;
            continue;
        }

        if (c === '(' || c === ')') {
            out.push(c);
            i++;
            continue;
        }

        // OR short form
        if (c === '|') {
            out.push('|');
            i++;
            continue;
        }

        // word (including leading '-tag')
        let j = i;
        while (j < s.length && isWordChar(s[j]) && s[j] !== '(' && s[j] !== ')')
            j++;
        const w = s.slice(i, j);
        out.push(w);
        i = j;
    }

    return out.filter(Boolean);
}

function isOp(tok: string) {
    const t = tok.toUpperCase();
    return t === 'AND' || t === 'OR' || t === 'NOT' || tok === '|';
}

function opKey(tok: string): 'AND' | 'OR' | 'NOT' {
    if (tok === '|') return 'OR';
    const t = tok.toUpperCase();
    if (t === 'AND') return 'AND';
    if (t === 'OR') return 'OR';
    return 'NOT';
}

function precedence(op: 'AND' | 'OR' | 'NOT') {
    if (op === 'NOT') return 3;
    if (op === 'AND') return 2;
    return 1; // OR
}

function rightAssoc(op: 'AND' | 'OR' | 'NOT') {
    return op === 'NOT';
}

function parseNumberFilter(field: string, raw: string): Filter | null {
    // value patterns: 123 | >123 | >=123 | <123 | <=123 | 10..20
    const r = raw.trim();

    const rangeMatch = r.match(/^(\d+(?:\.\d+)?)\.\.(\d+(?:\.\d+)?)$/);
    if (rangeMatch) {
        const min = Number(rangeMatch[1]);
        const max = Number(rangeMatch[2]);
        if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
        return { kind: 'number', field: field as any, op: 'range', min, max };
    }

    const cmpMatch = r.match(/^(>=|<=|>|<)(\d+(?:\.\d+)?)$/);
    if (cmpMatch) {
        const opRaw = cmpMatch[1];
        const val = Number(cmpMatch[2]);
        if (!Number.isFinite(val)) return null;

        const op: FilterOp =
            opRaw === '>'
                ? 'gt'
                : opRaw === '>='
                ? 'gte'
                : opRaw === '<'
                ? 'lt'
                : 'lte';

        return { kind: 'number', field: field as any, op, value: val };
    }

    const eq = Number(r);
    if (!Number.isFinite(eq)) return null;
    return { kind: 'number', field: field as any, op: 'eq', value: eq };
}

function parseUploadedFilter(raw: string): Filter | null {
    const r = raw.trim();

    const range = r.match(/^(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/);
    if (range)
        return { kind: 'uploaded', op: 'range', min: range[1], max: range[2] };

    const cmp = r.match(/^(>=|<=|>|<)(\d{4}-\d{2}-\d{2})$/);
    if (cmp) {
        const opRaw = cmp[1];
        const op: FilterOp =
            opRaw === '>'
                ? 'gt'
                : opRaw === '>='
                ? 'gte'
                : opRaw === '<'
                ? 'lt'
                : 'lte';
        return { kind: 'uploaded', op, value: cmp[2] };
    }

    const eq = r.match(/^(\d{4}-\d{2}-\d{2})$/);
    if (eq) return { kind: 'uploaded', op: 'eq', value: eq[1] };

    return null;
}

function parseRatioFilter(raw: string): Filter | null {
    const r = raw.trim();

    // 16/9
    const frac = r.match(/^(\d+(?:\.\d+)?)[/](\d+(?:\.\d+)?)$/);
    if (frac) {
        const a = Number(frac[1]);
        const b = Number(frac[2]);
        if (!Number.isFinite(a) || !Number.isFinite(b) || b === 0) return null;
        return { kind: 'ratio', op: 'eq', value: a / b };
    }

    // 1.3..1.9
    const range = r.match(/^(\d+(?:\.\d+)?)\.\.(\d+(?:\.\d+)?)$/);
    if (range) {
        const min = Number(range[1]);
        const max = Number(range[2]);
        if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
        return { kind: 'ratio', op: 'range', min, max };
    }

    // >=1.7
    const cmp = r.match(/^(>=|<=|>|<)(\d+(?:\.\d+)?)$/);
    if (cmp) {
        const opRaw = cmp[1];
        const val = Number(cmp[2]);
        if (!Number.isFinite(val)) return null;
        const op: FilterOp =
            opRaw === '>'
                ? 'gt'
                : opRaw === '>='
                ? 'gte'
                : opRaw === '<'
                ? 'lt'
                : 'lte';
        return { kind: 'ratio', op, value: val };
    }

    // eq
    const eq = Number(r);
    if (!Number.isFinite(eq)) return null;
    return { kind: 'ratio', op: 'eq', value: eq };
}

function parseAtomToken(tokRaw: string, st: ParseResult): Term | null {
    const tok = tokRaw.trim();
    if (!tok) return null;

    const low = tok.toLowerCase();

    // directives
    if (low === 'comic') {
        st.includeComic = true;
        return null;
    }

    if (low.startsWith('sort:')) {
        const v = low.slice('sort:'.length);
        const allowed: SearchSort[] = [
            'new',
            'old',
            'updated',
            'rating',
            'rating_count',
            'random',
            'last_page',
        ];
        if ((allowed as string[]).includes(v)) st.sort = v as SearchSort;
        else throw new Error('BAD_SORT');
        return null;
    }

    // type:image/video
    if (low.startsWith('type:')) {
        const v = low.slice('type:'.length);
        if (v === 'image')
            return { kind: 'filter', filter: { kind: 'type', value: 'IMAGE' } };
        if (v === 'video')
            return { kind: 'filter', filter: { kind: 'type', value: 'VIDEO' } };
        throw new Error('BAD_FILTER');
    }

    // uploaded:...
    if (low.startsWith('uploaded:')) {
        const f = parseUploadedFilter(tok.slice('uploaded:'.length));
        if (!f) throw new Error('BAD_FILTER');
        return { kind: 'filter', filter: f };
    }

    // ratio:...
    if (low.startsWith('ratio:')) {
        const f = parseRatioFilter(tok.slice('ratio:'.length));
        if (!f) throw new Error('BAD_FILTER');
        return { kind: 'filter', filter: f };
    }

    // numeric fields
    const m = tok.match(/^([a-z_]+):(.*)$/);
    if (m) {
        const field = m[1].toLowerCase();
        const raw = m[2];

        const numFields = new Set([
            'width',
            'height',
            'duration',
            'size',
            'rating',
            'rating_count',
            'comments',
        ]);

        if (numFields.has(field)) {
            const f = parseNumberFilter(field, raw);
            if (!f) throw new Error('BAD_FILTER');
            return { kind: 'filter', filter: f };
        }
    }

    // tag
    return { kind: 'tag', name: normalizeTagName(tok) };
}

function insertImplicitAnd(tokens: string[]): string[] {
    const out: string[] = [];
    let prevType: 'none' | 'term' | 'rparen' = 'none';

    for (const t of tokens) {
        const tt = t;

        const isLParen = tt === '(';
        const isRParen = tt === ')';
        const isOperator = isOp(tt);
        const isNotLike = opKey(tt) === 'NOT';

        // if next begins a term-like or '(' or NOT, and prev ended term or ')', insert AND
        const beginsOperand = !isOperator && !isRParen; // word or '('
        const beginsNot = isOperator && isNotLike;

        if (
            (beginsOperand || beginsNot) &&
            (prevType === 'term' || prevType === 'rparen')
        ) {
            out.push('AND');
        }

        out.push(tt);

        if (isRParen) prevType = 'rparen';
        else if (isOperator) prevType = 'none';
        else if (isLParen) prevType = 'none';
        else prevType = 'term';
    }

    return out;
}

function buildExprFromRpn(rpn: (Expr | 'AND' | 'OR' | 'NOT')[]): Expr | null {
    const stack: Expr[] = [];

    for (const t of rpn) {
        if (t === 'AND' || t === 'OR') {
            const b = stack.pop();
            const a = stack.pop();
            if (!a || !b) throw new Error('BAD_QUERY');

            // flatten
            if (t === 'AND') {
                const items: Expr[] = [];
                if (a.kind === 'and') items.push(...a.items);
                else items.push(a);
                if (b.kind === 'and') items.push(...b.items);
                else items.push(b);
                stack.push({ kind: 'and', items });
            } else {
                const items: Expr[] = [];
                if (a.kind === 'or') items.push(...a.items);
                else items.push(a);
                if (b.kind === 'or') items.push(...b.items);
                else items.push(b);
                stack.push({ kind: 'or', items });
            }
            continue;
        }

        if (t === 'NOT') {
            const a = stack.pop();
            if (!a) throw new Error('BAD_QUERY');
            stack.push({ kind: 'not', item: a });
            continue;
        }

        stack.push(t);
    }

    if (stack.length === 0) return null;
    if (stack.length !== 1) throw new Error('BAD_QUERY');
    return stack[0];
}

function prune(
    expr: Expr | null,
    shouldDropTerm: (term: Term) => boolean
): Expr | null {
    if (!expr) return null;

    if (expr.kind === 'term') {
        if (shouldDropTerm(expr.term)) return null;
        return expr;
    }

    if (expr.kind === 'not') {
        const inner = prune(expr.item, shouldDropTerm);
        if (!inner) return null; // no-op
        return { kind: 'not', item: inner };
    }

    if (expr.kind === 'and') {
        const items = expr.items
            .map((x) => prune(x, shouldDropTerm))
            .filter(Boolean) as Expr[];
        if (items.length === 0) return null;
        if (items.length === 1) return items[0];
        return { kind: 'and', items };
    }

    if (expr.kind === 'or') {
        const items = expr.items
            .map((x) => prune(x, shouldDropTerm))
            .filter(Boolean) as Expr[];
        if (items.length === 0) return null;
        if (items.length === 1) return items[0];
        return { kind: 'or', items };
    }

    return expr;
}

export function parseSearchQuery(q: string): ParseResult {
    const st: ParseResult = {
        expr: null,
        includeComic: false,
        excludeComic: false,
        sort: undefined,
    };

    const rawTokens = tokenize(q);

    // expand -token => NOT token, except special -comic
    const expanded: string[] = [];
    for (const t of rawTokens) {
        const low = t.toLowerCase();

        if (low === '-comic') {
            st.excludeComic = true;
            continue;
        }

        if (t.startsWith('-') && t.length > 1) {
            expanded.push('NOT');
            expanded.push(t.slice(1));
            continue;
        }

        expanded.push(t);
    }

    const tokens = insertImplicitAnd(expanded);

    // shunting-yard -> RPN
    const output: (Expr | 'AND' | 'OR' | 'NOT')[] = [];
    const ops: ('AND' | 'OR' | 'NOT' | '(')[] = [];

    for (const tok of tokens) {
        if (tok === '(') {
            ops.push('(');
            continue;
        }

        if (tok === ')') {
            while (ops.length > 0 && ops[ops.length - 1] !== '(') {
                output.push(ops.pop() as any);
            }
            if (ops.length === 0 || ops[ops.length - 1] !== '(')
                throw new Error('BAD_QUERY');
            ops.pop();
            continue;
        }

        if (isOp(tok)) {
            const op = opKey(tok);

            while (ops.length > 0) {
                const top = ops[ops.length - 1];
                if (top === '(') break;

                const pTop = precedence(top);
                const pOp = precedence(op);

                if (
                    (rightAssoc(op) && pOp < pTop) ||
                    (!rightAssoc(op) && pOp <= pTop)
                ) {
                    output.push(ops.pop() as any);
                    continue;
                }
                break;
            }

            ops.push(op);
            continue;
        }

        // atom -> term or directive
        const term = parseAtomToken(tok, st);
        if (!term) continue; // directive/no-op
        output.push({ kind: 'term', term });
    }

    while (ops.length > 0) {
        const op = ops.pop()!;
        if (op === '(') throw new Error('BAD_QUERY');
        output.push(op as any);
    }

    st.expr = buildExprFromRpn(output);

    // if -comic present -> comicMode must NOT be forced even if "comic" exists
    if (st.excludeComic) st.includeComic = false;

    // if comicMode on -> ignore comic_page in expression
    if (st.includeComic) {
        st.expr = prune(
            st.expr,
            (term) => term.kind === 'tag' && term.name === 'comic_page'
        );
    }

    return st;
}
