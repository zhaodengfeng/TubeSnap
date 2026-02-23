/**
 * TubeSnap - Content Script
 * 一键截取 YouTube 视频画面
 */

'use strict';

// ===== 配置与状态 =====
const CONFIG = {
    screenshotFormat: 'png',
    screenshotQuality: 0.95,
    screenshotAction: 'both',
    enableWatermark: false,
    watermarkPosition: 'bottom-right',
    watermarkStyle: 'simple', // 'simple' | 'frame'
};

let isAppended = false;
let screenshotButton = null;

// ===== DOM 选择器 =====
const SELECTORS = {
    video: 'video.html5-main-video, video[src*="googlevideo.com"]',
    videoContainer: '#movie_player, .html5-video-player, ytd-player',
    rightControls: '.ytp-right-controls, .ytp-chrome-controls .ytp-right-controls',
    title: [
        'h1.ytd-watch-metadata yt-formatted-string',
        'h1.title.ytd-video-primary-info-renderer',
        'h1.watch-title-container',
        '#title h1',
        'ytd-watch-metadata h1',
    ],
    channel: [
        'ytd-channel-name yt-formatted-string a',
        '#upload-info ytd-channel-name a',
        '.ytd-channel-name a',
    ],
};

// ===== 工具函数 =====
function getVideoTitle() {
    for (const selector of SELECTORS.title) {
        const el = document.querySelector(selector);
        if (el && el.textContent.trim()) {
            return sanitizeFilename(el.textContent.trim());
        }
    }
    return 'YouTube_Video';
}

function getChannelName() {
    for (const selector of SELECTORS.channel) {
        const el = document.querySelector(selector);
        if (el && el.textContent.trim()) {
            return sanitizeFilename(el.textContent.trim());
        }
    }
    return '';
}

function sanitizeFilename(str) {
    return str.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').substring(0, 100);
}

function formatTimestamp(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hrs > 0) {
        return `${hrs}h${mins.toString().padStart(2, '0')}m${secs.toString().padStart(2, '0')}s`;
    }
    return `${mins}m${secs.toString().padStart(2, '0')}s`;
}

function formatDate() {
    const now = new Date();
    return `${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}`;
}

function getCurrentTimeString() {
    const now = new Date();
    return now.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function getCurrentDateString() {
    const now = new Date();
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `${month}月${date}日 ${weekdays[now.getDay()]}`;
}

function getVideoElement() {
    return document.querySelector(SELECTORS.video);
}

// ===== 截图核心功能 =====
async function captureScreenshot() {
    const video = getVideoElement();
    if (!video) {
        showNotification('未找到视频元素', 'error');
        return;
    }
    
    if (video.readyState < 2) {
        showNotification('视频尚未加载完成', 'warning');
        return;
    }
    
    const currentTime = video.currentTime;
    const timestamp = formatTimestamp(currentTime);
    
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    if (CONFIG.enableWatermark) {
        if (CONFIG.watermarkStyle === 'frame') {
            drawFrameWatermark(ctx, canvas, timestamp, getChannelName(), video.videoWidth, video.videoHeight);
        } else {
            drawSimpleWatermark(ctx, canvas, timestamp, getChannelName());
        }
    }
    
    showFlashEffect();
    
    const title = getVideoTitle();
    const extension = CONFIG.screenshotFormat === 'jpeg' ? 'jpg' : CONFIG.screenshotFormat;
    const filename = `${title}_${timestamp}_${formatDate()}.${extension}`;
    
    switch (CONFIG.screenshotAction) {
        case 'save':
            await saveScreenshot(canvas, filename);
            break;
        case 'copy':
            await copyScreenshot(canvas);
            break;
        case 'both':
            await Promise.all([
                saveScreenshot(canvas, filename),
                copyScreenshot(canvas)
            ]);
            break;
        case 'preview':
            showPreview(canvas, filename);
            break;
        default:
            await saveScreenshot(canvas, filename);
    }
}

// 简洁文字水印
function drawSimpleWatermark(ctx, canvas, timestamp, channel) {
    const fontSize = Math.max(14, Math.floor(canvas.height / 40));
    ctx.font = `bold ${fontSize}px "Segoe UI", "Microsoft YaHei", sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.lineWidth = 2;
    
    const text = channel ? `${channel} · ${timestamp}` : timestamp;
    const padding = fontSize;
    const textMetrics = ctx.measureText(text);
    const textWidth = textMetrics.width;
    const textHeight = fontSize;
    
    let x, y;
    
    switch (CONFIG.watermarkPosition) {
        case 'top-left':
            x = padding;
            y = padding + textHeight;
            break;
        case 'top-right':
            x = canvas.width - textWidth - padding;
            y = padding + textHeight;
            break;
        case 'bottom-left':
            x = padding;
            y = canvas.height - padding;
            break;
        case 'bottom-right':
        default:
            x = canvas.width - textWidth - padding;
            y = canvas.height - padding;
            break;
    }
    
    ctx.strokeText(text, x, y);
    ctx.fillText(text, x, y);
}

// 外框水印（小米/vivo/OPPO 风格 - 精致版）
function drawFrameWatermark(ctx, canvas, videoTime, channel, videoWidth, videoHeight) {
    const padding = Math.floor(canvas.width * 0.04);
    const barHeight = Math.floor(canvas.width * 0.10);
    const barY = canvas.height - barHeight - padding;
    
    // 白色半透明底部条带
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.fillRect(padding, barY, canvas.width - padding * 2, barHeight);
    
    // 左侧红色/品牌色竖条
    const accentColor = '#ff3b30';
    ctx.fillStyle = accentColor;
    ctx.fillRect(padding, barY, 4, barHeight);
    
    // 计算字体大小
    const baseFontSize = Math.floor(barHeight * 0.22);
    
    // 左侧：品牌名 TubeSnap
    ctx.font = `600 ${baseFontSize}px "Segoe UI", "SF Pro Display", -apple-system, sans-serif`;
    ctx.fillStyle = '#1d1d1f';
    ctx.textBaseline = 'middle';
    const textY = barY + barHeight / 2;
    ctx.fillText('TubeSnap', padding + 16, textY - baseFontSize * 0.3);
    
    // 品牌名下：日期时间
    ctx.font = `400 ${Math.floor(baseFontSize * 0.75)}px "Segoe UI", sans-serif`;
    ctx.fillStyle = '#86868b';
    const dateTimeStr = `${getCurrentDateString()} ${getCurrentTimeString()}`;
    ctx.fillText(dateTimeStr, padding + 16, textY + baseFontSize * 0.5);
    
    // 右侧：视频信息
    ctx.textAlign = 'right';
    
    // 分辨率
    ctx.font = `500 ${baseFontSize}px "Segoe UI", sans-serif`;
    ctx.fillStyle = '#1d1d1f';
    ctx.fillText(`${videoWidth} × ${videoHeight}`, canvas.width - padding - 16, textY - baseFontSize * 0.2);
    
    // 时长和频道
    ctx.font = `400 ${Math.floor(baseFontSize * 0.75)}px "Segoe UI", sans-serif`;
    ctx.fillStyle = '#86868b';
    const infoText = channel ? `${channel} · ${videoTime}` : videoTime;
    ctx.fillText(infoText, canvas.width - padding - 16, textY + baseFontSize * 0.6);
    
    // 右下角小 Logo 图标区域（可选，增加品牌感）
    const logoSize = Math.floor(barHeight * 0.35);
    const logoX = canvas.width - padding - 80;
    const logoY = barY + (barHeight - logoSize) / 2;
    
    // 绘制简单的相机图标作为品牌标识
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(logoX + logoSize/2, logoY + logoSize/2, logoSize/3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(logoX + logoSize/2, logoY + logoSize/2, logoSize/6, 0, Math.PI * 2);
    ctx.fillStyle = accentColor;
    ctx.fill();
    
    // 重置文本对齐
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
}

async function saveScreenshot(canvas, filename) {
    return new Promise((resolve, reject) => {
        const mimeType = `image/${CONFIG.screenshotFormat}`;
        const quality = CONFIG.screenshotFormat === 'png' ? undefined : CONFIG.screenshotQuality;
        
        canvas.toBlob(async (blob) => {
            if (!blob) {
                reject(new Error('生成图片失败'));
                return;
            }
            
            try {
                const url = URL.createObjectURL(blob);
                await chrome.runtime.sendMessage({
                    action: 'download',
                    url: url,
                    filename: filename
                });
                URL.revokeObjectURL(url);
                showNotification(`已保存: ${filename}`, 'success');
                resolve();
            } catch (err) {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showNotification(`已保存: ${filename}`, 'success');
                resolve();
            }
        }, mimeType, quality);
    });
}

async function copyScreenshot(canvas) {
    return new Promise((resolve, reject) => {
        canvas.toBlob(async (blob) => {
            if (!blob) {
                reject(new Error('生成图片失败'));
                return;
            }
            
            try {
                if (CONFIG.screenshotFormat === 'png') {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                } else {
                    const pngBlob = await canvasToPngBlob(canvas);
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': pngBlob })
                    ]);
                }
                showNotification('已复制到剪贴板', 'success');
                resolve();
            } catch (err) {
                showNotification('复制失败: ' + err.message, 'error');
                reject(err);
            }
        }, 'image/png');
    });
}

function canvasToPngBlob(canvas) {
    return new Promise((resolve) => {
        canvas.toBlob((blob) => resolve(blob), 'image/png');
    });
}

// ===== UI 组件 =====
function createScreenshotButton() {
    const btn = document.createElement('button');
    btn.className = 'tubesnap-btn ytp-button';
    btn.title = '截图 (Alt+S)';
    btn.setAttribute('aria-label', '截图');
    
    // 相机图标 SVG
    btn.innerHTML = `
        <svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor">
            <path d="M12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/>
            <path d="M20 6h-2.5l-1.5-2h-7L7.5 6H5c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h15c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm-8 13c-3.31 0-6-2.69-6-6s2.69-6 6-6 6 2.69 6 6-2.69 6-6 6z"/>
        </svg>
    `;
    
    btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        captureScreenshot();
    });
    
    return btn;
}

function addButtonsToPlayer() {
    const controls = document.querySelector(SELECTORS.rightControls);
    if (!controls) {
        isAppended = false;
        return false;
    }
    
    if (isAppended && controls.querySelector('.tubesnap-btn')) {
        return true;
    }
    
    if (!screenshotButton) {
        screenshotButton = createScreenshotButton();
    }
    controls.prepend(screenshotButton);
    
    isAppended = true;
    return true;
}

// ===== 特效与反馈 =====
function showFlashEffect() {
    const flash = document.createElement('div');
    flash.className = 'tubesnap-flash';
    flash.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background: white;
        opacity: 0.3;
        pointer-events: none;
        z-index: 999999;
        transition: opacity 0.3s ease-out;
    `;
    document.body.appendChild(flash);
    
    requestAnimationFrame(() => {
        flash.style.opacity = '0';
        setTimeout(() => flash.remove(), 300);
    });
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `tubesnap-notify tubesnap-notify-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 80px;
        right: 20px;
        padding: 12px 20px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        z-index: 10000;
        animation: tubesnap-slide-in 0.3s ease-out;
        backdrop-filter: blur(10px);
        ${type === 'success' ? 'background: rgba(76, 175, 80, 0.9); color: white;' : ''}
        ${type === 'error' ? 'background: rgba(244, 67, 54, 0.9); color: white;' : ''}
        ${type === 'warning' ? 'background: rgba(255, 152, 0, 0.9); color: white;' : ''}
        ${type === 'info' ? 'background: rgba(33, 150, 243, 0.9); color: white;' : ''}
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'tubesnap-slide-out 0.3s ease-in forwards';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

function showPreview(canvas, filename) {
    canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        
        const previewWindow = window.open('', '_blank', 'width=1200,height=800');
        if (!previewWindow) {
            showNotification('弹窗被阻止，请允许弹窗以使用预览功能', 'warning');
            return;
        }
        
        previewWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>截图预览 - ${filename}</title>
                <style>
                    body { margin: 0; padding: 20px; background: #1a1a1a; color: #fff; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; display: flex; flex-direction: column; align-items: center; min-height: 100vh; }
                    .header { margin-bottom: 20px; text-align: center; }
                    .filename { font-size: 14px; color: #aaa; margin-top: 8px; }
                    .image-container { max-width: 100%; background: #000; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.5); }
                    img { max-width: 100%; max-height: 70vh; display: block; }
                    .actions { margin-top: 20px; display: flex; gap: 12px; }
                    button { padding: 10px 24px; border: none; border-radius: 6px; font-size: 14px; font-weight: 500; cursor: pointer; transition: all 0.2s; }
                    .btn-save { background: #4CAF50; color: white; }
                    .btn-save:hover { background: #45a049; }
                    .btn-copy { background: #2196F3; color: white; }
                    .btn-copy:hover { background: #1e88e5; }
                    .btn-close { background: #424242; color: white; }
                    .btn-close:hover { background: #616161; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h2>截图预览</h2>
                    <div class="filename">${filename}</div>
                </div>
                <div class="image-container">
                    <img src="${url}" alt="截图">
                </div>
                <div class="actions">
                    <button class="btn-save" onclick="download()">保存到本地</button>
                    <button class="btn-copy" onclick="copy()">复制到剪贴板</button>
                    <button class="btn-close" onclick="window.close()">关闭</button>
                </div>
                <script>
                    function download() {
                        const a = document.createElement('a');
                        a.href = '${url}';
                        a.download = '${filename}';
                        a.click();
                    }
                    async function copy() {
                        try {
                            const response = await fetch('${url}');
                            const blob = await response.blob();
                            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                            alert('已复制到剪贴板');
                        } catch (e) {
                            alert('复制失败: ' + e.message);
                        }
                    }
                </script>
            </body>
            </html>
        `);
    }, 'image/png');
}

// ===== 键盘快捷键 =====
function handleKeyDown(e) {
    if (document.activeElement && (
        document.activeElement.contentEditable === 'true' ||
        document.activeElement.tagName === 'INPUT' ||
        document.activeElement.tagName === 'TEXTAREA'
    )) {
        return;
    }
    
    if (e.altKey && (e.key === 's' || e.key === 'S')) {
        e.preventDefault();
        captureScreenshot();
    }
}

// ===== DOM 观察器 =====
const observer = new MutationObserver(() => {
    if (!isAppended) {
        addButtonsToPlayer();
    }
});

// ===== 初始化 =====
function init() {
    chrome.storage.sync.get([
        'screenshotFormat',
        'screenshotQuality',
        'screenshotAction',
        'enableWatermark',
        'watermarkPosition',
        'watermarkStyle'
    ], (result) => {
        Object.assign(CONFIG, result);
        addButtonsToPlayer();
    });
    
    chrome.storage.onChanged.addListener((changes) => {
        for (let key in changes) {
            if (CONFIG.hasOwnProperty(key)) {
                CONFIG[key] = changes[key].newValue;
            }
        }
    });
    
    document.addEventListener('keydown', handleKeyDown);
    
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'take-screenshot') {
            captureScreenshot();
            sendResponse({ success: true });
        }
        return true;
    });
    
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    setInterval(() => {
        if (!document.querySelector('.tubesnap-btn')) {
            isAppended = false;
            addButtonsToPlayer();
        }
    }, 2000);
}

// 注入动画样式
const style = document.createElement('style');
style.textContent = `
    @keyframes tubesnap-slide-in {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes tubesnap-slide-out {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}
