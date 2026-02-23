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

    // popup 触发截图：等待 popup 关闭后再发消息，提升 clipboard 成功率
    if (request.action === 'take-screenshot-from-popup') {
        const tabId = request.tabId;

        const sendCapture = () => new Promise((resolve) => {
            chrome.tabs.sendMessage(tabId, { action: 'take-screenshot' }, (resp) => {
                const err = chrome.runtime.lastError;
                if (err) {
                    resolve({ ok: false, error: err.message });
                    return;
                }
                resolve({ ok: true, resp });
            });
        });

        (async () => {
            await new Promise(r => setTimeout(r, 220));

            let result = await sendCapture();
            if (!result.ok && /Receiving end does not exist/i.test(result.error || '')) {
                // content script 可能尚未注入（例如刚更新扩展后未刷新页面）
                try {
                    await chrome.scripting.insertCSS({ target: { tabId }, files: ['content.css'] });
                } catch (_) {}
                try {
                    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
                } catch (e) {
                    sendResponse({ success: false, error: e?.message || result.error || 'Injection failed' });
                    return;
                }

                await new Promise(r => setTimeout(r, 80));
                result = await sendCapture();
            }

            if (!result.ok) {
                sendResponse({ success: false, error: result.error || 'Unknown error' });
                return;
            }
            sendResponse({ success: true });
        })();

        return true;
    }
    
    return false;
});

console.log('TubeSnap background script loaded');
