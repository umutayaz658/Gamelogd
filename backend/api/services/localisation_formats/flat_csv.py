"""
Round-1's plain `key,<source>,<lang>` CSV format, ported server-side. No plural support (dropped
with a warning, same rationale as flat_json.py).
"""

import csv
import io

from .canonical import ParsedEntry, ParsedImport

LABEL = 'Flat CSV'
EXTENSION = 'csv'
CONTENT_TYPE = 'text/csv'
SUPPORTS_MULTI_LANGUAGE = True
SUPPORTS_PLURALS = False


def export(bundle, *, language):
    buf = io.StringIO()
    if language == 'all':
        writer = csv.writer(buf)
        writer.writerow(['key', bundle.source.code] + [loc.code for loc in bundle.locales])
        for entry in bundle.entries:
            row = [entry.key, entry.base_text]
            for loc in bundle.locales:
                value = entry.translations.get(loc.code)
                row.append(value.text if (value and value.text) else '')
            writer.writerow(row)
        return buf.getvalue().encode('utf-8')

    writer = csv.writer(buf)
    writer.writerow(['key', bundle.source.code, language])
    for entry in bundle.entries:
        value = entry.translations.get(language)
        writer.writerow([entry.key, entry.base_text, value.text if (value and value.text) else ''])
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
        key_idx = header.index('key')
    except ValueError:
        raise ValueError('CSV must have a "key" column.')

    locale_codes = {loc.code for loc in project_locales}
    lang_cols = []
    base_idx = None
    for idx, h in enumerate(header):
        if idx == key_idx:
            continue
        if h == source_locale.code:
            base_idx = idx
        elif h in locale_codes:
            lang_cols.append((idx, h))

    warnings = []
    entries = []
    for row_num, cols in enumerate(rows[1:], start=2):
        key = (cols[key_idx] if key_idx < len(cols) else '').strip()
        if not key:
            warnings.append(f'Row {row_num}: skipped, empty key.')
            continue
        base_text = (cols[base_idx] if base_idx is not None and base_idx < len(cols) else '').strip()
        translations = {}
        for idx, code in lang_cols:
            value = (cols[idx] if idx < len(cols) else '').strip()
            if value:
                translations[code] = {'text': value}
        entries.append(ParsedEntry(key=key, base_text=base_text, translations=translations))

    return ParsedImport(entries=entries, warnings=warnings)
