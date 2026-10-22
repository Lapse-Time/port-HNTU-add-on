import { config } from './config-loader.js';

// Змінні для звукових сповіщень
let soundQueue = [];
let isPlaying = false;
let pulseTimer = null;
let lastPlayedSounds = new Map(); // Захист від подвійного відтворення

// Конвертація часу з рядка в хвилини
function timeStringToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
}

// Функція для отримання поточного часу в Києві у хвилинах
function getKyivCurrentTime() {
    const options = {
        timeZone: 'Europe/Kiev',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false,
    };

    const formatter = new Intl.DateTimeFormat([], options);
    const parts = formatter.formatToParts(new Date());
    
    const hours = parts.find(part => part.type === 'hour').value;
    const minutes = parts.find(part => part.type === 'minute').value;
    
    return parseInt(hours) * 60 + parseInt(minutes);
}

// Перевірка чи сьогодні навчальний день
async function isSchoolDay() {
    return await config.isWorkingDay();
}

// Функція для створення offscreen-документа
async function createOffscreen() {
    try {
        // Перевіряємо чи вже існує offscreen документ
        const existingContexts = await chrome.runtime.getContexts({
            contextTypes: ['OFFSCREEN_DOCUMENT']
        });
        
        if (existingContexts.length > 0) {
            return; // Документ вже існує
        }

        await chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: ['AUDIO_PLAYBACK'],
            justification: 'Відтворення звукових сповіщень для розкладу університету'
        });
        
    } catch (error) {
        console.error('Помилка створення offscreen документа:', error);
        throw error;
    }
}

// Додавання звуку в чергу
function enqueueSound(filePath) {
    soundQueue.push(filePath);
    playNextSound();
}

// Функція для пульсації бейджа
function pulseBadge(start = true) {
    if (start) {
        let isRed = true;
        pulseTimer = setInterval(() => {
            chrome.action.setBadgeBackgroundColor({ 
                color: isRed ? '#FF0000' : '#FF8C00'
            });
            isRed = !isRed;
        }, 500);
    } else {
        clearInterval(pulseTimer);
        chrome.action.setBadgeBackgroundColor({ color: 'blue' });
    }
}

// Відтворення наступного звуку з черги
async function playNextSound() {
    if (isPlaying || soundQueue.length === 0) return;

    isPlaying = true;
    const sound = soundQueue.shift();
    
    try {
        pulseBadge(true);
        await createOffscreen();
        
        // Чекаємо невелику затримку для ініціалізації offscreen документа
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Відправляємо повідомлення до offscreen документа
        const response = await chrome.runtime.sendMessage({ 
            type: 'playSound', 
            filePath: sound 
        });
        
        // Чекаємо завершення відтворення
        await new Promise(resolve => setTimeout(resolve, 2000));
        
    } catch (error) {
        console.error('Помилка відтворення звуку:', error);
        
        // Спробуємо пересоздати offscreen документ
        try {
            const existingContexts = await chrome.runtime.getContexts({
                contextTypes: ['OFFSCREEN_DOCUMENT']
            });
            
            if (existingContexts.length > 0) {
                await chrome.offscreen.closeDocument();
                await new Promise(resolve => setTimeout(resolve, 100));
            }
        } catch (closeError) {
            console.error('Помилка закриття offscreen документа:', closeError);
        }
    } finally {
        pulseBadge(false);
        isPlaying = false;
        
        // Продовжуємо відтворення черги
        if (soundQueue.length > 0) {
            setTimeout(() => playNextSound(), 500);
        }
    }
}

// Функція перевірки розкладу для звукових сповіщень
async function checkSchedule() {
    // Спершу перевіряємо, чи взагалі увімкнені звукові сповіщення —
    // щоб не робити зайву роботу (isSchoolDay, завантаження конфігу),
    // коли обидва типи сповіщень вимкнені.
    const earlySettings = await new Promise((resolve) => {
        chrome.storage.sync.get({
            soundNotifications: false,
            preNotifications: false
        }, resolve);
    });

    if (!earlySettings.soundNotifications && !earlySettings.preNotifications) {
        return;
    }

    // Перевіряємо чи сьогодні навчальний день
    if (!(await isSchoolDay())) {
        return;
    }

    const currentTimeMinutes = getKyivCurrentTime();

    const scheduleMinutes = await config.getScheduleInMinutes();
    if (scheduleMinutes.length === 0) {
        return;
    }

    const notificationSettings = await config.getNotificationSettings();

    // Виходимо раніше поза часовим вікном занять (перша пара мінус
    // попередження за N хвилин — до кінця останньої пари), щоб не робити
    // зайву роботу щопівхвилини цілодобово.
    const preWarningMinutes = notificationSettings.preWarningMinutes || 0;
    const windowStart = Math.min(...scheduleMinutes.map(p => p.startMinutes)) - preWarningMinutes;
    const windowEnd = Math.max(...scheduleMinutes.map(p => p.endMinutes));

    if (currentTimeMinutes < windowStart || currentTimeMinutes > windowEnd) {
        return;
    }

    const soundFiles = await config.getSoundFiles();

    chrome.storage.sync.get({
        soundNotifications: notificationSettings.enabledByDefault?.bellSounds || false,
        preNotifications: notificationSettings.enabledByDefault?.preWarnings || false
    }, (settings) => {

        const now = Date.now();
        
        scheduleMinutes.forEach(period => {
            // Перевірка дзвінка на початок пари
            if (settings.soundNotifications && currentTimeMinutes === period.startMinutes) {
                const soundKey = `start-${period.number}-${period.startMinutes}`;
                if (!lastPlayedSounds.has(soundKey) || (now - lastPlayedSounds.get(soundKey)) > 60000) {
                    enqueueSound(soundFiles.bell);
                    lastPlayedSounds.set(soundKey, now);
                }
            }
            
            // Перевірка дзвінка на кінець пари
            if (settings.soundNotifications && currentTimeMinutes === period.endMinutes) {
                const soundKey = `end-${period.number}-${period.endMinutes}`;
                if (!lastPlayedSounds.has(soundKey) || (now - lastPlayedSounds.get(soundKey)) > 60000) {
                    enqueueSound(soundFiles.bell);
                    lastPlayedSounds.set(soundKey, now);
                }
            }

            // Перевірка попередження за 5 хвилин
            if (settings.preNotifications) {
                const preNotificationTime = period.startMinutes - notificationSettings.preWarningMinutes;
                if (currentTimeMinutes === preNotificationTime) {
                    const soundKey = `pre-${period.number}-${preNotificationTime}`;
                    if (!lastPlayedSounds.has(soundKey) || (now - lastPlayedSounds.get(soundKey)) > 60000) {
                        enqueueSound(soundFiles.preNotification);
                        lastPlayedSounds.set(soundKey, now);
                    }
                }
            }
        });
    });
}

// Обробка повідомлень
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    
    if (message.type === 'playTestSound') {
        enqueueSound(message.filePath);
        sendResponse({ success: true });
        return true;
    }
    
    if (message.type === 'forceScheduleCheck') {
        checkSchedule();
        sendResponse({ success: true });
        return true;
    }
    
    if (message.action === "getWeekNumber") {
        
        // КРИТИЧНО: обгортаємо async код в IIFE і відразу повертаємо true
        (async () => {
            try {
                const weekNumber = await config.calculateWeekNumber(new Date());
                sendResponse({ weekNumber: weekNumber });
            } catch (error) {
                console.error("Background: Помилка розрахунку номера тижня:", error);
                sendResponse({ weekNumber: null, error: error.message });
            }
        })();
        
        return true; // Тримає message port відкритим для async відповіді
    }
    
    // Для інших типів повідомлень
    return false;
});

// Функція для перевірки авторизації Moodle
async function updateAndCheck() {
    var currentDate = new Date();
    var weekNumber = await config.calculateWeekNumber(currentDate);
    
    const authConfig = await config.getAuthConfig();
    
    chrome.cookies.get(
        { url: `https://${authConfig.moodleDomain}`, name: authConfig.moodleCookieName },
        (cookie) => {
            if (cookie && cookie.value) {
                chrome.storage.local.set({ isAuthorized: true });
                chrome.action.setBadgeText({ text: weekNumber });
                chrome.action.setBadgeBackgroundColor({ color: 'blue' });
                chrome.action.setBadgeTextColor({ color: '#FFFFFF' });
            } else {
                chrome.storage.local.set({ isAuthorized: false });
                chrome.action.setBadgeText({ text: weekNumber });
                chrome.action.setBadgeBackgroundColor({ color: '#808080' });
            }
        }
    );
}

// Ініціалізація
chrome.runtime.onInstalled.addListener(async () => {
    updateAndCheck();
    
    // Встановлення початкових налаштувань з конфігурації
    const notificationSettings = await config.getNotificationSettings();
    const defaultUISettings = await config.getDefaultUISettings();
    
    chrome.storage.sync.get({
        soundNotifications: notificationSettings.enabledByDefault?.bellSounds || false,
        preNotifications: notificationSettings.enabledByDefault?.preWarnings || false,
        showSupportMessage: defaultUISettings.showSupportMessage
    }, (current) => {
        if (current.soundNotifications === undefined) {
            chrome.storage.sync.set({ soundNotifications: notificationSettings.enabledByDefault?.bellSounds || false });
        }
        if (current.preNotifications === undefined) {
            chrome.storage.sync.set({ preNotifications: notificationSettings.enabledByDefault?.preWarnings || false });
        }
        if (current.showSupportMessage === undefined) {
            chrome.storage.sync.set({ showSupportMessage: defaultUISettings.showSupportMessage });
        }
    });
});

chrome.runtime.onStartup.addListener(() => {
    updateAndCheck();
});

// Оновлення кожні 60 хвилин
chrome.alarms.create('hourlyUpdate', { periodInMinutes: 60 });

// Налаштування перевірки розкладу кожні 30 секунд
chrome.alarms.create('scheduleCheck', { periodInMinutes: 0.5 });

// Обробка алармів
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'scheduleCheck') {
        checkSchedule();
    } else if (alarm.name === 'hourlyUpdate') {
        updateAndCheck();
    }
});

// Відстеження змін cookie для авторизації
chrome.cookies.onChanged.addListener(async (changeInfo) => {
    const authConfig = await config.getAuthConfig();
    if (
        changeInfo.cookie.name === authConfig.moodleCookieName &&
        changeInfo.cookie.domain === authConfig.moodleDomain
    ) {
        updateAndCheck();
    }
});
