import fs from 'fs';
import path from 'path';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import OpenAI from 'openai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '8123', 10);
const HOST = process.env.HOST || '0.0.0.0';
const JWT_SECRET = process.env.JWT_SECRET || 'novel_ai_secret_key_change_in_production';

// Root paths
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PUBLIC_ROOT = path.resolve(__dirname, '../../..');
const DATA_DIR = path.join(__dirname, 'data');
const USERS_DIR = path.join(DATA_DIR, 'users');
const USERS_DB_FILE = path.join(USERS_DIR, 'users.json');
const OAUTH_CONFIG_FILE = path.join(DATA_DIR, 'oauth_config.json');
const API_KEY_FILE = path.join(DATA_DIR, 'gpt_api_key.txt');

// BIT 계산 상수
const BIT_COUNT = 50;
const BIT_BASE_VALUE = 5.5;
const BIT_DEFAULT_PREFIX = '안 녕 한 국 인 터 넷 . 한 국';
let SUPER_BIT = 0;

const LANGUAGE_RANGES = [
  { range: [0xAC00, 0xD7AF], prefix: 1000000 },
  { range: [0x3040, 0x309F], prefix: 2000000 },
  { range: [0x30A0, 0x30FF], prefix: 3000000 },
  { range: [0x4E00, 0x9FFF], prefix: 4000000 },
  { range: [0x0410, 0x044F], prefix: 5000000 },
  { range: [0x0041, 0x007A], prefix: 6000000 },
  { range: [0x0590, 0x05FF], prefix: 7000000 },
  { range: [0x00C0, 0x00FD], prefix: 8000000 },
  { range: [0x0E00, 0x0E7F], prefix: 9000000 }
];

// ==================== 유틸리티 함수 ====================
function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function initializeDataDirectories() {
  ensureDirectory(DATA_DIR);
  ensureDirectory(USERS_DIR);
  if (!fs.existsSync(USERS_DB_FILE)) {
    fs.writeFileSync(USERS_DB_FILE, JSON.stringify({ users: [] }, null, 2), 'utf8');
  }
  // OAuth 설정 파일 초기화
  if (!fs.existsSync(OAUTH_CONFIG_FILE)) {
    const baseUrl = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;
    const defaultConfig = {
      google: {
        clientId: '',
        clientSecret: '',
        redirectUri: `${baseUrl}/api/auth/google/callback`
      },
      naver: {
        clientId: process.env.NAVER_CLIENT_ID || '',
        clientSecret: process.env.NAVER_CLIENT_SECRET || '',
        redirectUri: `${baseUrl}/api/auth/naver/callback`
      },
      kakao: {
        clientId: '',
        clientSecret: '',
        redirectUri: `${baseUrl}/api/auth/kakao/callback`
      }
    };
    fs.writeFileSync(OAUTH_CONFIG_FILE, JSON.stringify(defaultConfig, null, 2), 'utf8');
  }
  // GPT API 키 파일 초기화
  if (!fs.existsSync(API_KEY_FILE)) {
    try {
      fs.writeFileSync(API_KEY_FILE, '', 'utf8');
    } catch (error) {
      console.warn('[Init] Failed to create API key file:', error);
    }
  }
}

// GPT API 키 로드 함수
function getApiKey() {
  try {
    if (fs.existsSync(API_KEY_FILE)) {
      return fs.readFileSync(API_KEY_FILE, 'utf8').trim();
    }
  } catch (e) {
    // 파일 읽기 실패 시 무시
  }
  return process.env.OPENAI_API_KEY || null;
}

// OAuth 설정 로드
function getOAuthConfig() {
  try {
    if (fs.existsSync(OAUTH_CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(OAUTH_CONFIG_FILE, 'utf8'));
    }
  } catch (e) {
    console.warn('[OAuth] 설정 파일 읽기 실패:', e);
  }
  
  const baseUrl = process.env.BASE_URL || `http://127.0.0.1:${PORT}`;
  return {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
      redirectUri: process.env.GOOGLE_REDIRECT_URI || `${baseUrl}/api/auth/google/callback`
    },
    naver: {
      clientId: process.env.NAVER_CLIENT_ID || '',
      clientSecret: process.env.NAVER_CLIENT_SECRET || '',
      redirectUri: process.env.NAVER_REDIRECT_URI || `${baseUrl}/api/auth/naver/callback`
    },
    kakao: {
      clientId: process.env.KAKAO_REST_API_KEY || '',
      clientSecret: process.env.KAKAO_CLIENT_SECRET || '',
      redirectUri: process.env.KAKAO_REDIRECT_URI || `${baseUrl}/api/auth/kakao/callback`
    }
  };
}

// ==================== BIT 계산 함수 ====================
function wordNbUnicodeFormat(text = '') {
  let domain = BIT_DEFAULT_PREFIX;
  if (text && text.length > 0) {
    domain = `${BIT_DEFAULT_PREFIX}:${text}`;
  }
  const chars = Array.from(domain);
  return chars.map(char => {
    const codePoint = char.codePointAt(0);
    const lang = LANGUAGE_RANGES.find(
      ({ range: [start, end] }) => codePoint >= start && codePoint <= end
    );
    const prefix = lang ? lang.prefix : 0;
    return prefix + codePoint;
  });
}

function initializeBitArrays(len) {
  return {
    BIT_START_A50: new Array(len).fill(0),
    BIT_START_A100: new Array(len).fill(0),
    BIT_START_B50: new Array(len).fill(0),
    BIT_START_B100: new Array(len).fill(0),
    BIT_START_NBA100: new Array(len).fill(0)
  };
}

function calculateBit(nb, bit = BIT_BASE_VALUE, reverse = false) {
  if (!nb || nb.length < 2) return bit / 100;
  const BIT_NB = bit;
  const max = Math.max(...nb);
  const min = Math.min(...nb);
  const negativeRange = min < 0 ? Math.abs(min) : 0;
  const positiveRange = max > 0 ? max : 0;
  const denom = (BIT_COUNT * nb.length - 1) || 1;
  const negativeIncrement = negativeRange / denom;
  const positiveIncrement = positiveRange / denom;
  const arrays = initializeBitArrays(BIT_COUNT * nb.length);
  let count = 0;
  for (const value of nb) {
    for (let i = 0; i < BIT_COUNT; i++) {
      const BIT_END = 1;
      const A50 = value < 0
        ? min + negativeIncrement * (count + 1)
        : min + positiveIncrement * (count + 1);
      const A100 = (count + 1) * BIT_NB / (BIT_COUNT * nb.length);
      const B50 = value < 0 ? A50 - negativeIncrement * 2 : A50 - positiveIncrement * 2;
      const B100 = value < 0 ? A50 + negativeIncrement : A50 + positiveIncrement;
      const NBA100 = A100 / (nb.length - BIT_END);
      arrays.BIT_START_A50[count] = A50;
      arrays.BIT_START_A100[count] = A100;
      arrays.BIT_START_B50[count] = B50;
      arrays.BIT_START_B100[count] = B100;
      arrays.BIT_START_NBA100[count] = NBA100;
      count++;
    }
  }
  if (reverse) arrays.BIT_START_NBA100.reverse();
  let NB50 = 0;
  for (const value of nb) {
    for (let a = 0; a < arrays.BIT_START_NBA100.length; a++) {
      if (arrays.BIT_START_B50[a] <= value && arrays.BIT_START_B100[a] >= value) {
        NB50 += arrays.BIT_START_NBA100[Math.min(a, arrays.BIT_START_NBA100.length - 1)];
        break;
      }
    }
  }
  if (nb.length === 2) return bit - NB50;
  return NB50;
}

function BIT_MAX_NB(nb, bit = BIT_BASE_VALUE) {
  const result = calculateBit(nb, bit, false);
  if (!Number.isFinite(result) || Number.isNaN(result) || result > 100 || result < -100) {
    return SUPER_BIT;
  }
  SUPER_BIT = result;
  return result;
}

function BIT_MIN_NB(nb, bit = BIT_BASE_VALUE) {
  const result = calculateBit(nb, bit, true);
  if (!Number.isFinite(result) || Number.isNaN(result) || result > 100 || result < -100) {
    return SUPER_BIT;
  }
  SUPER_BIT = result;
  return result;
}

function calculateBitValues(text = '') {
  const arr = wordNbUnicodeFormat(text || '');
  return { max: BIT_MAX_NB(arr), min: BIT_MIN_NB(arr), length: arr.length };
}

// 사용자 BIT 계산
function calculateUserBit(userIdOrNickname) {
  const text = String(userIdOrNickname || '');
  const arr = wordNbUnicodeFormat(text);
  const max = BIT_MAX_NB(arr);
  const min = BIT_MIN_NB(arr);
  return { max, min };
}

// ==================== 데이터 경로 함수 ====================
function getUserDataPath(userBitMax, userBitMin) {
  const userDir = path.join(USERS_DIR, String(userBitMax), String(userBitMin));
  ensureDirectory(userDir);
  return {
    base: userDir,
    novels: path.join(userDir, 'novels')
  };
}

function getNovelDataPath(userBitMax, userBitMin, novelBit) {
  const novelDir = path.join(USERS_DIR, String(userBitMax), String(userBitMin), 'novels', String(novelBit));
  ensureDirectory(novelDir);
  return {
    base: novelDir,
    novelInfo: path.join(novelDir, 'novel_info.ndjson'),
    chapters: path.join(novelDir, 'chapters'),
    characters: path.join(novelDir, 'characters'),
    charactersRPG: path.join(novelDir, 'characters.ndjson'), // RPG 통합 파일
    items: path.join(novelDir, 'items'),
    background: path.join(novelDir, 'background'),
    events: path.join(novelDir, 'events'),
    relations: path.join(novelDir, 'relations'),
    summary: path.join(novelDir, 'summary.ndjson'),
    lv: path.join(novelDir, 'lv.ndjson'),
    prologue: path.join(novelDir, 'prologue.ndjson')
  };
}

// ==================== NDJSON 함수 ====================
function readNDJSON(filePath) {
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf8');
  return content.trim().split('\n').filter(line => line.trim()).map(line => JSON.parse(line));
}

function writeNDJSON(filePath, data) {
  const content = Array.isArray(data) 
    ? data.map(item => JSON.stringify(item)).join('\n') + '\n'
    : JSON.stringify(data) + '\n';
  ensureDirectory(path.dirname(filePath));
  fs.writeFileSync(filePath, content, 'utf8');
}

function appendNDJSON(filePath, data) {
  const content = JSON.stringify(data) + '\n';
  ensureDirectory(path.dirname(filePath));
  fs.appendFileSync(filePath, content, 'utf8');
}

// ==================== 사용자 DB 함수 ====================
function readUsersDB() {
  try {
    const data = fs.readFileSync(USERS_DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    return { users: [] };
  }
}

function writeUsersDB(data) {
  fs.writeFileSync(USERS_DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ==================== JWT 함수 ====================
function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, nickname: user.nickname },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: '인증 토큰이 필요합니다.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: '유효하지 않은 토큰입니다.' });
    }
    req.user = user;
    next();
  });
}

// ==================== LV 계산 함수 ====================
function calculateLv(text, bitMax, bitMin, previousLv = 1) {
  const charCount = text.length;
  const bitDiff = Math.abs(bitMax - bitMin);
  const bitChange = Math.abs(bitMax) + Math.abs(bitMin);
  
  // 레벨 알고리즘: 글자 수, BIT 공간 차이, MAX/MIN 변화량 기반
  const charFactor = Math.log10(charCount + 1) * 10;
  const bitFactor = bitDiff * 5;
  const changeFactor = bitChange * 2;
  
  const lvIncrease = (charFactor + bitFactor + changeFactor) / 100;
  return Math.max(1, Math.floor(previousLv + lvIncrease));
}

// ==================== Express 설정 ====================
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

initializeDataDirectories();

// ==================== 인증 API ====================
// 회원가입
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, nickname } = req.body;
    
    if (!email || !password || !nickname) {
      return res.status(400).json({ error: '이메일, 비밀번호, 닉네임은 필수입니다.' });
    }

    const db = readUsersDB();
    const existingUser = db.users.find(u => u.email === email || u.nickname === nickname);
    
    if (existingUser) {
      return res.status(400).json({ error: '이미 존재하는 이메일 또는 닉네임입니다.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userBit = calculateUserBit(nickname || email);

    const newUser = {
      id: Date.now().toString(),
      email,
      nickname,
      password: hashedPassword,
      userBitMax: userBit.max,
      userBitMin: userBit.min,
      profileLv: 1,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    };

    db.users.push(newUser);
    writeUsersDB(db);

    const token = generateToken(newUser);
    res.json({ 
      token, 
      user: { 
        id: newUser.id, 
        email, 
        nickname, 
        userBitMax: userBit.max, 
        userBitMin: userBit.min, 
        profileLv: 1 
      } 
    });
  } catch (error) {
    console.error('[Auth] 회원가입 오류:', error);
    res.status(500).json({ error: '회원가입 중 오류가 발생했습니다.' });
  }
});

// 로그인
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: '이메일과 비밀번호는 필수입니다.' });
    }

    const db = readUsersDB();
    const user = db.users.find(u => u.email === email);
    
    if (!user) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' });
    }

    // 로그인 시간 업데이트
    user.lastLoginAt = new Date().toISOString();
    writeUsersDB(db);

    const token = generateToken(user);
    res.json({ 
      token, 
      user: { 
        id: user.id, 
        email: user.email, 
        nickname: user.nickname,
        userBitMax: user.userBitMax,
        userBitMin: user.userBitMin,
        profileLv: user.profileLv || 1,
        lastLoginAt: user.lastLoginAt
      } 
    });
  } catch (error) {
    console.error('[Auth] 로그인 오류:', error);
    res.status(500).json({ error: '로그인 중 오류가 발생했습니다.' });
  }
});

// 현재 사용자 정보
app.get('/api/auth/me', authenticateToken, (req, res) => {
  const db = readUsersDB();
  const user = db.users.find(u => u.id === req.user.id);
  if (!user) {
    return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
  }
  res.json({ 
    id: user.id, 
    email: user.email, 
    nickname: user.nickname,
    userBitMax: user.userBitMax,
    userBitMin: user.userBitMin,
    profileLv: user.profileLv || 1,
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt
  });
});

// ==================== 소설 관리 API ====================
// 소설 목록 조회
app.get('/api/my/novels', authenticateToken, (req, res) => {
  try {
    const db = readUsersDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    const userPaths = getUserDataPath(user.userBitMax, user.userBitMin);
    const novelsDir = userPaths.novels;
    
    if (!fs.existsSync(novelsDir)) {
      return res.json({ novels: [] });
    }

    const novels = [];
    const folders = fs.readdirSync(novelsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const novelBit of folders) {
      const novelPath = getNovelDataPath(user.userBitMax, user.userBitMin, novelBit);
      const novelInfoPath = novelPath.novelInfo;
      
      if (fs.existsSync(novelInfoPath)) {
        const info = readNDJSON(novelInfoPath);
        if (info.length > 0) {
          const novelData = info[info.length - 1];
          const chaptersDir = novelPath.chapters;
          const chapterCount = fs.existsSync(chaptersDir) 
            ? fs.readdirSync(chaptersDir).filter(f => f.endsWith('.ndjson')).length 
            : 0;
          
          novels.push({
            novelBit,
            title: novelData.title || '제목 없음',
            description: novelData.description || '',
            attributePath: novelData.attributePath || '',
            totalLv: novelData.totalLv || 1,
            chapterCount,
            createdAt: novelData.createdAt || '',
            updatedAt: novelData.updatedAt || ''
          });
        }
      }
    }

    res.json({ novels });
  } catch (error) {
    console.error('[Novels] 목록 조회 오류:', error);
    res.status(500).json({ error: '소설 목록을 불러오는 중 오류가 발생했습니다.' });
  }
});

// 소설 생성
app.post('/api/my/novels', authenticateToken, (req, res) => {
  try {
    const db = readUsersDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    }

    const { title, description, attributePath } = req.body;
    if (!title) {
      return res.status(400).json({ error: '제목은 필수입니다.' });
    }

    const bitValues = attributePath ? calculateBitValues(attributePath) : { max: 0, min: 0, length: 0 };
    const novelBit = `${bitValues.max}_${bitValues.min}`;
    
    const novelPath = getNovelDataPath(user.userBitMax, user.userBitMin, novelBit);
    
    const novelInfo = {
      title,
      description: description || '',
      attributePath: attributePath || '',
      userBitMax: user.userBitMax,
      userBitMin: user.userBitMin,
      novelBitMax: bitValues.max,
      novelBitMin: bitValues.min,
      totalLv: 1,
      chapterCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    writeNDJSON(novelPath.novelInfo, novelInfo);

    res.json({ novelBit, ...novelInfo });
  } catch (error) {
    console.error('[Novels] 생성 오류:', error);
    res.status(500).json({ error: '소설 생성 중 오류가 발생했습니다.' });
  }
});

// 소설 정보 조회
app.get('/api/my/novels/:novelBit', authenticateToken, (req, res) => {
  try {
    const db = readUsersDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    const novelPath = getNovelDataPath(user.userBitMax, user.userBitMin, req.params.novelBit);
    const novelInfoPath = novelPath.novelInfo;

    if (!fs.existsSync(novelInfoPath)) {
      return res.status(404).json({ error: '소설을 찾을 수 없습니다.' });
    }

    const info = readNDJSON(novelInfoPath);
    if (info.length === 0) {
      return res.status(404).json({ error: '소설 정보를 찾을 수 없습니다.' });
    }

    const novelData = info[info.length - 1];
    res.json({ novelBit: req.params.novelBit, ...novelData });
  } catch (error) {
    console.error('[Novels] 조회 오류:', error);
    res.status(500).json({ error: '소설 정보를 불러오는 중 오류가 발생했습니다.' });
  }
});

// 소설 수정
app.put('/api/my/novels/:novelBit', authenticateToken, (req, res) => {
  try {
    const db = readUsersDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    const novelPath = getNovelDataPath(user.userBitMax, user.userBitMin, req.params.novelBit);
    const novelInfoPath = novelPath.novelInfo;

    if (!fs.existsSync(novelInfoPath)) {
      return res.status(404).json({ error: '소설을 찾을 수 없습니다.' });
    }

    const info = readNDJSON(novelInfoPath);
    if (info.length === 0) {
      return res.status(404).json({ error: '소설 정보를 찾을 수 없습니다.' });
    }

    const novelData = info[info.length - 1];
    const { title, description, attributePath } = req.body;

    if (title) novelData.title = title;
    if (description !== undefined) novelData.description = description;
    if (attributePath !== undefined) {
      novelData.attributePath = attributePath;
      const bitValues = attributePath ? calculateBitValues(attributePath) : { max: 0, min: 0, length: 0 };
      novelData.novelBitMax = bitValues.max;
      novelData.novelBitMin = bitValues.min;
    }
    novelData.updatedAt = new Date().toISOString();

    appendNDJSON(novelInfoPath, novelData);
    res.json({ novelBit: req.params.novelBit, ...novelData });
  } catch (error) {
    console.error('[Novels] 수정 오류:', error);
    res.status(500).json({ error: '소설 수정 중 오류가 발생했습니다.' });
  }
});

// 소설 삭제
app.delete('/api/my/novels/:novelBit', authenticateToken, (req, res) => {
  try {
    const db = readUsersDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    const novelPath = getNovelDataPath(user.userBitMax, user.userBitMin, req.params.novelBit);
    
    if (fs.existsSync(novelPath.base)) {
      fs.rmSync(novelPath.base, { recursive: true, force: true });
    }

    res.json({ success: true });
  } catch (error) {
    console.error('[Novels] 삭제 오류:', error);
    res.status(500).json({ error: '소설 삭제 중 오류가 발생했습니다.' });
  }
});

// ==================== 챕터 관리 API ====================
// 챕터 목록 조회
app.get('/api/my/novels/:novelBit/chapters', authenticateToken, (req, res) => {
  try {
    const db = readUsersDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    const novelPath = getNovelDataPath(user.userBitMax, user.userBitMin, req.params.novelBit);
    const chaptersDir = novelPath.chapters;

    if (!fs.existsSync(chaptersDir)) {
      return res.json({ chapters: [] });
    }

    const files = fs.readdirSync(chaptersDir)
      .filter(f => f.endsWith('.ndjson'))
      .sort((a, b) => {
        const numA = parseInt(a.replace('.ndjson', '')) || 0;
        const numB = parseInt(b.replace('.ndjson', '')) || 0;
        return numA - numB;
      });

    const chapters = files.map(file => {
      const chapterNum = file.replace('.ndjson', '');
      const content = readNDJSON(path.join(chaptersDir, file));
      const chapterData = content.length > 0 ? content[content.length - 1] : {};
      return {
        chapterNum,
        ...chapterData
      };
    });

    res.json({ chapters });
  } catch (error) {
    console.error('[Chapters] 목록 조회 오류:', error);
    res.status(500).json({ error: '챕터 목록을 불러오는 중 오류가 발생했습니다.' });
  }
});

// 챕터 생성/수정
app.post('/api/my/novels/:novelBit/chapters', authenticateToken, (req, res) => {
  try {
    const db = readUsersDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    const { chapterNum, chapterTitle, chapterText, attributePath, charactersInvolved, itemsUsed, eventsOccurred } = req.body;
    
    if (!chapterNum || !chapterTitle) {
      return res.status(400).json({ error: '챕터 번호와 제목은 필수입니다.' });
    }

    const novelPath = getNovelDataPath(user.userBitMax, user.userBitMin, req.params.novelBit);
    const chapterFile = path.join(novelPath.chapters, `${String(chapterNum).padStart(2, '0')}.ndjson`);
    
    const bitValues = attributePath ? calculateBitValues(attributePath) : { max: 0, min: 0, length: 0 };
    
    // 이전 챕터 LV 가져오기
    const previousChapters = fs.existsSync(novelPath.chapters) 
      ? fs.readdirSync(novelPath.chapters).filter(f => f.endsWith('.ndjson')).length 
      : 0;
    const previousLv = previousChapters > 0 ? 1 : 1; // 간단화, 실제로는 이전 챕터 LV 읽기
    
    const chapterLv = calculateLv(chapterText || '', bitValues.max, bitValues.min, previousLv);
    
    const chapterData = {
      chapterNum: String(chapterNum).padStart(2, '0'),
      chapterTitle,
      chapterText: chapterText || '',
      chapterBitMax: bitValues.max,
      chapterBitMin: bitValues.min,
      charactersInvolved: charactersInvolved || [],
      itemsUsed: itemsUsed || [],
      eventsOccurred: eventsOccurred || [],
      summaryShort: '',
      summaryLong: '',
      chapterLv,
      timestamp: new Date().toISOString(),
      // RPG 업데이트 정보
      characterUpdates: req.body.characterUpdates || []
    };

    appendNDJSON(chapterFile, chapterData);

    // 캐릭터 RPG 업데이트 처리
    if (req.body.characterUpdates && Array.isArray(req.body.characterUpdates) && req.body.characterUpdates.length > 0) {
      const charactersRPGFile = novelPath.charactersRPG;
      if (fs.existsSync(charactersRPGFile)) {
        let characters = readNDJSON(charactersRPGFile);
        
        for (const update of req.body.characterUpdates) {
          const character = characters.find(c => c.name === update.name);
          if (!character) continue;

          let updatedChar = { ...character };

          // 경험치 추가
          if (update.expGain) {
            updatedChar.exp += update.expGain;
          }

          // 골드 변경
          if (update.goldGain !== undefined) {
            updatedChar.gold = Math.max(0, updatedChar.gold + update.goldGain);
          }

          // 아이템 추가
          if (update.itemsGained && Array.isArray(update.itemsGained)) {
            updatedChar.inventory = [...(updatedChar.inventory || []), ...update.itemsGained];
          }

          // 아이템 사용
          if (update.itemsUsed && Array.isArray(update.itemsUsed)) {
            for (const item of update.itemsUsed) {
              const index = updatedChar.inventory.indexOf(item);
              if (index > -1) {
                updatedChar.inventory.splice(index, 1);
              }
            }
          }

          // 장비 획득/교체
          if (update.equipmentGained && Array.isArray(update.equipmentGained)) {
            for (const equip of update.equipmentGained) {
              const equipType = equip.includes('검') || equip.includes('지팡이') ? 'weapon' :
                              equip.includes('로브') || equip.includes('갑옷') ? 'armor' :
                              equip.includes('반지') ? 'ring' : 'accessory';
              updatedChar.equipment[equipType] = equip;
            }
          }

          // 레벨업 처리
          while (updatedChar.exp >= updatedChar.expNeeded) {
            updatedChar = applyLevelUp(updatedChar);
          }

          updatedChar.updatedAt = new Date().toISOString();

          // 원본 배열 업데이트
          const index = characters.findIndex(c => c.name === update.name);
          if (index > -1) {
            characters[index] = updatedChar;
          }
        }

        writeNDJSON(charactersRPGFile, characters);
      }
    }

    // 소설 정보 업데이트
    const novelInfoPath = novelPath.novelInfo;
    if (fs.existsSync(novelInfoPath)) {
      const info = readNDJSON(novelInfoPath);
      if (info.length > 0) {
        const novelData = info[info.length - 1];
        novelData.chapterCount = fs.readdirSync(novelPath.chapters).filter(f => f.endsWith('.ndjson')).length;
        novelData.updatedAt = new Date().toISOString();
        appendNDJSON(novelInfoPath, novelData);
      }
    }

    res.json(chapterData);
  } catch (error) {
    console.error('[Chapters] 생성 오류:', error);
    res.status(500).json({ error: '챕터 생성 중 오류가 발생했습니다.' });
  }
});

// ==================== 레벨업 계산 함수 ====================
function calculateExpNeeded(level) {
  // 레벨에 따른 필요 경험치 계산 (100 * level^1.5)
  return Math.floor(100 * Math.pow(level, 1.5));
}

function calculateLevelUpStats(level) {
  // 레벨업 시 스탯 증가량
  return {
    hp: 20 + (level * 5),
    mp: 10 + (level * 3),
    atk: 3 + Math.floor(level / 2),
    def: 2 + Math.floor(level / 3)
  };
}

function applyLevelUp(character) {
  const newLevel = character.lv + 1;
  const stats = calculateLevelUpStats(newLevel);
  
  return {
    ...character,
    lv: newLevel,
    exp: character.exp - character.expNeeded,
    expNeeded: calculateExpNeeded(newLevel),
    hp: character.hp + stats.hp,
    mp: character.mp + stats.mp,
    atk: character.atk + stats.atk,
    def: character.def + stats.def
  };
}

// ==================== 캐릭터 RPG 관리 API ====================
// 캐릭터 목록 조회 (RPG 스탯 포함)
app.get('/api/my/novels/:novelBit/characters', authenticateToken, (req, res) => {
  try {
    const db = readUsersDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    const novelPath = getNovelDataPath(user.userBitMax, user.userBitMin, req.params.novelBit);
    const charactersRPGFile = novelPath.charactersRPG;

    if (!fs.existsSync(charactersRPGFile)) {
      return res.json({ characters: [] });
    }

    const characters = readNDJSON(charactersRPGFile);
    res.json({ characters });
  } catch (error) {
    console.error('[Characters] 목록 조회 오류:', error);
    res.status(500).json({ error: '캐릭터 목록을 불러오는 중 오류가 발생했습니다.' });
  }
});

// 캐릭터 생성 (RPG 스탯 초기화)
app.post('/api/my/novels/:novelBit/characters', authenticateToken, (req, res) => {
  try {
    const db = readUsersDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    const { 
      name, 
      role, 
      description,
      attributePath,
      // RPG 스탯 (선택적, 없으면 기본값)
      lv = 1,
      exp = 0,
      hp = 100,
      mp = 50,
      atk = 10,
      def = 5,
      gold = 0,
      inventory = [],
      equipment = {},
      status = '정상'
    } = req.body;
    
    if (!name) return res.status(400).json({ error: '이름은 필수입니다.' });

    const novelPath = getNovelDataPath(user.userBitMax, user.userBitMin, req.params.novelBit);
    const charactersRPGFile = novelPath.charactersRPG;

    // 기존 캐릭터 목록 로드
    let characters = [];
    if (fs.existsSync(charactersRPGFile)) {
      characters = readNDJSON(charactersRPGFile);
    }

    // 중복 확인
    if (characters.find(c => c.name === name)) {
      return res.status(400).json({ error: '이미 존재하는 캐릭터 이름입니다.' });
    }

    const bitValues = attributePath ? calculateBitValues(attributePath) : { max: 0, min: 0, length: 0 };
    const expNeeded = calculateExpNeeded(lv);

    const character = {
      name,
      role: role || '',
      description: description || '',
      lv,
      exp,
      expNeeded,
      hp,
      mp,
      atk,
      def,
      gold,
      inventory: Array.isArray(inventory) ? inventory : [],
      equipment: equipment || {},
      status,
      attributePath: attributePath || '',
      bitMax: bitValues.max,
      bitMin: bitValues.min,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    characters.push(character);
    writeNDJSON(charactersRPGFile, characters);

    res.json(character);
  } catch (error) {
    console.error('[Characters] 생성 오류:', error);
    res.status(500).json({ error: '캐릭터 생성 중 오류가 발생했습니다.' });
  }
});

// 캐릭터 업데이트 (챕터 진행 후)
app.post('/api/my/novels/:novelBit/characters/update', authenticateToken, (req, res) => {
  try {
    const db = readUsersDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    const { characterUpdates } = req.body; // [{ name, expGain, goldGain, itemsGained, itemsUsed, equipmentGained, lvUp }]
    
    if (!Array.isArray(characterUpdates)) {
      return res.status(400).json({ error: 'characterUpdates는 배열이어야 합니다.' });
    }

    const novelPath = getNovelDataPath(user.userBitMax, user.userBitMin, req.params.novelBit);
    const charactersRPGFile = novelPath.charactersRPG;

    if (!fs.existsSync(charactersRPGFile)) {
      return res.status(404).json({ error: '캐릭터 데이터를 찾을 수 없습니다.' });
    }

    let characters = readNDJSON(charactersRPGFile);
    const updatedCharacters = [];

    for (const update of characterUpdates) {
      const character = characters.find(c => c.name === update.name);
      if (!character) continue;

      let updatedChar = { ...character };

      // 경험치 추가
      if (update.expGain) {
        updatedChar.exp += update.expGain;
      }

      // 골드 변경
      if (update.goldGain !== undefined) {
        updatedChar.gold = Math.max(0, updatedChar.gold + update.goldGain);
      }

      // 아이템 추가
      if (update.itemsGained && Array.isArray(update.itemsGained)) {
        updatedChar.inventory = [...(updatedChar.inventory || []), ...update.itemsGained];
      }

      // 아이템 사용
      if (update.itemsUsed && Array.isArray(update.itemsUsed)) {
        for (const item of update.itemsUsed) {
          const index = updatedChar.inventory.indexOf(item);
          if (index > -1) {
            updatedChar.inventory.splice(index, 1);
          }
        }
      }

      // 장비 획득/교체
      if (update.equipmentGained && Array.isArray(update.equipmentGained)) {
        for (const equip of update.equipmentGained) {
          // 장비 타입 추출 (간단한 로직, 실제로는 더 복잡할 수 있음)
          const equipType = equip.includes('검') || equip.includes('지팡이') ? 'weapon' :
                          equip.includes('로브') || equip.includes('갑옷') ? 'armor' :
                          equip.includes('반지') ? 'ring' : 'accessory';
          updatedChar.equipment[equipType] = equip;
        }
      }

      // 레벨업 처리
      while (updatedChar.exp >= updatedChar.expNeeded) {
        updatedChar = applyLevelUp(updatedChar);
      }

      updatedChar.updatedAt = new Date().toISOString();
      updatedCharacters.push(updatedChar);

      // 원본 배열 업데이트
      const index = characters.findIndex(c => c.name === update.name);
      if (index > -1) {
        characters[index] = updatedChar;
      }
    }

    // 파일 저장
    writeNDJSON(charactersRPGFile, characters);

    res.json({ 
      success: true, 
      updated: updatedCharacters.length,
      characters: updatedCharacters 
    });
  } catch (error) {
    console.error('[Characters] 업데이트 오류:', error);
    res.status(500).json({ error: '캐릭터 업데이트 중 오류가 발생했습니다.' });
  }
});

// 캐릭터 수정 (수동)
app.put('/api/my/novels/:novelBit/characters/:characterName', authenticateToken, (req, res) => {
  try {
    const db = readUsersDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    const novelPath = getNovelDataPath(user.userBitMax, user.userBitMin, req.params.novelBit);
    const charactersRPGFile = novelPath.charactersRPG;

    if (!fs.existsSync(charactersRPGFile)) {
      return res.status(404).json({ error: '캐릭터 데이터를 찾을 수 없습니다.' });
    }

    let characters = readNDJSON(charactersRPGFile);
    const character = characters.find(c => c.name === req.params.characterName);
    
    if (!character) {
      return res.status(404).json({ error: '캐릭터를 찾을 수 없습니다.' });
    }

    // 업데이트 가능한 필드들
    const updatableFields = ['lv', 'exp', 'hp', 'mp', 'atk', 'def', 'gold', 'inventory', 'equipment', 'status', 'role', 'description'];
    for (const field of updatableFields) {
      if (req.body[field] !== undefined) {
        character[field] = req.body[field];
      }
    }

    // 레벨 변경 시 expNeeded 재계산
    if (req.body.lv !== undefined) {
      character.expNeeded = calculateExpNeeded(character.lv);
    }

    // 레벨업 체크
    while (character.exp >= character.expNeeded) {
      Object.assign(character, applyLevelUp(character));
    }

    character.updatedAt = new Date().toISOString();

    writeNDJSON(charactersRPGFile, characters);

    res.json(character);
  } catch (error) {
    console.error('[Characters] 수정 오류:', error);
    res.status(500).json({ error: '캐릭터 수정 중 오류가 발생했습니다.' });
  }
});

// ==================== 아이템 관리 API ====================
app.get('/api/my/novels/:novelBit/items', authenticateToken, (req, res) => {
  try {
    const db = readUsersDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    const novelPath = getNovelDataPath(user.userBitMax, user.userBitMin, req.params.novelBit);
    const itemsDir = novelPath.items;

    if (!fs.existsSync(itemsDir)) {
      return res.json({ items: [] });
    }

    const files = fs.readdirSync(itemsDir).filter(f => f.endsWith('.ndjson'));
    const items = files.map(file => {
      const content = readNDJSON(path.join(itemsDir, file));
      const itemData = content.length > 0 ? content[content.length - 1] : {};
      return { itemBit: path.basename(file, '.ndjson'), ...itemData };
    });

    res.json({ items });
  } catch (error) {
    console.error('[Items] 목록 조회 오류:', error);
    res.status(500).json({ error: '아이템 목록을 불러오는 중 오류가 발생했습니다.' });
  }
});

app.post('/api/my/novels/:novelBit/items', authenticateToken, (req, res) => {
  try {
    const db = readUsersDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    const { name, description, abilities, attributePath } = req.body;
    if (!name) return res.status(400).json({ error: '이름은 필수입니다.' });

    const novelPath = getNovelDataPath(user.userBitMax, user.userBitMin, req.params.novelBit);
    const bitValues = attributePath ? calculateBitValues(attributePath) : { max: 0, min: 0, length: 0 };
    const itemBit = `${bitValues.max}_${bitValues.min}`;
    const itemFile = path.join(novelPath.items, `${itemBit}.ndjson`);

    const item = {
      name,
      description: description || '',
      abilities: abilities || [],
      attributePath: attributePath || '',
      bitMax: bitValues.max,
      bitMin: bitValues.min,
      level: 1,
      usageHistory: [],
      createdAt: new Date().toISOString()
    };

    appendNDJSON(itemFile, item);
    res.json({ itemBit, ...item });
  } catch (error) {
    console.error('[Items] 생성 오류:', error);
    res.status(500).json({ error: '아이템 생성 중 오류가 발생했습니다.' });
  }
});

// ==================== 배경 관리 API ====================
app.get('/api/my/novels/:novelBit/backgrounds', authenticateToken, (req, res) => {
  try {
    const db = readUsersDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    const novelPath = getNovelDataPath(user.userBitMax, user.userBitMin, req.params.novelBit);
    const backgroundsDir = novelPath.background;

    if (!fs.existsSync(backgroundsDir)) {
      return res.json({ backgrounds: [] });
    }

    const files = fs.readdirSync(backgroundsDir).filter(f => f.endsWith('.ndjson'));
    const backgrounds = files.map(file => {
      const content = readNDJSON(path.join(backgroundsDir, file));
      const bgData = content.length > 0 ? content[content.length - 1] : {};
      return { backgroundBit: path.basename(file, '.ndjson'), ...bgData };
    });

    res.json({ backgrounds });
  } catch (error) {
    console.error('[Backgrounds] 목록 조회 오류:', error);
    res.status(500).json({ error: '배경 목록을 불러오는 중 오류가 발생했습니다.' });
  }
});

app.post('/api/my/novels/:novelBit/backgrounds', authenticateToken, (req, res) => {
  try {
    const db = readUsersDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    const { name, description, attributePath } = req.body;
    if (!name) return res.status(400).json({ error: '이름은 필수입니다.' });

    const novelPath = getNovelDataPath(user.userBitMax, user.userBitMin, req.params.novelBit);
    const bitValues = attributePath ? calculateBitValues(attributePath) : { max: 0, min: 0, length: 0 };
    const backgroundBit = `${bitValues.max}_${bitValues.min}`;
    const backgroundFile = path.join(novelPath.background, `${backgroundBit}.ndjson`);

    const background = {
      name,
      description: description || '',
      attributePath: attributePath || '',
      bitMax: bitValues.max,
      bitMin: bitValues.min,
      createdAt: new Date().toISOString()
    };

    appendNDJSON(backgroundFile, background);
    res.json({ backgroundBit, ...background });
  } catch (error) {
    console.error('[Backgrounds] 생성 오류:', error);
    res.status(500).json({ error: '배경 생성 중 오류가 발생했습니다.' });
  }
});

// ==================== 이벤트 관리 API ====================
app.get('/api/my/novels/:novelBit/events', authenticateToken, (req, res) => {
  try {
    const db = readUsersDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    const novelPath = getNovelDataPath(user.userBitMax, user.userBitMin, req.params.novelBit);
    const eventsDir = novelPath.events;

    if (!fs.existsSync(eventsDir)) {
      return res.json({ events: [] });
    }

    const files = fs.readdirSync(eventsDir).filter(f => f.endsWith('.ndjson'));
    const events = files.map(file => {
      const content = readNDJSON(path.join(eventsDir, file));
      const eventData = content.length > 0 ? content[content.length - 1] : {};
      return { id: path.basename(file, '.ndjson'), ...eventData };
    });

    res.json({ events });
  } catch (error) {
    console.error('[Events] 목록 조회 오류:', error);
    res.status(500).json({ error: '이벤트 목록을 불러오는 중 오류가 발생했습니다.' });
  }
});

app.post('/api/my/novels/:novelBit/events', authenticateToken, (req, res) => {
  try {
    const db = readUsersDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    const { chapterNum, title, description } = req.body;
    if (!chapterNum || !title) return res.status(400).json({ error: '챕터 번호와 제목은 필수입니다.' });

    const novelPath = getNovelDataPath(user.userBitMax, user.userBitMin, req.params.novelBit);
    const eventId = Date.now().toString();
    const eventFile = path.join(novelPath.events, `${eventId}.ndjson`);

    const event = {
      id: eventId,
      chapterNum: String(chapterNum).padStart(2, '0'),
      title,
      description: description || '',
      createdAt: new Date().toISOString()
    };

    appendNDJSON(eventFile, event);
    res.json(event);
  } catch (error) {
    console.error('[Events] 생성 오류:', error);
    res.status(500).json({ error: '이벤트 생성 중 오류가 발생했습니다.' });
  }
});

// ==================== 요약 관리 API ====================
app.get('/api/my/novels/:novelBit/summary', authenticateToken, (req, res) => {
  try {
    const db = readUsersDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    const novelPath = getNovelDataPath(user.userBitMax, user.userBitMin, req.params.novelBit);
    const summaryPath = novelPath.summary;

    if (!fs.existsSync(summaryPath)) {
      return res.json({ summary: null });
    }

    const summary = readNDJSON(summaryPath);
    res.json({ summary: summary.length > 0 ? summary[summary.length - 1] : null });
  } catch (error) {
    console.error('[Summary] 조회 오류:', error);
    res.status(500).json({ error: '요약을 불러오는 중 오류가 발생했습니다.' });
  }
});

app.post('/api/my/novels/:novelBit/summary', authenticateToken, (req, res) => {
  try {
    const db = readUsersDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    const { overallSummary, characterFlow, eventFlow, worldView } = req.body;
    const novelPath = getNovelDataPath(user.userBitMax, user.userBitMin, req.params.novelBit);
    const summaryPath = novelPath.summary;

    const summary = {
      overallSummary: overallSummary || '',
      characterFlow: characterFlow || '',
      eventFlow: eventFlow || '',
      worldView: worldView || '',
      updatedAt: new Date().toISOString()
    };

    appendNDJSON(summaryPath, summary);
    res.json({ summary });
  } catch (error) {
    console.error('[Summary] 저장 오류:', error);
    res.status(500).json({ error: '요약 저장 중 오류가 발생했습니다.' });
  }
});

// ==================== 관계도 관리 API ====================
app.get('/api/my/novels/:novelBit/relations', authenticateToken, (req, res) => {
  try {
    const db = readUsersDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    const novelPath = getNovelDataPath(user.userBitMax, user.userBitMin, req.params.novelBit);
    const relationsDir = novelPath.relations;

    if (!fs.existsSync(relationsDir)) {
      return res.json({ relations: [] });
    }

    const files = fs.readdirSync(relationsDir).filter(f => f.endsWith('.ndjson'));
    const relations = files.map(file => {
      const content = readNDJSON(path.join(relationsDir, file));
      const relationData = content.length > 0 ? content[content.length - 1] : {};
      return { id: path.basename(file, '.ndjson'), ...relationData };
    });

    res.json({ relations });
  } catch (error) {
    console.error('[Relations] 목록 조회 오류:', error);
    res.status(500).json({ error: '관계도 목록을 불러오는 중 오류가 발생했습니다.' });
  }
});

app.post('/api/my/novels/:novelBit/relations', authenticateToken, (req, res) => {
  try {
    const db = readUsersDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    const { fromCharacter, toCharacter, relationType, description } = req.body;
    if (!fromCharacter || !toCharacter || !relationType) {
      return res.status(400).json({ error: '관계 정보는 필수입니다.' });
    }

    const novelPath = getNovelDataPath(user.userBitMax, user.userBitMin, req.params.novelBit);
    const relationId = Date.now().toString();
    const relationFile = path.join(novelPath.relations, `${relationId}.ndjson`);

    const relation = {
      id: relationId,
      fromCharacter,
      toCharacter,
      relationType,
      description: description || '',
      createdAt: new Date().toISOString()
    };

    appendNDJSON(relationFile, relation);
    res.json(relation);
  } catch (error) {
    console.error('[Relations] 생성 오류:', error);
    res.status(500).json({ error: '관계도 생성 중 오류가 발생했습니다.' });
  }
});

// ==================== LV 시스템 API ====================
app.get('/api/my/novels/:novelBit/lv', authenticateToken, (req, res) => {
  try {
    const db = readUsersDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    const novelPath = getNovelDataPath(user.userBitMax, user.userBitMin, req.params.novelBit);
    const lvPath = novelPath.lv;

    if (!fs.existsSync(lvPath)) {
      return res.json({ lv: { totalLv: 1, chapterLvs: [], characterLvs: [] } });
    }

    const lv = readNDJSON(lvPath);
    res.json({ lv: lv.length > 0 ? lv[lv.length - 1] : { totalLv: 1, chapterLvs: [], characterLvs: [] } });
  } catch (error) {
    console.error('[LV] 조회 오류:', error);
    res.status(500).json({ error: 'LV 정보를 불러오는 중 오류가 발생했습니다.' });
  }
});

app.post('/api/my/novels/:novelBit/lv', authenticateToken, (req, res) => {
  try {
    const db = readUsersDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    const { totalLv, chapterLvs, characterLvs } = req.body;
    const novelPath = getNovelDataPath(user.userBitMax, user.userBitMin, req.params.novelBit);
    const lvPath = novelPath.lv;

    const lvData = {
      totalLv: totalLv || 1,
      chapterLvs: chapterLvs || [],
      characterLvs: characterLvs || [],
      updatedAt: new Date().toISOString()
    };

    appendNDJSON(lvPath, lvData);
    res.json({ lv: lvData });
  } catch (error) {
    console.error('[LV] 저장 오류:', error);
    res.status(500).json({ error: 'LV 정보 저장 중 오류가 발생했습니다.' });
  }
});

// ==================== OAuth 인증 ====================
// OAuth 인증 시작
app.get('/api/auth/:provider', (req, res) => {
  const { provider } = req.params;
  const config = getOAuthConfig();
  const pageState = req.query.state || 'novel_manager';
  
  let authUrl = '';
  
  if (provider === 'naver') {
    const { clientId, redirectUri } = config.naver || {};
    if (!clientId) {
      return res.status(400).json({ ok: false, error: 'Naver OAuth Client ID가 설정되지 않았습니다.' });
    }
    const state = `${pageState}_${Math.random().toString(36).substring(7)}`;
    authUrl = `https://nid.naver.com/oauth2.0/authorize?response_type=code&client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}`;
  } else {
    return res.status(400).json({ ok: false, error: '지원하지 않는 OAuth 제공자입니다.' });
  }
  
  res.redirect(authUrl);
});

// OAuth 콜백 처리
app.get('/api/auth/:provider/callback', async (req, res) => {
  const { provider } = req.params;
  const { code, error, state } = req.query;
  const config = getOAuthConfig();
  
  // state에서 버전 정보 추출 (예: novel_manager_v1.0.7 -> v1.0.7)
  let version = 'v1.0.6'; // 기본값
  let pageState = 'novel_manager';
  if (state) {
    const parts = state.split('_');
    pageState = parts[0] || 'novel_manager';
    // 버전 정보가 있으면 추출 (v1.0.7 형식)
    const versionMatch = state.match(/v\d+\.\d+\.\d+/);
    if (versionMatch) {
      version = versionMatch[0];
    }
  }
  
  if (error) {
    const redirectPage = pageState === 'structure' ? 'structure.html' : 'index.html';
    return res.redirect(`/novel_ai/${version}/${redirectPage}?error=${encodeURIComponent(error)}`);
  }
  
  if (!code) {
    const redirectPage = pageState === 'structure' ? 'structure.html' : 'index.html';
    return res.redirect(`/novel_ai/${version}/${redirectPage}?error=${encodeURIComponent('인증 코드가 없습니다.')}`);
  }
  
  try {
    let userInfo = null;
    
    if (provider === 'naver') {
      const { clientId, clientSecret } = config.naver || {};
      if (!clientId || !clientSecret) {
        const redirectPage = pageState === 'structure' ? 'structure.html' : 'index.html';
        return res.redirect(`/novel_ai/${version}/${redirectPage}?error=${encodeURIComponent('Naver OAuth 설정이 완료되지 않았습니다.')}`);
      }
      
      const tokenResponse = await fetch('https://nid.naver.com/oauth2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          code,
          state: state || ''
        })
      });
      
      if (!tokenResponse.ok) {
        throw new Error('토큰 교환 실패');
      }
      
      const tokenData = await tokenResponse.json();
      const accessToken = tokenData.access_token;
      
      const userResponse = await fetch('https://openapi.naver.com/v1/nid/me', {
        headers: { Authorization: `Bearer ${accessToken}` }
      });
      
      if (userResponse.ok) {
        const userData = await userResponse.json();
        if (userData.response) {
          userInfo = {
            provider: 'naver',
            id: userData.response.id,
            name: userData.response.name,
            email: userData.response.email,
            nickname: userData.response.nickname,
            profile_image: userData.response.profile_image
          };
        }
      }
    }
    
    if (userInfo) {
      // OAuth 사용자를 시스템에 등록/조회하고 JWT 토큰 발급
      const db = readUsersDB();
      const oauthId = `${provider}_${userInfo.id}`;
      const email = userInfo.email || `${oauthId}@oauth.local`;
      const nickname = userInfo.nickname || userInfo.name || `User_${userInfo.id.substring(0, 8)}`;
      
      // 기존 사용자 찾기
      let user = db.users.find(u => 
        u.oauthId === oauthId || 
        (u.email === email && u.provider === provider)
      );
      
      if (!user) {
        // 새 사용자 생성
        const userBit = calculateUserBit(nickname || email);
        
        user = {
          id: Date.now().toString(),
          email,
          nickname,
          oauthId,
          provider,
          userBitMax: userBit.max,
          userBitMin: userBit.min,
          profileLv: 1,
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString()
        };
        
        db.users.push(user);
        writeUsersDB(db);
      } else {
        // 로그인 시간 업데이트
        user.lastLoginAt = new Date().toISOString();
        writeUsersDB(db);
      }
      
      // JWT 토큰 생성
      const token = generateToken(user);
      
      // state 파라미터에서 원래 페이지 확인
      const redirectPage = pageState === 'structure' ? 'structure.html' : 'index.html';
      
      // 사용자 정보를 쿼리 파라미터로 전달
      const userParam = encodeURIComponent(JSON.stringify(userInfo));
      return res.redirect(`/novel_ai/${version}/${redirectPage}?token=${token}&userInfo=${userParam}`);
    } else {
      const redirectPage = pageState === 'structure' ? 'structure.html' : 'index.html';
      return res.redirect(`/novel_ai/${version}/${redirectPage}?error=${encodeURIComponent('사용자 정보를 가져올 수 없습니다.')}`);
    }
  } catch (error) {
    console.error(`[OAuth] ${provider} 콜백 처리 오류:`, error);
    const redirectPage = pageState === 'structure' ? 'structure.html' : 'index.html';
    return res.redirect(`/novel_ai/${version}/${redirectPage}?error=${encodeURIComponent(error.message || 'OAuth 처리 중 오류가 발생했습니다.')}`);
  }
});

// ==================== GPT API ====================
// GPT API 키 저장
app.post('/api/gpt/key', (req, res) => {
  try {
    const { apiKey } = req.body || {};
    if (!apiKey || typeof apiKey !== 'string') {
      return res.status(400).json({ ok: false, error: 'apiKey required' });
    }
    try {
      fs.writeFileSync(API_KEY_FILE, apiKey.trim(), 'utf8');
      return res.json({ ok: true });
    } catch (e) {
      return res.status(500).json({ ok: false, error: String(e) });
    }
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

// GPT API 키 확인
app.get('/api/gpt/key', (req, res) => {
  try {
    const apiKey = getApiKey();
    return res.json({ ok: true, hasKey: !!apiKey });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e) });
  }
});

// GPT API 호출 (챕터 생성용)
app.post('/api/gpt/chat', async (req, res) => {
  try {
    const { prompt, systemMessage, model = 'gpt-4o-mini', temperature = 0.7, maxTokens = 2000, context, responseFormat } = req.body || {};
    
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ ok: false, error: 'prompt required' });
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      return res.status(400).json({ ok: false, error: 'OpenAI API key not configured. Please set it via /api/gpt/key' });
    }

    const openai = new OpenAI({ apiKey });

    const messages = [];
    if (systemMessage && typeof systemMessage === 'string') {
      messages.push({ role: 'system', content: systemMessage });
    }
    
    // 컨텍스트가 있으면 추가 (캐릭터, 세계관 정보)
    if (context && typeof context === 'string') {
      messages.push({ role: 'system', content: `[세계관 컨텍스트]\n${context}` });
    }
    
    messages.push({ role: 'user', content: prompt });

    // 새로운 모델(gpt-5-*)은 max_completion_tokens 사용
    const isNewModel = model && model.startsWith('gpt-5');
    const requestOptions = {
      model,
      messages,
    };
    
    // JSON 형식 응답 요청
    if (req.body.responseFormat === 'json' || responseFormat === 'json') {
      requestOptions.response_format = { type: 'json_object' };
    }
    
    if (isNewModel) {
      requestOptions.max_completion_tokens = Number(maxTokens) || 2000;
    } else {
      requestOptions.temperature = Number(temperature) || 0.7;
      requestOptions.max_tokens = Number(maxTokens) || 2000;
    }

    let completion;
    try {
      completion = await openai.chat.completions.create(requestOptions);
    } catch (err) {
      const msg = String(err?.message || err || '');
      if (msg.includes('not in v1/chat/completions') || msg.includes('not supported')) {
        const fbOptions = {
          model: 'gpt-4o-mini',
          messages,
          temperature: Number(temperature) || 0.7,
          max_tokens: Number(maxTokens) || 2000,
        };
        if (responseFormat === 'json') {
          fbOptions.response_format = { type: 'json_object' };
        }
        const fb = await openai.chat.completions.create(fbOptions);
        const fbResponse = fb.choices[0]?.message?.content || '';
        return res.json({ ok: true, response: fbResponse, model: fb.model, usage: fb.usage, fallback: true });
      }
      throw err;
    }

    let response = completion.choices[0]?.message?.content || '';
    if (!response || !String(response).trim()) {
      try {
        const fbOptions2 = {
          model: 'gpt-4o-mini',
          messages,
          temperature: Number(temperature) || 0.7,
          max_tokens: Number(maxTokens) || 2000,
        };
        if (req.body.responseFormat === 'json' || responseFormat === 'json') {
          fbOptions2.response_format = { type: 'json_object' };
        }
        const fb2 = await openai.chat.completions.create(fbOptions2);
        response = fb2.choices[0]?.message?.content || '';
        return res.json({ ok: true, response, model: fb2.model, usage: fb2.usage, fallback: true });
      } catch (_) {
        // 폴백 실패 시 그대로 진행
      }
    }
    
    return res.json({ 
      ok: true, 
      response,
      model: completion.model,
      usage: completion.usage
    });
  } catch (e) {
    console.error('[GPT] error:', e);
    return res.status(500).json({ 
      ok: false, 
      error: String(e.message || e)
    });
  }
});

// GPT 챕터 생성 API (RPG 통합)
app.post('/api/my/novels/:novelBit/chapters/generate', authenticateToken, async (req, res) => {
  try {
    const db = readUsersDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    const { 
      chapterNum, 
      previousChapters, 
      characters, 
      worldContext,
      userPrompt 
    } = req.body;

    if (!chapterNum) {
      return res.status(400).json({ error: '챕터 번호는 필수입니다.' });
    }

    const apiKey = getApiKey();
    if (!apiKey) {
      return res.status(400).json({ error: 'OpenAI API key가 설정되지 않았습니다. /api/gpt/key로 설정하세요.' });
    }

    const novelPath = getNovelDataPath(user.userBitMax, user.userBitMin, req.params.novelBit);
    
    // 캐릭터 정보 로드
    let charactersData = [];
    if (fs.existsSync(novelPath.charactersRPG)) {
      charactersData = readNDJSON(novelPath.charactersRPG);
    }

    // 시스템 프롬프트 구성
    const systemPrompt = `당신은 소설 작가입니다. 다음 규칙을 절대적으로 지키세요:

1. 입력란 내용을 반영해 자연스럽게 작성
2. 기호 사용 금지 (#, **, *, 등)
3. JSON만 출력, JSON 외 텍스트 출력 금지
4. 누락 없는 필드 출력
5. 캐릭터의 RPG 스탯을 챕터 진행에 따라 자동 업데이트
6. 레벨업 자동 적용
7. 아이템 자동 관리
8. 골드 자동 적용
9. 장비 자동 교체 가능
10. 모든 챕터 기록과 캐릭터 기록을 반영해 다음 내용 작성
11. 전체 스토리 흐름 유지

출력 형식:
{
  "title": "챕터 제목",
  "text": "챕터 본문 (기호 없이 순수 텍스트만)",
  "summary": "챕터 요약",
  "characters": "등장한 캐릭터 설명",
  "items": "등장한 아이템 설명",
  "events": "주요 사건 설명",
  "next": "다음 챕터 예고",
  "characterUpdates": [
    {
      "name": "캐릭터 이름",
      "expGain": 경험치 획득량,
      "goldGain": 골드 변화량 (음수 가능),
      "itemsGained": ["획득한 아이템1", "획득한 아이템2"],
      "itemsUsed": ["사용한 아이템1"],
      "equipmentGained": ["획득한 장비1"],
      "lvUp": 레벨업 여부 (boolean)
    }
  ]
}`;

    // 사용자 프롬프트 구성
    let userPromptText = userPrompt || '다음 챕터를 작성해주세요.';
    
    if (previousChapters && previousChapters.length > 0) {
      userPromptText += '\n\n[이전 챕터들]\n';
      previousChapters.forEach((ch, idx) => {
        userPromptText += `${idx + 1}장: ${ch.chapterTitle}\n${ch.chapterText.substring(0, 500)}...\n\n`;
      });
    }

    if (charactersData && charactersData.length > 0) {
      userPromptText += '\n[현재 캐릭터 상태]\n';
      charactersData.forEach(char => {
        userPromptText += `${char.name} (LV ${char.lv}, HP ${char.hp}, MP ${char.mp}, ATK ${char.atk}, DEF ${char.def}, 골드 ${char.gold})\n`;
        if (char.inventory && char.inventory.length > 0) {
          userPromptText += `  인벤토리: ${char.inventory.join(', ')}\n`;
        }
        if (char.equipment && Object.keys(char.equipment).length > 0) {
          userPromptText += `  장비: ${JSON.stringify(char.equipment)}\n`;
        }
      });
    }

    if (worldContext) {
      userPromptText += `\n[세계관 정보]\n${worldContext}\n`;
    }

    const openai = new OpenAI({ apiKey });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPromptText }
      ],
      temperature: 0.7,
      max_tokens: 4000,
      response_format: { type: 'json_object' }
    });

    const responseText = completion.choices[0]?.message?.content || '';
    let chapterData;
    
    try {
      chapterData = JSON.parse(responseText);
    } catch (parseError) {
      // JSON 파싱 실패 시 텍스트에서 JSON 추출 시도
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        chapterData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('GPT 응답이 유효한 JSON 형식이 아닙니다.');
      }
    }

    // 챕터 저장
    const chapterFile = path.join(novelPath.chapters, `${String(chapterNum).padStart(2, '0')}.ndjson`);
    const bitValues = chapterData.attributePath ? calculateBitValues(chapterData.attributePath) : { max: 0, min: 0, length: 0 };
    
    const chapterRecord = {
      chapterNum: String(chapterNum).padStart(2, '0'),
      chapterTitle: chapterData.title || `제${chapterNum}장`,
      chapterText: chapterData.text || '',
      chapterBitMax: bitValues.max,
      chapterBitMin: bitValues.min,
      charactersInvolved: chapterData.characters ? [chapterData.characters] : [],
      itemsUsed: chapterData.items ? [chapterData.items] : [],
      eventsOccurred: chapterData.events ? [chapterData.events] : [],
      summaryShort: chapterData.summary || '',
      summaryLong: '',
      chapterLv: 1,
      timestamp: new Date().toISOString(),
      characterUpdates: chapterData.characterUpdates || []
    };

    appendNDJSON(chapterFile, chapterRecord);

    // 캐릭터 RPG 업데이트 처리
    if (chapterData.characterUpdates && Array.isArray(chapterData.characterUpdates) && chapterData.characterUpdates.length > 0) {
      if (fs.existsSync(novelPath.charactersRPG)) {
        let characters = readNDJSON(novelPath.charactersRPG);
        
        for (const update of chapterData.characterUpdates) {
          const character = characters.find(c => c.name === update.name);
          if (!character) continue;

          let updatedChar = { ...character };

          if (update.expGain) {
            updatedChar.exp += update.expGain;
          }

          if (update.goldGain !== undefined) {
            updatedChar.gold = Math.max(0, updatedChar.gold + update.goldGain);
          }

          if (update.itemsGained && Array.isArray(update.itemsGained)) {
            updatedChar.inventory = [...(updatedChar.inventory || []), ...update.itemsGained];
          }

          if (update.itemsUsed && Array.isArray(update.itemsUsed)) {
            for (const item of update.itemsUsed) {
              const index = updatedChar.inventory.indexOf(item);
              if (index > -1) {
                updatedChar.inventory.splice(index, 1);
              }
            }
          }

          if (update.equipmentGained && Array.isArray(update.equipmentGained)) {
            for (const equip of update.equipmentGained) {
              const equipType = equip.includes('검') || equip.includes('지팡이') ? 'weapon' :
                              equip.includes('로브') || equip.includes('갑옷') ? 'armor' :
                              equip.includes('반지') ? 'ring' : 'accessory';
              updatedChar.equipment[equipType] = equip;
            }
          }

          while (updatedChar.exp >= updatedChar.expNeeded) {
            updatedChar = applyLevelUp(updatedChar);
          }

          updatedChar.updatedAt = new Date().toISOString();

          const index = characters.findIndex(c => c.name === update.name);
          if (index > -1) {
            characters[index] = updatedChar;
          }
        }

        writeNDJSON(novelPath.charactersRPG, characters);
      }
    }

    // 소설 정보 업데이트
    const novelInfoPath = novelPath.novelInfo;
    if (fs.existsSync(novelInfoPath)) {
      const info = readNDJSON(novelInfoPath);
      if (info.length > 0) {
        const novelData = info[info.length - 1];
        novelData.chapterCount = fs.readdirSync(novelPath.chapters).filter(f => f.endsWith('.ndjson')).length;
        novelData.updatedAt = new Date().toISOString();
        appendNDJSON(novelInfoPath, novelData);
      }
    }

    res.json({ 
      success: true, 
      chapter: chapterRecord,
      characterUpdates: chapterData.characterUpdates || []
    });
  } catch (error) {
    console.error('[GPT Chapter] 생성 오류:', error);
    res.status(500).json({ error: `챕터 생성 중 오류가 발생했습니다: ${error.message}` });
  }
});

// ==================== 프롤로그 관리 API ====================
// 프롤로그 조회
app.get('/api/my/novels/:novelBit/prologue', authenticateToken, (req, res) => {
  try {
    const db = readUsersDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    const novelPath = getNovelDataPath(user.userBitMax, user.userBitMin, req.params.novelBit);
    const prologuePath = novelPath.prologue;

    if (!fs.existsSync(prologuePath)) {
      return res.json({ prologue: null });
    }

    const prologue = readNDJSON(prologuePath);
    res.json({ prologue: prologue.length > 0 ? prologue[prologue.length - 1] : null });
  } catch (error) {
    console.error('[Prologue] 조회 오류:', error);
    res.status(500).json({ error: '프롤로그를 불러오는 중 오류가 발생했습니다.' });
  }
});

// 프롤로그 생성/수정
app.post('/api/my/novels/:novelBit/prologue', authenticateToken, (req, res) => {
  try {
    const db = readUsersDB();
    const user = db.users.find(u => u.id === req.user.id);
    if (!user) return res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });

    const { 
      prologue, 
      world, 
      characters, 
      conflict, 
      background, 
      theme, 
      next 
    } = req.body;

    const novelPath = getNovelDataPath(user.userBitMax, user.userBitMin, req.params.novelBit);
    const prologuePath = novelPath.prologue;

    // characters가 제공되면 초기 캐릭터 데이터로 저장
    if (characters && Array.isArray(characters)) {
      const charactersRPGFile = novelPath.charactersRPG;
      const initialCharacters = characters.map(char => {
        const expNeeded = calculateExpNeeded(char.lv || 1);
        return {
          name: char.name,
          role: char.role || '',
          description: char.description || '',
          lv: char.lv || 1,
          exp: char.exp || 0,
          expNeeded,
          hp: char.hp || 100,
          mp: char.mp || 50,
          atk: char.atk || 10,
          def: char.def || 5,
          gold: char.gold || 0,
          inventory: Array.isArray(char.inventory) ? char.inventory : [],
          equipment: char.equipment || {},
          status: char.status || '정상',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
      });
      writeNDJSON(charactersRPGFile, initialCharacters);
    }

    const prologueData = {
      prologue: prologue || '',
      world: world || '',
      characters: characters || [],
      conflict: conflict || '',
      background: background || '',
      theme: theme || '',
      next: next || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    appendNDJSON(prologuePath, prologueData);
    res.json({ prologue: prologueData });
  } catch (error) {
    console.error('[Prologue] 저장 오류:', error);
    res.status(500).json({ error: '프롤로그 저장 중 오류가 발생했습니다.' });
  }
});

// ==================== 속성 데이터 API (v1.0.5 호환) ====================
// 숫자를 자릿수 배열로 변환
function numberToDigits(num) {
  const str = String(num);
  return str.split('').filter(c => c !== '.' && c !== '-');
}

// BIT 값으로 중첩 경로 생성
function nestedPathFromNumber(label, num) {
  const digits = numberToDigits(num);
  const baseDir = path.join(DATA_DIR, label, ...digits);
  const leaf = label === 'max' ? 'max_bit' : 'min_bit';
  const targetDir = path.join(baseDir, leaf);
  return { targetDir, nestedFile: path.join(targetDir, 'log.ndjson'), baseDir, digits };
}

// 레코드 파일 목록 조회
function listRecordFiles(targetDir) {
  const files = [];
  try {
    if (!fs.existsSync(targetDir)) return files;
    const entries = fs.readdirSync(targetDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('.ndjson')) {
        files.push(path.join(targetDir, entry.name));
      }
    }
  } catch {
    // ignore
  }
  return files;
}

// 재귀적으로 모든 log 파일 찾기
function findAllLogFiles(baseDir, label, digits) {
  const leaf = label === 'max' ? 'max_bit' : 'min_bit';
  const results = [];
  const seen = new Set();
  
  function walkDir(dir) {
    if (!fs.existsSync(dir)) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === leaf) {
            const recordFiles = listRecordFiles(fullPath);
            for (const recordFile of recordFiles) {
              if (!seen.has(recordFile)) {
                seen.add(recordFile);
                results.push(recordFile);
              }
            }
          } else {
            walkDir(fullPath);
          }
        }
      }
    } catch (e) {
      // ignore
    }
  }
  
  const rootLabelDir = path.join(DATA_DIR, label);
  let startDigits = Array.isArray(digits) ? digits.slice() : [];
  let lastNonZero = -1;
  for (let i = startDigits.length - 1; i >= 0; i--) {
    if (startDigits[i] !== '0') { lastNonZero = i; break; }
  }
  if (lastNonZero >= 0) startDigits = startDigits.slice(0, lastNonZero + 1);
  if (startDigits.length === 0 && Array.isArray(digits) && digits.length > 0) startDigits = [digits[0]];

  let startDir = path.join(rootLabelDir, ...startDigits);
  while (!fs.existsSync(startDir) && startDigits.length > 0) {
    startDigits.pop();
    startDir = path.join(rootLabelDir, ...startDigits);
  }
  if (!fs.existsSync(startDir)) startDir = rootLabelDir;

  walkDir(startDir);
  return results;
}

// 디렉토리 내 모든 log 파일 찾기
function findAllLogFilesInDir(dir) {
  const files = [];
  function walk(currentDir) {
    try {
      if (!fs.existsSync(currentDir)) return;
      const entries = fs.readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile() && entry.name.endsWith('.ndjson')) {
          files.push(fullPath);
        }
      }
    } catch {}
  }
  walk(dir);
  return files;
}

// 모든 속성 수집
async function collectAllAttributes() {
  const attributes = new Map();
  const seen = new Set();
  
  const maxDir = path.join(DATA_DIR, 'max');
  if (fs.existsSync(maxDir)) {
    const allLogFiles = findAllLogFilesInDir(maxDir);
    for (const logFile of allLogFiles) {
      try {
        const text = fs.readFileSync(logFile, 'utf8');
        const lines = text.split(/\r?\n/).filter(Boolean);
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.attribute && parsed.attribute.text) {
              const attrText = parsed.attribute.text.trim();
              const key = `${parsed.attribute.bitMax}_${parsed.attribute.bitMin}_${attrText}`;
              if (!seen.has(key)) {
                seen.add(key);
                attributes.set(key, {
                  text: attrText,
                  bitMax: parsed.attribute.bitMax,
                  bitMin: parsed.attribute.bitMin,
                  cellId: parsed.attribute.cellId || key
                });
              }
            }
          } catch {}
        }
      } catch {}
    }
  }
  
  return Array.from(attributes.values());
}

// 모든 속성 목록 조회
app.get('/api/attributes/all', async (req, res) => {
  try {
    const attributes = await collectAllAttributes();
    return res.json({ ok: true, count: attributes.length, attributes });
  } catch (e) {
    console.error('[Attributes] Get all error:', e);
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// 속성 데이터 조회
app.get('/api/attributes/data', (req, res) => {
  try {
    const attributeBitMax = req.query.bitMax !== undefined ? Number(req.query.bitMax) : undefined;
    const attributeBitMin = req.query.bitMin !== undefined ? Number(req.query.bitMin) : undefined;
    const attributeText = req.query.attributeText || '';
    
    if (attributeBitMax === undefined || attributeBitMin === undefined) {
      return res.status(400).json({ ok: false, error: 'bitMax and bitMin query parameters required' });
    }
    
    const limit = Math.min(parseInt(req.query.limit || '100', 10) || 100, 1000);
    let allItems = [];
    
    // MAX 폴더에서 검색
    if (Number.isFinite(attributeBitMax)) {
      const { targetDir, nestedFile, baseDir, digits } = nestedPathFromNumber('max', attributeBitMax);
      const sourceFiles = [];
      if (fs.existsSync(nestedFile)) sourceFiles.push(nestedFile);
      sourceFiles.push(...listRecordFiles(targetDir).filter(f => f !== nestedFile));
      if (sourceFiles.length === 0) {
        sourceFiles.push(...findAllLogFiles(baseDir, 'max', digits));
      }
      for (const logFile of sourceFiles) {
        try {
          const text = fs.readFileSync(logFile, 'utf8');
          const lines = text.split(/\r?\n/).filter(Boolean);
          const items = lines.map(l => {
            try {
              const parsed = JSON.parse(l);
              if (!parsed.attribute) return null;
              if (parsed.attribute.bitMax === attributeBitMax && parsed.attribute.bitMin === attributeBitMin) {
                if (attributeText && parsed.attribute.text) {
                  if (!parsed.attribute.text.includes(attributeText)) return null;
                }
                return {
                  ...parsed,
                  source: { file: logFile },
                  max: parsed.attribute.bitMax,
                  min: parsed.attribute.bitMin,
                  text: parsed.s || parsed.data?.text || '',
                  attributeText: parsed.attribute.text,
                  data: {
                    text: parsed.s || parsed.data?.text || '',
                    bitMax: parsed.max || parsed.data?.bitMax,
                    bitMin: parsed.min || parsed.data?.bitMin
                  }
                };
              }
              return null;
            } catch { return null; }
          }).filter(Boolean);
          allItems.push(...items);
        } catch (e) {
          console.warn('[Attribute] max read error:', logFile, e);
        }
      }
    }
    
    // MIN 폴더에서 검색
    if (Number.isFinite(attributeBitMin)) {
      const { targetDir, nestedFile, baseDir, digits } = nestedPathFromNumber('min', attributeBitMin);
      const sourceFiles = [];
      if (fs.existsSync(nestedFile)) sourceFiles.push(nestedFile);
      sourceFiles.push(...listRecordFiles(targetDir).filter(f => f !== nestedFile));
      if (sourceFiles.length === 0) {
        sourceFiles.push(...findAllLogFiles(baseDir, 'min', digits));
      }
      for (const logFile of sourceFiles) {
        try {
          const text = fs.readFileSync(logFile, 'utf8');
          const lines = text.split(/\r?\n/).filter(Boolean);
          const items = lines.map(l => {
            try {
              const parsed = JSON.parse(l);
              if (!parsed.attribute) return null;
              if (parsed.attribute.bitMax === attributeBitMax && parsed.attribute.bitMin === attributeBitMin) {
                if (attributeText && parsed.attribute.text) {
                  if (!parsed.attribute.text.includes(attributeText)) return null;
                }
                return {
                  ...parsed,
                  source: { file: logFile },
                  max: parsed.attribute.bitMax,
                  min: parsed.attribute.bitMin,
                  text: parsed.s || parsed.data?.text || '',
                  attributeText: parsed.attribute.text,
                  data: {
                    text: parsed.s || parsed.data?.text || '',
                    bitMax: parsed.max || parsed.data?.bitMax,
                    bitMin: parsed.min || parsed.data?.bitMin
                  }
                };
              }
              return null;
            } catch { return null; }
          }).filter(Boolean);
          allItems.push(...items);
        } catch (e) {
          console.warn('[Attribute] min read error:', logFile, e);
        }
      }
    }
    
    // 중복 제거
    const seen = new Set();
    const uniqueItems = [];
    allItems.forEach(item => {
      const key = `${item.t || ''}_${item.s || ''}_${item.max || ''}_${item.min || ''}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueItems.push(item);
      }
    });
    
    // 최신순 정렬
    uniqueItems.sort((a, b) => (b.t || 0) - (a.t || 0));
    
    const slice = uniqueItems.slice(0, limit);
    return res.json({ ok: true, count: slice.length, items: slice });
  } catch (e) {
    console.error('[Attribute] Get error:', e);
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// 속성 데이터 삭제
app.post('/api/attributes/delete', (req, res) => {
  try {
    const { attributeText } = req.body || {};
    if (!attributeText) {
      return res.status(400).json({ ok: false, error: 'attributeText required' });
    }
    
    const bits = calculateBitValues(attributeText);
    let deletedCount = 0;
    const filesProcessed = [];
    
    const filesToCheck = [];
    
    if (Number.isFinite(bits.max)) {
      const { targetDir, nestedFile, baseDir, digits } = nestedPathFromNumber('max', bits.max);
      const sources = [];
      if (fs.existsSync(nestedFile)) sources.push(nestedFile);
      sources.push(...listRecordFiles(targetDir).filter(f => f !== nestedFile));
      if (sources.length === 0) {
        sources.push(...findAllLogFiles(baseDir, 'max', digits));
      }
      filesToCheck.push(...sources);
    }
    
    if (Number.isFinite(bits.min)) {
      const { targetDir, nestedFile, baseDir, digits } = nestedPathFromNumber('min', bits.min);
      const sources = [];
      if (fs.existsSync(nestedFile)) sources.push(nestedFile);
      sources.push(...listRecordFiles(targetDir).filter(f => f !== nestedFile));
      if (sources.length === 0) {
        sources.push(...findAllLogFiles(baseDir, 'min', digits));
      }
      filesToCheck.push(...sources);
    }
    
    const uniqueFiles = [...new Set(filesToCheck)];
    
    for (const filePath of uniqueFiles) {
      if (!fs.existsSync(filePath)) continue;
      
      try {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split(/\r?\n/).filter(Boolean);
        const remainingLines = [];
        let fileDeletedCount = 0;
        
        for (const line of lines) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.attribute && parsed.attribute.text === attributeText) {
              fileDeletedCount++;
            } else {
              remainingLines.push(line);
            }
          } catch {
            remainingLines.push(line);
          }
        }
        
        if (fileDeletedCount > 0) {
          fs.writeFileSync(filePath, remainingLines.join('\n') + (remainingLines.length > 0 ? '\n' : ''), 'utf8');
          deletedCount += fileDeletedCount;
          filesProcessed.push(filePath);
        }
      } catch (e) {
        console.warn('[Delete] File error:', filePath, e);
      }
    }
    
    return res.json({ ok: true, deletedCount, filesProcessed });
  } catch (e) {
    console.error('[Delete] Error:', e);
    return res.status(500).json({ ok: false, error: String(e.message || e) });
  }
});

// 폴더 정보 조회
app.get('/api/tests/folders', (req, res) => {
  try {
    const includeFiles = String(req.query.includeFiles || '').toLowerCase() === 'true';
    const result = { max: [], min: [] };
    const summary = {
      maxFolders: 0,
      minFolders: 0,
      maxFiles: 0,
      minFiles: 0,
      maxRecords: 0,
      minRecords: 0
    };

    const directories = {
      max: path.join(DATA_DIR, 'max'),
      min: path.join(DATA_DIR, 'min')
    };

    for (const [key, dirPath] of Object.entries(directories)) {
      if (!fs.existsSync(dirPath)) {
        result[key] = [];
        continue;
      }

      const folderMap = new Map();
      const files = findAllLogFilesInDir(dirPath);

      for (const filePath of files) {
        const relativeFilePath = path.relative(DATA_DIR, filePath).replace(/\\/g, '/');
        const folderPath = relativeFilePath.split('/').slice(0, -1).join('/') || relativeFilePath;
        let info = folderMap.get(folderPath);
        if (!info) {
          info = { folder: folderPath, files: 0, records: 0 };
          if (includeFiles) info.filePaths = [];
          folderMap.set(folderPath, info);
        }
        info.files += 1;
        if (includeFiles) info.filePaths.push(relativeFilePath);

        try {
          const content = fs.readFileSync(filePath, 'utf8');
          const recordCount = content.split(/\r?\n/).filter(Boolean).length;
          info.records += recordCount;
        } catch {
          // ignore read errors per file
        }
      }

      const folders = Array.from(folderMap.values())
        .sort((a, b) => (a.folder || '').localeCompare(b.folder || '', 'ko', { numeric: true }));
      result[key] = folders;

      const folderCount = folders.length;
      const fileCount = folders.reduce((acc, folder) => acc + (folder.files || 0), 0);
      const recordCount = folders.reduce((acc, folder) => acc + (folder.records || 0), 0);
      summary[`${key}Folders`] = folderCount;
      summary[`${key}Files`] = fileCount;
      summary[`${key}Records`] = recordCount;
    }

    return res.json({
      ok: true,
      generatedAt: new Date().toISOString(),
      summary,
      max: result.max,
      min: result.min
    });
  } catch (error) {
    console.error('[Tests] folders error:', error);
    return res.status(500).json({ ok: false, error: String(error.message || error) });
  }
});

// ==================== 정적 파일 서빙 ====================
app.use('/', express.static(PUBLIC_ROOT, { index: 'database/index.html' }));

// ==================== 서버 시작 ====================
app.listen(PORT, HOST, () => {
  console.log(`🚀 Novel AI v1.0.6 Server listening on http://${HOST}:${PORT}`);
  console.log(`📁 Serving static from: ${PUBLIC_ROOT}`);
  console.log(`💾 Data directory: ${DATA_DIR}`);
});

