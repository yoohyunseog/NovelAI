/**
 * 메인 애플리케이션 로직
 * 트리 구조 관리, 속성 입력란 동적 생성, 로그 관리
 */

document.addEventListener('DOMContentLoaded', () => {
    console.info('[속성 단위 편집기] 초기화 중...');

    // DOM 요소
    const $novelTree = document.getElementById('novelTree');
    const $attributeInputs = document.getElementById('attributeInputs');
    const $currentPath = document.getElementById('currentPath');
    const $attributeList = document.getElementById('attributeList');
    const $newNovelBtn = document.getElementById('newNovelBtn');
    const $loginInfo = document.getElementById('loginInfo');
    const $userName = document.getElementById('userName');
    const $userBit = document.getElementById('userBit');
    const $currentNovelHeader = document.getElementById('currentNovelHeader');
    const $currentNovelTitle = document.getElementById('currentNovelTitle');
    const $currentNovelGenres = document.getElementById('currentNovelGenres');
    const $novelMenuNav = document.getElementById('novelMenuNav');
    const $logoutBtn = document.getElementById('logoutBtn');
    const $naverLoginBtn = document.getElementById('naverLoginBtn');
    const $userInfo = document.getElementById('userInfo');
    const $loginInfoContainer = document.getElementById('loginInfoContainer');

    // 상태 관리
    let currentNovel = null;
    let currentChapter = null;
    let currentAttribute = null;
    let attributeEditors = new Map(); // 속성명 -> AttributeEditor 인스턴스
    let allAttributes = []; // 서버에서 로드한 모든 속성
    let novelInfoManager = null; // 소설 정보 관리자
    const $novelInfoContainer = document.getElementById('novelInfoContainer');

    // 속성 목록 (기본)
    const DEFAULT_ATTRIBUTES = [
        '줄거리 요약',
        '본문',
        '등장인물',
        '배경',
        '아이템',
        '주요 사건',
        '레벨',
        'BIT 구조',
        '관계도'
    ];

    // 로그 함수 (수동 입력 로그)
    function addLog(type, message) {
        const $logContainer = document.getElementById('manualLogContainer');
        if (!$logContainer) return;
        const timestamp = new Date().toLocaleString('ko-KR');
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.textContent = `[${timestamp}] ${message}`;
        $logContainer.insertBefore(logEntry, $logContainer.firstChild);
        
        // 최대 100개 로그만 유지
        while ($logContainer.children.length > 100) {
            $logContainer.removeChild($logContainer.lastChild);
        }
    }
    
    // 최상위 경로 데이터 로그 함수
    function addTopPathLog(type, message) {
        const $logContainer = document.getElementById('topPathLogContainer');
        if (!$logContainer) return;
        const timestamp = new Date().toLocaleString('ko-KR');
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.textContent = `[${timestamp}] ${message}`;
        $logContainer.insertBefore(logEntry, $logContainer.firstChild);
        
        // 최대 100개 로그만 유지
        while ($logContainer.children.length > 100) {
            $logContainer.removeChild($logContainer.lastChild);
        }
    }

    // 수동 입력 로그 지우기
    const $clearManualLogBtn = document.getElementById('clearManualLogBtn');
    if ($clearManualLogBtn) {
        $clearManualLogBtn.addEventListener('click', () => {
            const $logContainer = document.getElementById('manualLogContainer');
            if ($logContainer) {
                $logContainer.innerHTML = '';
                addLog('info', '로그가 지워졌습니다.');
            }
        });
    }
    
    // 최상위 경로 데이터 로그 지우기
    const $clearTopPathLogBtn = document.getElementById('clearTopPathLogBtn');
    if ($clearTopPathLogBtn) {
        $clearTopPathLogBtn.addEventListener('click', () => {
            const $logContainer = document.getElementById('topPathLogContainer');
            if ($logContainer) {
                $logContainer.innerHTML = '';
                addTopPathLog('info', '로그가 지워졌습니다.');
            }
        });
    }

    // 초기 로그
    addLog('info', '시스템이 준비되었습니다.');
    addTopPathLog('info', '시스템이 준비되었습니다.');

    /**
     * 사용자 정보 업데이트
     */
    function updateUserInfo() {
        const loginInfo = $loginInfo?.value || '';
        if (loginInfo) {
            const parts = loginInfo.split('/');
            const userName = parts[0]?.trim() || '호떡';
            const userIp = parts[1]?.trim() || '';
            
            // displayUserName 업데이트
            const displayUserName = document.getElementById('displayUserName');
            if (displayUserName) {
                displayUserName.textContent = userName;
            }
            
            if ($userName) {
                $userName.textContent = userName;
            }

            // IP BIT 계산 및 표시
            if (userIp && typeof Worker !== 'undefined') {
                const worker = new Worker('../../bit_worker.js');
                worker.onmessage = (e) => {
                    if (e.data.ok) {
                        const bitMax = e.data.max.toFixed(15);
                        const bitMin = e.data.min.toFixed(15);
                        const displayPcIpBitMax = document.getElementById('displayPcIpBitMax');
                        const displayPcIpBitMin = document.getElementById('displayPcIpBitMin');
                        if (displayPcIpBitMax) {
                            displayPcIpBitMax.textContent = bitMax;
                        }
                        if (displayPcIpBitMin) {
                            displayPcIpBitMin.textContent = bitMin;
                        }
                    }
                    worker.terminate();
                };
                worker.onerror = () => {
                    worker.terminate();
                };
                worker.postMessage({ text: userIp });
            }

            // 사용자 BIT 계산 및 표시
            if (loginInfo && typeof Worker !== 'undefined') {
                const worker = new Worker('../../bit_worker.js');
                worker.onmessage = (e) => {
                    if (e.data.ok) {
                        const bitMax = e.data.max.toFixed(15);
                        const bitMin = e.data.min.toFixed(15);
                        if ($userBit) {
                            $userBit.textContent = `사용자 BIT: ${bitMax} / ${bitMin}`;
                        }
                    }
                    worker.terminate();
                };
                worker.onerror = () => {
                    if ($userBit) {
                        $userBit.textContent = '사용자 BIT: 계산 실패';
                    }
                    worker.terminate();
                };
                worker.postMessage({ text: loginInfo });
            }
        }
    }

    /**
     * 현재 소설 정보 헤더 업데이트
     */
    function updateCurrentNovelHeader() {
        if (currentNovel) {
            if ($currentNovelHeader) {
                $currentNovelHeader.style.display = 'block';
            }
            if ($currentNovelTitle) {
                $currentNovelTitle.textContent = currentNovel;
            }
            if ($novelMenuNav) {
                $novelMenuNav.style.display = 'block';
            }

            // 장르 태그는 novelInfoManager에서 가져오기
            if (novelInfoManager && novelInfoManager.novelData) {
                const genres = novelInfoManager.novelData.genreTags || [];
                if ($currentNovelGenres) {
                    if (genres.length > 0) {
                        $currentNovelGenres.innerHTML = genres.map(g => `<span class="badge bg-secondary me-1">${g}</span>`).join('');
                    } else {
                        $currentNovelGenres.textContent = '-';
                    }
                }
            }
        } else {
            if ($currentNovelHeader) {
                $currentNovelHeader.style.display = 'none';
            }
            if ($novelMenuNav) {
                $novelMenuNav.style.display = 'none';
            }
        }
    }

    // 로그인 정보 변경 시 사용자 정보 업데이트
    if ($loginInfo) {
        $loginInfo.addEventListener('input', updateUserInfo);
        $loginInfo.addEventListener('change', updateUserInfo);
    }

    // 메뉴 버튼 클릭 이벤트
    if ($novelMenuNav) {
        $novelMenuNav.addEventListener('click', (e) => {
            if (e.target.dataset.menu) {
                const menu = e.target.dataset.menu;
                
                // 모든 버튼 비활성화
                $novelMenuNav.querySelectorAll('button').forEach(btn => {
                    btn.classList.remove('active');
                    btn.classList.add('btn-outline-secondary');
                    btn.classList.remove('btn-outline-primary');
                });

                // 클릭한 버튼 활성화
                e.target.classList.add('active');
                e.target.classList.remove('btn-outline-secondary');
                e.target.classList.add('btn-outline-primary');

                // 메뉴에 따라 다른 동작
                if (menu === 'info') {
                    // 소설 메인 정보 표시
                    const infoPane = document.getElementById('info-pane');
                    const attributesPane = document.getElementById('attributes-pane');
                    if (infoPane) {
                        infoPane.classList.add('show', 'active');
                    }
                    if (attributesPane) {
                        attributesPane.classList.remove('show', 'active');
                    }
                } else {
                    // 다른 메뉴는 속성 편집 탭으로 이동
                    const infoPane = document.getElementById('info-pane');
                    const attributesPane = document.getElementById('attributes-pane');
                    if (infoPane) {
                        infoPane.classList.remove('show', 'active');
                    }
                    if (attributesPane) {
                        attributesPane.classList.add('show', 'active');
                    }
                }
            }
        });
    }

    /**
     * 네이버 로그인
     */
    function handleNaverLogin() {
        // 서버의 네이버 로그인 API로 리다이렉트 (state에 버전 정보 포함)
        const serverUrl = getServerUrl('/api/auth/naver?state=novel_manager_v1.0.7');
        window.location.href = serverUrl;
    }

    /**
     * 네이버 로그인 콜백 처리
     */
    function handleNaverLoginCallback() {
        const urlParams = new URLSearchParams(window.location.search);
        const error = urlParams.get('error');
        const userInfo = urlParams.get('userInfo');
        const token = urlParams.get('token');

        if (error) {
            addLog('error', `네이버 로그인 오류: ${decodeURIComponent(error)}`);
            // URL에서 에러 파라미터 제거
            window.history.replaceState({}, document.title, window.location.pathname);
            return;
        }

        if (userInfo) {
            try {
                const user = JSON.parse(decodeURIComponent(userInfo));
                // 제공자 정보 확인 (URL 경로 또는 파라미터에서)
                let provider = urlParams.get('provider');
                if (!provider) {
                    // URL 경로에서 provider 추출 시도 (예: /api/auth/naver/callback)
                    const pathMatch = window.location.pathname.match(/\/api\/auth\/(\w+)\/callback/);
                    if (pathMatch) {
                        provider = pathMatch[1];
                    } else {
                        provider = 'naver'; // 기본값은 naver
                    }
                }
                
                // 사용자 정보 저장 (제공자별로 구분)
                sessionStorage.setItem('naverUser', JSON.stringify(user));
                sessionStorage.setItem('loginProvider', provider); // 로그인 제공자 저장
                if (token) {
                    sessionStorage.setItem('authToken', token);
                }
                
                // 사용자 정보 표시
                const userNameDisplay = document.getElementById('userNameDisplay');
                const userEmailDisplay = document.getElementById('userEmailDisplay');
                const displayUserName = document.getElementById('displayUserName');
                
                if (userNameDisplay) {
                    userNameDisplay.textContent = user.nickname || user.name || '호떡';
                }
                if (userEmailDisplay) {
                    userEmailDisplay.textContent = user.email || '';
                }
                if (displayUserName) {
                    displayUserName.textContent = user.nickname || user.name || '호떡';
                }
                if ($userName) {
                    $userName.textContent = user.nickname || user.name || '호떡';
                }
                const userInfoContainer = document.getElementById('userInfoContainer');
                if (userInfoContainer) {
                    userInfoContainer.style.display = 'flex';
                }
                if ($userInfo) {
                    $userInfo.style.display = 'block';
                }
                if ($naverLoginBtn) {
                    $naverLoginBtn.style.display = 'none';
                }
                if ($logoutBtn) {
                    $logoutBtn.style.display = 'block';
                }

                // 로그인 정보 필드에 사용자 정보 설정
                const loginText = `${user.nickname || user.name || '호떡'}/${user.id || ''}`;
                if ($loginInfo) {
                    $loginInfo.value = loginText;
                }

                // 사용자 BIT 계산
                updateUserInfo();

                addLog('success', `네이버 로그인 성공: ${user.nickname || user.name}`);
                
                // URL에서 파라미터 제거
                window.history.replaceState({}, document.title, window.location.pathname);
            } catch (e) {
                addLog('error', `사용자 정보 파싱 오류: ${e.message}`);
            }
        }
    }

    /**
     * 로그인 상태 확인
     */
    function checkLoginStatus() {
        const naverUser = sessionStorage.getItem('naverUser');
        if (naverUser) {
            try {
                const user = JSON.parse(naverUser);
                const userNameDisplay = document.getElementById('userNameDisplay');
                const userEmailDisplay = document.getElementById('userEmailDisplay');
                const displayUserName = document.getElementById('displayUserName');
                
                if (userNameDisplay) {
                    userNameDisplay.textContent = user.nickname || user.name || '호떡';
                }
                if (userEmailDisplay) {
                    userEmailDisplay.textContent = user.email || '';
                }
                if (displayUserName) {
                    displayUserName.textContent = user.nickname || user.name || '호떡';
                }
                if ($userName) {
                    $userName.textContent = user.nickname || user.name || '호떡';
                }
                const userInfoContainer = document.getElementById('userInfoContainer');
                if (userInfoContainer) {
                    userInfoContainer.style.display = 'flex';
                }
                if ($userInfo) {
                    $userInfo.style.display = 'block';
                }
                if ($naverLoginBtn) {
                    $naverLoginBtn.style.display = 'none';
                }
                if ($logoutBtn) {
                    $logoutBtn.style.display = 'block';
                }

                const loginText = `${user.nickname || user.name || '호떡'}/${user.id || ''}`;
                if ($loginInfo) {
                    $loginInfo.value = loginText;
                }

                updateUserInfo();
            } catch (e) {
                addLog('error', `로그인 상태 확인 오류: ${e.message}`);
            }
        }
    }

    // 네이버 로그인 버튼
    if ($naverLoginBtn) {
        $naverLoginBtn.addEventListener('click', handleNaverLogin);
    }

    // 로그아웃 버튼
    if ($logoutBtn) {
        $logoutBtn.addEventListener('click', () => {
            sessionStorage.removeItem('naverUser');
            sessionStorage.removeItem('authToken');
            sessionStorage.removeItem('loginProvider');
            if ($loginInfo) {
                $loginInfo.value = '';
            }
            if ($userName) {
                $userName.textContent = '호떡';
            }
            if ($userBit) {
                $userBit.textContent = '사용자 BIT: 계산 중...';
            }
            const userInfoContainer = document.getElementById('userInfoContainer');
            if (userInfoContainer) {
                userInfoContainer.style.display = 'none';
            }
            if ($userInfo) {
                $userInfo.style.display = 'none';
            }
            if ($naverLoginBtn) {
                $naverLoginBtn.style.display = 'block';
            }
            if ($logoutBtn) {
                $logoutBtn.style.display = 'none';
            }
            const displayUserName = document.getElementById('displayUserName');
            if (displayUserName) {
                displayUserName.textContent = '-';
            }
            currentNovel = null;
            currentChapter = null;
            updateCurrentNovelHeader();
            if ($novelInfoContainer) {
                $novelInfoContainer.innerHTML = '<div class="text-muted text-center py-5">소설을 선택하면 메인 정보가 표시됩니다.</div>';
            }
            addLog('info', '로그아웃되었습니다.');
        });
    }

    // 페이지 로드 시 네이버 로그인 콜백 처리
    handleNaverLoginCallback();
    checkLoginStatus();

    // 초기 사용자 정보 업데이트
    updateUserInfo();

    // 키 설정 모달 제어
    (function() {
        const settingsModal = document.getElementById('settingsModal');
        const closeSettingsModal = document.getElementById('closeSettingsModal');
        const saveGptKeyBtn = document.getElementById('saveGptKeyBtn');
        const saveOAuthConfigBtn = document.getElementById('saveOAuthConfigBtn');
        const gptApiKeyInput = document.getElementById('gptApiKeyInput');
        const settingsBtn = document.getElementById('settingsBtn');
        
        // 설정 모달 열기
        function openSettingsModal() {
            if (settingsModal) {
                settingsModal.style.display = 'flex';
                document.body.style.overflow = 'hidden';
                loadSettings();
            }
        }
        
        // 설정 모달 닫기
        function closeSettingsModalFunc() {
            if (settingsModal) {
                settingsModal.style.display = 'none';
                document.body.style.overflow = '';
            }
        }
        
        // 설정 불러오기
        async function loadSettings() {
            const baseUrl = getServerUrl('');
            
            // GPT API 키 불러오기
            try {
                const gptResponse = await fetch(`${baseUrl}/api/gpt/key`);
                if (gptResponse.ok) {
                    const gptData = await gptResponse.json();
                    if (gptData.ok && gptData.apiKey && gptApiKeyInput) {
                        gptApiKeyInput.value = gptData.apiKey;
                    }
                }
            } catch (e) {
                addLog('error', `GPT API 키 불러오기 오류: ${e.message}`);
            }
            
            // OAuth 설정 불러오기
            try {
                const oauthResponse = await fetch(`${baseUrl}/api/auth/config`);
                if (oauthResponse.ok) {
                    const oauthData = await oauthResponse.json();
                    if (oauthData.ok && oauthData.config) {
                        const cfg = oauthData.config;
                        
                        // Naver
                        const naverClientId = document.getElementById('naverClientId');
                        const naverClientSecret = document.getElementById('naverClientSecret');
                        const naverRedirectUri = document.getElementById('naverRedirectUri');
                        if (naverClientId && cfg.naver) {
                            naverClientId.value = cfg.naver.clientId || '';
                            if (naverClientSecret) {
                                naverClientSecret.value = cfg.naver.clientSecret || '';
                            }
                            if (naverRedirectUri) {
                                naverRedirectUri.value = cfg.naver.redirectUri || 'http://127.0.0.1:8123/api/auth/naver/callback';
                            }
                        }
                    }
                }
            } catch (e) {
                addLog('error', `OAuth 설정 불러오기 오류: ${e.message}`);
            }
        }
        
        // GPT API 키 저장
        async function saveGptKey() {
            if (!gptApiKeyInput) return;
            
            const apiKey = gptApiKeyInput.value.trim();
            if (!apiKey) {
                addLog('error', 'API 키를 입력해주세요.');
                return;
            }
            
            const baseUrl = getServerUrl('');
            
            try {
                const response = await fetch(`${baseUrl}/api/gpt/key`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ apiKey })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.ok) {
                        addLog('success', 'GPT API 키가 저장되었습니다.');
                    } else {
                        addLog('error', `저장 실패: ${data.error || '알 수 없는 오류'}`);
                    }
                } else {
                    addLog('error', '저장 실패: 서버 오류');
                }
            } catch (e) {
                addLog('error', `GPT API 키 저장 오류: ${e.message}`);
            }
        }
        
        // OAuth 설정 저장
        async function saveOAuthConfig() {
            const baseUrl = getServerUrl('');
            
            const naverClientId = document.getElementById('naverClientId')?.value.trim() || '';
            const naverClientSecret = document.getElementById('naverClientSecret')?.value.trim() || '';
            const naverRedirectUri = document.getElementById('naverRedirectUri')?.value.trim() || '';
            
            const payload = {
                naver: {
                    clientId: naverClientId,
                    clientSecret: naverClientSecret,
                    redirectUri: naverRedirectUri || 'http://127.0.0.1:8123/api/auth/naver/callback'
                }
            };
            
            try {
                const response = await fetch(`${baseUrl}/api/auth/config`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.ok) {
                        addLog('success', 'OAuth 설정이 저장되었습니다.');
                    } else {
                        addLog('error', `저장 실패: ${data.error || '알 수 없는 오류'}`);
                    }
                } else {
                    addLog('error', '저장 실패: 서버 오류');
                }
            } catch (e) {
                addLog('error', `OAuth 설정 저장 오류: ${e.message}`);
            }
        }
        
        // 이벤트 리스너
        if (closeSettingsModal) {
            closeSettingsModal.addEventListener('click', closeSettingsModalFunc);
        }
        
        if (settingsModal) {
            settingsModal.addEventListener('click', function(e) {
                if (e.target === settingsModal) {
                    closeSettingsModalFunc();
                }
            });
        }
        
        if (saveGptKeyBtn) {
            saveGptKeyBtn.addEventListener('click', saveGptKey);
        }
        
        if (saveOAuthConfigBtn) {
            saveOAuthConfigBtn.addEventListener('click', saveOAuthConfig);
        }
        
        if (settingsBtn) {
            settingsBtn.addEventListener('click', openSettingsModal);
        }
        
        // ESC 키로 모달 닫기
        document.addEventListener('keydown', function(e) {
            if (e.key === 'Escape' && settingsModal && settingsModal.style.display === 'flex') {
                closeSettingsModalFunc();
            }
        });
        
        // 전역 함수로 노출
        window.openSettingsModal = openSettingsModal;
    })();

    /**
     * 속성 경로 생성
     */
    function buildAttributePath(attributeName) {
        const parts = [];
        if (currentNovel) {
            parts.push(currentNovel);
        }
        if (currentChapter) {
            parts.push(currentChapter);
        }
        if (attributeName) {
            parts.push(attributeName);
        }
        return parts.join(' → ');
    }

    /**
     * 현재 경로 업데이트
     */
    function updateCurrentPath() {
        if ($currentPath) {
            const path = buildAttributePath('');
            $currentPath.innerHTML = `<small>경로: ${path || '선택된 항목이 없습니다.'}</small>`;
        }
    }

    /**
     * 소설 목록 로드 (서버에서)
     */
    async function loadNovels() {
        try {
            addLog('info', '[소설 목록] 로드 시작...');
            const response = await fetch(getServerUrl('/api/attributes/all'));
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const data = await response.json();
            
            if (data.ok && data.attributes) {
                allAttributes = data.attributes;
                
                // 속성에서 소설 구조 추출
                const novelMap = new Map();
                
                for (const attr of data.attributes) {
                    const attrText = (attr.text || '').trim();
                    if (!attrText || !attrText.includes(' → ')) continue;
                    
                    const parts = attrText.split(' → ').map(p => p.trim()).filter(Boolean);
                    if (parts.length < 2) continue;
                    
                    const novelTitle = parts[0];
                    const chapterPart = parts[1];
                    
                    if (!novelMap.has(novelTitle)) {
                        novelMap.set(novelTitle, {
                            title: novelTitle,
                            chapters: new Map()
                        });
                    }
                    
                    const novel = novelMap.get(novelTitle);
                    const chapterMatch = chapterPart.match(/챕터\s*(\d+)(?:\s*[:：]\s*(.+))?/i);
                    if (chapterMatch) {
                        const chapterNum = chapterMatch[1];
                        const chapterTitle = chapterMatch[2] || `제${chapterNum}장`;
                        const chapterKey = `챕터 ${chapterNum}`;
                        
                        if (!novel.chapters.has(chapterKey)) {
                            novel.chapters.set(chapterKey, {
                                number: chapterNum,
                                title: chapterTitle
                            });
                        }
                    }
                }
                
                // 트리 렌더링
                renderNovelTree(Array.from(novelMap.values()));
                addLog('success', `[소설 목록] 로드 완료: ${novelMap.size}개 소설`);
            } else {
                addLog('info', '[소설 목록] 저장된 소설 없음');
                $novelTree.innerHTML = '<div class="text-muted small">저장된 소설이 없습니다.</div>';
            }
        } catch (error) {
            addLog('error', `[소설 목록] 로드 오류: ${error.message}`);
            console.error('소설 목록 로드 오류:', error);
        }
    }

    /**
     * 소설 트리 렌더링
     */
    function renderNovelTree(novels) {
        if (!$novelTree) return;
        
        if (novels.length === 0) {
            $novelTree.innerHTML = '<div class="text-muted small">저장된 소설이 없습니다.</div>';
            return;
        }

        const html = novels.map(novel => {
            const chapters = Array.from(novel.chapters.values());
            const chaptersHtml = chapters.map(ch => {
                return `
                    <div class="tree-item-children">
                        <div class="tree-item" data-novel="${novel.title}" data-chapter="${ch.number}">
                            <span class="tree-toggle">📄</span>
                            챕터 ${ch.number}: ${ch.title}
                        </div>
                    </div>
                `;
            }).join('');
            
            return `
                <div class="tree-item" data-novel="${novel.title}">
                    <span class="tree-toggle">📁</span>
                    ${novel.title}
                </div>
                ${chaptersHtml}
            `;
        }).join('');

        $novelTree.innerHTML = html;

        // 클릭 이벤트
        $novelTree.querySelectorAll('.tree-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                
                const novelTitle = item.dataset.novel;
                const chapterNum = item.dataset.chapter;
                
                if (novelTitle) {
                    if (chapterNum) {
                        // 챕터 선택
                        currentNovel = novelTitle;
                        currentChapter = `챕터 ${chapterNum}`;
                        addLog('info', `[선택] 챕터: ${currentNovel} → ${currentChapter}`);
                        
                        // 속성 편집 탭으로 전환
                        const attributesTab = document.getElementById('attributes-tab');
                        if (attributesTab) {
                            const tab = new bootstrap.Tab(attributesTab);
                            tab.show();
                        }
                        
                        updateCurrentPath();
                        renderAttributeInputs();
                    } else {
                        // 소설 선택
                        currentNovel = novelTitle;
                        currentChapter = null;
                        addLog('info', `[선택] 소설: ${currentNovel}`);
                        
                        // 소설 메인 정보 탭으로 전환
                        const infoTab = document.getElementById('info-tab');
                        if (infoTab) {
                            const tab = new bootstrap.Tab(infoTab);
                            tab.show();
                        }
                        
                        // 소설 정보 로드 및 표시
                        loadNovelInfo();
                        updateCurrentNovelHeader();
                    }
                    
                    // 활성화 표시
                    $novelTree.querySelectorAll('.tree-item').forEach(i => i.classList.remove('active'));
                    item.classList.add('active');
                }
            });
        });
    }

    /**
     * 속성 입력란 렌더링
     */
    function renderAttributeInputs() {
        if (!$attributeInputs) return;
        
        if (!currentNovel) {
            $attributeInputs.innerHTML = '<div class="text-muted text-center py-5">소설을 선택하세요.</div>';
            return;
        }

        // 기본 속성 목록 + 프롤로그 (챕터가 없을 때)
        const attributesToShow = currentChapter ? DEFAULT_ATTRIBUTES : ['프롤로그', ...DEFAULT_ATTRIBUTES];
        
        // 기존 에디터 정리
        attributeEditors.clear();
        
        // 속성 입력란 생성 (비동기)
        $attributeInputs.innerHTML = '<div class="text-center py-3"><div class="spinner-border" role="status"></div> <span class="ms-2">속성 입력란 생성 중...</span></div>';
        
        // 각 속성에 대해 에디터 생성 및 데이터 로드
        const editorPromises = attributesToShow.map(async (attrName) => {
            const attributePath = buildAttributePath(attrName);
            const editor = new AttributeEditor(attrName, attributePath, handleSave, addLog);
            attributeEditors.set(attrName, editor);
            
            // 데이터 로드
            await editor.loadData();
            
            return editor.createInputElement();
        });
        
        Promise.all(editorPromises).then(elements => {
            $attributeInputs.innerHTML = '';
            elements.forEach(element => {
                $attributeInputs.appendChild(element);
            });
            addLog('success', `[속성 입력란] ${attributesToShow.length}개 생성 완료`);
        }).catch(error => {
            addLog('error', `[속성 입력란] 생성 오류: ${error.message}`);
            $attributeInputs.innerHTML = '<div class="alert alert-danger">속성 입력란 생성 중 오류가 발생했습니다.</div>';
        });
    }

    /**
     * 저장 핸들러
     */
    async function handleSave(editor) {
        // 저장은 AttributeEditor에서 처리
        addLog('info', `[저장 요청] ${editor.attributeName}`);
    }

    /**
     * 새 소설 생성
     */
    (function() {
        const cancelNewNovelBtn = document.getElementById('cancelNewNovelBtn');
        const createNovelBtn = document.getElementById('createNovelBtn');
        const newNovelTitleInput = document.getElementById('newNovelTitleInput');
        const newNovelAttributePathInput = document.getElementById('newNovelAttributePathInput');
        const newNovelTopPathInput = document.getElementById('newNovelTopPathInput');
        const newNovelTopDataInput = document.getElementById('newNovelTopDataInput');
        const newNovelTopMaxOutput = document.getElementById('newNovelTopMaxOutput');
        const newNovelTopMinOutput = document.getElementById('newNovelTopMinOutput');
        const newNovelAttributePathDisplay = document.getElementById('newNovelAttributePathDisplay');
        const newNovelAttributeDataInput = document.getElementById('newNovelAttributeDataInput');
        const newNovelAttributeMaxOutput = document.getElementById('newNovelAttributeMaxOutput');
        const newNovelAttributeMinOutput = document.getElementById('newNovelAttributeMinOutput');
        const newNovelResultContent = document.getElementById('newNovelResultContent');
        const newNovelPane = document.getElementById('newNovel-pane');
        const infoPane = document.getElementById('info-pane');
        const attributesPane = document.getElementById('attributes-pane');
        
        // 최상위 경로 추출 함수
        function extractTopPath(attributePath) {
            if (!attributePath || !attributePath.trim()) {
                return '';
            }
            const parts = attributePath.split(' → ').map(p => p.trim()).filter(Boolean);
            if (parts.length >= 2) {
                // 마지막 부분을 제거하여 최상위 경로 생성
                return parts.slice(0, -1).join(' → ');
            }
            return '';
        }
        
        // BIT 계산 함수 (최상위 경로용)
        async function calculateBitForTopPath(topPath) {
            if (!topPath || !topPath.trim()) {
                if (newNovelTopMaxOutput) newNovelTopMaxOutput.textContent = '-';
                if (newNovelTopMinOutput) newNovelTopMinOutput.textContent = '-';
                return Promise.resolve(null);
            }
            
            try {
                // novel_ai_shared.js의 calculateBitValues 함수 사용 (우선)
                const Shared = window.NovelAIShared;
                if (Shared && Shared.calculateBitValues) {
                    const bits = Shared.calculateBitValues(topPath.trim());
                    if (bits && bits.max !== undefined && bits.min !== undefined) {
                        if (newNovelTopMaxOutput) {
                            newNovelTopMaxOutput.textContent = bits.max.toString();
                        }
                        if (newNovelTopMinOutput) {
                            newNovelTopMinOutput.textContent = bits.min.toString();
                        }
                        return Promise.resolve({ max: bits.max, min: bits.min });
                    }
                }
                
                // fallback: Web Worker 사용
                if (typeof Worker !== 'undefined' && window.BitWorker) {
                    return new Promise((resolve) => {
                        const worker = new window.BitWorker();
                        worker.postMessage({ text: topPath.trim() });
                        worker.onmessage = (e) => {
                            const { max, min } = e.data;
                            if (newNovelTopMaxOutput) {
                                newNovelTopMaxOutput.textContent = max.toString();
                            }
                            if (newNovelTopMinOutput) {
                                newNovelTopMinOutput.textContent = min.toString();
                            }
                            resolve({ max, min });
                        };
                        worker.onerror = () => {
                            if (newNovelTopMaxOutput) newNovelTopMaxOutput.textContent = '-';
                            if (newNovelTopMinOutput) newNovelTopMinOutput.textContent = '-';
                            resolve(null);
                        };
                    });
                } else {
                    // fallback: 서버 API 사용
                    const baseUrl = getServerUrl('');
                    const response = await fetch(`${baseUrl}/api/attributes/data`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            attributeText: topPath.trim(),
                            text: '',
                            novelTitle: ''
                        })
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        if (data.ok && data.attributeBit) {
                            const max = data.attributeBit.max || 0;
                            const min = data.attributeBit.min || 0;
                            if (newNovelTopMaxOutput) {
                                newNovelTopMaxOutput.textContent = max.toString();
                            }
                            if (newNovelTopMinOutput) {
                                newNovelTopMinOutput.textContent = min.toString();
                            }
                            return Promise.resolve({ max, min });
                        }
                    }
                }
            } catch (e) {
                console.error('[BIT 계산] 오류:', e);
                addTopPathLog('error', `BIT 계산 오류: ${e.message}`);
            }
            
            if (newNovelTopMaxOutput) newNovelTopMaxOutput.textContent = '-';
            if (newNovelTopMinOutput) newNovelTopMinOutput.textContent = '-';
            return Promise.resolve(null);
        }
        
        // BIT 계산 함수 (속성 경로용)
        async function calculateBitForAttributePath(attributePath) {
            if (!attributePath || !attributePath.trim()) {
                if (newNovelAttributeMaxOutput) newNovelAttributeMaxOutput.textContent = '-';
                if (newNovelAttributeMinOutput) newNovelAttributeMinOutput.textContent = '-';
                return null;
            }
            
            try {
                // novel_ai_shared.js의 calculateBitValues 함수 사용 (우선)
                const Shared = window.NovelAIShared;
                if (Shared && Shared.calculateBitValues) {
                    const bits = Shared.calculateBitValues(attributePath.trim());
                    if (bits && bits.max !== undefined && bits.min !== undefined) {
                        if (newNovelAttributeMaxOutput) {
                            newNovelAttributeMaxOutput.textContent = bits.max.toString();
                        }
                        if (newNovelAttributeMinOutput) {
                            newNovelAttributeMinOutput.textContent = bits.min.toString();
                        }
                        console.log('[BIT 계산] 완료:', { max: bits.max, min: bits.min, path: attributePath });
                        return { max: bits.max, min: bits.min };
                    }
                }
                
                // fallback: Web Worker 사용
                if (typeof Worker !== 'undefined' && window.BitWorker) {
                    return new Promise((resolve) => {
                        const worker = new window.BitWorker();
                        worker.postMessage({ text: attributePath.trim() });
                        worker.onmessage = (e) => {
                            const { max, min } = e.data;
                            if (newNovelAttributeMaxOutput) {
                                newNovelAttributeMaxOutput.textContent = max.toString();
                            }
                            if (newNovelAttributeMinOutput) {
                                newNovelAttributeMinOutput.textContent = min.toString();
                            }
                            resolve({ max, min });
                        };
                        worker.onerror = () => {
                            if (newNovelAttributeMaxOutput) newNovelAttributeMaxOutput.textContent = '-';
                            if (newNovelAttributeMinOutput) newNovelAttributeMinOutput.textContent = '-';
                            resolve(null);
                        };
                    });
                } else {
                    // fallback: 서버 API 사용
                    const baseUrl = getServerUrl('');
                    const response = await fetch(`${baseUrl}/api/attributes/data`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            attributeText: attributePath.trim(),
                            text: '',
                            novelTitle: ''
                        })
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        if (data.ok && data.attributeBit) {
                            const max = data.attributeBit.max || 0;
                            const min = data.attributeBit.min || 0;
                            if (newNovelAttributeMaxOutput) {
                                newNovelAttributeMaxOutput.textContent = max.toString();
                            }
                            if (newNovelAttributeMinOutput) {
                                newNovelAttributeMinOutput.textContent = min.toString();
                            }
                            return { max, min };
                        }
                    }
                }
            } catch (e) {
                console.error('[BIT 계산] 오류:', e);
                addLog('error', `BIT 계산 오류: ${e.message}`);
            }
            
            if (newNovelAttributeMaxOutput) newNovelAttributeMaxOutput.textContent = '-';
            if (newNovelAttributeMinOutput) newNovelAttributeMinOutput.textContent = '-';
            return null;
        }
        
        // 새 소설 만들기 화면 표시
        function showNewNovelPane() {
            if (newNovelPane) {
                newNovelPane.classList.add('show', 'active');
            }
            if (infoPane) {
                infoPane.classList.remove('show', 'active');
            }
            if (attributesPane) {
                attributesPane.classList.remove('show', 'active');
            }
            if (newNovelTitleInput) {
                newNovelTitleInput.value = '';
            }
            if (newNovelAttributePathInput) {
                // 로그인한 경우 제공자 닉네임으로 초기값 설정
                const loginInfo = getLoginInfo();
                if (loginInfo) {
                    // 로그인한 경우: "제공자 닉네임 → 호떡 → " 형식
                    newNovelAttributePathInput.value = `${loginInfo.fullName} → 호떡 → `;
                } else {
                    // 로그인하지 않은 경우: "호떡 → " 형식
                    newNovelAttributePathInput.value = '호떡 → ';
                }
            }
            if (newNovelTopPathInput) {
                newNovelTopPathInput.value = '';
            }
            if (newNovelTopDataInput) {
                newNovelTopDataInput.value = '';
            }
            if (newNovelTopMaxOutput) {
                newNovelTopMaxOutput.textContent = '-';
            }
            if (newNovelTopMinOutput) {
                newNovelTopMinOutput.textContent = '-';
            }
            if (newNovelAttributePathDisplay) {
                newNovelAttributePathDisplay.value = '';
            }
            if (newNovelAttributeDataInput) {
                newNovelAttributeDataInput.value = '';
            }
            if (newNovelAttributeMaxOutput) {
                newNovelAttributeMaxOutput.textContent = '-';
            }
            if (newNovelAttributeMinOutput) {
                newNovelAttributeMinOutput.textContent = '-';
            }
            if (newNovelResultContent) {
                newNovelResultContent.textContent = '소설 정보를 입력하고 생성 버튼을 누르면 저장 정보가 표시됩니다.';
            }
            setTimeout(() => {
                if (newNovelTitleInput) newNovelTitleInput.focus();
            }, 100);
        }
        
        // 새 소설 만들기 화면 닫기
        function hideNewNovelPane() {
            if (newNovelPane) {
                newNovelPane.classList.remove('show', 'active');
            }
            if (infoPane) {
                infoPane.classList.add('show', 'active');
            }
            if (newNovelTitleInput) {
                newNovelTitleInput.value = '';
            }
            if (newNovelAttributePathInput) {
                newNovelAttributePathInput.value = '';
            }
            if (newNovelTopPathInput) {
                newNovelTopPathInput.value = '';
            }
            if (newNovelTopDataInput) {
                newNovelTopDataInput.value = '';
            }
            if (newNovelAttributePathDisplay) {
                newNovelAttributePathDisplay.value = '';
            }
            if (newNovelAttributeDataInput) {
                newNovelAttributeDataInput.value = '';
            }
        }
        
        // BIT 계산 함수 (클라이언트 측)
        async function calculateBitForAttributePath(attributePath) {
            if (!attributePath || !attributePath.trim()) {
                if (newNovelAttributeMaxOutput) newNovelAttributeMaxOutput.textContent = '-';
                if (newNovelAttributeMinOutput) newNovelAttributeMinOutput.textContent = '-';
                return null;
            }
            
            try {
                // novel_ai_shared.js의 calculateBitValues 함수 사용 (우선)
                const Shared = window.NovelAIShared;
                if (Shared && Shared.calculateBitValues) {
                    const bits = Shared.calculateBitValues(attributePath.trim());
                    if (bits && bits.max !== undefined && bits.min !== undefined) {
                        if (newNovelAttributeMaxOutput) {
                            newNovelAttributeMaxOutput.textContent = bits.max.toString();
                        }
                        if (newNovelAttributeMinOutput) {
                            newNovelAttributeMinOutput.textContent = bits.min.toString();
                        }
                        console.log('[BIT 계산] 완료:', { max: bits.max, min: bits.min, path: attributePath });
                        return { max: bits.max, min: bits.min };
                    }
                }
                
                // fallback: Web Worker 사용
                if (typeof Worker !== 'undefined' && window.BitWorker) {
                    return new Promise((resolve) => {
                        const worker = new window.BitWorker();
                        worker.postMessage({ text: attributePath.trim() });
                        worker.onmessage = (e) => {
                            const { max, min } = e.data;
                            if (newNovelAttributeMaxOutput) {
                                newNovelAttributeMaxOutput.textContent = max.toString();
                            }
                            if (newNovelAttributeMinOutput) {
                                newNovelAttributeMinOutput.textContent = min.toString();
                            }
                            resolve({ max, min });
                        };
                        worker.onerror = () => {
                            if (newNovelAttributeMaxOutput) newNovelAttributeMaxOutput.textContent = '-';
                            if (newNovelAttributeMinOutput) newNovelAttributeMinOutput.textContent = '-';
                            resolve(null);
                        };
                    });
                } else {
                    // fallback: 서버 API 사용
                    const baseUrl = getServerUrl('');
                    const response = await fetch(`${baseUrl}/api/attributes/data`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ 
                            attributeText: attributePath.trim(),
                            text: '',
                            novelTitle: ''
                        })
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        if (data.ok && data.attributeBit) {
                            const max = data.attributeBit.max || 0;
                            const min = data.attributeBit.min || 0;
                            if (newNovelAttributeMaxOutput) {
                                newNovelAttributeMaxOutput.textContent = max.toString();
                            }
                            if (newNovelAttributeMinOutput) {
                                newNovelAttributeMinOutput.textContent = min.toString();
                            }
                            return { max, min };
                        }
                    }
                }
            } catch (e) {
                addLog('error', `BIT 계산 오류: ${e.message}`);
            }
            
            if (newNovelAttributeMaxOutput) newNovelAttributeMaxOutput.textContent = '-';
            if (newNovelAttributeMinOutput) newNovelAttributeMinOutput.textContent = '-';
            return null;
        }
        
        // 자동 저장 함수
        let autoSaveTimeout = null;
        let isSaving = false;
        let lastSavedData = null;
        
        async function autoSaveNovel() {
            if (isSaving) return;
            
            const novelTitle = newNovelTitleInput ? newNovelTitleInput.value.trim() : '';
            if (!novelTitle) {
                // 제목이 없으면 저장하지 않음
                return;
            }
            
            const attributePath = newNovelAttributePathInput ? newNovelAttributePathInput.value.trim() : '';
            const topPath = newNovelTopPathInput ? newNovelTopPathInput.value.trim() : '';
            const topData = newNovelTopDataInput ? newNovelTopDataInput.value.trim() : '';
            const attributeData = newNovelAttributeDataInput ? newNovelAttributeDataInput.value.trim() : '';
            
            // 마지막 저장된 데이터와 동일하면 저장하지 않음
            const currentData = JSON.stringify({ novelTitle, attributePath, topPath, topData, attributeData });
            if (lastSavedData === currentData) {
                return;
            }
            
            isSaving = true;
            
            try {
                const baseUrl = getServerUrl('');
                
                // 최상위 경로 BIT 계산
                const topBit = topPath ? await calculateBitForTopPath(topPath) : null;
                
                // 속성 경로 BIT 계산
                const attributeBit = attributePath ? await calculateBitForAttributePath(attributePath) : null;
                
                // 최상위 경로 데이터 저장 (데이터가 있는 경우)
                if (topPath && topData && topBit) {
                    try {
                        const Shared = window.NovelAIShared;
                        if (Shared && Shared.saveRecord) {
                            const topDataBits = Shared.calculateBitValues(topData);
                            await Shared.saveRecord(baseUrl, {
                                attributeText: topPath,
                                attributeBitMax: topBit.max,
                                attributeBitMin: topBit.min,
                                text: topData,
                                dataBitMax: topDataBits.max,
                                dataBitMin: topDataBits.min
                            });
                            addTopPathLog('success', `최상위 경로 데이터 저장 완료: ${topPath}`);
                        } else {
                            // fallback: 직접 API 호출
                            const topDataBits = window.NovelAIShared?.calculateBitValues(topData) || { max: 0, min: 0 };
                            await fetch(`${baseUrl}/api/attributes/data`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    attributeText: topPath,
                                    attributeBitMax: topBit.max,
                                    attributeBitMin: topBit.min,
                                    text: topData,
                                    dataBitMax: topDataBits.max,
                                    dataBitMin: topDataBits.min
                                })
                            });
                            addTopPathLog('success', `최상위 경로 데이터 저장 완료: ${topPath}`);
                        }
                    } catch (error) {
                        console.error('[최상위 경로 데이터 저장] 오류:', error);
                        addTopPathLog('error', `최상위 경로 데이터 저장 실패: ${error.message}`);
                    }
                }
                
                // 속성 경로 데이터 저장 (데이터가 있는 경우)
                if (attributePath && attributeData && attributeBit) {
                    try {
                        const Shared = window.NovelAIShared;
                        if (Shared && Shared.saveRecord) {
                            const attributeDataBits = Shared.calculateBitValues(attributeData);
                            await Shared.saveRecord(baseUrl, {
                                attributeText: attributePath,
                                attributeBitMax: attributeBit.max,
                                attributeBitMin: attributeBit.min,
                                text: attributeData,
                                dataBitMax: attributeDataBits.max,
                                dataBitMin: attributeDataBits.min
                            });
                            addLog('success', `속성 경로 데이터 저장 완료: ${attributePath}`);
                        } else {
                            // fallback: 직접 API 호출
                            const attributeDataBits = window.NovelAIShared?.calculateBitValues(attributeData) || { max: 0, min: 0 };
                            await fetch(`${baseUrl}/api/attributes/data`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    attributeText: attributePath,
                                    attributeBitMax: attributeBit.max,
                                    attributeBitMin: attributeBit.min,
                                    text: attributeData,
                                    dataBitMax: attributeDataBits.max,
                                    dataBitMin: attributeDataBits.min
                                })
                            });
                            addLog('success', `속성 경로 데이터 저장 완료: ${attributePath}`);
                        }
                    } catch (error) {
                        console.error('[속성 경로 데이터 저장] 오류:', error);
                        addLog('error', `속성 경로 데이터 저장 실패: ${error.message}`);
                    }
                }
                
                // 서버에 소설 생성/업데이트 요청
                const response = await fetch(`${baseUrl}/api/my/novels`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${sessionStorage.getItem('authToken') || ''}`
                    },
                    body: JSON.stringify({
                        title: novelTitle,
                        attributePath: attributePath,
                        topPath: topPath,
                        topData: topData,
                        attributeData: attributeData
                    })
                });
                
                if (response.ok) {
                    const data = await response.json();
                    if (data.novelBit || data.title) {
                        lastSavedData = currentData;
                        
                        if (newNovelResultContent) {
                            newNovelResultContent.textContent = JSON.stringify({
                                title: data.title || novelTitle,
                                attributePath: data.attributePath || attributePath,
                                topPath: data.topPath || topPath,
                                topData: data.topData || topData,
                                topBitMax: data.topBitMax || topBit?.max || 0,
                                topBitMin: data.topBitMin || topBit?.min || 0,
                                attributeData: data.attributeData || attributeData,
                                attributeBitMax: data.attributeBitMax || attributeBit?.max || 0,
                                attributeBitMin: data.attributeBitMin || attributeBit?.min || 0,
                                savedAt: new Date().toLocaleString('ko-KR')
                            }, null, 2);
                        }
                        addLog('success', `자동 저장 완료: ${novelTitle}`);
                        
                        // 저장 후 데이터 목록 새로고침
                        if (topPath && topData) {
                            await loadTopPathData();
                        }
                        if (attributePath && attributeData) {
                            await loadAttributePathData();
                        }
                        
                        // 현재 소설 업데이트
                        if (!currentNovel || currentNovel !== novelTitle) {
                            currentNovel = novelTitle;
                            currentChapter = null;
                            
                            // 트리 업데이트
                            if ($novelTree) {
                                let treeItem = $novelTree.querySelector(`[data-novel="${novelTitle}"]`);
                                if (!treeItem) {
                                    treeItem = document.createElement('div');
                treeItem.className = 'tree-item';
                treeItem.dataset.novel = currentNovel;
                treeItem.innerHTML = `<span class="tree-toggle">📁</span> ${currentNovel}`;
                treeItem.addEventListener('click', () => {
                                        currentNovel = novelTitle;
                    currentChapter = null;
                    
                                        // 소설 메인 정보 표시
                                        if (infoPane) {
                                            infoPane.classList.add('show', 'active');
                                        }
                                        if (attributesPane) {
                                            attributesPane.classList.remove('show', 'active');
                                        }
                                        if (newNovelPane) {
                                            newNovelPane.classList.remove('show', 'active');
                    }
                    
                    loadNovelInfo();
                                        updateCurrentNovelHeader();
                                        if ($novelTree) {
                    $novelTree.querySelectorAll('.tree-item').forEach(i => i.classList.remove('active'));
                                        }
                    treeItem.classList.add('active');
                });
                $novelTree.appendChild(treeItem);
                                }
                
                // 트리에서 활성화
                $novelTree.querySelectorAll('.tree-item').forEach(i => i.classList.remove('active'));
                treeItem.classList.add('active');
            }
                            
                            // 소설 정보 로드 및 표시
                            updateCurrentNovelHeader();
                        }
                    }
                } else {
                    const errorData = await response.json().catch(() => ({}));
                    addLog('error', `자동 저장 실패: ${errorData.error || '서버 오류'}`);
                }
            } catch (e) {
                addLog('error', `자동 저장 오류: ${e.message}`);
            } finally {
                isSaving = false;
            }
        }
        
        // 소설 생성 (수동 저장 버튼용)
        async function createNovel() {
            await autoSaveNovel();
        }
        
        // 이벤트 리스너
        if ($newNovelBtn) {
            $newNovelBtn.addEventListener('click', showNewNovelPane);
        }
        
        if (cancelNewNovelBtn) {
            cancelNewNovelBtn.addEventListener('click', hideNewNovelPane);
        }
        
        if (createNovelBtn) {
            createNovelBtn.addEventListener('click', createNovel);
        }
        
        // 최상위 경로 데이터 삭제 버튼
        const deleteCurrentTopPathButton = document.getElementById('deleteCurrentTopPathButton');
        if (deleteCurrentTopPathButton) {
            deleteCurrentTopPathButton.addEventListener('click', async function() {
                const topPath = newNovelTopPathInput ? newNovelTopPathInput.value.trim() : '';
                if (!topPath) {
                    addTopPathLog('warning', '최상위 경로가 입력되지 않았습니다.');
                    return;
                }
                
                try {
                    const baseUrl = getServerUrl('');
                    const response = await fetch(`${baseUrl}/api/attributes/delete`, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${sessionStorage.getItem('authToken') || ''}`
                        },
                        body: JSON.stringify({ attributeText: topPath })
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        if (data.ok) {
                            addTopPathLog('success', `최상위 경로 데이터 삭제 완료: ${topPath}`);
                            // 데이터 목록 새로고침
                            loadTopPathData();
                        } else {
                            addTopPathLog('error', data.error || '삭제 실패');
                        }
                    } else {
                        addTopPathLog('error', `삭제 실패: HTTP ${response.status}`);
                    }
                } catch (error) {
                    addTopPathLog('error', `삭제 오류: ${error.message}`);
                }
            });
        }
        
        // 속성 경로 데이터 삭제 버튼
        const deleteCurrentAttributePathButton = document.getElementById('deleteCurrentAttributePathButton');
        if (deleteCurrentAttributePathButton) {
            deleteCurrentAttributePathButton.addEventListener('click', async function() {
                const attributePath = newNovelAttributePathInput ? newNovelAttributePathInput.value.trim() : '';
                if (!attributePath) {
                    addLog('warning', '속성 경로가 입력되지 않았습니다.');
                    return;
                }
                
                try {
                    const baseUrl = getServerUrl('');
                    const response = await fetch(`${baseUrl}/api/attributes/delete`, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${sessionStorage.getItem('authToken') || ''}`
                        },
                        body: JSON.stringify({ attributeText: attributePath })
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        if (data.ok) {
                            addLog('success', `속성 경로 데이터 삭제 완료: ${attributePath}`);
                            // 데이터 목록 새로고침
                            loadAttributePathData();
                        } else {
                            addLog('error', data.error || '삭제 실패');
                        }
                    } else {
                        addLog('error', `삭제 실패: HTTP ${response.status}`);
                    }
                } catch (error) {
                    addLog('error', `삭제 오류: ${error.message}`);
                }
            });
        }
        
        // 데이터 목록 렌더링 함수
        function renderDataList(items, container, logElement, focusAttribute = '') {
            if (!container) return;
            if (!items || items.length === 0) {
                container.innerHTML = '<span style="color:#9aa4d9;">저장된 데이터가 여기 표시됩니다.</span>';
                if (logElement) logElement.textContent = '─';
                return;
            }
            
            if (logElement) {
                logElement.textContent = `[${new Date().toLocaleTimeString('ko-KR')}] ${items.length}개 데이터 표시중`;
            }
            
            const fragment = document.createDocumentFragment();
            items.forEach(item => {
                const text = (item.data?.text || item.dataText || item.text || item.s || '').trim();
                if (!text) return;
                
                const card = document.createElement('div');
                card.className = 'data-item';
                card.textContent = text;
                fragment.appendChild(card);
            });
            
            container.innerHTML = '';
            container.appendChild(fragment);
        }
        
        // 폴더 목록 렌더링 함수
        function renderFolderList(container, folders) {
            if (!container) return;
            if (!folders || folders.length === 0) {
                container.innerHTML = '<span style="color:#7d88c7;">폴더가 없습니다.</span>';
                return;
            }
            
            const fragment = document.createDocumentFragment();
            folders.forEach(folder => {
                const folderPath = folder.folder || '';
                const fileCount = folder.files ?? 0;
                const recordCount = folder.records ?? 0;
                
                const item = document.createElement('div');
                item.className = 'folder-item';
                
                const label = document.createElement('span');
                label.className = 'label';
                label.textContent = folderPath;
                
                const meta = document.createElement('span');
                meta.className = 'meta';
                meta.textContent = `파일 ${fileCount}개 · 레코드 ${recordCount}개`;
                
                item.append(label, meta);
                fragment.appendChild(item);
            });
            
            container.innerHTML = '';
            container.appendChild(fragment);
        }
        
        // 최상위 경로 데이터 로드 함수
        async function loadTopPathData() {
            const topPath = newNovelTopPathInput ? newNovelTopPathInput.value.trim() : '';
            if (!topPath) {
                return;
            }
            
            try {
                addTopPathLog('info', `최상위 경로 데이터 로드 시작: ${topPath}`);
                
                // BIT 계산
                const topBit = await calculateBitForTopPath(topPath);
                if (!topBit) {
                    addTopPathLog('error', 'BIT 계산 실패');
                    return;
                }
                
                const baseUrl = getServerUrl('');
                
                // 데이터 로드
                const dataResponse = await fetch(`${baseUrl}/api/attributes/data?bitMax=${topBit.max}&bitMin=${topBit.min}&attributeText=${encodeURIComponent(topPath)}`);
                
                if (dataResponse.ok) {
                    const data = await dataResponse.json();
                    console.log('[최상위 경로 데이터] API 응답:', data);
                    
                    if (data.ok && data.items) {
                        const items = Array.isArray(data.items) ? data.items : [];
                        const maxItems = [];
                        const minItems = [];
                        
                        items.forEach(item => {
                            const sourcePath = (item.source?.file || '').toLowerCase();
                            // MAX/MIN 폴더 구분
                            if (sourcePath.includes('/max/') || sourcePath.includes('\\max\\') || sourcePath.includes('/max_bit/') || sourcePath.includes('\\max_bit\\')) {
                                maxItems.push(item);
                            }
                            if (sourcePath.includes('/min/') || sourcePath.includes('\\min\\') || sourcePath.includes('/min_bit/') || sourcePath.includes('\\min_bit\\')) {
                                minItems.push(item);
                            }
                            // source 정보가 없으면 모든 아이템을 MAX에 추가 (기본값)
                            if (!sourcePath && items.length > 0 && maxItems.length === 0 && minItems.length === 0) {
                                maxItems.push(item);
                            }
                        });
                        
                        console.log('[최상위 경로 데이터] 필터링 결과:', { total: items.length, max: maxItems.length, min: minItems.length });
                        
                        renderDataList(maxItems, document.getElementById('newNovelTopDataListMax'), document.getElementById('newNovelTopLogMax'), topPath);
                        renderDataList(minItems, document.getElementById('newNovelTopDataListMin'), document.getElementById('newNovelTopLogMin'), topPath);
                        
                        addTopPathLog('success', `데이터 로드 완료: MAX ${maxItems.length}개, MIN ${minItems.length}개`);
                    } else {
                        addTopPathLog('info', '저장된 데이터가 없습니다.');
                        // 빈 상태로 렌더링
                        renderDataList([], document.getElementById('newNovelTopDataListMax'), document.getElementById('newNovelTopLogMax'), topPath);
                        renderDataList([], document.getElementById('newNovelTopDataListMin'), document.getElementById('newNovelTopLogMin'), topPath);
                    }
                } else {
                    addTopPathLog('error', `데이터 로드 실패: HTTP ${dataResponse.status}`);
                }
                
                // 폴더 정보 로드
                addTopPathLog('info', '폴더 정보 로드 시작...');
                const folderResponse = await fetch(`${baseUrl}/api/tests/folders`);
                if (folderResponse.ok) {
                    const folderData = await folderResponse.json();
                    console.log('[최상위 경로 폴더] API 응답:', folderData);
                    
                    if (folderData.ok) {
                        renderFolderList(document.getElementById('newNovelTopFoldersMax'), folderData.max || []);
                        renderFolderList(document.getElementById('newNovelTopFoldersMin'), folderData.min || []);
                        const maxFolders = (folderData.max || []).length;
                        const minFolders = (folderData.min || []).length;
                        addTopPathLog('success', `폴더 정보 로드 완료: MAX ${maxFolders}개, MIN ${minFolders}개`);
                    } else {
                        addTopPathLog('error', '폴더 정보 로드 실패');
                        renderFolderList(document.getElementById('newNovelTopFoldersMax'), []);
                        renderFolderList(document.getElementById('newNovelTopFoldersMin'), []);
                    }
                } else {
                    addTopPathLog('error', `폴더 정보 로드 실패: HTTP ${folderResponse.status}`);
                    renderFolderList(document.getElementById('newNovelTopFoldersMax'), []);
                    renderFolderList(document.getElementById('newNovelTopFoldersMin'), []);
                }
            } catch (error) {
                console.error('[최상위 경로 데이터 로드] 오류:', error);
                addTopPathLog('error', `최상위 경로 데이터 로드 실패: ${error.message}`);
            }
        }
        
        // 속성 경로 데이터 로드 함수
        async function loadAttributePathData() {
            const attributePath = newNovelAttributePathInput ? newNovelAttributePathInput.value.trim() : '';
            if (!attributePath) {
                return;
            }
            
            try {
                // BIT 계산
                const attributeBit = await calculateBitForAttributePath(attributePath);
                if (!attributeBit) return;
                
                const baseUrl = getServerUrl('');
                
                // 데이터 로드
                const dataResponse = await fetch(`${baseUrl}/api/attributes/data?bitMax=${attributeBit.max}&bitMin=${attributeBit.min}&attributeText=${encodeURIComponent(attributePath)}`);
                
                if (dataResponse.ok) {
                    const data = await dataResponse.json();
                    console.log('[속성 경로 데이터] API 응답:', data);
                    
                    if (data.ok && data.items) {
                        const items = Array.isArray(data.items) ? data.items : [];
                        const maxItems = [];
                        const minItems = [];
                        
                        items.forEach(item => {
                            const sourcePath = (item.source?.file || '').toLowerCase();
                            // MAX/MIN 폴더 구분
                            if (sourcePath.includes('/max/') || sourcePath.includes('\\max\\') || sourcePath.includes('/max_bit/') || sourcePath.includes('\\max_bit\\')) {
                                maxItems.push(item);
                            }
                            if (sourcePath.includes('/min/') || sourcePath.includes('\\min\\') || sourcePath.includes('/min_bit/') || sourcePath.includes('\\min_bit\\')) {
                                minItems.push(item);
                            }
                            // source 정보가 없으면 모든 아이템을 MAX에 추가 (기본값)
                            if (!sourcePath && items.length > 0 && maxItems.length === 0 && minItems.length === 0) {
                                maxItems.push(item);
                            }
                        });
                        
                        console.log('[속성 경로 데이터] 필터링 결과:', { total: items.length, max: maxItems.length, min: minItems.length });
                        
                        renderDataList(maxItems, document.getElementById('newNovelAttributeDataListMax'), document.getElementById('newNovelAttributeLogMax'), attributePath);
                        renderDataList(minItems, document.getElementById('newNovelAttributeDataListMin'), document.getElementById('newNovelAttributeLogMin'), attributePath);
                    } else {
                        // 빈 상태로 렌더링
                        renderDataList([], document.getElementById('newNovelAttributeDataListMax'), document.getElementById('newNovelAttributeLogMax'), attributePath);
                        renderDataList([], document.getElementById('newNovelAttributeDataListMin'), document.getElementById('newNovelAttributeLogMin'), attributePath);
                    }
                }
                
                // 폴더 정보 로드
                const folderResponse = await fetch(`${baseUrl}/api/tests/folders`);
                if (folderResponse.ok) {
                    const folderData = await folderResponse.json();
                    if (folderData.ok) {
                        renderFolderList(document.getElementById('newNovelAttributeFoldersMax'), folderData.max || []);
                        renderFolderList(document.getElementById('newNovelAttributeFoldersMin'), folderData.min || []);
                    } else {
                        renderFolderList(document.getElementById('newNovelAttributeFoldersMax'), []);
                        renderFolderList(document.getElementById('newNovelAttributeFoldersMin'), []);
                    }
                } else {
                    renderFolderList(document.getElementById('newNovelAttributeFoldersMax'), []);
                    renderFolderList(document.getElementById('newNovelAttributeFoldersMin'), []);
                }
            } catch (error) {
                console.error('[속성 경로 데이터 로드] 오류:', error);
                addLog('error', `속성 경로 데이터 로드 실패: ${error.message}`);
            }
        }
        
        // 입력 필드 자동 저장 이벤트
        function setupAutoSave(inputElement) {
            if (!inputElement) return;
            
            inputElement.addEventListener('input', function() {
                clearTimeout(autoSaveTimeout);
                autoSaveTimeout = setTimeout(() => {
                    autoSaveNovel();
                }, 1000); // 1초 디바운스
            });
        }
        
        // 로그인 정보 가져오기 함수 (제공자와 닉네임)
        function getLoginInfo() {
            try {
                const provider = sessionStorage.getItem('loginProvider') || 'naver';
                const naverUserStr = sessionStorage.getItem('naverUser');
                
                if (naverUserStr) {
                    const user = JSON.parse(naverUserStr);
                    // 네이버 API 응답 구조에 따라 nickname, name, id 등을 확인
                    const nickname = user.nickname || user.name || user.id || null;
                    if (nickname) {
                        // 제공자 이름 한글 변환
                        const providerName = {
                            'naver': '네이버',
                            'google': '구글',
                            'kakao': '카카오'
                        }[provider] || provider;
                        
                        console.log('[로그인 정보] 제공자:', providerName, '닉네임:', nickname);
                        return {
                            provider: providerName,
                            nickname: nickname,
                            fullName: `${providerName} 닉네임`
                        };
                    }
                } else {
                    console.log('[로그인 정보] sessionStorage에 사용자 정보가 없습니다.');
                }
            } catch (e) {
                console.error('[로그인 정보] 사용자 정보 파싱 오류:', e);
            }
            // 로그인하지 않은 경우
            console.log('[로그인 정보] 로그인하지 않음, 기본값 사용');
            return null;
        }
        
        // 소설 제목 입력 시 속성 경로 자동 설정 및 최상위 경로 데이터 자동 입력
        if (newNovelTitleInput) {
            let titleInputTimeout;
            newNovelTitleInput.addEventListener('input', function() {
                clearTimeout(titleInputTimeout);
                titleInputTimeout = setTimeout(() => {
                    const novelTitle = newNovelTitleInput.value.trim();
                    
                    // 최상위 경로 데이터 입력 필드에 소설 제목 자동 입력
                    if (novelTitle && newNovelTopDataInput) {
                        newNovelTopDataInput.value = novelTitle;
                    } else if (!novelTitle && newNovelTopDataInput) {
                        newNovelTopDataInput.value = '';
                    }
                    
                    if (novelTitle && newNovelAttributePathInput) {
                        // 속성 경로 필드가 비어있거나 기본값인 경우에만 자동 설정
                        const currentAttributePath = newNovelAttributePathInput.value.trim();
                        const loginInfo = getLoginInfo();
                        
                        if (loginInfo) {
                            // 로그인한 경우: "제공자 닉네임 → 호떡 → 소설 제목" 형식
                            const expectedPath = `${loginInfo.fullName} → 호떡 → ${novelTitle}`;
                            
                            // 속성 경로가 비어있거나, 기존 값이 "제공자 닉네임 →"으로 시작하는 경우에만 업데이트
                            if (!currentAttributePath || currentAttributePath.startsWith(`${loginInfo.fullName} →`)) {
                                newNovelAttributePathInput.value = expectedPath;
                                
                                // BIT 자동 계산 (1초 디바운스는 속성 경로 입력 이벤트에서 처리)
                                // 속성 경로 값이 변경되었으므로 input 이벤트를 트리거하여 BIT 계산
                                const inputEvent = new Event('input', { bubbles: true });
                                newNovelAttributePathInput.dispatchEvent(inputEvent);
                            }
                        } else {
                            // 로그인하지 않은 경우: "호떡 → 소설 제목" 형식
                            const expectedPath = `호떡 → ${novelTitle}`;
                            
                            if (!currentAttributePath || currentAttributePath.startsWith('호떡 →')) {
                                newNovelAttributePathInput.value = expectedPath;
                                
                                // BIT 자동 계산 (1초 디바운스는 속성 경로 입력 이벤트에서 처리)
                                // 속성 경로 값이 변경되었으므로 input 이벤트를 트리거하여 BIT 계산
                                const inputEvent = new Event('input', { bubbles: true });
                                newNovelAttributePathInput.dispatchEvent(inputEvent);
                            }
                        }
                    }
                }, 300); // 300ms 디바운스
            });
        }
        
        // 모든 입력 필드에 자동 저장 설정
        setupAutoSave(newNovelTitleInput);
        setupAutoSave(newNovelAttributePathInput);
        setupAutoSave(newNovelTopDataInput);
        setupAutoSave(newNovelAttributeDataInput);
        
        // 속성 경로 입력 시 최상위 경로와 속성 경로 자동 분리 및 BIT 계산
        if (newNovelAttributePathInput) {
            let calculateTimeout;
            let lastCalculatedPath = '';
            
            newNovelAttributePathInput.addEventListener('input', function() {
                const currentPath = newNovelAttributePathInput.value.trim();
                
                // 값이 변경되지 않았으면 계산하지 않음
                if (currentPath === lastCalculatedPath) {
                    return;
                }
                
                clearTimeout(calculateTimeout);
                
                // 빈 값인 경우 즉시 처리
                if (!currentPath) {
                    if (newNovelTopPathInput) newNovelTopPathInput.value = '';
                    if (newNovelAttributePathDisplay) newNovelAttributePathDisplay.value = '';
                    if (newNovelTopMaxOutput) newNovelTopMaxOutput.textContent = '-';
                    if (newNovelTopMinOutput) newNovelTopMinOutput.textContent = '-';
                    if (newNovelAttributeMaxOutput) newNovelAttributeMaxOutput.textContent = '-';
                    if (newNovelAttributeMinOutput) newNovelAttributeMinOutput.textContent = '-';
                    lastCalculatedPath = '';
                    return;
                }
                
                // 최상위 경로와 속성 경로 분리
                const topPath = extractTopPath(currentPath);
                if (newNovelTopPathInput) {
                    newNovelTopPathInput.value = topPath;
                }
                if (newNovelAttributePathDisplay) {
                    newNovelAttributePathDisplay.value = currentPath;
                }
                
                // 1초 디바운스로 BIT 계산
                calculateTimeout = setTimeout(async () => {
                    const finalPath = newNovelAttributePathInput.value.trim();
                    if (finalPath !== currentPath) {
                        // 입력 중에 값이 변경되었으면 다시 계산하지 않음
                        return;
                    }
                    
                    lastCalculatedPath = finalPath;
                    const finalTopPath = extractTopPath(finalPath);
                    
                    // 최상위 경로 BIT 계산 및 데이터 로드
                    if (finalTopPath) {
                        try {
                            const topBit = await calculateBitForTopPath(finalTopPath);
                            if (topBit) {
                                // BIT 계산 완료 후 데이터 로드
                                await loadTopPathData();
                            }
                        } catch (error) {
                            console.error('[최상위 경로] 오류:', error);
                            addTopPathLog('error', `최상위 경로 처리 오류: ${error.message}`);
                        }
                    }
                    
                    // 속성 경로 BIT 계산 및 데이터 로드
                    try {
                        const attributeBit = await calculateBitForAttributePath(finalPath);
                        if (attributeBit) {
                            // BIT 계산 완료 후 데이터 로드
                            await loadAttributePathData();
                        }
                    } catch (error) {
                        console.error('[속성 경로] 오류:', error);
                        addLog('error', `속성 경로 처리 오류: ${error.message}`);
                    }
                }, 1000); // 1초 디바운스
            });
        }
        
        // Enter 키로 생성
        if (newNovelTitleInput) {
            newNovelTitleInput.addEventListener('keydown', function(e) {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    createNovel();
                } else if (e.key === 'Escape') {
                    hideNewNovelPane();
                }
            });
        }
    })();

    /**
     * 속성 목록 렌더링 (우측 패널)
     */
    function renderAttributeList() {
        if (!$attributeList) return;
        
        const attributes = DEFAULT_ATTRIBUTES.map(name => {
            const div = document.createElement('div');
            div.className = 'attribute-list-item';
            div.textContent = name;
            div.addEventListener('click', () => {
                // 해당 속성으로 스크롤
                const inputGroup = document.getElementById(`attr-${name.replace(/\s+/g, '-')}`);
                if (inputGroup) {
                    inputGroup.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    $attributeList.querySelectorAll('.attribute-list-item').forEach(i => i.classList.remove('active'));
                    div.classList.add('active');
                }
            });
            return div;
        });
        
        $attributeList.innerHTML = '';
        attributes.forEach(attr => $attributeList.appendChild(attr));
    }

    /**
     * 소설 정보 로드 및 표시
     */
    async function loadNovelInfo() {
        if (!currentNovel || !$novelInfoContainer) return;
        
        $novelInfoContainer.innerHTML = '<div class="text-center py-3"><div class="spinner-border" role="status"></div> <span class="ms-2">소설 정보 로드 중...</span></div>';
        
        try {
            novelInfoManager = new NovelInfoManager(currentNovel, addLog);
            await novelInfoManager.loadNovelInfo();
            
            const html = novelInfoManager.createInfoHTML();
            $novelInfoContainer.innerHTML = html;
            
            // 현재 소설 헤더 업데이트
            updateCurrentNovelHeader();
            
            addLog('success', `[소설 정보] 로드 완료: ${currentNovel}`);
        } catch (error) {
            addLog('error', `[소설 정보] 로드 오류: ${error.message}`);
            $novelInfoContainer.innerHTML = '<div class="alert alert-danger">소설 정보를 로드하는 중 오류가 발생했습니다.</div>';
        }
    }

    // 초기화
    loadNovels();
    renderAttributeList();
    updateCurrentPath();

    // GPT 모델 선택 모달
    const gptModal = new bootstrap.Modal(document.getElementById('gptModal'));
    const $gptModel = document.getElementById('gptModel');
    const $confirmGptBtn = document.getElementById('confirmGptBtn');
    
    if ($confirmGptBtn) {
        $confirmGptBtn.addEventListener('click', () => {
            const selectedModel = $gptModel.value;
            // 모든 에디터의 모델 업데이트
            attributeEditors.forEach(editor => {
                editor.gptModel = selectedModel;
            });
            addLog('info', `[GPT 모델] 변경: ${selectedModel}`);
            gptModal.hide();
        });
    }

    // 전역 함수로 export
    window.addLog = addLog;
    window.renderAttributeInputs = renderAttributeInputs;
});

