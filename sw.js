// ============================================================
//  SERVICE WORKER ДЛЯ ФОНОВОЙ РАБОТЫ
// ============================================================

let questionDB = new Map();
let hasPermission = false;
let lastCheckedText = '';

// ============================================================
//  ПОЛУЧЕНИЕ ДАННЫХ ОТ СТРАНИЦЫ
// ============================================================

self.addEventListener('message', function(event) {
    const data = event.data;
    
    if (data.type === 'UPDATE_DB') {
        questionDB = new Map(data.data);
        console.log('📚 SW: База обновлена:', questionDB.size, 'вопросов');
    }
    
    if (data.type === 'PERMISSION_GRANTED') {
        hasPermission = true;
        console.log('✅ SW: Разрешение получено');
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
        const text = await navigator.clipboard.readText();
        
        if (text === lastCheckedText) return;
        lastCheckedText = text;
        
        if (text && text.trim()) {
            console.log('📝 SW: Текст из буфера:', text);
            const answer = findAnswer(text);
            
            if (answer) {
                console.log('✅ SW: Найден ответ:', answer);
                
                // Отправляем ответ странице
                const clients = await self.clients.matchAll({
                    type: 'window',
                    includeUncontrolled: true
                });
                
                clients.forEach(client => {
                    client.postMessage({
                        type: 'UPDATE_TITLE',
                        answer: answer,
                        question: text
                    });
                });
            }
        }
    } catch (e) {
        // Игнорируем
    }
}

// ============================================================
//  ЗАПУСК ФОНОВОГО ОПРОСА
// ============================================================

setInterval(() => {
    checkClipboard();
}, 2000);

self.addEventListener('activate', function(event) {
    console.log('✅ SW: Активирован');
    self.clients.claim();
});

self.addEventListener('install', function(event) {
    console.log('✅ SW: Установлен');
    self.skipWaiting();
});

self.addEventListener('fetch', function(event) {
    event.respondWith(fetch(event.request));
});
