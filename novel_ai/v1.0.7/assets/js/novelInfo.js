/**
 * 소설 메인 정보 관리 모듈
 * 단계, LV, BIT 분석, 추천 작업 등을 관리
 */

class NovelInfoManager {
    constructor(novelTitle, onLog) {
        this.novelTitle = novelTitle;
        this.onLog = onLog;
        this.novelData = null;
        this.userBitMax = null;
        this.userBitMin = null;
        this.novelBitMax = null;
        this.novelBitMin = null;
    }

    /**
     * 사용자 BIT 계산 (로그인 정보에서)
     */
    async calculateUserBits() {
        const loginInfo = document.getElementById('loginInfo')?.value || '';
        if (!loginInfo) {
            return { max: null, min: null };
        }

        return new Promise((resolve, reject) => {
            const worker = new Worker('../../bit_worker.js');
            worker.onmessage = (e) => {
                if (e.data.ok) {
                    this.userBitMax = e.data.max;
                    this.userBitMin = e.data.min;
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
            worker.postMessage({ text: loginInfo });
        });
    }

    /**
     * 소설 BIT 계산
     */
    async calculateNovelBits() {
        if (!this.novelTitle) {
            return { max: null, min: null };
        }

        return new Promise((resolve, reject) => {
            const worker = new Worker('../../bit_worker.js');
            worker.onmessage = (e) => {
                if (e.data.ok) {
                    this.novelBitMax = e.data.max;
                    this.novelBitMin = e.data.min;
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
            worker.postMessage({ text: this.novelTitle });
        });
    }

    /**
     * 소설 정보 로드 (서버에서)
     */
    async loadNovelInfo() {
        try {
            // 소설 BIT 계산
            await this.calculateNovelBits();
            
            // 사용자 BIT 계산
            await this.calculateUserBits();

            // 속성 데이터에서 소설 정보 수집
            const response = await fetch(getServerUrl('/api/attributes/all'));
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            if (!data.ok || !data.attributes) {
                return this.getDefaultNovelInfo();
            }

            // 소설 관련 속성 필터링
            const novelAttributes = data.attributes.filter(attr => {
                const attrText = (attr.text || '').trim();
                return attrText.startsWith(this.novelTitle + ' →');
            });

            // 챕터 수 계산
            const chapterSet = new Set();
            novelAttributes.forEach(attr => {
                const parts = attr.text.split(' → ');
                if (parts.length >= 2) {
                    const chapterMatch = parts[1].match(/챕터\s*(\d+)/i);
                    if (chapterMatch) {
                        chapterSet.add(chapterMatch[1]);
                    }
                }
            });

            // 속성별 데이터 존재 여부 확인
            const attributeStatus = this.checkAttributeStatus(novelAttributes);

            // 진행 단계 계산
            const stage = this.calculateStage(attributeStatus, chapterSet.size);

            // LV 계산
            const lv = this.calculateLv(attributeStatus, chapterSet.size);

            this.novelData = {
                title: this.novelTitle,
                description: this.getDescription(novelAttributes),
                genreTags: this.getGenreTags(novelAttributes),
                novelId: this.generateNovelId(),
                status: this.getStatus(stage),
                stage: stage,
                totalLv: lv,
                chapterCount: chapterSet.size,
                createdAt: this.getCreatedAt(novelAttributes),
                updatedAt: this.getUpdatedAt(novelAttributes),
                creator: this.getCreator(novelAttributes),
                novelBitMax: this.novelBitMax,
                novelBitMin: this.novelBitMin,
                userBitMax: this.userBitMax,
                userBitMin: this.userBitMin,
                attributeStatus: attributeStatus
            };

            return this.novelData;
        } catch (error) {
            this.onLog('error', `[소설 정보] 로드 오류: ${error.message}`);
            return this.getDefaultNovelInfo();
        }
    }

    /**
     * 기본 소설 정보
     */
    getDefaultNovelInfo() {
        return {
            title: this.novelTitle,
            description: '',
            genreTags: [],
            novelId: this.generateNovelId(),
            status: '초기 기획 단계',
            stage: 1,
            totalLv: 1,
            chapterCount: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            creator: this.extractUserName(),
            novelBitMax: this.novelBitMax || 0,
            novelBitMin: this.novelBitMin || 0,
            userBitMax: this.userBitMax || 0,
            userBitMin: this.userBitMin || 0,
            attributeStatus: {}
        };
    }

    /**
     * 속성별 상태 확인
     */
    checkAttributeStatus(attributes) {
        const status = {
            '줄거리 요약': false,
            '본문': false,
            '등장인물': false,
            '배경': false,
            '아이템': false,
            '주요 사건': false,
            '레벨': false,
            'BIT 구조': false,
            '관계도': false,
            '프롤로그': false
        };

        attributes.forEach(attr => {
            const attrText = attr.text || '';
            Object.keys(status).forEach(key => {
                if (attrText.includes(key)) {
                    status[key] = true;
                }
            });
        });

        return status;
    }

    /**
     * 진행 단계 계산 (1-5단계)
     */
    calculateStage(attributeStatus, chapterCount) {
        // 1단계: 기본 정보만
        if (!attributeStatus['줄거리 요약'] && !attributeStatus['등장인물'] && chapterCount === 0) {
            return 1;
        }
        
        // 2단계: 줄거리 또는 주요 사건 있음
        if (attributeStatus['줄거리 요약'] || attributeStatus['주요 사건']) {
            if (!attributeStatus['등장인물'] && !attributeStatus['관계도']) {
                return 2;
            }
        }
        
        // 3단계: 등장인물 또는 관계도 있음
        if (attributeStatus['등장인물'] || attributeStatus['관계도']) {
            if (!attributeStatus['레벨'] && !attributeStatus['아이템']) {
                return 3;
            }
        }
        
        // 4단계: 레벨 또는 아이템 있음
        if (attributeStatus['레벨'] || attributeStatus['아이템']) {
            if (chapterCount === 0) {
                return 4;
            }
        }
        
        // 5단계: 챕터가 있음
        if (chapterCount > 0) {
            return 5;
        }
        
        return 1;
    }

    /**
     * LV 계산
     */
    calculateLv(attributeStatus, chapterCount) {
        let lv = 1;
        
        // 기본 정보 입력 완료
        if (this.novelTitle) {
            lv = 1;
        }
        
        // 줄거리 요약 또는 등장인물 있으면 LV 2
        if (attributeStatus['줄거리 요약'] || attributeStatus['등장인물']) {
            lv = 2;
        }
        
        // 챕터가 있으면 LV 3
        if (chapterCount > 0) {
            lv = 3;
        }
        
        // 본문이 있으면 LV 4
        if (attributeStatus['본문']) {
            lv = 4;
        }
        
        // 모든 주요 속성이 있으면 LV 5
        const mainAttributes = ['줄거리 요약', '등장인물', '배경', '주요 사건'];
        if (mainAttributes.every(attr => attributeStatus[attr])) {
            lv = 5;
        }
        
        return lv;
    }

    /**
     * 설명 추출
     */
    getDescription(attributes) {
        // 배경 속성에서 설명 추출 시도
        const backgroundAttr = attributes.find(attr => attr.text.includes('배경'));
        if (backgroundAttr) {
            return backgroundAttr.text.split('배경')[1] || '';
        }
        return '';
    }

    /**
     * 장르 태그 추출
     */
    getGenreTags(attributes) {
        // 실제로는 별도 저장소에서 가져와야 하지만, 여기서는 예시
        return ['RPG GAME FICTION', '무협 판타지', 'SF', '퓨전 판타지'];
    }

    /**
     * 소설 ID 생성
     */
    generateNovelId() {
        // 제목의 첫 글자들로 ID 생성
        const title = this.novelTitle || '';
        const initials = title.split('').filter(c => /[가-힣A-Z]/.test(c)).slice(0, 2).join('');
        const num = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        return `${initials}-${num}`;
    }

    /**
     * 상태 텍스트
     */
    getStatus(stage) {
        const statusMap = {
            1: '초기 기획 단계',
            2: '줄거리·구성 설계',
            3: '등장인물·관계도 설계',
            4: '레벨·아이템 시스템 확정',
            5: '본문 집필 및 BIT 튜닝'
        };
        return statusMap[stage] || '초기 기획 단계';
    }

    /**
     * 생성일 추출
     */
    getCreatedAt(attributes) {
        if (attributes.length > 0) {
            // 가장 오래된 속성의 타임스탬프 사용
            return new Date().toISOString();
        }
        return new Date().toISOString();
    }

    /**
     * 수정일 추출
     */
    getUpdatedAt(attributes) {
        return new Date().toISOString();
    }

    /**
     * 생성자 추출
     */
    getCreator(attributes) {
        return this.extractUserName();
    }

    /**
     * 사용자명 추출
     */
    extractUserName() {
        const loginInfo = document.getElementById('loginInfo')?.value || '';
        const parts = loginInfo.split('/');
        return parts[0]?.trim() || '호떡';
    }

    /**
     * 다음 추천 작업 계산
     */
    getRecommendedTasks() {
        const tasks = [];
        const status = this.novelData?.attributeStatus || {};
        const stage = this.novelData?.stage || 1;
        const chapterCount = this.novelData?.chapterCount || 0;

        if (stage === 1) {
            tasks.push('📝 줄거리 요약에서 프롤로그용 한 줄 콘셉트 작성');
            tasks.push('👥 등장인물 목록에 최소 2명 이상(주인공 / 대립자) 등록');
            tasks.push('🔢 전체 BIT 구조 화면에서 "1단계 → 2단계" 버튼으로 단계 진입 로그 기록');
        } else if (stage === 2) {
            if (!status['등장인물']) {
                tasks.push('👥 등장인물 목록 작성');
            }
            if (!status['주요 사건']) {
                tasks.push('⚡ 주요 사건 정리');
            }
        } else if (stage === 3) {
            if (!status['관계도']) {
                tasks.push('🔗 관계도 작성');
            }
            if (!status['배경']) {
                tasks.push('🌍 배경 설정 작성');
            }
        } else if (stage === 4) {
            if (!status['레벨']) {
                tasks.push('📊 레벨 시스템 설계');
            }
            if (!status['아이템']) {
                tasks.push('🎒 아이템 시스템 설계');
            }
        } else if (stage === 5) {
            if (chapterCount === 0) {
                tasks.push('📖 첫 챕터 작성');
            }
            if (!status['본문']) {
                tasks.push('📝 본문 집필');
            }
        }

        return tasks;
    }

    /**
     * BIT 분석 텍스트 생성
     */
    getBitAnalysis() {
        if (!this.novelData) return null;

        const novelMax = this.novelData.novelBitMax;
        const novelMin = this.novelData.novelBitMin;
        const userMax = this.novelData.userBitMax;
        const userMin = this.novelData.userBitMin;

        if (!novelMax || !novelMin || !userMax || !userMin) {
            return null;
        }

        const maxDiff = novelMax - userMax;
        const minDiff = novelMin - userMin;

        let maxAnalysis = '';
        let minAnalysis = '';
        let correlation = '';
        let recommendation = '';

        // MAX BIT 분석
        if (novelMax > 3.0) {
            maxAnalysis = '감정 밀도·전투·클라이맥스 에너지 비중이 높음';
        } else if (novelMax > 2.5) {
            maxAnalysis = '감정과 전투 장면이 균형있게 배치됨';
        } else {
            maxAnalysis = '서사적 전개와 묘사 중심';
        }

        // MIN BIT 분석
        if (novelMin > 2.8) {
            minAnalysis = '세계관 설명·배경 묘사·분산형 정보량이 높음';
        } else if (novelMin > 2.5) {
            minAnalysis = '세계관 설명·배경 묘사·분산형 정보량이 중간 수준';
        } else {
            minAnalysis = '액션·전개 중심, 설정 설명은 보조적';
        }

        // 사용자 BIT 분석
        let userMaxAnalysis = '';
        let userMinAnalysis = '';
        
        if (userMax > 2.8) {
            userMaxAnalysis = '직관적 전개, 감정 폭발 장면을 선호';
        } else {
            userMaxAnalysis = '서사적 전개를 선호';
        }

        if (userMin > 2.8) {
            userMinAnalysis = '설정·데이터·분석형 묘사도 강하게 선호';
        } else {
            userMinAnalysis = '액션과 전개 중심 선호';
        }

        // 상관 분석
        if (maxDiff > 0.1) {
            correlation += `• 소설 MAX(${novelMax.toFixed(4)}) > 사용자 MAX(${userMax.toFixed(4)}): 작품의 피크 감정·전투 강도가 사용자 평균 성향보다 약간 더 높게 설정됨\n`;
        } else if (maxDiff < -0.1) {
            correlation += `• 소설 MAX(${novelMax.toFixed(4)}) < 사용자 MAX(${userMax.toFixed(4)}): 작품의 피크 감정·전투 강도가 사용자 평균 성향보다 낮음\n`;
        }

        if (minDiff < -0.1) {
            correlation += `• 소설 MIN(${novelMin.toFixed(4)}) < 사용자 MIN(${userMin.toFixed(4)}): 사용자가 좋아하는 "설정·세계관 설명량"에 비해 현재 소설은 다소 액션·전개 비중이 큼\n`;
        } else if (minDiff > 0.1) {
            correlation += `• 소설 MIN(${novelMin.toFixed(4)}) > 사용자 MIN(${userMin.toFixed(4)}): 설정 설명이 사용자 선호보다 많음\n`;
        }

        // 추천 튜닝 방향
        if (minDiff < -0.1) {
            recommendation += '• 줄거리 요약(📝)과 배경(🌍)에서 설정 설명을 조금 더 늘려 MIN BIT를 사용자 값에 근접하게 맞춤\n';
        }
        if (maxDiff > 0.1) {
            recommendation += '• 주요 사건(⚡)과 레벨 시스템(📊)에서 클라이맥스 장면을 명확히 설계해 MAX BIT 피크를 유지\n';
        }

        return {
            novelMax,
            novelMin,
            userMax,
            userMin,
            maxAnalysis,
            minAnalysis,
            userMaxAnalysis,
            userMinAnalysis,
            correlation,
            recommendation
        };
    }

    /**
     * HTML 생성
     */
    createInfoHTML() {
        if (!this.novelData) {
            return '<div class="text-muted">소설 정보를 로드하는 중...</div>';
        }

        const data = this.novelData;
        const bitAnalysis = this.getBitAnalysis();
        const recommendedTasks = this.getRecommendedTasks();

        const stageInfo = this.getStageInfo(data.stage);
        const lvInfo = this.getLvInfo(data.totalLv, data.attributeStatus, data.chapterCount);

        return `
            <div class="novel-info-container">
                <!-- 소설 메인 정보 -->
                <section class="novel-main-info mb-4">
                    <h4 class="mb-3">📖 소설 메인 정보</h4>
                    
                    <div class="card mb-3">
                        <div class="card-body">
                            <h5 class="card-title">${data.title}</h5>
                            <p class="card-text"><strong>설명:</strong> ${data.description || data.genreTags.join(', ')}</p>
                            <p class="card-text small"><strong>속성 경로:</strong> ${data.title}</p>
                            <p class="card-text small"><strong>소설 ID:</strong> ${data.novelId} (예시, 내부 관리용)</p>
                            <p class="card-text small"><strong>소설 상태:</strong> ${data.status} / 작업 중</p>
                        </div>
                    </div>

                    <!-- 진행 단계 -->
                    <div class="card mb-3">
                        <div class="card-body">
                            <h6 class="card-subtitle mb-2"><strong>진행 단계:</strong> ${data.stage}단계 – ${stageInfo.name}</h6>
                            <p class="card-text small mb-2"><strong>단계 요약:</strong></p>
                            <p class="card-text small" style="white-space: pre-wrap;">${stageInfo.description}</p>
                            <hr class="my-2">
                            <p class="card-text small mb-2"><strong>전체 단계:</strong> 5단계 중 ${data.stage}단계</p>
                            <ul class="small mb-0">
                                ${this.getStageList(data.stage)}
                            </ul>
                        </div>
                    </div>

                    <!-- LV 정보 -->
                    <div class="card mb-3">
                        <div class="card-body">
                            <h6 class="card-subtitle mb-2"><strong>총 LV:</strong> ${data.totalLv}</h6>
                            <p class="card-text small mb-2"><strong>현재 LV 설명:</strong></p>
                            <ul class="small mb-2">
                                <li>${lvInfo.description}</li>
                                <li>다음 LV 조건: ${lvInfo.nextCondition}</li>
                            </ul>
                        </div>
                    </div>

                    <!-- 챕터 정보 -->
                    <div class="card mb-3">
                        <div class="card-body">
                            <h6 class="card-subtitle mb-2"><strong>챕터 수:</strong> ${data.chapterCount}</h6>
                            <p class="card-text small mb-2"><strong>챕터 상태:</strong></p>
                            <ul class="small mb-0">
                                <li>${data.chapterCount === 0 ? '등록된 챕터 없음' : `${data.chapterCount}개 챕터 등록됨`}</li>
                                <li>다음 추천 작업: ${data.chapterCount === 0 ? '1화 프롤로그 작성 후 "챕터: 1, LV: 2"로 상승' : '다음 챕터 작성'}</li>
                            </ul>
                        </div>
                    </div>

                    <!-- 생성/수정 정보 -->
                    <div class="card mb-3">
                        <div class="card-body">
                            <p class="card-text small mb-1"><strong>생성일:</strong> ${this.formatDate(data.createdAt)}</p>
                            <p class="card-text small mb-1"><strong>최초 생성자:</strong> ${data.creator}</p>
                            <p class="card-text small mb-1"><strong>수정일:</strong> ${this.formatDate(data.updatedAt)}</p>
                            <p class="card-text small mb-0"><strong>마지막 수정 작업:</strong> 소설 기본 정보 및 BIT 초기값 설정</p>
                        </div>
                    </div>
                </section>

                <!-- BIT 분석 정보 -->
                ${bitAnalysis ? `
                <section class="bit-analysis mb-4">
                    <h4 class="mb-3">BIT 분석 정보</h4>
                    
                    <div class="card mb-3">
                        <div class="card-body">
                            <h6 class="card-subtitle mb-2"><strong>소설 BIT:</strong> ${bitAnalysis.novelMax.toFixed(15)} / ${bitAnalysis.novelMin.toFixed(15)}</h6>
                            <ul class="small mb-0">
                                <li><strong>MAX BIT(${bitAnalysis.novelMax.toFixed(4)}…):</strong> ${bitAnalysis.maxAnalysis}</li>
                                <li><strong>MIN BIT(${bitAnalysis.novelMin.toFixed(4)}…):</strong> ${bitAnalysis.minAnalysis}</li>
                            </ul>
                        </div>
                    </div>

                    <div class="card mb-3">
                        <div class="card-body">
                            <h6 class="card-subtitle mb-2"><strong>사용자 BIT:</strong> ${bitAnalysis.userMax.toFixed(15)} / ${bitAnalysis.userMin.toFixed(15)}</h6>
                            <ul class="small mb-0">
                                <li><strong>MAX BIT(${bitAnalysis.userMax.toFixed(4)}…):</strong> ${bitAnalysis.userMaxAnalysis}</li>
                                <li><strong>MIN BIT(${bitAnalysis.userMin.toFixed(4)}…):</strong> ${bitAnalysis.userMinAnalysis}</li>
                            </ul>
                        </div>
                    </div>

                    ${bitAnalysis.correlation ? `
                    <div class="card mb-3">
                        <div class="card-body">
                            <h6 class="card-subtitle mb-2"><strong>소설–사용자 BIT 상관 메모:</strong></h6>
                            <div class="small" style="white-space: pre-wrap;">${bitAnalysis.correlation}</div>
                        </div>
                    </div>
                    ` : ''}

                    ${bitAnalysis.recommendation ? `
                    <div class="card mb-3">
                        <div class="card-body">
                            <h6 class="card-subtitle mb-2"><strong>추천 튜닝 방향:</strong></h6>
                            <div class="small" style="white-space: pre-wrap;">${bitAnalysis.recommendation}</div>
                        </div>
                    </div>
                    ` : ''}

                    ${bitAnalysis.correlation || bitAnalysis.recommendation ? `
                    <div class="card mb-3">
                        <div class="card-body">
                            <h6 class="card-subtitle mb-2"><strong>BIT 기반 진행 단계 힌트:</strong></h6>
                            <ul class="small mb-0">
                                <li>현재 단계(${data.stage}단계): BIT 초벌 측정 완료</li>
                                <li>다음 단계에서:
                                    <ul>
                                        <li>줄거리 요약 작성 시, "세계관 설명 비중 ↑" → MIN BIT 상승 예상</li>
                                        <li>주요 사건·전투 추가 시, "클라이맥스 장면 ↑" → MAX BIT 미세 상승 예상</li>
                                    </ul>
                                </li>
                            </ul>
                        </div>
                    </div>
                    ` : ''}
                </section>
                ` : ''}

                <!-- 다음 추천 작업 -->
                ${recommendedTasks.length > 0 ? `
                <section class="recommended-tasks mb-4">
                    <h4 class="mb-3">다음 추천 작업</h4>
                    <div class="card">
                        <div class="card-body">
                            <ol class="mb-0 small">
                                ${recommendedTasks.map(task => `<li>${task}</li>`).join('')}
                            </ol>
                        </div>
                    </div>
                </section>
                ` : ''}
            </div>
        `;
    }

    /**
     * 단계 정보
     */
    getStageInfo(stage) {
        const stages = {
            1: { 
                name: '세계관·장르 기획', 
                description: '• 기본 제목, 장르, 설명, 속성 경로를 확정하는 단계\n• 전체 BIT 구조와 사용자 BIT를 매칭해 소설 성향을 진단\n• 다음 단계에서 줄거리 요약(📝)과 주요 인물(👥)을 설계' 
            },
            2: { 
                name: '줄거리·구성 설계', 
                description: '• 줄거리 요약과 주요 사건을 설계하는 단계\n• 스토리 구조와 전개 방향을 확정' 
            },
            3: { 
                name: '등장인물·관계도 설계', 
                description: '• 등장인물과 관계도를 설계하는 단계\n• 캐릭터 간 관계와 갈등 구조를 확정' 
            },
            4: { 
                name: '레벨·아이템 시스템 확정', 
                description: '• 레벨 시스템과 아이템 시스템을 확정하는 단계\n• 게임적 요소와 밸런스를 조정' 
            },
            5: { 
                name: '본문 집필 및 BIT 튜닝', 
                description: '• 본문을 집필하고 BIT 값을 튜닝하는 단계\n• 챕터별 BIT 값을 조정하여 소설의 톤을 일관되게 유지' 
            }
        };
        return stages[stage] || stages[1];
    }

    /**
     * 단계 목록 HTML
     */
    getStageList(currentStage) {
        const stages = [
            { num: 1, name: '세계관·장르 기획', attrs: [] },
            { num: 2, name: '줄거리·구성 설계', attrs: ['📝', '⚡'] },
            { num: 3, name: '등장인물·관계도 설계', attrs: ['👥', '🔗'] },
            { num: 4, name: '레벨·아이템 시스템 확정', attrs: ['📊', '🎒'] },
            { num: 5, name: '본문 집필 및 BIT 튜닝', attrs: ['전체 BIT 구조', '챕터 확장'] }
        ];

        return stages.map(s => {
            const isCurrent = s.num === currentStage;
            const isPast = s.num < currentStage;
            const className = isCurrent ? 'text-primary fw-bold' : isPast ? 'text-muted' : '';
            const marker = isCurrent ? '(현재 단계)' : isPast ? '(완료)' : '';
            const attrsText = s.attrs.length > 0 ? ` (${s.attrs.join(', ')})` : '';
            return `<li class="${className}">${s.num}단계: ${s.name}${attrsText} ${marker}</li>`;
        }).join('');
    }

    /**
     * LV 정보
     */
    getLvInfo(lv, attributeStatus, chapterCount) {
        const lvInfo = {
            1: {
                description: 'LV 1: 기본 정보 입력 완료',
                nextCondition: '최소 1개 이상 챕터 생성 또는 줄거리 요약 등록'
            },
            2: {
                description: 'LV 2: 줄거리 요약 또는 등장인물 등록 완료',
                nextCondition: '챕터 생성 또는 본문 작성'
            },
            3: {
                description: 'LV 3: 챕터 생성 완료',
                nextCondition: '본문 작성'
            },
            4: {
                description: 'LV 4: 본문 작성 완료',
                nextCondition: '모든 주요 속성 완성'
            },
            5: {
                description: 'LV 5: 모든 주요 속성 완성',
                nextCondition: '완성'
            }
        };

        return lvInfo[lv] || lvInfo[1];
    }

    /**
     * 날짜 포맷
     */
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true
        });
    }
}

if (typeof window !== 'undefined') {
    window.NovelInfoManager = NovelInfoManager;
}

