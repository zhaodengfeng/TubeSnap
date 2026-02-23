'use strict';

// ===== DOM 元素 =====
const screenshotBtn = document.getElementById('screenshot-btn');
const settingsBtn = document.getElementById('settings-btn');
const statusDiv = document.getElementById('status');

// ===== 显示状态 =====
function showStatus(message, type = 'success') {
    statusDiv.innerHTML = `
        <svg viewBox="0 0 24 24">
            ${type === 'success' 
                ? '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>'
                : '<path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>'
            }
        </svg>
        ${message}
    `;
    statusDiv.className = `status ${type}`;
    statusDiv.classList.remove('hidden');
}

// ===== 检查当前标签页 =====
async function checkCurrentTab() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        const isYouTube = tab.url && (
            tab.url.includes('youtube.com') || 
            tab.url.includes('youtu.be')
        );
        
        if (!isYouTube) {
            screenshotBtn.disabled = true;
            screenshotBtn.style.opacity = '0.4';
            screenshotBtn.innerHTML = `
                <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/><path d="M12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/><path d="M20 6h-2.5l-1.5-2h-7L7.5 6H5c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h15c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-8 13c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/></svg>
                请前往 YouTube 使用
            `;
            return false;
        }
        return true;
    } catch (err) {
        return false;
    }
}

// ===== 截图按钮点击 =====
screenshotBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    try {
        await chrome.tabs.sendMessage(tab.id, { action: 'take-screenshot' });
        showStatus('截图成功！', 'success');
        
        // 2秒后关闭弹窗
        setTimeout(() => {
            window.close();
        }, 1500);
    } catch (err) {
        showStatus('截图失败: ' + err.message, 'error');
    }
});

// ===== 设置按钮点击 =====
settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
    window.close();
});

// ===== 初始化 =====
checkCurrentTab();
