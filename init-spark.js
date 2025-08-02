// init-spark.js
// 初始化API配置

document.addEventListener('DOMContentLoaded', () => {
    if (!window.sparkAPI) {
        console.error('错误: sparkAPI对象未定义，无法初始化。请检查 spark-api.js 是否正确加载。');
        // 如果有UI元素显示错误，可以在这里添加
        return;
    }
    
    console.log('开始初始化API配置...');
    // 从.env文件中获取配置
    // 注意：在实际生产环境中，这些值应该从服务器端获取，而不是直接嵌入到前端代码中
    const appId = '3993bebc';
    const apiKey = 'b1ac6aed76cef76575745f348445afdc';
    const apiSecret = 'MGJhNmNhNThlNzQyZmM5MTY5OTRlZjZl';
    const uid = 'SMTLITE';
    const url = 'wss://spark-api.xf-yun.com/v1.1/chat';
    const domain = 'lite';
    
    try {
        // 初始化API
        window.sparkAPI.init({
            appId,
            apiKey,
            apiSecret,
            uid,
            url,
            domain
        });
        
        // 立即设置响应回调函数
        window.sparkAPI.setResponseCallback((content, type, isComplete) => {
            console.log('响应回调被调用:', { content: content.substring(0, 100) + '...', type, isComplete });
            
            const targetText = document.getElementById('target-text');
            const translateBtn = document.getElementById('translate-btn');
            const sourceText = document.getElementById('source-text');
            
            if (!targetText || !translateBtn) {
                console.error('页面元素未找到');
                return;
            }
            
            if (type === 'error') {
                targetText.value = content;
                if (window.showToast) {
                    window.showToast(content);
                }
            } else {
                targetText.value = content;
                // 如果翻译完成且有内容，尝试保存到历史记录
                if (isComplete && content.trim() && sourceText && window.saveTranslationHistory) {
                    const sourceLang = window.sourceLang || 'en';
                    const targetLang = window.targetLang || 'zh';
                    window.saveTranslationHistory(sourceText.value.trim(), content.trim(), sourceLang, targetLang);
                }
            }
            
            if (type === 'error' || isComplete) {
                translateBtn.disabled = false;
                translateBtn.textContent = '翻译';
            }
        });
        
        console.log('API配置已成功初始化');
    } catch (error) {
        console.error('API初始化失败:', error);
    }
});