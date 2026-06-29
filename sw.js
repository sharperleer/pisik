// ============================================================
//  SERVICE WORKER ДЛЯ ФОНОВОГО ЧТЕНИЯ БУФЕРА
// ============================================================

let questionDB = new Map();
let hasPermission = false;

// ============================================================
//  ПОЛУЧЕНИЕ ДАННЫХ ОТ СТРАНИЦЫ
// ============================================================

self.addEventListener('message', function(event) {
    const data = event.data;
    
    if (data.type === 'UPDATE_DB') {
        // Обновляем базу вопросов
        questionDB = new Map(data.data);
        console.log('📚 База обновлена в Service Worker:', questionDB.size, 'вопросов');
    }
    
    if (data.type === 'PERMISSION_GRANTED') {
        hasPermission = true;
        console.log('✅ Разрешение получено в Service Worker');
        
        // Запускаем периодическую проверку
        startBackgroundCheck();
    }
});

// ============================================================
//  ФОНОВАЯ ПРОВЕРКА БУФЕРА
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

async function checkClipboard() {
    if (!hasPermission || questionDB.size === 0) return;
    
    try {
        // Пытаемся прочитать буфер через Clipboard API
        // В Service Worker это работает в фоне!
        const text = await navigator.clipboard.readText();
        
        if (text && text.trim()) {
            console.log('📝 SW: Текст из буфера:', text);
            const answer = findAnswer(text);
            
            if (answer) {
                console.log('✅ SW: Найден ответ:', answer);
                
                // Обновляем заголовок всех вкладок
                const clients = await self.clients.matchAll();
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
    }
}

let intervalId = null;

function startBackgroundCheck() {
    if (intervalId) return;
    
    console.log('🔄 Запущен фоновый опрос буфера (каждые 2 секунды)');
    
    // Проверяем каждые 2 секунды
    intervalId = setInterval(() => {
        checkClipboard();
    }, 2000);
}

// ============================================================
//  АКТИВАЦИЯ SERVICE WORKER
// ============================================================

self.addEventListener('activate', function(event) {
    console.log('✅ Service Worker активирован');
    
    // Если разрешение уже есть, запускаем проверку
    if (hasPermission) {
        startBackgroundCheck();
    }
});

// ============================================================
//  ОБРАБОТКА СООБЩЕНИЙ ОТ КЛИЕНТОВ
// ============================================================

self.addEventListener('message', function(event) {
    if (event.data.type === 'CHECK_CLIPBOARD') {
        checkClipboard();
    }
});