const supportedLanguages = require("../constants/supportedLanguages");
const { translateWithCache } = require("../utils/translationCacheUtil");

const normalizeLanguage = (lang) => {
    if (!lang) return lang;
    const lower = String(lang).toLowerCase();
    if (lower.startsWith("de")) return "de";
    return lang;
};

/**
 * Translates text values in an object to the target language
 * @param {Object} data - The data object containing text to translate
 * @param {string} targetLang - Target language code (e.g., 'DE' for German)
 * @param {string[]} [translationFields] - Array of field names that should be translated. If not provided, all string fields will be translated.
 * @returns {Promise<Object>} - Translated data object
 */
const translateObjectValues = async (data, targetLang = 'de', translationFields = []) => {
    const target = normalizeLanguage(targetLang);
    if (!target || !supportedLanguages.includes(target)) {
        return data;
    }

    try {
        const textsToTranslate = [];
        const map = [];

        const collectStrings = (obj, translationFields = [], path = '', isNested = false) => {
            if (typeof obj === 'string') {
                if (!isNested && path) {  // Only process top-level strings if they are in translationFields
                    const key = path.split('.').pop();
                    if (translationFields.includes(key)) {
                        const trimmed = obj.trim();
                        if (trimmed) {
                            textsToTranslate.push(trimmed);
                            map.push({ path, isLeaf: true });
                        }
                    }
                }
            } else if (Array.isArray(obj)) {
                obj.forEach((item, index) => {
                    collectStrings(item, translationFields, path ? `${path}[${index}]` : `[${index}]`, true);
                });
            } else if (typeof obj === 'object' && obj !== null) {
                Object.entries(obj).forEach(([key, value]) => {
                    const newPath = path ? `${path}.${key}` : key;
                    const isTranslationField = translationFields.includes(key);
                    const isNestedLevel = isNested || (path !== '');

                    if (typeof value === 'string') {
                        if (isTranslationField || (!isNestedLevel && !translationFields.length)) {
                            const trimmed = value.trim();
                            if (trimmed) {
                                textsToTranslate.push(trimmed);
                                map.push({ path: newPath, isLeaf: true });
                            }
                        }
                    } else if (Array.isArray(value) || (value && typeof value === 'object')) {
                        // Only pass translationFields if we're at a top-level field that's in translationFields
                        const nestedFields = isTranslationField ? [] : translationFields;
                        collectStrings(value, nestedFields, newPath, true);
                    }
                });
            }
        };
        collectStrings(data, translationFields);
        if (textsToTranslate.length === 0) {
            return data;
        }
        const results = await translateWithCache(textsToTranslate, target);
        const setNestedValue = (obj, path, value) => {
            if (!path) return;
            if (Object.prototype.hasOwnProperty.call(obj, path)) {
                obj[path] = value;
                return;
            }
            const keys = path.replace(/\[(\w+)\]/g, '.$1').replace(/^\./, '').split('.');
            let current = obj;
            
            for (let i = 0; i < keys.length - 1; i++) {
                const key = keys[i];
                if (current[key] === undefined || current[key] === null) {
                    const nextKey = keys[i + 1];
                    const nextIsArrayIndex = /^\d+$/.test(nextKey);
                    current[key] = nextIsArrayIndex ? [] : {};
                }
                current = current[key];
            }

            const lastKey = keys[keys.length - 1];
            if (current !== undefined && current !== null) {
                current[lastKey] = value;
            }
        };
        results.forEach((translation, index) => {
            const { path } = map[index];
            if (path) {
                setNestedValue(data, path, translation.text);
            }
        });
        return data;
    } catch (error) {
        console.error('Translation error:', error);
        return data;
    }
};

module.exports = {
    translateObjectValues
};