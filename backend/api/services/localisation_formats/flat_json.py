"""
Round-1's plain `{key: text}` / `{key: {lang: text}}` JSON format, ported server-side from the
client-side parsers that used to live in frontend/src/components/devs/LocalisationManager.tsx.
Kept as a format option (not replaced by the richer formats below) because it's the
lowest-friction option for a solo dev who just wants a flat lookup table for their own loader —
no plural support (a plural entry's forms are dropped with a warning, same as round 1's
mergeImportedRows discarding translation values it couldn't place structurally).
"""

import json

from .canonical import ParsedEntry, ParsedImport

LABEL = 'Flat JSON'
EXTENSION = 'json'
CONTENT_TYPE = 'application/json'
SUPPORTS_MULTI_LANGUAGE = True
SUPPORTS_PLURALS = False


def export(bundle, *, language):
    if language == 'all':
        result = {}
        for entry in bundle.entries:
            row = {bundle.source.code: entry.base_text}
            for loc in bundle.locales:
                value = entry.translations.get(loc.code)
                if value and value.text:
                    row[loc.code] = value.text
            result[entry.key] = row
        return json.dumps(result, indent=2, ensure_ascii=False).encode('utf-8')

    result = {}
    for entry in bundle.entries:
        value = entry.translations.get(language)
        result[entry.key] = value.text if (value and value.text) else entry.base_text
    return json.dumps(result, indent=2, ensure_ascii=False).encode('utf-8')


def parse(raw: bytes, *, project_locales, source_locale):
    try:
        data = json.loads(raw.decode('utf-8'))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise ValueError(f'Invalid JSON file: {exc}') from exc
    if not isinstance(data, dict):
        raise ValueError('JSON file must be an object mapping keys to text or language objects.')

    locale_codes = {loc.code for loc in project_locales}
    warnings = []
    entries = []
    for key, value in data.items():
        if not key.strip():
            warnings.append('Skipped a row with an empty key.')
            continue
        if isinstance(value, str):
            entries.append(ParsedEntry(key=key, base_text=value))
            continue
        if isinstance(value, dict):
            base_text = value.get(source_locale.code, '')
            translations = {}
            for code, text_value in value.items():
                if code == source_locale.code or not isinstance(text_value, str) or not text_value.strip():
                    continue
                if code in locale_codes:
                    translations[code] = {'text': text_value}
                else:
                    warnings.append(f'Unknown language "{code}" for key "{key}" — skipped.')
            entries.append(ParsedEntry(key=key, base_text=base_text, translations=translations))
            continue
        warnings.append(f'Skipped "{key}": unsupported value type.')

    return ParsedImport(entries=entries, warnings=warnings)
