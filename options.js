'use strict';

// ===== DOM 元素 =====
const elements = {
    actionRadios: document.querySelectorAll('input[name="action"]'),
    formatSelect: document.getElementById('format-select'),
    qualityRange: document.getElementById('quality-range'),
    qualityValue: document.getElementById('quality-value'),
    qualitySetting: document.getElementById('quality-setting'),
    watermarkToggle: document.getElementById('watermark-toggle'),
    styleRadios: document.querySelectorAll('input[name="watermark-style"]'),
    styleSetting: document.getElementById('style-setting'),
    positionSelect: document.getElementById('position-select'),
    positionSetting: document.getElementById('position-setting'),
};

// ===== 状态管理 =====
const state = {
    screenshotFormat: 'png',
    screenshotQuality: 95,
    screenshotAction: 'both',
    enableWatermark: false,
    watermarkPosition: 'bottom-right',
    watermarkStyle: 'simple',
};

// ===== 初始化 =====
function init() {
    loadSettings();
    bindEvents();
}

// ===== 加载设置 =====
function loadSettings() {
    chrome.storage.sync.get([
        'screenshotFormat',
        'screenshotQuality',
        'screenshotAction',
        'enableWatermark',
        'watermarkPosition',
        'watermarkStyle',
    ], (result) => {
        Object.assign(state, result);
        updateUIFromState();
    });
}

// ===== 更新 UI =====
function updateUIFromState() {
    // 截图操作
    const actionRadio = document.querySelector(`input[name="action"][value="${state.screenshotAction}"]`);
    if (actionRadio) actionRadio.checked = true;
    
    // 图片格式
    elements.formatSelect.value = state.screenshotFormat;
    
    // 质量设置
    elements.qualityRange.value = state.screenshotQuality;
    elements.qualityValue.textContent = state.screenshotQuality + '%';
    updateQualityVisibility();
    
    // 水印
    updateToggle(elements.watermarkToggle, state.enableWatermark);
    
    // 水印样式
    const styleRadio = document.querySelector(`input[name="watermark-style"][value="${state.watermarkStyle}"]`);
    if (styleRadio) styleRadio.checked = true;
    
    // 水印位置
    elements.positionSelect.value = state.watermarkPosition;
    
    // 更新依赖状态
    updateWatermarkDependencies();
}

// ===== 更新质量滑块可见性 =====
function updateQualityVisibility() {
    const showQuality = state.screenshotFormat !== 'png';
    elements.qualitySetting.classList.toggle('hidden', !showQuality);
}

// ===== 更新水印相关控件状态 =====
function updateWatermarkDependencies() {
    const enabled = state.enableWatermark;
    elements.styleSetting.classList.toggle('disabled', !enabled);
    elements.positionSetting.classList.toggle('disabled', !(enabled && state.watermarkStyle === 'simple'));
}

// ===== 更新开关 UI =====
function updateToggle(toggle, active) {
    toggle.classList.toggle('active', active);
}

// ===== 保存设置 =====
function saveSettings() {
    chrome.storage.sync.set(state);
}

// ===== 绑定事件 =====
function bindEvents() {
    // 截图操作
    elements.actionRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            state.screenshotAction = radio.value;
            saveSettings();
        });
    });
    
    // 图片格式
    elements.formatSelect.addEventListener('change', () => {
        state.screenshotFormat = elements.formatSelect.value;
        updateQualityVisibility();
        saveSettings();
    });
    
    // 图片质量
    elements.qualityRange.addEventListener('input', () => {
        state.screenshotQuality = parseInt(elements.qualityRange.value);
        elements.qualityValue.textContent = state.screenshotQuality + '%';
    });
    elements.qualityRange.addEventListener('change', saveSettings);
    
    // 水印开关
    elements.watermarkToggle.addEventListener('click', () => {
        state.enableWatermark = !state.enableWatermark;
        updateToggle(elements.watermarkToggle, state.enableWatermark);
        updateWatermarkDependencies();
        saveSettings();
    });
    
    // 水印样式
    elements.styleRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            state.watermarkStyle = radio.value;
            updateWatermarkDependencies();
            saveSettings();
        });
    });
    
    // 水印位置
    elements.positionSelect.addEventListener('change', () => {
        state.watermarkPosition = elements.positionSelect.value;
        saveSettings();
    });
}

// 启动
init();
