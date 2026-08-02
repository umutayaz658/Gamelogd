"""
Format registry + dispatch. Every format module exposes the same four module-level names:
`LABEL`, `EXTENSION`, `CONTENT_TYPE`, `SUPPORTS_MULTI_LANGUAGE`, `SUPPORTS_PLURALS`, and two
functions: `export(bundle, *, language) -> bytes` and
`parse(raw: bytes, *, project_locales, source_locale) -> ParsedImport`.
"""

import io
import re
import zipfile

from . import flat_csv, flat_json, gettext_po, unity_csv, unity_xliff, unreal_po, xliff12

FORMATS = {
    'flat_json': flat_json,
    'flat_csv': flat_csv,
    'xliff12': xliff12,
    'gettext_po': gettext_po,
    'unity_csv': unity_csv,
    'unity_xliff': unity_xliff,
    'unreal_po': unreal_po,
}

_SLUG_TO_LABEL_EXT = {slug: (mod.LABEL, mod.EXTENSION) for slug, mod in FORMATS.items()}


def list_formats():
    return [
        {
            'slug': slug,
            'label': mod.LABEL,
            'extension': mod.EXTENSION,
            'supports_multi_language': mod.SUPPORTS_MULTI_LANGUAGE,
            'supports_plurals': mod.SUPPORTS_PLURALS,
        }
        for slug, mod in FORMATS.items()
    ]


def _slugify(text: str) -> str:
    return re.sub(r'[^a-z0-9]+', '-', text.lower()).strip('-') or 'project'


def export_bundle(fmt_slug: str, bundle, *, language: str):
    """
    Returns (content_bytes, filename, content_type).

    `language == 'all'`:
      - multi-language-capable formats (flat_json/flat_csv/unity_csv) export everything in one file.
      - single-locale formats (xliff12/gettext_po/unity_xliff/unreal_po) return a ZIP with one
        file per configured locale, laid out the way the format's real-world consumer expects:
        gettext -> locale/<code>/LC_MESSAGES/<slug>.po
        unreal_po -> <ProjectName>/<Culture>/<ProjectName>.po (Unreal's own Localization
                     Dashboard directory convention)
        everything else -> <slug>.<code>.<ext>
    """
    if fmt_slug not in FORMATS:
        raise ValueError(f'Unknown export format "{fmt_slug}".')
    module = FORMATS[fmt_slug]
    project_slug = _slugify(bundle.project_title)

    if language != 'all' or module.SUPPORTS_MULTI_LANGUAGE:
        content = module.export(bundle, language=language)
        suffix = 'all' if language == 'all' else language
        filename = f'{project_slug}_{suffix}.{module.EXTENSION}'
        return content, filename, module.CONTENT_TYPE

    # ZIP one file per locale for single-locale formats.
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, 'w', zipfile.ZIP_DEFLATED) as zf:
        for loc in bundle.locales:
            content = module.export(bundle, language=loc.code)
            if fmt_slug == 'gettext_po':
                arcname = f'locale/{loc.code}/LC_MESSAGES/{project_slug}.po'
            elif fmt_slug == 'unreal_po':
                arcname = f'{project_slug}/{loc.code}/{project_slug}.po'
            else:
                arcname = f'{project_slug}.{loc.code}.{module.EXTENSION}'
            zf.writestr(arcname, content)
    return buf.getvalue(), f'{project_slug}_all_{fmt_slug}.zip', 'application/zip'


def parse_file(fmt_slug: str, raw: bytes, *, project_locales, source_locale):
    """Returns a ParsedImport. Raises ValueError on a malformed file (caller turns this into a
    400 with the message as-is)."""
    if fmt_slug not in FORMATS:
        raise ValueError(f'Unknown import format "{fmt_slug}".')
    return FORMATS[fmt_slug].parse(raw, project_locales=project_locales, source_locale=source_locale)
