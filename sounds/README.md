# 快门音效占位文件
# 由于 base64 音效文件较大，您可以选择以下方式添加音效：
# 
# 方式1: 下载免费快门音效
#   wget https://www.soundjay.com/camera/camera-shutter-click-01.mp3 -O sounds/shutter.mp3
#
# 方式2: 使用在线工具生成或转换
#   使用 https://ttsmp3.com/ 或其他工具生成短音效
#
# 方式3: 禁用音效（将 enableSound 默认设为 false）
#   修改 background.js 中的默认配置
#
# 方式4: 使用 data URI (需要将音频文件转为 base64)
#   base64 -w 0 shutter.mp3 > shutter.b64
#
# 当前插件在找不到音效文件时会静默失败，不影响功能使用
