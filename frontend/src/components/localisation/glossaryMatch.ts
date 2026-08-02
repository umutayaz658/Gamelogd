/**
 * Shared glossary-locking logic used by both the Devs Localisation Manager and the public
 * project page's Localisation tab (previously Devs-only, hence "shared" — see
 * TranslationKeyCard.tsx). Matching is whole-word and Unicode-aware rather than a plain
 * substring check, so a short term (e.g. "HP") doesn't falsely lock onto an unrelated word that
 * merely contains it (e.g. "PHP"). This is advisory only — nothing here ever blocks a
 * submission, it only computes what to warn about.
 */

export interface GlossaryLockMatch {
    term: string;
    locked: string;
}

interface GlossaryTermLike {
    term: string;
    translations: Record<string, string>;
}

function escapeRegExp(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Compiled-pattern cache: this runs per key-card × per glossary term on every list render
// (and every search keystroke), so recompiling the RegExp each call multiplies into tens of
// thousands of compilations on a realistic catalogue. Keyed by the term text; bounded so a
// pathological glossary can't grow it forever.
const patternCache = new Map<string, RegExp>();
const PATTERN_CACHE_MAX = 2000;

function wholeWordPattern(term: string): RegExp {
    let pattern = patternCache.get(term);
    if (!pattern) {
        pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(term)}(?![\\p{L}\\p{N}])`, 'iu');
        if (patternCache.size >= PATTERN_CACHE_MAX) patternCache.clear();
        patternCache.set(term, pattern);
    }
    return pattern;
}

export function containsWholeWord(haystack: string, needle: string): boolean {
    const trimmed = needle.trim();
    if (!trimmed || !haystack) return false;
    return wholeWordPattern(trimmed).test(haystack);
}

/** Every glossary term whose source form appears (as a whole word) in `baseText`, paired with
 * its locked translation for `language`. Terms with no translation recorded for `language` are
 * skipped — there is nothing to lock/warn about yet. */
export function matchGlossaryLocks(
    baseText: string,
    glossary: GlossaryTermLike[],
    language: string,
): GlossaryLockMatch[] {
    if (!baseText || !language) return [];
    const matches: GlossaryLockMatch[] = [];
    for (const term of glossary) {
        const locked = term.translations[language];
        if (!locked) continue;
        if (containsWholeWord(baseText, term.term)) matches.push({ term: term.term, locked });
    }
    return matches;
}
