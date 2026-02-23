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
            try {
                await drawFrameWatermark(ctx, canvas, timestamp, getChannelName(), video.videoWidth, video.videoHeight);
            } catch (err) {
                console.error('外框水印失败，回退到简洁水印:', err);
                drawSimpleWatermark(ctx, canvas, timestamp, getChannelName());
            }
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

// 外框水印（相框风格 - 类似小米徕卡/vivo蔡司）
async function drawFrameWatermark(ctx, canvas, videoTime, channel, videoWidth, videoHeight) {
    const frameSize = Math.floor(Math.min(canvas.width, canvas.height) * 0.04);
    const bottomBarHeight = Math.floor(frameSize * 2.2);

    // 创建新画布，带边框
    const framedCanvas = document.createElement('canvas');
    framedCanvas.width = canvas.width + frameSize * 2;
    framedCanvas.height = canvas.height + frameSize + bottomBarHeight;
    const fCtx = framedCanvas.getContext('2d');
    
    // 启用高清渲染
    fCtx.imageSmoothingEnabled = true;
    fCtx.imageSmoothingQuality = 'high';

    // 填充白色背景
    fCtx.fillStyle = '#ffffff';
    fCtx.fillRect(0, 0, framedCanvas.width, framedCanvas.height);

    // 绘制原图
    fCtx.drawImage(canvas, frameSize, frameSize, canvas.width, canvas.height);

    // 底部信息栏
    const barY = canvas.height + frameSize;
    const barHeight = bottomBarHeight;
    const padding = frameSize * 1.5;

    // 左侧：使用 SVG 矢量绘制 Logo（清晰，不依赖图片加载）
    const logoSize = Math.floor(barHeight * 0.6);
    const logoX = padding;
    const logoY = barY + (barHeight - logoSize) / 2;
    
    // 保存上下文并绘制矢量 Logo
    fCtx.save();
    fCtx.translate(logoX, logoY);
    fCtx.scale(logoSize / 100, logoSize / 100);
    
    // 绘制相机快门形状（类似原 Logo）
    // 外圆
    fCtx.beginPath();
    fCtx.arc(50, 50, 45, 0, Math.PI * 2);
    fCtx.strokeStyle = '#ff3b30';
    fCtx.lineWidth = 8;
    fCtx.stroke();
    
    // 6个快门叶片
    for (let i = 0; i < 6; i++) {
        const angle = (i * 60 - 30) * Math.PI / 180;
        fCtx.beginPath();
        fCtx.moveTo(50, 50);
        fCtx.arc(50, 50, 38, angle, angle + 50 * Math.PI / 180);
        fCtx.closePath();
        fCtx.fillStyle = (i % 2 === 0) ? '#ff3b30' : '#333333';
        fCtx.fill();
    }
    
    // 中心白色圆
    fCtx.beginPath();
    fCtx.arc(50, 50, 15, 0, Math.PI * 2);
    fCtx.fillStyle = '#ffffff';
    fCtx.fill();
    
    // 中心播放三角形
    fCtx.beginPath();
    fCtx.moveTo(46, 43);
    fCtx.lineTo(58, 50);
    fCtx.lineTo(46, 57);
    fCtx.closePath();
    fCtx.fillStyle = '#333333';
    fCtx.fill();
    
    fCtx.restore();

    // 计算字体大小
    const channelFontSize = Math.floor(barHeight * 0.28);
    const urlFontSize = Math.floor(barHeight * 0.16);
    const timeFontSize = Math.floor(barHeight * 0.40);

    // Logo 右侧：信息区域
    const textStartX = logoX + logoSize + frameSize;
    
    // 启用文字抗锯齿
    fCtx.textRendering = 'optimizeLegibility';
    
    // 第一行：频道名称
    fCtx.font = `600 ${channelFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
    fCtx.fillStyle = '#1d1d1f';
    fCtx.textBaseline = 'middle';
    const displayChannel = channel || 'YouTube';
    fCtx.fillText(displayChannel, textStartX, barY + barHeight * 0.35);

    // 第二行：视频 URL
    fCtx.font = `400 ${urlFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
    fCtx.fillStyle = '#666666';
    const currentUrl = window.location.href;
    let urlDisplay = 'youtube.com';
    if (currentUrl.includes('youtube.com/watch')) {
        const urlObj = new URL(currentUrl);
        urlDisplay = 'youtube.com/watch?v=' + urlObj.searchParams.get('v');
    }
    fCtx.fillText(urlDisplay, textStartX, barY + barHeight * 0.65);

    // 右侧：视频当前时间
    fCtx.font = `200 ${timeFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
    fCtx.fillStyle = '#1d1d1f';
    fCtx.textAlign = 'right';
    fCtx.fillText(videoTime, framedCanvas.width - padding, barY + barHeight / 2);

    // 重置文本对齐
    fCtx.textAlign = 'left';

    // 将带边框的画布绘制回原画布
    ctx.canvas.width = framedCanvas.width;
    ctx.canvas.height = framedCanvas.height;
    ctx.drawImage(framedCanvas, 0, 0);
}

// 加载 Logo 图片（高清版）
function loadLogoImageHD() {
    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        // 使用 256px 高清图标
        img.src = chrome.runtime.getURL('icons/icon256.png');
    });
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
    
    // 使用简单的相机图标 - 可靠的 SVG 路径
    btn.innerHTML = `
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="3" fill="currentColor"/>
            <path fill="currentColor" d="M20 6h-2.5l-1.5-2h-7L7.5 6H5c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h15c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2zm0 12H5V8h15v10z"/>
        </svg>
    `;
    
    btn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
            await captureScreenshot();
        } catch (err) {
            console.error('截图失败:', err);
            showNotification('截图失败: ' + err.message, 'error');
        }
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
