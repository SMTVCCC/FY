// spark-api.js
// 星火API通信模块

// 防止重复定义，检查是否已存在sparkAPI对象
if (!window.sparkAPI) {
    console.log('创建新的 sparkAPI 对象');
    // 创建一个全局对象来处理星火API的通信
    window.sparkAPI = {
        ws: null,
        appId: '',
        apiKey: '',
        apiSecret: '',
        uid: '',
        url: '',
        domain: '',
        responseCallback: null,
        messageBuffer: '', // 添加消息缓冲区
        isFirstConnect: true, // 新增标记，用于跟踪是否是首次连接
        hasConnected: false, // 跟踪是否成功连接过
        
        // 初始化API配置
        init(config) {
            this.appId = config.appId;
            this.apiKey = config.apiKey;
            this.apiSecret = config.apiSecret;
            this.uid = config.uid;
            this.url = config.url;
            this.domain = config.domain;
            console.log('星火API初始化完成');
            
            // 初始化时预先连接WebSocket，但不显示错误
            this.connect(true);
        },
        
        // 设置响应回调函数
        setResponseCallback(callback) {
            this.responseCallback = callback;
        },
        
        // 生成认证URL
        generateAuthUrl() {
            const date = new Date().toGMTString();
            const signatureOrigin = `host: spark-api.xf-yun.com\ndate: ${date}\nGET /v1.1/chat HTTP/1.1`;
            const signatureSha = CryptoJS.HmacSHA256(signatureOrigin, this.apiSecret);
            const signature = CryptoJS.enc.Base64.stringify(signatureSha);
            const authorizationOrigin = `api_key="${this.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`;
            const authorization = btoa(authorizationOrigin);
            
            return `${this.url}?authorization=${authorization}&date=${encodeURIComponent(date)}&host=spark-api.xf-yun.com`;
        },
        
        // 连接WebSocket
        async connect(silent = false) {
            // 如果已经有连接且状态正常，则不需要重新连接
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                console.log('WebSocket已连接，无需重新连接');
                return true;
            }
            
            // 关闭现有连接
            if (this.ws) {
                this.ws.close();
                this.ws = null;
            }
            
            try {
                const url = this.generateAuthUrl();
                this.ws = new WebSocket(url);
                
                // 等待连接打开或失败
                const connectionPromise = new Promise((resolve) => {
                    this.ws.onopen = () => {
                        console.log('WebSocket连接已建立');
                        this.isFirstConnect = false; // 连接成功后更新标记
                        resolve(true);
                    };
                    
                    this.ws.onerror = (error) => {
                        console.error('WebSocket错误:', error);
                        if (!silent && this.responseCallback) {
                            this.responseCallback('连接星火API时出现错误，请稍后再试', 'error');
                        }
                        resolve(false);
                    };
                    
                    this.ws.onclose = () => {
                        console.log('WebSocket连接已关闭');
                        resolve(false);
                    };
                    
                    this.ws.onmessage = (event) => {
                        try {
                            const response = JSON.parse(event.data);
                            this.handleResponse(response);
                        } catch (error) {
                            console.error('解析响应失败:', error);
                            if (!silent && this.responseCallback) {
                                this.responseCallback('抱歉，处理响应时出现错误', 'error');
                            }
                        }
                    };
                    
                    // 设置超时
                    setTimeout(() => {
                        if (this.ws && this.ws.readyState !== WebSocket.OPEN) {
                            resolve(false);
                        }
                    }, 5000); // 5秒超时
                });
                
                const connected = await connectionPromise;
                return connected;
                
            } catch (error) {
                console.error('创建WebSocket连接失败:', error);
                if (!silent && this.responseCallback) {
                    this.responseCallback('无法连接到星火API，请检查网络连接', 'error');
                }
                return false;
            }
        },
        
        // 处理API响应
        handleResponse(response) {
            console.log('收到API响应:', JSON.stringify(response, null, 2));
            
            if (!response || !response.header) {
                console.error('无效的API响应');
                if (this.responseCallback) {
                    this.responseCallback('网络连接异常，请检查网络后重试', 'error');
                }
                return;
            }

            if (response.header.code !== 0) {
                console.error('API错误:', response.header.message);
                let errorMessage = '翻译服务暂时不可用，请稍后重试';
                
                // 根据错误代码提供更友好的错误信息
                switch(response.header.code) {
                    case 10013:
                        errorMessage = '请求过于频繁，请稍后再试';
                        break;
                    case 10014:
                        errorMessage = '输入内容过长，请缩短后重试';
                        break;
                    case 10163:
                        errorMessage = '输入内容不符合规范，请修改后重试';
                        break;
                    case 11200:
                        errorMessage = '授权失败，请检查网络连接';
                        break;
                    default:
                        errorMessage = `服务错误(${response.header.code})，请稍后重试`;
                }
                
                if (this.responseCallback) {
                    this.responseCallback(errorMessage, 'error');
                }
                return;
            }
            
            // 检查是否有文本内容
            if (response.payload && 
                response.payload.choices && 
                response.payload.choices.text && 
                response.payload.choices.text.length > 0 && 
                response.payload.choices.text[0] && 
                response.payload.choices.text[0].content) {
                
                const content = response.payload.choices.text[0].content;
                
                // 将新内容添加到缓冲区
                this.messageBuffer += content;
                
                // 检查会话状态
                const status = response.payload.choices.status;
                
                // 每次收到新的内容都更新消息，实现持续生成效果
                if (this.responseCallback && this.messageBuffer) {
                    // 清理可能的多余空格和换行
                    const cleanedContent = this.messageBuffer.trim();
                    // 传递完整的缓冲区内容和完成状态
                    this.responseCallback(cleanedContent, 'assistant', status === 2);
                }
                
                // 如果会话结束，清空缓冲区
                if (status === 2) {
                    this.messageBuffer = '';
                }
            } else {
                console.error('API响应中没有有效的文本内容');
                if (this.responseCallback) {
                    this.responseCallback('翻译结果为空，请重新尝试', 'error');
                }
            }
        },
        
        // 发送消息到API
        async sendMessage(message) {
            console.log('开始发送消息:', message.substring(0, 50) + '...');
            // 清空消息缓冲区
            this.messageBuffer = '';
            
            // 确保WebSocket连接已建立
            if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
                console.log('WebSocket未连接，尝试建立连接...');
                const connected = await this.connect();
                if (!connected) {
                    console.error('WebSocket连接失败');
                    if (this.responseCallback) {
                        this.responseCallback('连接失败，请检查网络后重试', 'error');
                    }
                    return;
                }
            }
            
            console.log('WebSocket连接状态:', this.ws.readyState);
            
            const data = {
                header: {
                    app_id: this.appId,
                    uid: this.uid
                },
                parameter: {
                    chat: {
                        domain: this.domain,
                        temperature: 0.2,  // 降低温度以获得更准确的翻译
                        max_tokens: 4096   // 增加最大token数以支持更长的文本
                    }
                },
                payload: {
                    message: {
                        text: [{ role: 'user', content: message }]
                    }
                }
            };
            
            try {
                console.log('发送数据到API:', JSON.stringify(data, null, 2));
                this.ws.send(JSON.stringify(data));
                console.log('消息发送成功');
            } catch (error) {
                console.error('发送消息失败:', error);
                
                // 尝试重新连接并发送
                const reconnected = await this.connect();
                if (reconnected) {
                    try {
                        this.ws.send(JSON.stringify(data));
                        return;
                    } catch (e) {
                        console.error('重试发送消息失败:', e);
                    }
                }
                
                if (this.responseCallback) {
                    this.responseCallback('发送消息失败，请稍后再试', 'error');
                }
            }
        }
    };
}