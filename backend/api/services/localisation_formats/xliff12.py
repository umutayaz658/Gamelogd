"""
Generic XLIFF 1.2 (OASIS) export/import — the "send this to any CAT tool" format. Single-locale
per file (multi-language export produces a ZIP of one .xlf per locale, handled by __init__.py).

Plurals: XLIFF 1.2 has no native plural construct. We use our own convention — one <trans-unit>
per CLDR category, `resname` suffixed `key[category]` — documented here because it is NOT part
of the spec, just a pragmatic choice (the same one several real-world XLIFF producers use when
they need plurals in a 1.2 file).

Approval state: written as BOTH the `approved` boolean attribute AND the `state` enum on
<target>, since different tools/vendors treat either as authoritative and we don't control which
one a downstream consumer reads. Approved -> approved="yes" + state="final". Submitted-but-
pending -> approved="no" + state="translated". Untranslated -> state="needs-translation", empty
<target>.
"""

import xml.etree.ElementTree as ET

from defusedxml import ElementTree as SafeET
from defusedxml.common import DefusedXmlException

from .canonical import ParsedEntry, ParsedImport

LABEL = 'XLIFF 1.2'
EXTENSION = 'xlf'
CONTENT_TYPE = 'application/xml'
SUPPORTS_MULTI_LANGUAGE = False
SUPPORTS_PLURALS = True

NS = 'urn:oasis:names:tc:xliff:document:1.2'
_MAX_BYTES = 5 * 1024 * 1024


def export(bundle, *, language):
    loc = next((l for l in bundle.locales if l.code == language), None)
    if loc is None:
        raise ValueError(f'Project is not configured for language "{language}".')

    ET.register_namespace('', NS)
    xliff = ET.Element(f'{{{NS}}}xliff', {'version': '1.2'})
    file_el = ET.SubElement(xliff, f'{{{NS}}}file', {
        'original': f'gamelogd://project/{bundle.project_id}',
        'source-language': bundle.source.code,
        'target-language': loc.code,
        'datatype': 'plaintext',
    })
    body = ET.SubElement(file_el, f'{{{NS}}}body')

    for entry in bundle.entries:
        group = ET.SubElement(body, f'{{{NS}}}group', {'id': entry.namespace or 'root', 'resname': entry.namespace or 'root'})
        value = entry.translations.get(loc.code)

        if entry.is_plural:
            for category in loc.cldr_categories:
                base_text = (entry.base_plural or {}).get(category, entry.base_text)
                target_text = (value.plural_forms or {}).get(category) if value else None
                _write_unit(group, f'{entry.key}[{category}]', base_text, target_text, value)
        else:
            _write_unit(group, entry.key, entry.base_text, value.text if value else None, value)

    return b'<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(xliff, encoding='utf-8')


def _write_unit(parent, unit_id, source_text, target_text, value):
    unit = ET.SubElement(parent, f'{{{NS}}}trans-unit', {
        'id': unit_id, 'resname': unit_id,
        'approved': 'yes' if (value and value.status == 'approved') else 'no',
    })
    ET.SubElement(unit, f'{{{NS}}}source').text = source_text or ''
    if target_text:
        state = 'final' if (value and value.status == 'approved') else 'translated'
        target = ET.SubElement(unit, f'{{{NS}}}target', {'state': state})
        target.text = target_text
    else:
        ET.SubElement(unit, f'{{{NS}}}target', {'state': 'needs-translation'})


def parse(raw: bytes, *, project_locales, source_locale):
    if len(raw) > _MAX_BYTES:
        raise ValueError('File is too large (max 5MB).')
    # Scan the whole buffer, not just a prefix: a long prolog comment would otherwise smuggle
    # a DTD past the check. defusedxml below is the real defence (entity expansion / DTD are
    # rejected by the parser itself); this scan just gives a friendlier error message.
    if b'<!DOCTYPE' in raw or b'<!ENTITY' in raw:
        raise ValueError('Refusing to parse an XML file containing a DOCTYPE/ENTITY declaration.')

    try:
        root = SafeET.fromstring(raw)
    except DefusedXmlException:
        raise ValueError('Refusing to parse an XML file containing a DOCTYPE/ENTITY declaration.')
    except ET.ParseError as exc:
        raise ValueError(f'Invalid XLIFF/XML file: {exc}') from exc

    def local(tag):
        return tag.split('}')[-1]

    warnings = []
    target_language = None
    for file_el in root.iter():
        if local(file_el.tag) == 'file':
            target_language = file_el.get('target-language')
            break
    locale_codes = {loc.code for loc in project_locales}
    if target_language not in locale_codes:
        warnings.append(f'File target-language "{target_language}" is not configured for this project — translations were not imported, only the key catalogue.')
        target_language = None

    by_key = {}  # key -> ParsedEntry
    plural_forms_by_key = {}  # key -> {category: text}
    for unit in root.iter():
        if local(unit.tag) != 'trans-unit':
            continue
        unit_id = unit.get('resname') or unit.get('id') or ''
        approved = unit.get('approved') == 'yes'
        state = None
        source_text = ''
        target_text = None
        for child in unit:
            if local(child.tag) == 'source':
                source_text = child.text or ''
            elif local(child.tag) == 'target':
                target_text = child.text
                state = child.get('state')
        is_official = approved or state in ('final', 'signed-off', 'reviewed')

        category = None
        base_key = unit_id
        if unit_id.endswith(']') and '[' in unit_id:
            base_key, _, cat = unit_id.rpartition('[')
            category = cat[:-1]

        entry = by_key.setdefault(base_key, ParsedEntry(key=base_key))
        if category:
            entry.is_plural = True
            entry.base_plural = entry.base_plural or {}
            entry.base_plural[category] = source_text
            if target_text and is_official and target_language:
                plural_forms_by_key.setdefault(base_key, {})[category] = target_text
        else:
            entry.base_text = source_text
            if target_text and is_official and target_language:
                entry.translations[target_language] = {'text': target_text}

    entries = []
    for key, entry in by_key.items():
        forms = plural_forms_by_key.get(key)
        if forms:
            entry.translations[target_language] = {'plural_forms': forms}
        entries.append(entry)

    return ParsedImport(entries=entries, warnings=warnings)
