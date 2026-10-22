import { config } from './config-loader.js';

// Завантаження налаштувань при відкритті сторінки
document.addEventListener('DOMContentLoaded', async () => {
    // Отримуємо налаштування з конфігурації
    const notificationSettings = await config.getNotificationSettings();
    const universityInfo = await config.getUniversityInfo();
    const defaultUISettings = await config.getDefaultUISettings();
    
    // Завантаження збережених налаштувань
    chrome.storage.sync.get({
        soundNotifications: notificationSettings.enabledByDefault?.bellSounds || false,
        preNotifications: notificationSettings.enabledByDefault?.preWarnings || false,
        websiteUrl: universityInfo.website,
        showSupportMessage: defaultUISettings.showSupportMessage
    }, (settings) => {
        document.getElementById('soundNotifications').checked = settings.soundNotifications;
        document.getElementById('preNotifications').checked = settings.preNotifications;
        document.getElementById('websiteUrl').value = settings.websiteUrl;
        document.getElementById('showSupportMessage').checked = settings.showSupportMessage;
    });

    // Перевірка наявності звукових файлів
    await checkSoundFiles();
});

// Перевірка наявності звукових файлів
async function checkSoundFiles() {
    const soundFiles = await config.getSoundFiles();
    const soundFilePaths = [soundFiles.bell, soundFiles.preNotification];
    
    const errorMessage = document.getElementById('errorMessage');
    const testButtons = document.querySelectorAll('.test-button');

    try {
        for (const file of soundFilePaths) {
            const response = await fetch(chrome.runtime.getURL(file));
            if (!response.ok) throw new Error(`Файл ${file} не знайдено`);
        }
        errorMessage.style.display = 'none';
        testButtons.forEach(button => button.disabled = false);
    } catch (error) {
        errorMessage.style.display = 'block';
        errorMessage.textContent = 'Помилка: ' + error.message;
        testButtons.forEach(button => button.disabled = true);
    }
}

function showError(message) {
    // Перевіряємо, чи вже існує повідомлення про помилку
    let errorDiv = document.querySelector('.error-message');
    
    if (!errorDiv) {
        // Створюємо новий елемент для відображення помилки
        errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        document.querySelector('.container').insertBefore(errorDiv, document.querySelector('.setting-group'));
    }
    
    errorDiv.textContent = message;
    
    // Автоматично ховаємо повідомлення через 5 секунд
    setTimeout(() => {
        errorDiv.remove();
    }, 5000);
}

// Функція для показу індикатора завантаження
function showSpinner(button, show) {
    const spinner = button.querySelector('.spinner');
    if (spinner) {
        spinner.style.display = show ? 'block' : 'none';
        button.disabled = show;
    }
}

// Функція для тестового відтворення звуку
async function playTestSound(button, soundType) {
    showSpinner(button, true);

    // Встановлюємо таймер на випадок, якщо щось піде не так
    const timeout = setTimeout(() => {
        showSpinner(button, false);
    }, 3000); // максимум 3 секунди

    try {
        const soundFiles = await config.getSoundFiles();
        const soundFile = soundType === 'bell' ? soundFiles.bell : soundFiles.preNotification;
        
        await chrome.runtime.sendMessage({
            type: 'playTestSound',
            filePath: soundFile
        });
        await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
        document.getElementById('errorMessage').style.display = 'block';
        document.getElementById('errorMessage').textContent = 'Помилка відтворення звуку: ' + error.message;
    } finally {
        clearTimeout(timeout);
        showSpinner(button, false);
    }
}

// Функція для показу повідомлення про збереження
function showSaveMessage() {
    const saveMessage = document.getElementById('saveMessage');
    saveMessage.style.display = 'block';
    setTimeout(() => {
        saveMessage.style.display = 'none';
    }, 2000);
}

// Функція валідації URL
function validateUrl(url) {
    try {
        new URL(url);
        return true;
    } catch (error) {
        return false;
    }
}

// Функція для показу/приховування повідомлення про валідацію URL
function showUrlValidation(isValid) {
    const urlInput = document.getElementById('websiteUrl');
    const validationMessage = document.getElementById('urlValidationMessage');
    
    if (isValid) {
        urlInput.classList.remove('error');
        validationMessage.style.display = 'none';
    } else {
        urlInput.classList.add('error');
        validationMessage.style.display = 'block';
    }
}

// Обробники подій для перемикачів звукових сповіщень
document.getElementById('soundNotifications').addEventListener('change', (e) => {
    chrome.storage.sync.set({ 
        soundNotifications: e.target.checked 
    }, showSaveMessage);
});

document.getElementById('preNotifications').addEventListener('change', (e) => {
    chrome.storage.sync.set({ 
        preNotifications: e.target.checked 
    }, showSaveMessage);
});

// Обробник для перемикача повідомлення підтримки
document.getElementById('showSupportMessage').addEventListener('change', (e) => {
    chrome.storage.sync.set({ 
        showSupportMessage: e.target.checked 
    }, showSaveMessage);
});

// Обробник для поля URL сайту
document.getElementById('websiteUrl').addEventListener('input', async (e) => {
    const url = e.target.value.trim();
    const universityInfo = await config.getUniversityInfo();
    const defaultUrl = universityInfo.website;
    
    if (url === '') {
        // Якщо поле порожнє, встановлюємо значення за замовчуванням з конфігурації
        e.target.value = defaultUrl;
        showUrlValidation(true);
        chrome.storage.sync.set({ 
            websiteUrl: defaultUrl 
        }, showSaveMessage);
    } else if (validateUrl(url)) {
        // Якщо URL валідний
        showUrlValidation(true);
        chrome.storage.sync.set({ 
            websiteUrl: url 
        }, showSaveMessage);
    } else {
        // Якщо URL невалідний
        showUrlValidation(false);
    }
});

// Обробник для втрати фокусу поля URL (blur)
document.getElementById('websiteUrl').addEventListener('blur', async (e) => {
    const url = e.target.value.trim();
    const universityInfo = await config.getUniversityInfo();
    const defaultUrl = universityInfo.website;
    
    if (url === '' || !validateUrl(url)) {
        // Якщо поле порожнє або URL невалідний, встановлюємо значення за замовчуванням з конфігурації
        e.target.value = defaultUrl;
        showUrlValidation(true);
        chrome.storage.sync.set({ 
            websiteUrl: defaultUrl 
        }, showSaveMessage);
    }
});

// Додавання обробників подій для тестових кнопок
document.getElementById('testBell').addEventListener('click', (e) => {
    playTestSound(e.currentTarget, 'bell');
});

document.getElementById('testPreNotification').addEventListener('click', (e) => {
    playTestSound(e.currentTarget, 'preNotification');
});