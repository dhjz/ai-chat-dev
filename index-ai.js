localforage.config({ driver: localforage.INDEXEDDB, name: 'dai-data-db', storeName: 'daistore' });
const themeList = ['prism', 'prism-coy', 'prism-okaidia', 'prism-tomorrow', 'prism-solarizedlight', 't-prism-vs', 't-prism-vsc-dark-plus',
  't-prism-a11y-dark', 't-prism-atom-dark', 't-prism-coldark-cold', 't-prism-coldark-dark',  't-prism-darcula', 't-prism-dracula', 't-prism-nord',
  't-prism-ghcolors', 't-prism-hopscotch', 't-prism-lucario', 't-prism-material-dark', 't-prism-material-oceanic', 't-prism-one-dark', 't-prism-one-light']

window.vueApp = Vue.createApp({
  data() {
    return {
      showSidebar: false,
      dialogShow: false,
      autoScroll: true,
      dialogCont: '',
      providers: [],
      prompts: [],
      userInput: '',
      userFile: {},
      chatHistory: [],
      currentChatId: null,
      isStreaming: false,
      isDarkMode: false,
      abortController: null,
      useContext: localStorage.getItem('dai-useContext') === 'true',
      themes: themeList,
      chatChanged: false,
      syncing: false,
      config: {
        provider: '',
        model: '',
        prompt: '',
        theme: 'prism',
        fontSize: 16,
        codeLine: 0,
        temperature: 0.6,
        top_p: 1,
      }
    };
  },
  computed: {
    currModels() {
      return this.providers.find(x => x.name === this.config.provider)?.models.split(/、|,|，|\s+/).map(m => m.trim()).filter(m => m)
        ?? [];
    },
    currentChat() {
      return this.chatHistory.find(chat => chat.id === this.currentChatId);
    },
    currentSysPrompt() {
      return this.prompts.find(x => x.id == this.config.prompt) || null;
    },
    currentChatMessages() {
      return this.currentChat ? this.currentChat.messages : [];
    },
    chatSyncCode() {
      return this.config.syncCode && this.config.syncCode.length > 3 ? `chat_${this.config.syncCode}`: '';
    }
  },
  watch: {
    isDarkMode(val) {
      localforage.setItem('isDarkMode', val);
      document.documentElement.className = val ? 'dark' : '';
      document.querySelector("#theme-link").href = !val ? this.getThemeLink(this.config.theme)
        : 'https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/prism-vsc-dark-plus.min.css';
    },
    config: {
      deep: true,
      handler(val) {
        this.$nextTick(() => localStorage.setItem('dai-config', JSON.stringify(val)));
      }
    },
    useContext(val) {
      localStorage.setItem('dai-useContext', val);
    },
    userInput() {
      // 自动调整textarea高度
      this.$nextTick(() => {
        const textarea = document.querySelector('.chat-input');
        textarea.style.height = 'auto';
        textarea.style.height = (textarea.scrollHeight + 2) + 'px';
      });
    }
  },
  mounted() {
    this.loadDataFromStorage();
    this.initListener()
  },
  methods: {
    open(url) { window.open(url) },
    renderMarkdown(content, notRender) {
      if (notRender) return content;
      const rawHtml = marked.parse(content);
      const template = document.createElement('template');
      template.innerHTML = rawHtml.trim();
      template.content.querySelectorAll('a').forEach(x => x.setAttribute('target', '_blank'));
      template.content.querySelectorAll('pre code').forEach((codeEle) => {
        const pre = codeEle.parentElement;
        pre.classList.add('line-numbers');
        let codeLen = codeEle.textContent.split('\n').length
        if (codeEle.className.includes('html') && !pre.querySelector('.run-btn')) {
          appendNode(pre, 'button', '▶️运行', 'run-btn');
          if (codeLen > 50 && !this.config.codeLine) {
            appendNode(pre, 'button', '▶️运行', 'run-btn btn-btm');
          }
        }
        if (this.config.codeLine > 0 &&  codeLen > this.config.codeLine) {
          appendNode(pre, 'button', '展开', 'expand-btn');
          pre.classList.add('over-code');
        }
        if (pre.querySelector('.copy-code-btn')) return; // 避免重复添加
        appendNode(pre, 'button', '复制', 'copy-code-btn');
        appendNode(pre, 'button', '下载', 'down-code-btn');
        if (codeLen > 50 && !this.config.codeLine) {
          appendNode(pre, 'button', '复制', 'copy-code-btn btn-btm');
        }
        if (codeEle.className == 'language-vue') codeEle.className = 'language-html';
        Prism.highlightElement(codeEle);
      });
      return template.innerHTML;
    },
    providerChange() {
      this.config.model = this.currModels[0] || '';
    },
    themeChange() {
      document.querySelector("#theme-link").href = this.getThemeLink(this.config.theme);
    },
    getThemeLink(theme) {
      return theme.startsWith('t-') ? `https://cdnjs.cloudflare.com/ajax/libs/prism-themes/1.9.0/${theme.replace('t-', '')}.min.css`
        : `https://cdnjs.cloudflare.com/ajax/libs/prism/1.30.0/themes/${theme}.min.css`;
    },
    handleChatClick(event) {
      if (event.target.classList.contains('copy-code-btn')) {
        const pre = event.target.closest('pre');
        if (pre) {
          const codeEle = pre.querySelector('code');
          if (codeEle) this.copyToClipboard(codeEle.textContent, event.target);
        }
      }
      if (event.target.classList.contains('down-code-btn')) {
        const pre = event.target.closest('pre');
        if (pre) {
          const codeEle = pre.querySelector('code');
          // 根据code的language生成文件后缀名
          if (codeEle) downloadText(codeEle.textContent, 'index' + getFileExt(codeEle));
        }
      }
      if (event.target.classList.contains('expand-btn')) {
        const pre = event.target.closest('pre');
        if (pre) {
          pre.classList.toggle('over-code');
          event.target.textContent = event.target.textContent === '展开' ? '收缩' : '展开';
        }
      }
      if (event.target.classList.contains('run-btn')) {
        const pre = event.target.closest('pre');
        if (pre) {
          const codeEle = pre.querySelector('code');
          if (codeEle) {
            const prose = event.target.closest('.prose');
            let styleHtml = '', jsHtml = '';
            console.log(prose.querySelectorAll('code[class="language-css"]'));
            prose.querySelectorAll('code[class="language-css"]').forEach((c) => styleHtml += c.textContent);
            prose.querySelectorAll('code[class="language-javascript"]').forEach((c) => jsHtml += c.textContent);
            const htmlStr = codeEle.textContent.includes('<\/body>') ? codeEle.textContent : `<body>${codeEle.textContent}</body>`;
            localStorage.setItem('dai-runHtml', htmlStr.replace('<\/body>', `<style>\n${styleHtml}<\/style>\n<script>\n${jsHtml}<\/script>\n<\/body>`));
            // if (window.openWin && !window.openWin.closed) {
            //   window.openWin.location.reload()
            // } else {
              window.openWin = window.open('run.html');
            // }
            window.openWin.focus()
          };
        }
      }
    },
    scrollToChat(ind) {
      document.querySelector('#curr-chat-' + ind)?.scrollIntoView({ behavior: 'smooth' });
    },
    scrollToChatDir(msg, d) {
      let ind = msg.dir.filter(x => d.h ? d.h == x.h : d.c == x.c).indexOf(d);
      let cls = d.h ? d.h : `.language-${d.c}`
      document.querySelectorAll(`.msg_${msg.id} ${cls}`)[ind]?.scrollIntoView({ behavior: 'smooth' });
    },
    scrollToBottom(isForce) {
      if (!isForce && !this.autoScroll) return
      this.$nextTick(() => {
        const chatMessages = this.$refs.chatMessages;
        if (chatMessages) {
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }
      });
    },
    goTop() {
      const chatMessages = this.$refs.chatMessages;
      chatMessages && chatMessages.scrollTo({ top: 0, behavior: 'smooth'})
    },
    handleEnter(e) {
      if (e.ctrlKey || !e.shiftKey) {
        e.preventDefault();
        this.sendMessage()
      }
    },
    delMessage(msg, index) {
      if (confirm(`确定要删除该条消息和回答吗?`)) {
        this.currentChat.messages.splice(index, 2);
        this.saveHistory()
      }
    },
    async sendMessage() {
      if (!this.userInput.trim() || this.isStreaming) return;
      const provider = this.providers.find(p => p.name === this.config.provider);
      if (!provider || !provider.url) return alert(`没有配置正确的服务商(${provider.name})url，无法发送请求。`);
      if (!provider.key) return alert('没有配置正确的key，无法发送请求。');
      if (!this.config.model) return alert('请先选择模型。');

      const userMessage = { role: 'user', content: this.userInput.trim(), file: { ...this.userFile }, help: this.currentSysPrompt ? this.currentSysPrompt.name : '' };
      if (!this.currentChat) {
        this.createNewChat();
      }
      this.currentChat.messages.push(userMessage);
      this.userInput = '';
      this.userFile = {};
      this.scrollToBottom();

      const aiMessage = { id: Math.random().toString(32).slice(-4), role: 'assistant', content: '', remark: '', tokenCount: 0, dir: null, isError: false };
      this.currentChat.messages.push(aiMessage);
      const reactiveAIMessage = this.currentChat.messages[this.currentChat.messages.length - 1];

      this.isStreaming = true;
      this.abortController = new AbortController();
      this.saveHistory()
      const startTime = Date.now();
      let tokens = null;
      document.title = 'AI 对话中...'
      try {
        let sysMessage = this.currentSysPrompt && this.currentSysPrompt.prompt ? [{ role: 'system', content: this.currentSysPrompt.prompt }] : []
        const response = await fetch(provider.url + '/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + provider.key
          },
          body: JSON.stringify({
            model: this.config.model,
            messages: sysMessage.concat(this.currentChat.messages.slice(this.useContext ? 0 : -2, -1).map(m => ({ role: m.role, content: m.content }))),
            stream: true,
            frequency_penalty: 0, // 文本的流畅性和完整性，即使它可能包含一些重复
            presence_penalty: 0,
            stream_options: {include_usage: true }, // 返回使用量
            temperature: this.config.temperature, // 0-2 越小随机性越小
            top_p: this.config.top_p,
          }),
          signal: this.abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`Network response was not ok. Status: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = line.substring(6);
              console.log(data);
              if (data.trim() === '[DONE]' || data.trim() === '[done]') {
                return;
              }
              try {
                const json = JSON.parse(data);
                console.log(json);
                if (json.choices && json.choices[0].delta && json.choices[0].delta.content) {
                  const delta = json.choices[0].delta.content;
                  reactiveAIMessage.content += delta;
                  this.scrollToBottom();
                }
                if (json.usage && json.usage.total_tokens && !tokens) {
                  tokens = {prompt: json.usage.prompt_tokens, chat: json.usage.completion_tokens, total: json.usage.total_tokens }
                }
              } catch (e) {
                console.error('Error parsing stream data chunk:', data, e);
              }
            }
          }
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          reactiveAIMessage.content += '\n\n(请求已中断)';
        } else {
          reactiveAIMessage.isError = true;
          reactiveAIMessage.content = `请求失败: ${error.message}`;
        }
      } finally {
        document.title = 'AI 对话'
        this.isStreaming = false;
        this.abortController = null;
        // 模拟获取token消耗
        reactiveAIMessage.tokenCount = tokens ? `${tokens.total}(${tokens.prompt}+${tokens.chat})` : reactiveAIMessage.content.length;
        reactiveAIMessage.remark = provider.name + '(' + this.config.model + '), ' + ((Date.now() - startTime) / 1000).toFixed(0) + 's';
        reactiveAIMessage.dir = listHtmlDir(document.querySelector(`.msg_${reactiveAIMessage.id}`))
        this.scrollToBottom();
        if (this.currentChat.messages.length === 2 && this.currentChat.title === '新对话') {
          this.currentChat.title = this.currentChat.messages[0].content.substring(0, 30);
        }
        this.saveHistory(true)
      }
    },
    stopStream() {
      this.abortController && this.abortController.abort()
    },
    retryLastMessage() {
      const lastMessageIndex = this.currentChat.messages.length - 1;
      if (!this.currentChat.messages[lastMessageIndex].isError && !confirm('是否确定重试回答此消息？')) {
        return
      }
      if (lastMessageIndex >= 0) { //  && this.currentChat.messages[lastMessageIndex].isError
        this.currentChat.messages.pop(); // 移除错误消息
        const lastUserMessage = this.currentChat.messages[this.currentChat.messages.length - 1];
        if (lastUserMessage && lastUserMessage.role === 'user') {
          this.userInput = lastUserMessage.content;
          this.currentChat.messages.pop(); // 移除最后的用户消息以便重新发送
          this.sendMessage();
        }
      }
    },
    copyToClipboard(text, buttonElement) {
      navigator.clipboard.writeText(text).then(() => {
        if (buttonElement) {
          const originalText = buttonElement.innerText;
          buttonElement.innerText = '已复制';
          setTimeout(() => { buttonElement.innerText = originalText }, 2000);
        }
      }).catch(err => alert('复制失败!'));
    },
    createNewChat() {
      const newChat = {
        id: Date.now(),
        title: '新对话',
        messages: [],
      };
      this.chatHistory.unshift(newChat);
      this.currentChatId = newChat.id;
      this.saveHistory()
    },
    selectChat(chatId) {
      this.currentChatId = chatId;
    },
    renameChat(chat) {
      const newTitle = prompt('请输入新的会话名称：', chat.title);
      if (newTitle && newTitle.trim()) {
        chat.title = newTitle.trim();
        this.saveHistory()
      }
    },
    deleteChat(chatId) {
      const chatIndex = this.chatHistory.findIndex(chat => chat.id === chatId);
      if (chatIndex === -1) return;
      console.log(this.chatHistory[chatIndex]);
      if (this.chatHistory[chatIndex].messages.length > 0 && !confirm(`确定删除该会话吗?`)) return;

      this.chatHistory.splice(chatIndex, 1);
      this.saveHistory()

      if (this.currentChatId === chatId) {
        if (this.chatHistory.length > 0) {
          // 选中被删除项的下一个或上一个，或者第一个
          const newIndex = Math.min(chatIndex, this.chatHistory.length - 1);
          this.currentChatId = this.chatHistory[newIndex].id;
        } else {
          this.createNewChat();
        }
      }
    },
    async loadDataFromStorage() {
      let history = await localforage.getItem('chatHistory');
      if (history) {
        if (history instanceof Uint8Array) {
          history = unzipStr8(history);
        }
        this.chatHistory = JSON.parse(history);
      }
      if (this.chatHistory.length > 0) {
        this.currentChatId = this.chatHistory[0].id;
      } else {
        this.createNewChat();
      }
      this.isDarkMode = !!(await localforage.getItem('isDarkMode'));
      this.config = {
        ...this.config,
        ...JSON.parse(localStorage.getItem('dai-config') || '{}')
      }
      this.initSyncChat()
      if (!this.isDarkMode) this.themeChange()
      let settingStr = localStorage.getItem("dai-setting");
      if(settingStr) {
        const setting = JSON.parse(settingStr);
        if (setting.prompts && setting.prompts.length) {
          this.prompts = setting.prompts;
        }
        if (setting.providers && setting.providers.length) {
          this.providers = setting.providers;
          if (!this.config.provider) this.config.provider = setting.providers[0].name;
          if (!this.config.model) this.config.model = setting.providers[0].defaultModel;
          return;
        }
      }
      if (confirm('您还没有配置任何服务商, 是否前往配置?')) {
        location.href = './setting.html';
      }
    },
    saveHistory(isSyncNow) {
      let data = zipStr8(JSON.stringify(this.chatHistory));
      console.log(`save chatHistory, length: ${data.length}, size: ${(data.length / 1024).toFixed(2)}kb`);
      localforage.setItem('chatHistory', data);
      this.chatChanged = true
      if (isSyncNow) this.syncChat()
    },
    initSyncChat() {
      if (!this.chatSyncCode) return;
      $bus.emit('downloadConfig', this.chatSyncCode, (res) => {
        console.log('下载的对话:', res);
        if (res && res.length) {
          let one = res[0].messages[res[0].messages.length - 1]
          if (!one || one.content || confirm(`云端最后一次对话无回答, 是否覆盖下载?`)) {
            this.chatHistory = res
            this.currentChatId = this.chatHistory[0].id;
          }
        }
      })
      setInterval(() => this.chatChanged && this.syncChat(), 10 * 1000) // 20秒同步一次对话
    },
    syncChat() {
      console.log('开始自动同步聊天记录...');
      if (!this.chatSyncCode) return;
      this.syncing = true
      setTimeout(() => this.syncing = false, 1500)
      $bus.emit('uploadConfig', this.chatSyncCode, this.chatHistory, (res) => {
        console.log(res);
        dnotify(res)
        this.chatChanged = false;
      })
    },
    uploadAsk() {
      uploadText().then(res => this.handleUpload(res?.data))
    },
    initListener() {
      document.addEventListener('dragover', (e) => e.preventDefault())
      document.addEventListener('drop', (e) => {
        e.preventDefault()
        const file = e.dataTransfer.files?.[0]
        if (!file) return;
        const reader = new FileReader()
        reader.readAsText(file, 'UTF-8')
        reader.onload = () => this.handleUpload(reader.result)
      })
    },
    handleUpload(text) {
      if (!text || !text.trim()) return;
      this.userInput = text.trim() + '\n' + this.userInput;
      this.$nextTick(() => {
        $q('.chat-input').scrollTop = $q('.chat-input').scrollHeight;
        $q('.chat-input').focus();
      })
    }
  },
}).mount('#app');

/**************** 工具函数 *******************/
function $q(val) { return document.querySelector(val) }
function $qa(val) { return Array.from(document.querySelectorAll(val)) }
// 压缩字符串为Uint8Array
function zipStr8(str) {
  return pako.deflate(new TextEncoder().encode(str), { level: 9 });
}
// 解压Uint8Array为字符串 // arr instanceof Uint8Array === true
function unzipStr8(arr) {
  return pako.inflate(arr, { to: 'string' });
}

function appendNode(parent, name, text, cls) {
  var btn = document.createElement(name);
  btn.innerText = text;
  btn.className = cls;
  parent.appendChild(btn);
  return btn;
}

function downloadText(text, name) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = Object.assign(document.createElement('a'), { href: url, download: name });
  document.body.appendChild(link).click();
  link.remove();
  URL.revokeObjectURL(url);
}

window.extensionMap = {
  js: 'js', javascript: 'js', ts: 'ts', typescript: 'ts', py: 'py', python: 'py', java: 'java', c: 'c', sql: 'sql', vue: 'vue', text: 'txt',
  cpp: 'cpp', 'c++': 'cpp', cs: 'cs', csharp: 'cs',  go: 'go', php: 'php', ruby: 'rb', html: 'html', xml: 'xml', json: 'json',
  css: 'css', scss: 'scss', less: 'less', yml: 'yml', yaml: 'yaml', shell: 'sh', bash: 'sh', sh: 'sh', bat: 'bat', batch: 'bat',
};
function getFileExt(ele) {
  if (!ele || !ele.classList) return '';
  const cls = Array.from(ele.classList).find(x => x.startsWith('language-'));
  if (!cls) return '';
  const lang = cls.substring('language-'.length).toLowerCase();
  return '.' + (extensionMap[lang] || lang);
}

function listHtmlDir(ele) {
  if (!ele) return null;
  const tempEl = typeof ele === 'string' ? new DOMParser().parseFromString(ele) : ele
  const result = [];
  tempEl.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((h) => result.push({h: h.tagName, c: h.textContent}));
  if (result.length) return result; // 如果有标题，则返回标题, 不然找代码块
  tempEl.querySelectorAll('pre code').forEach(codeBlock => {
    const langClass = [...codeBlock.classList].find(cls => cls.startsWith('language-'));
    langClass && result.push({c: `${langClass.replace('language-', '')}` });
  });   
  return result;
}

window.dnotifyTimer = null; window.dnotifyEl = document.body.appendChild(Object.assign(document.createElement('div'), { 
  id: 'dnotify', style: `display:none; min-width: 260px;max-width: 40%; padding: 10px; box-sizing: border-box; border: 1px solid #ebeef5; text-align: center; color:#333;
    position: fixed; background-color: #fff; top:16px;right:16px;z-index: 9999999; font-size: 14px;line-height: 1.4; border-radius: 8px; box-shadow: 0 2px 12px 0 rgba(0,0,0,.1); `
}));
function dnotify(txt, time) {
  dnotifyEl.style.display = 'block';
  dnotifyEl.innerHTML = txt;
  clearTimeout(dnotifyTimer);
  dnotifyTimer = setTimeout(() => dnotifyEl.style.display = 'none', (time || 2) * 1000);
}

function uploadText() {
  return new Promise((res) => {
    document.getElementById('importInput')?.remove()
    const accept = Object.values(extensionMap).map(ext => `.${ext}`).join(',')
    const inputEl = Object.assign(document.createElement('input'), { type: 'file', accept, id: 'importInput', style: 'display: none;' })
    document.body.append(inputEl)
    inputEl.onchange = function () {
      const file = inputEl.files[0]
      if (!file) return res({})
      const reader = new FileReader()
      reader.readAsText(file, 'UTF-8')
      reader.onload = () => res({ name: file.name, data: reader.result, size: file.size, type: file.type })
    }
    inputEl.click()
  })
}