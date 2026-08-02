"""
Unity `com.unity.localization` String Table CSV export/import.

Real column layout (verified against Unity's own docs): `Key, Id, Shared Comments,
<LanguageName>(<localeCode>), ...` — one column per locale (source language included, exactly
like Unity's own String Table Collection always carries the source language as a column too),
headed by the display name plus the locale code in parentheses (e.g. `English(en)`,
`Turkish(tr)`, `Portuguese (Brazil)(pt-BR)`). `Id` is always left blank — Unity matches an import
row on `Key` when `Id` is empty, and we have no meaningful Unity entry id to offer. `Shared
Comments` carries `namespace: <ns>`, which is how namespace round-trips.

Plurals use Unity's own "Smart String" syntax, NOT structural fields: `{0:plural:form1|form2|...}`,
with `formN` segments in the locale's own `cldr_categories` order (this is what Unity's Plural
Localization Formatter expects — one opaque string per cell, not separate columns per category).

Known, accepted limitation (not fixed — `export()` has no warnings channel, matching every other
format module's signature): a plural form containing a literal `|` will corrupt the Smart String
segmentation on the Unity side. Translators should avoid literal pipe characters in pluralisable
strings destined for Unity.
"""

import csv
import io
import re

from .canonical import ParsedEntry, ParsedImport

LABEL = 'Unity CSV'
EXTENSION = 'csv'
CONTENT_TYPE = 'text/csv'
SUPPORTS_MULTI_LANGUAGE = True
SUPPORTS_PLURALS = True

_HEADER_RE = re.compile(r'^(.*)\((.+)\)$')
_SMART_PLURAL_RE = re.compile(r'^\{0:plural:(.*)\}$', re.DOTALL)


def _smart_plural_cell(plural_forms, categories) -> str:
    segments = [(plural_forms or {}).get(cat, '') for cat in categories]
    return '{0:plural:' + '|'.join(segments) + '}'


def _parse_smart_plural_cell(cell: str, categories):
    m = _SMART_PLURAL_RE.match(cell.strip())
    if not m:
        return None
    segments = m.group(1).split('|')
    forms = {}
    for cat, seg in zip(categories, segments):
        if seg.strip():
            forms[cat] = seg
    return forms or None


def export(bundle, *, language):
    targets = bundle.locales if language == 'all' else [next(l for l in bundle.locales if l.code == language)]
    # The source language is always its own column too, exactly like a real Unity String Table
    # Collection — translators need the source text alongside whatever they're translating.
    columns = [bundle.source] + targets

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(['Key', 'Id', 'Shared Comments'] + [f'{loc.name}({loc.code})' for loc in columns])

    for entry in bundle.entries:
        row = [entry.key, '', f'namespace: {entry.namespace}' if entry.namespace else '']
        for loc in columns:
            if loc.code == bundle.source.code:
                cell = _smart_plural_cell(entry.base_plural, loc.cldr_categories) if entry.is_plural else entry.base_text
            else:
                value = entry.translations.get(loc.code)
                if entry.is_plural:
                    forms = (value.plural_forms if value else None) or {}
                    cell = _smart_plural_cell(forms, loc.cldr_categories)
                else:
                    cell = value.text if (value and value.text) else entry.base_text
            row.append(cell)
        writer.writerow(row)

    return buf.getvalue().encode('utf-8')


def parse(raw: bytes, *, project_locales, source_locale):
    try:
        text = raw.decode('utf-8-sig')
    except UnicodeDecodeError as exc:
        raise ValueError(f'Could not decode file as UTF-8: {exc}') from exc

    rows = list(csv.reader(io.StringIO(text)))
    rows = [r for r in rows if any(cell.strip() for cell in r)]
    if not rows:
        raise ValueError('CSV file is empty.')

    header = [h.strip() for h in rows[0]]
    try:
        key_idx = header.index('Key')
    except ValueError:
        raise ValueError('CSV must have a "Key" column.')
    comments_idx = header.index('Shared Comments') if 'Shared Comments' in header else None

    locales_by_code = {loc.code: loc for loc in project_locales}
    lang_cols = []       # (idx, code) — target language columns
    source_idx = None    # index of the source-language column, if present
    warnings = []
    for idx, h in enumerate(header):
        if idx in (key_idx, comments_idx) or h == 'Id':
            continue
        if h.endswith(' Comments'):
            continue  # per-language comment columns — read and discarded, same as round-1 aliases
        m = _HEADER_RE.match(h)
        if not m:
            continue
        code = m.group(2).strip()
        if code == source_locale.code:
            source_idx = idx
        elif code in locales_by_code:
            lang_cols.append((idx, code))
        else:
            warnings.append(f'Unknown language column "{h}" — skipped.')

    entries = []
    for row_num, cols in enumerate(rows[1:], start=2):
        key = (cols[key_idx] if key_idx < len(cols) else '').strip()
        if not key:
            warnings.append(f'Row {row_num}: skipped, empty key.')
            continue
        namespace = ''
        if comments_idx is not None and comments_idx < len(cols):
            comment = cols[comments_idx].strip()
            if comment.startswith('namespace:'):
                namespace = comment[len('namespace:'):].strip()

        base_cell = (cols[source_idx] if source_idx is not None and source_idx < len(cols) else '').strip()
        base_plural = _parse_smart_plural_cell(base_cell, source_locale.cldr_categories) if base_cell else None
        is_plural = base_plural is not None
        base_text = '' if is_plural else base_cell

        translations = {}
        for idx, code in lang_cols:
            cell = (cols[idx] if idx < len(cols) else '').strip()
            if not cell:
                continue
            loc = locales_by_code[code]
            plural_forms = _parse_smart_plural_cell(cell, loc.cldr_categories)
            if plural_forms:
                translations[code] = {'plural_forms': plural_forms}
            else:
                translations[code] = {'text': cell}

        entries.append(ParsedEntry(
            key=key, namespace=namespace, base_text=base_text,
            is_plural=is_plural, base_plural=base_plural, translations=translations,
        ))

    return ParsedImport(entries=entries, warnings=warnings)
