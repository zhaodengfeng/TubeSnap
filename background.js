/**
 * TubeSnap - Background Script
 */

'use strict';

// ===== 安装事件 =====
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        // 首次安装，设置默认配置
        chrome.storage.sync.set({
            screenshotFormat: 'png',
            screenshotQuality: 95,
            screenshotAction: 'both',
            enableWatermark: false,
            watermarkPosition: 'bottom-right',
            watermarkStyle: 'simple',
        });
        
        console.log('TubeSnap 已安装');
    }
});

// ===== 处理下载请求 =====
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'download') {
        chrome.downloads.download({
            url: request.url,
            filename: request.filename,
            saveAs: false
        }, (downloadId) => {
            if (chrome.runtime.lastError) {
                console.error('下载失败:', chrome.runtime.lastError);
                sendResponse({ success: false, error: chrome.runtime.lastError.message });
            } else {
                sendResponse({ success: true, downloadId });
            }
        });
        return true; // 保持消息通道开放以进行异步响应
    }
    
    return false;
});

// ===== 快捷键命令处理 =====
chrome.commands.onCommand.addListener((command) => {
    if (command === 'take-screenshot') {
        // 获取当前活动标签页
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].url && tabs[0].url.includes('youtube.com')) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'take-screenshot' });
            }
        });
    }
});

// ===== 标签页更新监听 =====
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // 当 YouTube 页面加载完成时，可以在这里执行一些初始化逻辑
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes('youtube.com')) {
        // 可以在这里发送消息给 content script 进行初始化检查
    }
});

console.log('TubeSnap background script loaded');
