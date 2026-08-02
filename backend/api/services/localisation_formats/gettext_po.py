"""
gettext .po export/import with real structural plurals (msgid_plural/msgstr[N], driven by each
locale's Plural-Forms header) — single locale per file (multi-language export produces a ZIP,
handled by __init__.py). Identity: `msgctxt` = our `key` (gettext's real identity is the
(msgctxt, msgid) pair; keeping msgid as genuine source text serves both the translator reading
the file AND makes the round-trip lossless via msgctxt, rather than needing to match on msgid
text alone).
"""

from . import _po
from .canonical import ParsedEntry, ParsedImport

LABEL = 'gettext PO'
EXTENSION = 'po'
CONTENT_TYPE = 'text/x-gettext-translation'
SUPPORTS_MULTI_LANGUAGE = False
SUPPORTS_PLURALS = True


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
        'Plural-Forms': f'nplurals={loc.gettext_nplurals}; plural={loc.gettext_plural_expr};',
    }

    entries = []
    for entry in bundle.entries:
        value = entry.translations.get(loc.code)
        comments = [f'#. Namespace: {entry.namespace}'] if entry.namespace else []
        if entry.is_plural:
            base_plural = entry.base_plural or {}
            msgid = base_plural.get('one', entry.base_text)
            msgid_plural = base_plural.get('other', entry.base_text)
            forms = (value.plural_forms if value else None) or {}
            msgstr_plural = [forms.get(cat, '') for cat in loc.gettext_category_order]
            entries.append(_po.PoEntry(
                msgctxt=entry.key, msgid=msgid, msgid_plural=msgid_plural,
                msgstr_plural=msgstr_plural, comments=comments,
            ))
        else:
            entries.append(_po.PoEntry(
                msgctxt=entry.key, msgid=entry.base_text,
                msgstr=(value.text if value else ''), comments=comments,
            ))

    return _po.write_po(header_fields, entries)


def parse(raw: bytes, *, project_locales, source_locale):
    header_fields, po_entries = _po.parse_po(raw)
    language = header_fields.get('Language')
    locale_codes = {loc.code for loc in project_locales}
    locales_by_code = {loc.code: loc for loc in project_locales}
    target_locale = locales_by_code.get(language)

    warnings = []
    if language and language not in locale_codes:
        warnings.append(f'PO file declares Language "{language}", which is not configured for this project — translations were not imported, only the key catalogue.')
    elif not language:
        warnings.append('PO file has no Language header — translations were not imported, only the key catalogue.')

    entries = []
    for po_entry in po_entries:
        key = po_entry.msgctxt or po_entry.msgid
        if po_entry.msgctxt is None:
            warnings.append(f'Entry with no msgctxt — falling back to msgid "{po_entry.msgid}" as the key; this may be ambiguous if two keys share source text.')

        if po_entry.msgid_plural is not None:
            base_plural = {'one': po_entry.msgid, 'other': po_entry.msgid_plural}
            translations = {}
            if target_locale and po_entry.msgstr_plural:
                if len(po_entry.msgstr_plural) != target_locale.gettext_nplurals:
                    warnings.append(f'"{key}": file has {len(po_entry.msgstr_plural)} plural form(s), project locale expects {target_locale.gettext_nplurals} — mapped positionally.')
                forms = {}
                for i, category in enumerate(target_locale.gettext_category_order):
                    if i < len(po_entry.msgstr_plural) and po_entry.msgstr_plural[i]:
                        forms[category] = po_entry.msgstr_plural[i]
                if forms:
                    translations[target_locale.code] = {'plural_forms': forms}
            entries.append(ParsedEntry(
                key=key, base_text=po_entry.msgid, is_plural=True,
                base_plural=base_plural, translations=translations,
            ))
        else:
            translations = {}
            if target_locale and po_entry.msgstr:
                translations[target_locale.code] = {'text': po_entry.msgstr}
            entries.append(ParsedEntry(key=key, base_text=po_entry.msgid, translations=translations))

    return ParsedImport(entries=entries, warnings=warnings)
