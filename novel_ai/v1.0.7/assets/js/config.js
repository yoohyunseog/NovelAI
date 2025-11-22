/**
 * API 설정 파일
 */

const API_CONFIG = {
    baseUrl: window.location.origin || 'http://localhost:8123',
    endpoints: {
        chat: '/api/gpt/chat',
        attributes: '/api/attributes',
        attributesAll: '/api/attributes/all',
        attributesData: '/api/attributes/data',
        attributesSave: '/api/attributes/data',
    },
    defaultModel: 'gpt-4o',
    defaultParams: {
        temperature: 0.7,
        maxTokens: 2000,
    }
};

function getServerUrl(path) {
    const base = API_CONFIG.baseUrl;
    if (!path) return base;
    if (path.startsWith('/')) {
        return base + path;
    }
    return base + '/' + path;
}

if (typeof window !== 'undefined') {
    window.API_CONFIG = API_CONFIG;
    window.getServerUrl = getServerUrl;
}

