"""
Single source of truth for supported game-localisation locales — mirrors the
`permission_catalog.py` pattern (code-defined constant, no DB rows, no Django imports so
migrations can import this module without a circular-import risk).

Each `LocaleDef` carries everything needed to go in both directions between our canonical,
CLDR-category-keyed storage and a real interchange format:
  - `cldr_categories` is what `Intl.PluralRules(code).select(n)` on the frontend can return —
    this is what the plural-form editor UI renders one input per.
  - `gettext_nplurals`/`gettext_plural_expr`/`gettext_category_order` are ONLY needed to write a
    valid gettext `.po` file header (`Plural-Forms: nplurals=N; plural=<expr>;`) and to order
    `msgstr[0..N-1]` — gettext has no notion of category names, only a numeric index a C
    expression resolves to for a given `n`. These three fields together are the hand-maintained
    encoding of the same CLDR plural rule `cldr_categories`/`Intl.PluralRules` expresses natively.

Two known real-world subtleties, resolved deliberately rather than by accident (see each note):
  - Turkish: some older gettext plural tables list `(n > 1)` (treating 0 as plural). CLDR defines
    only `one` (n = 1) and `other` for `tr`, which corresponds to `(n != 1)` — and
    `Intl.PluralRules('tr').select(0) === 'other'`. We follow CLDR so the PO export agrees with
    what the editor UI (which is CLDR-driven) already shows for n = 0.
  - Portuguese: CLDR genuinely differs between the Brazilian-flavoured `pt`/`pt-BR` (`one: i=0,1`
    → `(n > 1)`) and European `pt-PT` (`one: n=1` → `(n != 1)`). We ship both as distinct locales
    rather than picking one "Portuguese" — the historical round-1 hardcoded 'Portuguese' entry
    migrates to `pt-BR`, the far more common game-localisation target.

`es`/`fr`/`it`/`pt-BR`'s CLDR `many` category (compact-decimal, e.g. "1 M") is deliberately
omitted from `cldr_categories` below — no interchange format we support carries it, and no
existing UI can trigger it (we never show compact-notation numbers), so listing it would just
show a translator a form nothing can ever read from or write to.

The same rule prunes `ru`/`uk`/`pl`'s CLDR `other` (fractional n, e.g. "1.5 items" — game
strings use integers) and `he`'s `two`/`many` (dual/decade forms modern Hebrew style guides
map onto the plural anyway, and gettext's 2-form Hebrew table cannot carry): every category
listed below is exportable in every supported format, so a translator's typed form is never
silently dropped on export.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class LocaleDef:
    code: str                        # canonical id stored in CommunityTranslation.language
    name: str                        # English display name
    native_name: str                 # for the language-picker UI
    cldr_categories: tuple           # what Intl.PluralRules(code).select() can return
    gettext_nplurals: int
    gettext_plural_expr: str         # C expression, verbatim into the PO header
    gettext_category_order: tuple    # index i == the CLDR category `expr` yields i for


_RAW_LOCALES = [
    # code,     name,                    native_name,             cldr_categories,                              nplurals, plural_expr,                                                                                  gettext_category_order
    ('en',      'English',               'English',               ('one', 'other'),                             2, '(n != 1)', ('one', 'other')),
    ('tr',      'Turkish',               'Türkçe',                ('one', 'other'),                             2, '(n != 1)', ('one', 'other')),
    ('es',      'Spanish',               'Español',               ('one', 'other'),                             2, '(n != 1)', ('one', 'other')),
    ('fr',      'French',                'Français',              ('one', 'other'),                             2, '(n > 1)', ('one', 'other')),
    ('de',      'German',                'Deutsch',               ('one', 'other'),                             2, '(n != 1)', ('one', 'other')),
    ('it',      'Italian',               'Italiano',              ('one', 'other'),                             2, '(n != 1)', ('one', 'other')),
    ('nl',      'Dutch',                 'Nederlands',            ('one', 'other'),                             2, '(n != 1)', ('one', 'other')),
    ('pt-BR',   'Portuguese (Brazil)',   'Português (Brasil)',    ('one', 'other'),                             2, '(n > 1)', ('one', 'other')),
    ('pt-PT',   'Portuguese (Portugal)', 'Português (Portugal)',  ('one', 'other'),                             2, '(n != 1)', ('one', 'other')),
    ('ja',      'Japanese',              '日本語',                 ('other',),                                    1, '0', ('other',)),
    ('ko',      'Korean',                '한국어',                  ('other',),                                    1, '0', ('other',)),
    ('zh-Hans', 'Chinese (Simplified)',  '简体中文',                ('other',),                                    1, '0', ('other',)),
    ('zh-Hant', 'Chinese (Traditional)', '繁體中文',                ('other',),                                    1, '0', ('other',)),
    ('vi',      'Vietnamese',            'Tiếng Việt',            ('other',),                                    1, '0', ('other',)),
    ('th',      'Thai',                  'ไทย',                    ('other',),                                    1, '0', ('other',)),
    ('id',      'Indonesian',            'Bahasa Indonesia',      ('other',),                                    1, '0', ('other',)),
    ('ru',      'Russian',               'Русский',               ('one', 'few', 'many'),
     3, '(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2)', ('one', 'few', 'many')),
    ('uk',      'Ukrainian',             'Українська',            ('one', 'few', 'many'),
     3, '(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2)', ('one', 'few', 'many')),
    ('pl',      'Polish',                'Polski',                ('one', 'few', 'many'),
     3, '(n==1 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2)', ('one', 'few', 'many')),
    ('cs',      'Czech',                 'Čeština',               ('one', 'few', 'other'),
     3, '(n==1) ? 0 : (n>=2 && n<=4) ? 1 : 2', ('one', 'few', 'other')),
    ('sk',      'Slovak',                'Slovenčina',            ('one', 'few', 'other'),
     3, '(n==1) ? 0 : (n>=2 && n<=4) ? 1 : 2', ('one', 'few', 'other')),
    ('ro',      'Romanian',              'Română',                ('one', 'few', 'other'),
     3, '(n==1 ? 0 : (n==0 || (n%100 > 0 && n%100 < 20)) ? 1 : 2)', ('one', 'few', 'other')),
    ('hu',      'Hungarian',             'Magyar',                ('one', 'other'),                             2, '(n != 1)', ('one', 'other')),
    ('sv',      'Swedish',               'Svenska',               ('one', 'other'),                             2, '(n != 1)', ('one', 'other')),
    ('da',      'Danish',                'Dansk',                 ('one', 'other'),                             2, '(n != 1)', ('one', 'other')),
    ('no',      'Norwegian',             'Norsk',                 ('one', 'other'),                             2, '(n != 1)', ('one', 'other')),
    ('fi',      'Finnish',               'Suomi',                 ('one', 'other'),                             2, '(n != 1)', ('one', 'other')),
    ('el',      'Greek',                 'Ελληνικά',              ('one', 'other'),                             2, '(n != 1)', ('one', 'other')),
    ('he',      'Hebrew',                'עברית',                 ('one', 'other'),
     2, '(n != 1)', ('one', 'other')),
    ('ar',      'Arabic',                'العربية',                ('zero', 'one', 'two', 'few', 'many', 'other'),
     6, '(n==0 ? 0 : n==1 ? 1 : n==2 ? 2 : n%100>=3 && n%100<=10 ? 3 : n%100>=11 ? 4 : 5)',
     ('zero', 'one', 'two', 'few', 'many', 'other')),
    ('hi',      'Hindi',                 'हिन्दी',                  ('one', 'other'),                             2, '(n != 1)', ('one', 'other')),
    ('bn',      'Bengali',               'বাংলা',                  ('one', 'other'),                             2, '(n != 1)', ('one', 'other')),
    ('fil',     'Filipino',              'Filipino',              ('one', 'other'),                             2, '(n != 1)', ('one', 'other')),
    ('ms',      'Malay',                 'Bahasa Melayu',         ('other',),                                    1, '0', ('other',)),
    ('bg',      'Bulgarian',             'Български',             ('one', 'other'),                             2, '(n != 1)', ('one', 'other')),
    ('hr',      'Croatian',              'Hrvatski',              ('one', 'few', 'other'),
     3, '(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2)', ('one', 'few', 'other')),
    ('sr',      'Serbian',               'Српски',                ('one', 'few', 'other'),
     3, '(n%10==1 && n%100!=11 ? 0 : n%10>=2 && n%10<=4 && (n%100<10 || n%100>=20) ? 1 : 2)', ('one', 'few', 'other')),
    ('lt',      'Lithuanian',            'Lietuvių',              ('one', 'few', 'other'),
     3, '(n%10==1 && n%100!=11 ? 0 : n%10>=2 && (n%100<10 || n%100>=20) ? 1 : 2)', ('one', 'few', 'other')),
    ('lv',      'Latvian',               'Latviešu',              ('zero', 'one', 'other'),
     3, '(n%10==0 ? 0 : n%10==1 && n%100!=11 ? 1 : 2)', ('zero', 'one', 'other')),
]

LOCALES = {
    code: LocaleDef(
        code=code, name=name, native_name=native_name,
        cldr_categories=cldr_categories,
        gettext_nplurals=nplurals, gettext_plural_expr=plural_expr,
        gettext_category_order=gettext_category_order,
    )
    for code, name, native_name, cldr_categories, nplurals, plural_expr, gettext_category_order in _RAW_LOCALES
}

DEFAULT_SOURCE_LOCALE_CODE = 'en'

# Round-1 parity default — a project that has never opened the language settings modal behaves
# exactly as it did before this round shipped (same 6 target languages), just addressed by code.
DEFAULT_PROJECT_LOCALE_CODES = ['tr', 'es', 'fr', 'de', 'ja', 'pt-BR']

# Round-1's CommunityTranslation.language stored these English display-name strings as the value
# directly. Used by the 0066 data migration to rewrite existing rows/blob data to codes, and by
# tests to confirm the mapping is total and injective.
LEGACY_NAME_TO_CODE = {
    'English': 'en',
    'Turkish': 'tr',
    'Spanish': 'es',
    'French': 'fr',
    'German': 'de',
    'Japanese': 'ja',
    'Portuguese': 'pt-BR',
}


def get(code):
    """Returns the LocaleDef for `code`, or None if unknown."""
    return LOCALES.get(code)


def to_public_dict(loc: LocaleDef) -> dict:
    """Public-facing projection — deliberately omits gettext internals (nplurals/expression),
    which are a `.po`-export-only concern; the frontend only ever needs CLDR categories."""
    return {
        'code': loc.code,
        'name': loc.name,
        'native_name': loc.native_name,
        'plural_categories': list(loc.cldr_categories),
    }


def resolve_project_locales(blob: dict):
    """Returns list[LocaleDef] for a project's configured target languages, falling back to
    DEFAULT_PROJECT_LOCALE_CODES when the project has never configured `translationLanguages`
    (or configured an empty list) — no project silently loses languages."""
    configured = (blob or {}).get('translationLanguages') or []
    codes = [entry.get('code') for entry in configured if entry.get('code') in LOCALES]
    if not codes:
        codes = DEFAULT_PROJECT_LOCALE_CODES
    return [LOCALES[code] for code in codes if code in LOCALES]


def resolve_source_locale(blob: dict) -> LocaleDef:
    """Returns the LocaleDef for a project's configured source language, falling back to English."""
    configured = (blob or {}).get('translationSourceLanguage') or {}
    code = configured.get('code')
    if code and code in LOCALES:
        return LOCALES[code]
    return LOCALES[DEFAULT_SOURCE_LOCALE_CODE]
