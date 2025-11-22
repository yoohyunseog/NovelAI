/**
 * 속성 단위 편집기 모듈
 * 각 속성마다 독립적인 GPT 엔진과 입력란을 관리
 */

// 속성별 시스템 프롬프트 템플릿
const ATTRIBUTE_PROMPTS = {
    '줄거리 요약': {
        generate: `너는 소설 요약 엔진이다.
화의 전체 본문을 읽고 핵심 요약만 5문장 내로 재작성한다.
기호(#,*) 사용 금지.
출력은 순수 텍스트만.`,
        enhance: `사용자가 입력한 줄거리 요약을 기반으로 자연스럽게 보완하세요.
스토리 흐름에 맞게 매끄럽게 수정.
기호(#,*) 사용 금지.
출력은 순수 텍스트만.`
    },
    '등장인물': {
        generate: `너는 캐릭터 구성 엔진이다.
본문과 이전 화의 캐릭터 정보를 기반으로
등장인물 목록을 정리하라.
역할/성격/현재 상태 포함.
기호(#,*) 사용 금지.
출력은 순수 텍스트만.`,
        enhance: `사용자가 입력한 등장인물 정보를 기반으로 자연스럽게 보완하세요.
캐릭터의 역할과 성격을 일관되게 유지하며 보완.
기호(#,*) 사용 금지.
출력은 순수 텍스트만.`
    },
    '배경': {
        generate: `너는 배경 구성 엔진이다.
이 화에서 중요한 장소, 분위기, 구역 정보를 묘사하라.
기호(#,*) 사용 금지.
출력은 순수 텍스트만.`,
        enhance: `사용자가 입력한 배경 정보를 기반으로 자연스럽게 보완하세요.
장소의 분위기와 특징을 일관되게 유지하며 보완.
기호(#,*) 사용 금지.
출력은 순수 텍스트만.`
    },
    '아이템': {
        generate: `너는 아이템 구성 엔진이다.
획득한 아이템, 사용한 아이템, 잃어버린 아이템을 정리하라.
기호(#,*) 사용 금지.
출력은 순수 텍스트만.`,
        enhance: `사용자가 입력한 아이템 정보를 기반으로 자연스럽게 보완하세요.
아이템의 상태와 용도를 일관되게 유지하며 보완.
기호(#,*) 사용 금지.
출력은 순수 텍스트만.`
    },
    '주요 사건': {
        generate: `너는 사건 구성 엔진이다.
이 화에서 발생한 주요 사건들을 시간순으로 정리하라.
기호(#,*) 사용 금지.
출력은 순수 텍스트만.`,
        enhance: `사용자가 입력한 주요 사건 정보를 기반으로 자연스럽게 보완하세요.
사건의 흐름과 인과관계를 일관되게 유지하며 보완.
기호(#,*) 사용 금지.
출력은 순수 텍스트만.`
    },
    '본문': {
        generate: `너는 소설 본문 생성 엔진이다.
주어진 줄거리와 설정을 바탕으로 소설 본문을 작성하라.
기호(#,*) 사용 금지.
출력은 순수 텍스트만.`,
        enhance: `사용자가 입력한 본문을 기반으로 자연스럽게 보완하세요.
문체와 톤을 일관되게 유지하며 보완.
기호(#,*) 사용 금지.
출력은 순수 텍스트만.`
    },
    '프롤로그': {
        generate: `너는 프롤로그 생성 엔진이다.
소설의 시작을 알리는 프롤로그를 작성하라.
기호(#,*) 사용 금지.
출력은 순수 텍스트만.`,
        enhance: `사용자가 입력한 프롤로그를 기반으로 자연스럽게 보완하세요.
소설의 분위기와 톤을 일관되게 유지하며 보완.
기호(#,*) 사용 금지.
출력은 순수 텍스트만.`
    },
    '레벨': {
        generate: `너는 레벨 구성 엔진이다.
캐릭터나 시스템의 레벨 정보를 정리하라.
기호(#,*) 사용 금지.
출력은 순수 텍스트만.`,
        enhance: `사용자가 입력한 레벨 정보를 기반으로 자연스럽게 보완하세요.
레벨 시스템의 일관성을 유지하며 보완.
기호(#,*) 사용 금지.
출력은 순수 텍스트만.`
    },
    'BIT 구조': {
        generate: `너는 BIT 구조 설명 엔진이다.
데이터의 BIT 구조와 의미를 설명하라.
기호(#,*) 사용 금지.
출력은 순수 텍스트만.`,
        enhance: `사용자가 입력한 BIT 구조 정보를 기반으로 자연스럽게 보완하세요.
BIT 구조의 논리적 일관성을 유지하며 보완.
기호(#,*) 사용 금지.
출력은 순수 텍스트만.`
    },
    '관계도': {
        generate: `너는 관계도 구성 엔진이다.
캐릭터나 요소들 간의 관계를 정리하라.
기호(#,*) 사용 금지.
출력은 순수 텍스트만.`,
        enhance: `사용자가 입력한 관계도 정보를 기반으로 자연스럽게 보완하세요.
관계의 일관성을 유지하며 보완.
기호(#,*) 사용 금지.
출력은 순수 텍스트만.`
    }
};

// 기본 프롬프트 (속성이 목록에 없을 때)
const DEFAULT_PROMPTS = {
    generate: `이 속성의 역할에 맞는 내용을 생성하세요.
기호 제외(#,*).
JSON 사용 금지.
순수 텍스트만 출력.`,
    enhance: `사용자가 입력한 내용을 기반으로 자연스럽게 보완하세요.
스토리 흐름에 맞게 매끄럽게 수정.
기호 제외(#,*).
출력은 순수 텍스트만.`
};

/**
 * 속성 편집기 클래스
 */
class AttributeEditor {
    constructor(attributeName, attributePath, onSave, onLog) {
        this.attributeName = attributeName;
        this.attributePath = attributePath;
        this.onSave = onSave;
        this.onLog = onLog;
        this.currentData = '';
        this.attributeBitMax = null;
        this.attributeBitMin = null;
        this.dataBitMax = null;
        this.dataBitMin = null;
        this.gptModel = 'gpt-4o';
    }

    /**
     * 속성 경로에서 BIT 값 계산
     */
    async calculateAttributeBits() {
        return new Promise((resolve, reject) => {
            const worker = new Worker('../../bit_worker.js');
            worker.onmessage = (e) => {
                if (e.data.ok) {
                    this.attributeBitMax = e.data.max;
                    this.attributeBitMin = e.data.min;
                    resolve({ max: e.data.max, min: e.data.min });
                } else {
                    reject(new Error(e.data.error || 'BIT 계산 실패'));
                }
                worker.terminate();
            };
            worker.onerror = (e) => {
                reject(new Error('BIT 계산 워커 오류'));
                worker.terminate();
            };
            worker.postMessage({ text: this.attributePath });
        });
    }

    /**
     * 데이터 텍스트에서 BIT 값 계산
     */
    async calculateDataBits(text) {
        return new Promise((resolve, reject) => {
            const worker = new Worker('../../bit_worker.js');
            worker.onmessage = (e) => {
                if (e.data.ok) {
                    this.dataBitMax = e.data.max;
                    this.dataBitMin = e.data.min;
                    resolve({ max: e.data.max, min: e.data.min });
                } else {
                    reject(new Error(e.data.error || 'BIT 계산 실패'));
                }
                worker.terminate();
            };
            worker.onerror = (e) => {
                reject(new Error('BIT 계산 워커 오류'));
                worker.terminate();
            };
            worker.postMessage({ text: text || '' });
        });
    }

    /**
     * 속성 데이터 로드
     */
    async loadData() {
        try {
            // 속성 BIT 계산
            await this.calculateAttributeBits();
            this.onLog('info', `[로드] 속성 BIT 계산 완료: MAX ${this.attributeBitMax.toFixed(4)} / MIN ${this.attributeBitMin.toFixed(4)}`);

            // API 호출
            const url = getServerUrl(`/api/attributes/data?bitMax=${this.attributeBitMax}&bitMin=${this.attributeBitMin}`);
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            
            if (data.ok && data.items && data.items.length > 0) {
                // 최신 데이터 선택 (시간순 정렬되어 있음)
                const latestItem = data.items[0];
                this.currentData = latestItem.text || latestItem.data?.text || '';
                this.dataBitMax = latestItem.data?.bitMax || latestItem.max;
                this.dataBitMin = latestItem.data?.bitMin || latestItem.min;
                
                this.onLog('success', `[로드] 데이터 로드 완료: ${this.currentData.length}자`);
                return this.currentData;
            } else {
                this.onLog('info', '[로드] 저장된 데이터 없음');
                return '';
            }
        } catch (error) {
            this.onLog('error', `[로드] 오류: ${error.message}`);
            return '';
        }
    }

    /**
     * GPT로 내용 생성
     */
    async generateWithGPT() {
        try {
            const prompts = ATTRIBUTE_PROMPTS[this.attributeName] || DEFAULT_PROMPTS;
            const systemPrompt = prompts.generate;

            this.onLog('info', `[GPT 생성] 시작: ${this.attributeName}`);
            this.onLog('info', `[GPT 생성] 모델: ${this.gptModel}`);
            this.onLog('info', `[GPT 생성] 시스템 프롬프트: ${systemPrompt.substring(0, 100)}...`);

            const response = await fetch(getServerUrl('/api/gpt/chat'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.gptModel,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: `속성 경로: ${this.attributePath}\n\n이 속성의 내용을 생성해주세요.` }
                    ],
                    temperature: 0.7,
                    max_tokens: 2000
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            if (data.ok && data.content) {
                this.currentData = data.content;
                this.onLog('success', `[GPT 생성] 완료: ${data.content.length}자 생성`);
                return data.content;
            } else {
                throw new Error(data.error || 'GPT 응답 오류');
            }
        } catch (error) {
            this.onLog('error', `[GPT 생성] 오류: ${error.message}`);
            throw error;
        }
    }

    /**
     * GPT로 내용 보완
     */
    async enhanceWithGPT() {
        try {
            if (!this.currentData || this.currentData.trim().length === 0) {
                throw new Error('보완할 내용이 없습니다. 먼저 내용을 입력하세요.');
            }

            const prompts = ATTRIBUTE_PROMPTS[this.attributeName] || DEFAULT_PROMPTS;
            const systemPrompt = prompts.enhance;

            this.onLog('info', `[GPT 보완] 시작: ${this.attributeName}`);
            this.onLog('info', `[GPT 보완] 모델: ${this.gptModel}`);
            this.onLog('info', `[GPT 보완] 원본 길이: ${this.currentData.length}자`);

            const response = await fetch(getServerUrl('/api/gpt/chat'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: this.gptModel,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: `속성 경로: ${this.attributePath}\n\n현재 내용:\n${this.currentData}\n\n위 내용을 보완해주세요.` }
                    ],
                    temperature: 0.7,
                    max_tokens: 2000
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            if (data.ok && data.content) {
                this.currentData = data.content;
                this.onLog('success', `[GPT 보완] 완료: ${data.content.length}자로 보완`);
                return data.content;
            } else {
                throw new Error(data.error || 'GPT 응답 오류');
            }
        } catch (error) {
            this.onLog('error', `[GPT 보완] 오류: ${error.message}`);
            throw error;
        }
    }

    /**
     * 데이터 저장
     */
    async saveData() {
        try {
            if (!this.currentData) {
                throw new Error('저장할 내용이 없습니다.');
            }

            // 속성 BIT 계산
            await this.calculateAttributeBits();
            
            // 데이터 BIT 계산
            await this.calculateDataBits(this.currentData);

            this.onLog('info', `[저장] 속성 BIT: MAX ${this.attributeBitMax.toFixed(4)} / MIN ${this.attributeBitMin.toFixed(4)}`);
            this.onLog('info', `[저장] 데이터 BIT: MAX ${this.dataBitMax.toFixed(4)} / MIN ${this.dataBitMin.toFixed(4)}`);

            // 저장 데이터 구성
            const saveData = {
                attributeText: this.attributePath,
                attributeBitMax: this.attributeBitMax,
                attributeBitMin: this.attributeBitMin,
                text: this.currentData,
                dataBitMax: this.dataBitMax,
                dataBitMin: this.dataBitMin,
                novelTitle: this.getNovelTitle(),
                chapter: this.getChapter(),
                userName: this.extractUserName(),
                pcIp: this.extractPcIp()
            };

            // 저장 API 호출
            const response = await fetch(getServerUrl('/api/attributes/data'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(saveData)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();
            
            if (result.ok) {
                // 저장 경로 정보 로그
                if (result.files) {
                    this.onLog('info', `[저장] 저장 경로:`);
                    if (result.files.attributeMax) {
                        this.onLog('info', `  - MAX: ${result.files.attributeMax}`);
                    }
                    if (result.files.attributeMin) {
                        this.onLog('info', `  - MIN: ${result.files.attributeMin}`);
                    }
                    if (result.files.dataMax) {
                        this.onLog('info', `  - 데이터 MAX: ${result.files.dataMax}`);
                    }
                    if (result.files.dataMin) {
                        this.onLog('info', `  - 데이터 MIN: ${result.files.dataMin}`);
                    }
                }
                
                this.onLog('success', `[저장] 완료: ${this.currentData.length}자 저장됨`);
                return true;
            } else {
                throw new Error(result.error || '저장 실패');
            }
        } catch (error) {
            this.onLog('error', `[저장] 오류: ${error.message}`);
            throw error;
        }
    }

    /**
     * 속성 경로에서 소설 제목 추출
     */
    getNovelTitle() {
        const parts = this.attributePath.split(' → ');
        return parts[0] || '';
    }

    /**
     * 속성 경로에서 챕터 정보 추출
     */
    getChapter() {
        const parts = this.attributePath.split(' → ');
        if (parts.length >= 2) {
            const chapterPart = parts[1];
            const match = chapterPart.match(/챕터\s*(\d+)(?:\s*[:：]\s*(.+))?/i);
            if (match) {
                return {
                    number: match[1],
                    title: match[2] || `제${match[1]}장`
                };
            }
        }
        return null;
    }

    /**
     * 로그인 정보에서 사용자명 추출
     */
    extractUserName() {
        const loginInfo = document.getElementById('loginInfo')?.value || '';
        // "사용자명/IP" 형식에서 사용자명 추출
        const parts = loginInfo.split('/');
        return parts[0]?.trim() || '';
    }

    /**
     * 로그인 정보에서 IP 추출
     */
    extractPcIp() {
        const loginInfo = document.getElementById('loginInfo')?.value || '';
        // "사용자명/IP" 형식에서 IP 추출
        const parts = loginInfo.split('/');
        return parts[1]?.trim() || '';
    }

    /**
     * HTML 입력란 생성
     */
    createInputElement() {
        const div = document.createElement('div');
        div.className = 'attribute-input-group';
        div.id = `attr-${this.attributeName.replace(/\s+/g, '-')}`;

        div.innerHTML = `
            <div class="attribute-label">${this.attributeName}</div>
            <textarea class="attribute-input" id="input-${this.attributeName.replace(/\s+/g, '-')}" 
                placeholder="${this.attributeName} 내용을 입력하세요...">${this.currentData}</textarea>
            <div class="attribute-buttons">
                <button class="btn btn-primary btn-sm" data-action="generate">
                    <span class="spinner-border spinner-border-sm d-none" role="status"></span>
                    <span class="btn-text">AI 생성</span>
                </button>
                <button class="btn btn-success btn-sm" data-action="enhance">
                    <span class="spinner-border spinner-border-sm d-none" role="status"></span>
                    <span class="btn-text">AI 보완</span>
                </button>
                <button class="btn btn-warning btn-sm" data-action="save">
                    <span class="spinner-border spinner-border-sm d-none" role="status"></span>
                    <span class="btn-text">저장</span>
                </button>
            </div>
        `;

        // 이벤트 리스너
        const textarea = div.querySelector('textarea');
        const buttons = div.querySelectorAll('button');

        textarea.addEventListener('input', (e) => {
            this.currentData = e.target.value;
        });

        buttons.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const action = btn.dataset.action;
                const spinner = btn.querySelector('.spinner-border');
                const btnText = btn.querySelector('.btn-text');
                
                btn.disabled = true;
                spinner.classList.remove('d-none');
                btnText.textContent = '처리 중...';

                try {
                    if (action === 'generate') {
                        const result = await this.generateWithGPT();
                        textarea.value = result;
                        this.currentData = result;
                    } else if (action === 'enhance') {
                        this.currentData = textarea.value;
                        const result = await this.enhanceWithGPT();
                        textarea.value = result;
                        this.currentData = result;
                    } else if (action === 'save') {
                        this.currentData = textarea.value;
                        await this.saveData();
                    }
                } catch (error) {
                    // 오류는 이미 로그에 기록됨
                } finally {
                    btn.disabled = false;
                    spinner.classList.add('d-none');
                    btnText.textContent = btn.dataset.action === 'generate' ? 'AI 생성' : 
                                        btn.dataset.action === 'enhance' ? 'AI 보완' : '저장';
                }
            });
        });

        return div;
    }
}

// 전역으로 export
if (typeof window !== 'undefined') {
    window.AttributeEditor = AttributeEditor;
    window.ATTRIBUTE_PROMPTS = ATTRIBUTE_PROMPTS;
}

