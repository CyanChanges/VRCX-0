import { languageMappings } from '@/shared/constants/language';

export function resolveUserLanguages(user: any) {
    if (Array.isArray(user?.$languages) && user.$languages.length) {
        return user.$languages;
    }

    const tags = Array.isArray(user?.tags) ? user.tags : [];
    return tags
        .filter((tag: any) => typeof tag === 'string' && tag.startsWith('language_'))
        .map((tag: any) => {
            const key = tag.slice('language_'.length);
            return {
                key,
                value: languageMappings[key] || key
            };
        })
        .filter((entry: any) => entry.key);
}

export function languageFlagLabel(languageKey: any) {
    const countryCode =
        languageMappings[String(languageKey || '').toLowerCase()];
    if (!countryCode || !/^[a-z]{2}$/i.test(countryCode)) {
        return (
            String(languageKey || '?')
                .slice(0, 3)
                .toUpperCase() || '?'
        );
    }

    return String.fromCodePoint(
        ...countryCode
            .toUpperCase()
            .split('')
            .map((letter: any) => 0x1f1e6 + letter.charCodeAt(0) - 65)
    );
}
