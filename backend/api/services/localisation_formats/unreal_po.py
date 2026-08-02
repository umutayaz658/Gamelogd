"""
Unreal Engine's `.po` export/import, reusing `_po.py`'s shared lexer/writer (syntax only) with
Unreal's own semantics on top — exactly as `_po.py`'s own docstring anticipated this module.

Two real, verified differences from gettext_po.py:
  - Identity: `msgctxt` = `"<Namespace>,<Key>"` (empty namespace -> `",<Key>"`), not just `key` —
    this is how Unreal's Localization Dashboard encodes its internal string-table identity into
    gettext's context field.
  - Plurals are NOT structural (no `msgid_plural`/`msgstr[N]`) — Unreal embeds the whole plural
    expression as ONE opaque string, in its own `FText` argument-modifier syntax:
    `{Count}|plural(one=...,other=...,...)`, categories in the locale's `cldr_categories` order.
    A form containing `,`, `)`, or `=` is double-quoted (backslash-escaping any literal `"`); the
    parser reverses this. No `Plural-Forms:` header line is written — Unreal doesn't consume it.
"""

import re

from . import _po
from .canonical import ParsedEntry, ParsedImport

LABEL = 'Unreal PO'
EXTENSION = 'po'
CONTENT_TYPE = 'text/x-gettext-translation'
SUPPORTS_MULTI_LANGUAGE = False
SUPPORTS_PLURALS = True

_PLURAL_RE = re.compile(r'^\{(\w+)\}\|plural\((.*)\)$', re.DOTALL)


def _build_unreal_plural_arg(count_placeholder: str, forms_by_category: dict, category_order) -> str:
    parts = []
    for cat in category_order:
        text = forms_by_category.get(cat, '')
        if any(c in text for c in ',)='):
            text = '"' + text.replace('"', '\\"') + '"'
        parts.append(f'{cat}={text}')
    return f'{{{count_placeholder}}}|plural(' + ','.join(parts) + ')'


def _split_plural_args(s: str):
    """Splits a comma-separated `cat=value` argument list, respecting double-quoted values that
    may themselves contain escaped quotes."""
    parts = []
    current = ''
    in_quotes = False
    i = 0
    while i < len(s):
        c = s[i]
        if c == '"' and (i == 0 or s[i - 1] != '\\'):
            in_quotes = not in_quotes
            current += c
            i += 1
            continue
        if c == ',' and not in_quotes:
            parts.append(current)
            current = ''
            i += 1
            continue
        current += c
        i += 1
    if current:
        parts.append(current)
    return parts


def _parse_unreal_plural_arg(s: str):
    m = _PLURAL_RE.match(s.strip())
    if not m:
        return None
    forms = {}
    for part in _split_plural_args(m.group(2)):
        if '=' not in part:
            continue
        cat, _, value = part.partition('=')
        cat = cat.strip()
        value = value.strip()
        if value.startswith('"') and value.endswith('"'):
            value = value[1:-1].replace('\\"', '"')
        if value:
            forms[cat] = value
    return forms or None


def export(bundle, *, language):
    loc = next((l for l in bundle.locales if l.code == language), None)
    if loc is None:
        raise ValueError(f'Project is not configured for language "{language}".')

    header_fields = {
        'Project-Id-Version': bundle.project_title,
        'Language': loc.code,
        'MIME-Version': '1.0',
        'Content-Type': 'text/plain; charset=UTF-8',
        'Content-Transfer-Encoding': '8bit',
    }

    entries = []
    for entry in bundle.entries:
        value = entry.translations.get(loc.code)
        msgctxt = f'{entry.namespace},{entry.key}'
        comments = [f'#. Key: {entry.key}', '#. SourceLocation: /Game/Gamelogd']

        if entry.is_plural:
            base_plural = entry.base_plural or {}
            msgid = _build_unreal_plural_arg('Count', base_plural, loc.cldr_categories)
            forms = (value.plural_forms if value else None) or {}
            msgstr = _build_unreal_plural_arg('Count', forms, loc.cldr_categories) if forms else ''
        else:
            msgid = entry.base_text
            msgstr = value.text if value else ''

        entries.append(_po.PoEntry(msgctxt=msgctxt, msgid=msgid, msgstr=msgstr, comments=comments))

    return _po.write_po(header_fields, entries)


def parse(raw: bytes, *, project_locales, source_locale):
    header_fields, po_entries = _po.parse_po(raw)
    language = header_fields.get('Language')
    locales_by_code = {loc.code: loc for loc in project_locales}
    target_locale = locales_by_code.get(language)

    warnings = []
    if language and target_locale is None:
        warnings.append(f'PO file declares Language "{language}", which is not configured for this project — translations were not imported, only the key catalogue.')
    elif not language:
        warnings.append('PO file has no Language header — translations were not imported, only the key catalogue.')

    entries = []
    for po_entry in po_entries:
        if po_entry.msgctxt and ',' in po_entry.msgctxt:
            namespace, _, key = po_entry.msgctxt.partition(',')
        elif po_entry.msgctxt:
            namespace, key = '', po_entry.msgctxt
        else:
            namespace, key = '', po_entry.msgid
            warnings.append(f'Entry with no msgctxt — falling back to msgid "{po_entry.msgid}" as the key; this may be ambiguous if two keys share source text.')

        source_plural = _parse_unreal_plural_arg(po_entry.msgid)
        entry = ParsedEntry(key=key, namespace=namespace)
        if source_plural:
            entry.is_plural = True
            entry.base_plural = source_plural
        else:
            entry.base_text = po_entry.msgid

        if target_locale and po_entry.msgstr:
            if source_plural:
                target_plural = _parse_unreal_plural_arg(po_entry.msgstr)
                if target_plural:
                    entry.translations[target_locale.code] = {'plural_forms': target_plural}
            else:
                entry.translations[target_locale.code] = {'text': po_entry.msgstr}

        entries.append(entry)

    return ParsedImport(entries=entries, warnings=warnings)
