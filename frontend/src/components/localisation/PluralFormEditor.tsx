'use client';

import type { CldrCategory } from '@/types';
import { useTranslation } from '@/lib/useTranslation';

interface PluralFormEditorProps {
    /** Used only to compute example numbers via Intl.PluralRules — not sent anywhere. */
    localeCode: string;
    categories: CldrCategory[];
    value: Partial<Record<CldrCategory, string>>;
    onChange: (value: Partial<Record<CldrCategory, string>>) => void;
    disabled?: boolean;
    placeholderPrefix?: string;
}

const CATEGORY_LABEL: Record<CldrCategory, string> = {
    zero: 'Zero', one: 'One', two: 'Two', few: 'Few', many: 'Many', other: 'Other',
};

function exampleNumbersFor(localeCode: string, category: CldrCategory, limit = 3): number[] {
    try {
        const rules = new Intl.PluralRules(localeCode);
        const examples: number[] = [];
        for (let n = 0; n <= 200 && examples.length < limit; n++) {
            if (rules.select(n) === category) examples.push(n);
        }
        return examples;
    } catch {
        return [];
    }
}

/**
 * One input per CLDR plural category (zero/one/two/few/many/other), used identically by both
 * the Devs base-text editor (source-language plural forms) and a contributor's translation
 * suggestion box (target-language plural forms) — a single implementation so the two never
 * diverge. Categories/order come from the project's catalogue (server-resolved from
 * api.locale_registry), never a frontend-hardcoded list.
 */
export default function PluralFormEditor({
    localeCode, categories, value, onChange, disabled = false, placeholderPrefix,
}: PluralFormEditorProps) {
    const { t } = useTranslation();
    const handleChange = (category: CldrCategory, text: string) => {
        onChange({ ...value, [category]: text });
    };

    return (
        <div className="space-y-2">
            {categories.map((category) => {
                const examples = exampleNumbersFor(localeCode, category);
                return (
                    <div key={category}>
                        <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">
                            {CATEGORY_LABEL[category]}
                            {examples.length > 0 && (
                                <span className="normal-case font-normal text-zinc-600 ml-1">{[t('exampleAbbrevPrefix'), examples.join(', ')].join(' ')}</span>
                            )}
                        </label>
                        <input
                            value={value[category] ?? ''}
                            onChange={(e) => handleChange(category, e.target.value)}
                            disabled={disabled}
                            placeholder={placeholderPrefix ? `${placeholderPrefix} (${CATEGORY_LABEL[category].toLowerCase()})...` : undefined}
                            className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-blue-500 transition-all disabled:opacity-50"
                        />
                    </div>
                );
            })}
        </div>
    );
}
