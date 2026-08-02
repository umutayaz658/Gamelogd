"""
Canonical intermediate representation every format converter reads from / writes to. No
converter ever touches the ORM or the WorkspaceState blob directly — build_bundle() does that
once, and apply_import() is the only thing that writes back.
"""

from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class TranslationValue:
    text: str
    plural_forms: Optional[dict] = None
    status: str = 'approved'
    author: Optional[str] = None
    updated_at: Optional[datetime] = None


@dataclass
class BundleEntry:
    key: str
    namespace: str
    base_text: str
    is_plural: bool = False
    base_plural: Optional[dict] = None
    translations: dict = field(default_factory=dict)  # locale code -> TranslationValue


@dataclass
class TranslationBundle:
    project_id: int
    project_title: str
    source: object          # LocaleDef
    locales: list           # list[LocaleDef]
    entries: list           # list[BundleEntry]


@dataclass
class ParsedEntry:
    """One row read out of an uploaded file, before it's matched/applied against a project."""
    key: str
    base_text: str = ''
    namespace: str = ''
    is_plural: bool = False
    base_plural: Optional[dict] = None
    # locale code -> {'text': str} or {'plural_forms': dict}
    translations: dict = field(default_factory=dict)


@dataclass
class ParsedImport:
    entries: list           # list[ParsedEntry]
    warnings: list = field(default_factory=list)


@dataclass
class ImportResult:
    mode: str
    format: str
    language: str
    keys_added: int = 0
    keys_updated: int = 0
    translations_created: int = 0
    translations_updated: int = 0
    skipped: int = 0
    warnings: list = field(default_factory=list)
    sample: list = field(default_factory=list)

    def to_dict(self):
        return {
            'mode': self.mode,
            'format': self.format,
            'language': self.language,
            'keys_added': self.keys_added,
            'keys_updated': self.keys_updated,
            'translations_created': self.translations_created,
            'translations_updated': self.translations_updated,
            'skipped': self.skipped,
            'warnings': self.warnings,
            'sample': self.sample,
        }


def build_bundle(project, locales, statuses=('approved',)):
    """
    Builds a TranslationBundle for `project` scoped to `locales` (list[LocaleDef]) and `statuses`
    (default: approved-only, i.e. the publicly-exportable set). Exactly 2 queries regardless of
    key count: one WorkspaceState blob read (via the existing read-only helper, never mutates),
    one CommunityTranslation fetch.
    """
    from api.locale_registry import resolve_source_locale
    from api.views import _project_workspace_state_readonly
    from core.models import CommunityTranslation

    state = _project_workspace_state_readonly(project)
    blob = (state.data or {}) if state else {}
    key_entries = blob.get('translationKeys') or []
    source = resolve_source_locale(blob)

    locale_codes = [loc.code for loc in locales]
    rows = CommunityTranslation.objects.filter(
        project=project, language__in=locale_codes, status__in=list(statuses),
    ).select_related('author')

    by_key_lang = {(row.key, row.language): row for row in rows}

    entries = []
    for e in key_entries:
        key = e.get('key')
        translations = {}
        for loc in locales:
            row = by_key_lang.get((key, loc.code))
            if row is not None:
                translations[loc.code] = TranslationValue(
                    text=row.text,
                    plural_forms=row.plural_forms,
                    status=row.status,
                    author=row.author.username if row.author else None,
                    updated_at=row.updated_at,
                )
        entries.append(BundleEntry(
            key=key,
            namespace=e.get('namespace', ''),
            base_text=e.get('baseText', ''),
            is_plural=bool(e.get('isPlural')),
            base_plural=e.get('basePlural') or None,
            translations=translations,
        ))

    return TranslationBundle(
        project_id=project.id, project_title=project.title,
        source=source, locales=locales, entries=entries,
    )


def _validate_import_value(key, catalog_entry, value, locale):
    """
    Enforces the same payload-shape rules as CommunityTranslationSerializer._validate_payload_shape
    on a value read from an uploaded file. An import that bypassed these could write plural forms
    onto a flat key (a state the editor UI can't render) or unbounded text onto a TextField.
    Returns (field_values or None, warning or None); an invalid value is skipped with a warning
    rather than failing the whole import.
    """
    is_plural = bool(catalog_entry.get('isPlural'))

    if 'plural_forms' in value:
        if not is_plural:
            return None, f'Skipped "{key}": file contains plural forms but the key is not pluralisable.'
        if locale is None:
            return None, f'Skipped "{key}": unknown language.'
        forms = value.get('plural_forms')
        if not isinstance(forms, dict):
            return None, f'Skipped "{key}": malformed plural forms.'
        cleaned = {k: str(v).strip() for k, v in forms.items() if str(v or '').strip()}
        unknown = set(cleaned.keys()) - set(locale.cldr_categories)
        if unknown:
            return None, f'Skipped "{key}": unknown plural categories {", ".join(sorted(unknown))}.'
        if not cleaned:
            return None, None
        if any(len(v) > 2000 for v in cleaned.values()) or sum(len(v) for v in cleaned.values()) > 12000:
            return None, f'Skipped "{key}": translation exceeds the length limit.'
        text = cleaned.get(locale.gettext_category_order[-1]) or next(iter(cleaned.values()))
        return {'plural_forms': cleaned, 'text': text}, None

    if is_plural:
        return None, f'Skipped "{key}": the key is pluralisable but the file only has a flat value.'
    text = str(value.get('text') or '').strip()
    if not text:
        return None, None
    if len(text) > 2000:
        return None, f'Skipped "{key}": translation exceeds the length limit.'
    return {'text': text, 'plural_forms': None}, None


def apply_import(project, parsed, *, language, user, import_keys, import_translations, base_version=None):
    """
    Applies a ParsedImport to `project`, either previewing (returned as an ImportResult with
    nothing written) or committing. Two write paths, matching how the data is actually stored:
      - Keys (key/namespace/base_text/plural metadata) merge into the WorkspaceState blob via
        the existing version-protected upsert helpers — identical concurrency semantics to every
        other Devs write.
      - Translation values become CommunityTranslation rows, updated in place when the author
        already has a non-rejected row for (project, key, language) — rejected rows are excluded
        because uniq_ct_author_per_key_lang doesn't constrain them, so several can exist and a
        plain update_or_create would raise MultipleObjectsReturned — and are immediately approved
        via _approve_community_translation, since a bulk import is a moderation action, not a
        suggestion (the caller must already have verified 'community_translation.approve' before
        import_translations=True is honoured).
    The whole commit runs in one transaction: a mid-import failure must not leave the key
    catalogue mutated with only a prefix of the translations applied.
    Returns (ImportResult, conflict: bool). `conflict=True` means a stale base_version was
    supplied and NOTHING was written — the caller should surface this as a 409.
    """
    from django.db import transaction

    from api.locale_registry import get as get_locale
    from api.views import (
        _approve_community_translation, _project_board_key_and_identity,
        _project_workspace_state, _versioned_workspace_upsert,
    )
    from core.models import CommunityTranslation

    result = ImportResult(mode='commit', format='', language=language)
    locale = get_locale(language) if language else None

    with transaction.atomic():
        state = _project_workspace_state(project)
        if base_version is not None and base_version != state.version:
            return result, True

        data = dict(state.data or {})
        existing_entries = list(data.get('translationKeys') or [])
        by_key = {e.get('key'): e for e in existing_entries}

        if import_keys:
            for parsed_entry in parsed.entries:
                current = by_key.get(parsed_entry.key)
                if current is None:
                    new_entry = {
                        'id': f'lk-import-{parsed_entry.key}',
                        'key': parsed_entry.key,
                        'namespace': parsed_entry.namespace or (parsed_entry.key.split('.')[0] if '.' in parsed_entry.key else 'other'),
                        'baseText': parsed_entry.base_text,
                    }
                    if parsed_entry.is_plural and parsed_entry.base_plural:
                        new_entry['isPlural'] = True
                        new_entry['basePlural'] = parsed_entry.base_plural
                    existing_entries.append(new_entry)
                    by_key[parsed_entry.key] = new_entry
                    result.keys_added += 1
                elif parsed_entry.base_text and parsed_entry.base_text != current.get('baseText'):
                    current['baseText'] = parsed_entry.base_text
                    result.keys_updated += 1
            data['translationKeys'] = existing_entries

        if data != (state.data or {}):
            board_key, identity = _project_board_key_and_identity(project)
            _, conflict = _versioned_workspace_upsert(key=board_key, data=data, base_version=state.version, **identity)
            if conflict:
                return result, True

        if import_translations:
            for parsed_entry in parsed.entries:
                catalog_entry = by_key.get(parsed_entry.key)
                if catalog_entry is None:
                    result.warnings.append(f'Skipped translation for unknown key "{parsed_entry.key}".')
                    result.skipped += 1
                    continue
                value = parsed_entry.translations.get(language)
                if value is None:
                    continue

                field_values, warning = _validate_import_value(parsed_entry.key, catalog_entry, value, locale)
                if warning:
                    result.warnings.append(warning)
                    result.skipped += 1
                if field_values is None:
                    continue

                existing = (
                    CommunityTranslation.objects
                    .filter(project=project, key=parsed_entry.key, language=language, author=user)
                    .exclude(status='rejected')
                    .first()
                )
                if existing is not None:
                    for field, val in field_values.items():
                        setattr(existing, field, val)
                    existing.save(update_fields=list(field_values.keys()) + ['updated_at'])
                    obj = existing
                    result.translations_updated += 1
                else:
                    obj = CommunityTranslation.objects.create(
                        project=project, key=parsed_entry.key, language=language, author=user,
                        **field_values,
                    )
                    result.translations_created += 1
                _approve_community_translation(obj, user)

    return result, False
