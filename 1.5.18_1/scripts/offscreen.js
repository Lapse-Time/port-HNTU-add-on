chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'playSound') {
        try {
            const audio = new Audio(message.filePath);
            
            // Добавляем обработчики событий для более надежного воспроизведения
            audio.addEventListener('canplaythrough', () => {
                audio.play().then(() => {
                    console.log('Звук успешно воспроизведен:', message.filePath);
                    sendResponse({ success: true });
                }).catch(error => {
                    console.error('Ошибка воспроизведения звука:', error);
                    sendResponse({ success: false, error: error.message });
                });
            });

            audio.addEventListener('error', (error) => {
                console.error('Ошибка загрузки аудио:', error);
                sendResponse({ success: false, error: 'Ошибка загрузки аудио файла' });
            });

            // Устанавливаем громкость
            audio.volume = 0.8;
            
            // Принудительно загружаем аудио
            audio.load();
            
        } catch (error) {
            console.error('Ошибка создания аудио объекта:', error);
            sendResponse({ success: false, error: error.message });
        }
        
        return true; // Указываем, что ответ будет асинхронным
    }
});