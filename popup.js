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
            screenshotBtn.style.opacity = '0.5';
            showStatus('请在 YouTube 页面使用此功能', 'error');
            return false;
        }
        return true;
    } catch (err) {
        showStatus('无法访问当前页面', 'error');
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
