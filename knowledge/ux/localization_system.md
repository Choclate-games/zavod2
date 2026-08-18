# Localization System

Yandex requirement 8.2.3: every language-dependent field must actually be
translated. Untranslated strings are a routine rejection reason, and they are
always the same two causes — a missing key, or text hardcoded in JS.

## Language comes from the platform, not from a menu

```
bridge.platform.language → navigator.language → 'en'
```

Resolve it **once at boot, before the first DOM translate**, and drop the
in-game language switcher: on a portal the platform already knows the player's
language, and a switcher just adds a way to disagree with it.

Two caveats: on CrazyGames `platform.language` is a country code, so use the
browser locale there; and anything that is not a supported locale falls back to
English.

## Engine

A dictionary per locale plus a `t(key, params)` accessor. Attribute-driven
translation for static markup, `t()` for anything dynamic.

```javascript
class I18nManager {
    t(key, params) {
        const dict = translations[this.currentLang] || translations.en;
        // Touch builds must never show keyboard instructions: any key may carry a
        // `<key>_touch` sibling that wins while touch mode is on, so one t() call
        // serves both control schemes and callers stay unaware of the split.
        const touchKey = this.touchMode ? `${key}_touch` : null;
        let text = (touchKey && (dict[touchKey] || translations.en[touchKey]))
                 || dict[key] || translations.en[key] || key;

        if (params) {
            const entries = Array.isArray(params) ? params.entries() : Object.entries(params);
            for (const [k, v] of entries) text = text.replaceAll(`{${k}}`, v);
        }
        return text;
    }

    translateDOM(root = document) {
        root.querySelectorAll('[data-i18n]').forEach((el) => {
            const val = this.t(el.getAttribute('data-i18n'));
            if (el.dataset.i18nHtml === 'true') el.innerHTML = val; else el.innerText = val;
        });
        root.querySelectorAll('[data-i18n-title]').forEach((el) =>
            el.setAttribute('title', this.t(el.getAttribute('data-i18n-title'))));
        root.querySelectorAll('[data-i18n-placeholder]').forEach((el) =>
            el.setAttribute('placeholder', this.t(el.getAttribute('data-i18n-placeholder'))));
        document.documentElement.lang = this.currentLang;
    }
}
```

| Attribute | Replaces |
|---|---|
| `data-i18n` | `innerText` |
| `data-i18n-html` | `innerHTML` (use sparingly) |
| `data-i18n-title` | `title` |
| `data-i18n-placeholder` | `placeholder` |

Text written directly in the HTML serves as the fallback for the very first
paint, before the bridge answers. Put the English string there.

## Rules

1. **Add the key to every locale at once.** A key present in one locale only will
   render the fallback language on someone's screen.
2. **Never hardcode a user-visible string in JS.** Always `t('key')`.
3. **Never build sentences by concatenation** — word order differs per language.
   Use placeholders: `t('score_fmt', { score: 120 })`.
4. **Call `t()` only after the language is resolved.** Anything running before the
   bridge answers paints in the wrong language and only corrects on the next
   translate pass.
5. **Control-scheme strings need the `_touch` variant.** Mobile must never see
   "press Space". Settle touch mode *before* the first `translateDOM()`, or a
   phone paints keyboard strings once and fixes them a frame later.
6. **Proper nouns may legitimately match across locales.** Character and product
   names are not missing translations — exclude them from parity noise.

## Automated parity audit

Run this in CI or before every submission:

- both dictionaries have identical key sets (report the diff, both directions);
- placeholders inside each string match across locales (`{score}` in `en` must
  exist in `ru`);
- no empty values;
- optionally: walk every screen with the locale forced and screenshot-diff for
  overflow and clipping — 8.2.3 rejections are often *visible* strings that were
  simply never routed through `t()`.

A shipped game passed this audit with 429 keys per locale and zero divergences;
the only same-value pairs were proper nouns.

## Text overflow is part of localization

German and Russian run 20–40 % longer than English. Buttons and HUD labels sized
to fit the English string will clip — which moderation reads as requirement
1.10.1 (clipped elements), not as a translation issue. Test the longest locale.
