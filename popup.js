'use strict';

const KEYS = {
    screenshotAction: 'screenshotAction',
    screenshotFormat: 'screenshotFormat',
    screenshotQuality: 'screenshotQuality',
    enableWatermark: 'enableWatermark',
    watermarkStyle: 'watermarkStyle',
    watermarkPosition: 'watermarkPosition',
    uiLanguage: 'uiLanguage'
};

const DEFAULTS = {
    screenshotAction: 'both',
    screenshotFormat: 'png',
    screenshotQuality: 95,
    enableWatermark: true,
    watermarkStyle: 'simple',
    watermarkPosition: 'bottom-right',
    uiLanguage: 'zh'
};

const I18N = {
    zh: {
        desc: '截图按键在播放窗口右下角',
        actionLabel: '截图操作',
        actionSave: '保存',
        actionCopy: '复制',
        actionBoth: '两者',
        actionPreview: '预览',
        formatLabel: '图片格式',
        formatPng: 'PNG (无损)',
        formatJpeg: 'JPEG (压缩)',
        formatWebp: 'WebP (现代)',
        qualityLabel: '图片质量',
        wmLabel: '水印',
        wmSimple: '时间戳',
        wmFrame: '相框式',
        langLabel: '界面语言',
        langZh: '中文',
        langEn: 'English',
        saved: '设置已保存',
        loadFailed: '加载失败'
    },
    en: {
        desc: 'Capture button is at the bottom-right of the player',
        actionLabel: 'Capture Action',
        actionSave: 'Save',
        actionCopy: 'Copy',
        actionBoth: 'Both',
        actionPreview: 'Preview',
        formatLabel: 'Image Format',
        formatPng: 'PNG (Lossless)',
        formatJpeg: 'JPEG (Compressed)',
        formatWebp: 'WebP (Modern)',
        qualityLabel: 'Image Quality',
        wmLabel: 'Watermark',
        wmSimple: 'Timestamp',
        wmFrame: 'Frame Style',
        langLabel: 'UI Language',
        langZh: '中文',
        langEn: 'English',
        saved: 'Settings saved',
        loadFailed: 'Load failed'
    }
};

const statusEl = document.getElementById('status');
const formatSelect = document.getElementById('format-select');
const qualityRow = document.getElementById('quality-row');
const qualityRange = document.getElementById('quality-range');
const qualityValue = document.getElementById('quality-value');

let currentLang = 'zh';
let saveTimer = null;

function t(key) {
    return I18N[currentLang]?.[key] || I18N.zh[key] || key;
}

function applyLanguage(lang) {
    currentLang = lang || 'zh';
    const map = {
        'i18n-desc': t('desc'),
        'i18n-action-label': t('actionLabel'),
        'i18n-action-save': t('actionSave'),
        'i18n-action-copy': t('actionCopy'),
        'i18n-action-both': t('actionBoth'),
        'i18n-action-preview': t('actionPreview'),
        'i18n-format-label': t('formatLabel'),
        'i18n-quality-label': t('qualityLabel'),
        'i18n-wm-label': t('wmLabel'),
        'i18n-wm-simple': t('wmSimple'),
        'i18n-wm-frame': t('wmFrame'),
        'i18n-lang-label': t('langLabel'),
        'i18n-lang-zh': t('langZh'),
        'i18n-lang-en': t('langEn')
    };

    Object.entries(map).forEach(([id, text]) => {
        const el = document.getElementById(id);
        if (el) el.textContent = text;
    });

    const formatOptions = document.querySelectorAll('#format-select option');
    if (formatOptions[0]) formatOptions[0].textContent = t('formatPng');
    if (formatOptions[1]) formatOptions[1].textContent = t('formatJpeg');
    if (formatOptions[2]) formatOptions[2].textContent = t('formatWebp');
}

function showSaved(text = t('saved')) {
    statusEl.textContent = text;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
        statusEl.textContent = '';
    }, 1200);
}

function getCheckedValue(name) {
    const el = document.querySelector(`input[name="${name}"]:checked`);
    return el ? el.value : null;
}

function setCheckedValue(name, value) {
    const el = document.querySelector(`input[name="${name}"][value="${value}"]`);
    if (el) el.checked = true;
}

function updateQualityVisibility() {
    qualityRow.classList.toggle('hidden', formatSelect.value === 'png');
}

async function savePartial(partial) {
    await chrome.storage.sync.set(partial);
    showSaved();
}

async function init() {
    const data = await chrome.storage.sync.get(Object.keys(DEFAULTS));
    const cfg = { ...DEFAULTS, ...data };

    setCheckedValue('action', cfg.screenshotAction);
    formatSelect.value = cfg.screenshotFormat;
    qualityRange.value = String(cfg.screenshotQuality || 95);
    qualityValue.textContent = `${qualityRange.value}%`;

    // 水印二选一：左=时间戳(simple)，右=相框(frame)
    setCheckedValue('wm-mode', cfg.watermarkStyle || 'simple');

    // 语言二选一
    setCheckedValue('ui-lang', cfg.uiLanguage || 'zh');
    applyLanguage(cfg.uiLanguage || 'zh');

    updateQualityVisibility();

    document.querySelectorAll('input[name="action"]').forEach(el => {
        el.addEventListener('change', () => savePartial({ [KEYS.screenshotAction]: el.value }));
    });

    formatSelect.addEventListener('change', async () => {
        updateQualityVisibility();
        await savePartial({ [KEYS.screenshotFormat]: formatSelect.value });
    });

    qualityRange.addEventListener('input', () => {
        qualityValue.textContent = `${qualityRange.value}%`;
    });

    qualityRange.addEventListener('change', async () => {
        await savePartial({ [KEYS.screenshotQuality]: Number(qualityRange.value) });
    });

    document.querySelectorAll('input[name="wm-mode"]').forEach(el => {
        el.addEventListener('change', async () => {
            await savePartial({
                [KEYS.enableWatermark]: true,
                [KEYS.watermarkStyle]: el.value,
                [KEYS.watermarkPosition]: 'bottom-right'
            });
        });
    });

    document.querySelectorAll('input[name="ui-lang"]').forEach(el => {
        el.addEventListener('change', async () => {
            applyLanguage(el.value);
            await savePartial({ [KEYS.uiLanguage]: el.value });
        });
    });
}

init().catch((err) => {
    statusEl.textContent = `${t('loadFailed')}: ${err.message}`;
    statusEl.style.color = '#dc2626';
});
