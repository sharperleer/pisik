// ============================================================
//  SERVICE WORKER ДЛЯ ФОНОВОГО ЧТЕНИЯ БУФЕРА
// ============================================================

let questionDB = new Map();
let hasPermission = false;
let lastCheckedText = '';
let clientsList = [];

// ============================================================
//  ПОЛУЧЕНИЕ ДАННЫХ ОТ СТРАНИЦЫ
// ============================================================

self.addEventListener('message', function(event) {
    const data = event.data;
    
    if (data.type === 'UPDATE_DB') {
        // Обновляем базу вопросов
        questionDB = new Map(data.data);
        console.log('📚 SW: База обновлена:', questionDB.size, 'вопросов');
    }
    
    if (data.type === 'PERMISSION_GRANTED') {
        hasPermission = true;
        console.log('✅ SW: Разрешение получено');
        
        // Запускаем периодическую проверку
        startBackgroundCheck();
    }
});

// ============================================================
//  ФУНКЦИИ ПОИСКА
// ============================================================

function normalizeText(str) {
    if (!str) return '';
    return str.trim()
              .toLowerCase()
              .replace(/[^\wа-яё\s\-]/gi, ' ')
              .replace(/\s+/g, ' ')
              .trim();
}

function findAnswer(query) {
    const normalizedQuery = normalizeText(query);
    if (!normalizedQuery) return null;
    for (let [question, answer] of questionDB) {
        if (normalizeText(question) === normalizedQuery) {
            return answer;
        }
    }
    return null;
}

// ============================================================
//  ФОНОВАЯ ПРОВЕРКА БУФЕРА
// ============================================================

async function checkClipboard() {
    if (!hasPermission || questionDB.size === 0) return;
    
    try {
        // Пытаемся прочитать буфер через Clipboard API
        const text = await navigator.clipboard.readText();
        
        // Если текст не изменился - пропускаем
        if (text === lastCheckedText) return;
        lastCheckedText = text;
        
        if (text && text.trim()) {
            console.log('📝 SW: Текст из буфера:', text);
            const answer = findAnswer(text);
            
            if (answer) {
                console.log('✅ SW: Найден ответ:', answer);
                
                // Отправляем ответ ВСЕМ открытым вкладкам
                const clients = await self.clients.matchAll({
                    type: 'window',
                    includeUncontrolled: true
                });
                
                clients.forEach(client => {
                    client.postMessage({
                        type: 'UPDATE_TITLE',
                        answer: answer
                    });
                });
            }
        }
    } catch (e) {
        // Игнорируем ошибки
        if (e.name === 'NotAllowedError') {
            console.warn('⛔ SW: Нет разрешения');
        }
    }
}

// ============================================================
//  ЗАПУСК ФОНОВОГО ОПРОСА
// ============================================================

let intervalId = null;

function startBackgroundCheck() {
    if (intervalId) return;
    
    console.log('🔄 SW: Запущен фоновый опрос буфера (каждые 2 секунды)');
    
    // Проверяем каждые 2 секунды
    intervalId = setInterval(() => {
        checkClipboard();
    }, 2000);
}

// ============================================================
//  АКТИВАЦИЯ SERVICE WORKER
// ============================================================

self.addEventListener('activate', function(event) {
    console.log('✅ SW: Активирован');
    
    // Если разрешение уже есть, запускаем проверку
    if (hasPermission) {
        startBackgroundCheck();
    }
});

self.addEventListener('install', function(event) {
    console.log('✅ SW: Установлен');
    self.skipWaiting();
});

// ============================================================
//  ПЕРЕХВАТ FETCH ЗАПРОСОВ (для демонстрации работы)
// ============================================================

self.addEventListener('fetch', function(event) {
    // Просто проксируем запросы, чтобы SW был активен
    event.respondWith(fetch(event.request));
});
