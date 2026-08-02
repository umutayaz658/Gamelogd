"""
XLIFF 1.2 with Unity's own conventions, on the same OASIS skeleton as xliff12.py. Kept as its own
small module rather than parametrizing xliff12.py, to avoid risking that already-tested generic
converter for the sake of one divergent behaviour.

The one substantive difference: Unity does NOT use our `key[category]` per-category trans-unit
convention for plurals (that's our own pragmatic choice for the *generic* XLIFF target, not a
Unity requirement). Unity expects a SINGLE `<trans-unit id=key resname=key>`, with the whole
plural expressed as Unity's own opaque "Smart String" syntax (`{0:plural:form1|form2|...}`,
segments in the locale's `cldr_categories` order) inside one `<target>` — exactly the same cell
format `unity_csv.py` uses, since it's the same Unity-side consumer either way.

Everything else (approval-state signalling, XML safety limits) is identical to xliff12.py.
"""

import xml.etree.ElementTree as ET

from defusedxml import ElementTree as SafeET
from defusedxml.common import DefusedXmlException

from .canonical import ParsedEntry, ParsedImport
from .unity_csv import _parse_smart_plural_cell

LABEL = 'Unity XLIFF'
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
            base_plural = entry.base_plural or {}
            # Same fallback semantics as xliff12.py's per-category loop: a category the source
            # locale doesn't distinguish (e.g. English has no "few") falls back to the flat
            # representative base_text rather than an empty segment.
            source_text = '{0:plural:' + '|'.join(base_plural.get(cat, entry.base_text) for cat in loc.cldr_categories) + '}'
            forms = value.plural_forms if (value and value.plural_forms) else None
            target_text = ('{0:plural:' + '|'.join((forms or {}).get(cat, '') for cat in loc.cldr_categories) + '}') if forms else None
        else:
            source_text = entry.base_text
            target_text = value.text if value else None

        unit = ET.SubElement(group, f'{{{NS}}}trans-unit', {
            'id': entry.key, 'resname': entry.key,
            'approved': 'yes' if (value and value.status == 'approved') else 'no',
        })
        ET.SubElement(unit, f'{{{NS}}}source').text = source_text or ''
        if target_text:
            state = 'final' if (value and value.status == 'approved') else 'translated'
            ET.SubElement(unit, f'{{{NS}}}target', {'state': state}).text = target_text
        else:
            ET.SubElement(unit, f'{{{NS}}}target', {'state': 'needs-translation'})

    return b'<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(xliff, encoding='utf-8')


def parse(raw: bytes, *, project_locales, source_locale):
    if len(raw) > _MAX_BYTES:
        raise ValueError('File is too large (max 5MB).')
    # Same defence as xliff12.py: full-buffer scan for a friendly error, defusedxml as the
    # actual protection against entity-expansion / DTD payloads.
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
    locales_by_code = {loc.code: loc for loc in project_locales}
    target_locale = locales_by_code.get(target_language)
    if target_locale is None:
        warnings.append(f'File target-language "{target_language}" is not configured for this project — translations were not imported, only the key catalogue.')

    entries = []
    for unit in root.iter():
        if local(unit.tag) != 'trans-unit':
            continue
        key = unit.get('resname') or unit.get('id') or ''
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

        source_plural = _parse_smart_plural_cell(source_text, source_locale.cldr_categories) if source_text else None
        entry = ParsedEntry(key=key)
        if source_plural:
            entry.is_plural = True
            entry.base_plural = source_plural
        else:
            entry.base_text = source_text

        if target_text and is_official and target_locale:
            target_plural = _parse_smart_plural_cell(target_text, target_locale.cldr_categories) if source_plural else None
            if target_plural:
                entry.translations[target_locale.code] = {'plural_forms': target_plural}
            else:
                entry.translations[target_locale.code] = {'text': target_text}

        entries.append(entry)

    return ParsedImport(entries=entries, warnings=warnings)
