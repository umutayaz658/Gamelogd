"""
Minimal gettext .po lexer/writer — syntax only, no semantics. `gettext_po.py` builds real
structural plurals on top of this; round 2b's Unreal PO converter will reuse this exact module
with different semantics (Unreal embeds plurals as one opaque string instead of msgid_plural/
msgstr[N], but the underlying msgid/msgstr/msgctxt/comment syntax is identical gettext).

No third-party dependency (no `polib`) — this is ~150 lines because the format itself is simple;
adding a dependency for it would cost more than it saves.
"""

import re

_FIELD_RE = re.compile(r'^(msgctxt|msgid_plural|msgid|msgstr(?:\[\d+\])?)\s+"(.*)"\s*$')
_CONT_RE = re.compile(r'^"(.*)"\s*$')
_MSGSTR_INDEX_RE = re.compile(r'^msgstr\[(\d+)\]$')


def escape(s: str) -> str:
    return s.replace('\\', '\\\\').replace('"', '\\"').replace('\n', '\\n').replace('\t', '\\t')


def unescape(s: str) -> str:
    out = []
    i = 0
    while i < len(s):
        c = s[i]
        if c == '\\' and i + 1 < len(s):
            nxt = s[i + 1]
            if nxt == 'n':
                out.append('\n'); i += 2; continue
            if nxt == 't':
                out.append('\t'); i += 2; continue
            if nxt == '"':
                out.append('"'); i += 2; continue
            if nxt == '\\':
                out.append('\\'); i += 2; continue
        out.append(c)
        i += 1
    return ''.join(out)


def _field(keyword: str, value: str) -> str:
    return f'{keyword} "{escape(value)}"'


class PoEntry:
    def __init__(self, msgctxt=None, msgid='', msgid_plural=None, msgstr=None, msgstr_plural=None, comments=None):
        self.msgctxt = msgctxt
        self.msgid = msgid
        self.msgid_plural = msgid_plural
        self.msgstr = msgstr
        self.msgstr_plural = msgstr_plural  # list[str], index-ordered, or None for non-plural
        self.comments = comments or []       # raw '#. ...'/'#: ...' lines, kept verbatim


def write_po(header_fields: dict, entries: list) -> bytes:
    # The header entry's own msgstr is a quoted-string-per-field-line gettext convention.
    lines = ['msgid ""', 'msgstr ""'] + [f'"{k}: {v}\\n"' for k, v in header_fields.items()] + ['']
    for entry in entries:
        for c in entry.comments:
            lines.append(c)
        if entry.msgctxt is not None:
            lines.append(_field('msgctxt', entry.msgctxt))
        lines.append(_field('msgid', entry.msgid))
        if entry.msgid_plural is not None:
            lines.append(_field('msgid_plural', entry.msgid_plural))
            for i, form in enumerate(entry.msgstr_plural or []):
                lines.append(_field(f'msgstr[{i}]', form))
        else:
            lines.append(_field('msgstr', entry.msgstr or ''))
        lines.append('')
    return ('\n'.join(lines) + '\n').encode('utf-8')


def parse_po(raw: bytes):
    """Returns (header_fields: dict, entries: list[PoEntry])."""
    try:
        text = raw.decode('utf-8')
    except UnicodeDecodeError as exc:
        # Same contract as the other parsers: a user uploading e.g. a latin-1 .po must get the
        # view's clean 400 (ValueError), not a 500.
        raise ValueError('File is not valid UTF-8 — re-save the .po file with UTF-8 encoding.') from exc
    lines = text.replace('\r\n', '\n').split('\n')

    entries_raw = []
    current = {'comments': [], 'fields': {}}
    last_field = None

    def flush():
        nonlocal current, last_field
        if current['fields'] or current['comments']:
            entries_raw.append(current)
        current = {'comments': [], 'fields': {}}
        last_field = None

    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            flush()
            continue
        if line.startswith('#'):
            current['comments'].append(line)
            continue
        m = _FIELD_RE.match(line)
        if m:
            field, value = m.group(1), unescape(m.group(2))
            idx_m = _MSGSTR_INDEX_RE.match(field)
            if idx_m:
                current['fields'].setdefault('msgstr_plural', {})[int(idx_m.group(1))] = value
                last_field = ('msgstr_plural', int(idx_m.group(1)))
            else:
                current['fields'][field] = value
                last_field = (field, None)
            continue
        m = _CONT_RE.match(line)
        if m and last_field:
            value = unescape(m.group(1))
            field, idx = last_field
            if field == 'msgstr_plural':
                current['fields']['msgstr_plural'][idx] += value
            else:
                current['fields'][field] += value
            continue
        # Anything else (stray text) is ignored rather than raising — real-world PO files
        # occasionally carry lines a strict parser would choke on unnecessarily.
    flush()

    if not entries_raw:
        return {}, []

    header_entry = entries_raw[0]
    header_fields = {}
    for line in header_entry['fields'].get('msgstr', '').split('\n'):
        if ':' in line:
            k, _, v = line.partition(':')
            header_fields[k.strip()] = v.strip()

    entries = []
    for raw_entry in entries_raw[1:]:
        f = raw_entry['fields']
        plural_dict = f.get('msgstr_plural')
        msgstr_plural = [plural_dict[i] for i in sorted(plural_dict.keys())] if plural_dict else None
        entries.append(PoEntry(
            msgctxt=f.get('msgctxt'),
            msgid=f.get('msgid', ''),
            msgid_plural=f.get('msgid_plural'),
            msgstr=f.get('msgstr'),
            msgstr_plural=msgstr_plural,
            comments=raw_entry['comments'],
        ))
    return header_fields, entries
