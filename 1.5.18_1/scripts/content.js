// content.js

var weekNumber; // Глобальна змінна
var retryCount = 0;
var maxRetries = 5;
var navItemAddAttempts = 0; // Лічильник спроб додавання в навігацію
var maxNavItemAttempts = 10;

// Функція для отримання номера тижня з повторними спробами
function getWeekNumber() {
    chrome.runtime.sendMessage({ action: "getWeekNumber" }, function(response) {
        // Перевірка на помилки Chrome Runtime
        if (chrome.runtime.lastError) {
            console.error("Chrome Runtime Error:", chrome.runtime.lastError.message);
            
            // Повторна спроба через 500ms
            if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(getWeekNumber, 500);
            } else {
                console.error("Не вдалося отримати номер тижня після всіх спроб.");
            }
            return;
        }

        if (response && response.weekNumber) {
            weekNumber = response.weekNumber;
            addNavItem();
        } else {
            console.error("Відповідь не містить weekNumber:", response);
            
            // Повторна спроба
            if (retryCount < maxRetries) {
                retryCount++;
                setTimeout(getWeekNumber, 500);
            }
        }
    });
}

// Запускаємо отримання номера тижня
getWeekNumber();

// Функція для додавання або оновлення елемента навігації
function addNavItem() {
    // Перевіряємо, чи елемент навігації вже існує
    let existingNavItem = document.querySelector('.primary-navigation .week-number');
    
    if (existingNavItem) {
        return;
    }

    // Знаходимо навігаційний список
    var navList = document.querySelector('.primary-navigation .moremenu ul[role="menubar"]');
    
    if (!navList) {
        navItemAddAttempts++;
        
        if (navItemAddAttempts >= maxNavItemAttempts) {
            console.warn("Навігація не знайдена після всіх спроб. Можливо, це сторінка без навігації.");
            return;
        }
        
        console.warn(`Навігація не знайдена. Спроба ${navItemAddAttempts} з ${maxNavItemAttempts}...`);
        setTimeout(addNavItem, 500);
        return;
    }

    // Створюємо новий елемент списку
    var newListItem = document.createElement("li");
    newListItem.setAttribute("data-key", "weeknumber");
    newListItem.setAttribute("class", "nav-item week-number");
    newListItem.setAttribute("role", "none");
    newListItem.setAttribute("data-forceintomoremenu", "false");

    // Створюємо посилання
    var newLink = document.createElement("a");
    newLink.setAttribute("role", "menuitem");
    newLink.setAttribute("class", "nav-link");
    newLink.setAttribute("href", "#");
    newLink.setAttribute("data-disableactive", "true");
    newLink.setAttribute("tabindex", "-1");
    newLink.setAttribute("style", "font-weight: bold; color: #0077cc;");
    newLink.textContent = weekNumber + " тиждень";

    // Запобігаємо переходу по посиланню
    newLink.addEventListener("click", function(event) {
        event.preventDefault();
    });

    // Додаємо іконку зі знаком питання
    addQuestionIcon(newLink);

    // Додаємо посилання в елемент списку
    newListItem.appendChild(newLink);

    // Вставляємо перед кнопкою "Більше" або в кінець
    var moreButton = navList.querySelector('.dropdownmoremenu');
    if (moreButton) {
        navList.insertBefore(newListItem, moreButton);
    } else {
        navList.appendChild(newListItem);
    }

    // Додаємо стилі
    addStyles();
    
    // Зупиняємо MutationObserver після успішного додавання
    if (typeof observer !== 'undefined') {
        observer.disconnect();
    }
}

// Функція для додавання іконки питання
function addQuestionIcon(linkElement) {
    var questionIcon = document.createElement("span");
    questionIcon.setAttribute("class", "question-icon");
    questionIcon.textContent = " ?";

    // Додаємо обробник кліку на іконку
    questionIcon.addEventListener("click", function(event) {
        event.preventDefault();
        event.stopPropagation();
        showModal(event.target);
    });

    linkElement.appendChild(questionIcon);
}

// Функція для додавання стилів
function addStyles() {
    // Перевіряємо чи стилі вже додані
    if (document.getElementById('week-number-styles')) {
        return;
    }

    const style = document.createElement('style');
    style.id = 'week-number-styles';
    style.textContent = `
        span.question-icon {
            display: inline-block;
            border-radius: 50%;
            text-align: center;
            border: 1px solid #0077cc;
            background-color: #f0f8ff;
            padding: 2px 6px;
            margin-left: 6px;
            line-height: 1;
            cursor: pointer;
            font-size: 0.85em;
            transition: all 0.2s ease;
        }
        span.question-icon:hover {
            background-color: #0077cc;
            color: white;
            transform: scale(1.1);
        }
    `;
    document.head.appendChild(style);
}

// Функція для показу модального вікна
function showModal(iconElement) {
    // Перевіряємо, чи вже існує модальне вікно
    if (document.querySelector('.modal-window')) {
        return;
    }

    // Створюємо оверлей
    var overlay = document.createElement("div");
    overlay.classList.add('modal-overlay');
    overlay.setAttribute("style", `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 9998;
        backdrop-filter: blur(2px);
    `);

    // Створюємо модальне вікно
    var modal = document.createElement("div");
    modal.classList.add('modal-window');
    
    modal.setAttribute("style", `
        position: fixed;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 340px;
        max-width: 90vw;
        background-color: white;
        border-radius: 12px;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        z-index: 9999;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        border: 1px solid #e0e0e0;
        box-sizing: border-box;
        animation: modalFadeIn 0.3s ease;
    `);

    // Додаємо анімацію
    if (!document.getElementById('modal-animation-styles')) {
        const animStyle = document.createElement('style');
        animStyle.id = 'modal-animation-styles';
        animStyle.textContent = `
            @keyframes modalFadeIn {
                from {
                    opacity: 0;
                    transform: translate(-50%, -45%);
                }
                to {
                    opacity: 1;
                    transform: translate(-50%, -50%);
                }
            }
        `;
        document.head.appendChild(animStyle);
    }

    // Контент модального вікна
    var modalContent = `
        <div style="padding: 24px;">
            <div style="text-align: center; margin-bottom: 16px;">
                <div style="font-size: 42px; margin-bottom: 8px;">📚</div>
                <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: #333;">
                    Розширення єХНТУ
                </h3>
            </div>
            <p style="font-size: 14px; line-height: 1.6; color: #666; margin: 0 0 16px 0; text-align: center;">
                Номер тижня додано автоматично розширенням для Chrome
            </p>
            <div style="background: linear-gradient(135deg, #7FC3E8 0%, #9DEADA 100%); 
                        padding: 12px; border-radius: 8px; text-align: center;">
                <a href="https://chromewebstore.google.com/detail/%D1%94%D1%85%D0%BD%D1%82%D1%83/kfhobnegcnngjhbgkbfchopkcomdpfap/reviews" 
                   target="_blank" 
                   style="color: #fff; text-decoration: none; font-weight: 600; font-size: 15px;">
                    ⭐ Залиши відгук про розширення! 😉
                </a>
            </div>
        </div>
    `;

    modal.innerHTML = modalContent;

    // Хрестик для закриття
    var closeButton = document.createElement("span");
    closeButton.innerHTML = "&times;";
    closeButton.setAttribute("style", `
        position: absolute;
        top: 12px;
        right: 16px;
        font-size: 28px;
        font-weight: 300;
        color: #999;
        cursor: pointer;
        line-height: 1;
        transition: color 0.2s ease;
    `);

    // Функція закриття
    const closeModal = function() {
        if (document.body.contains(modal)) {
            document.body.removeChild(modal);
        }
        if (document.body.contains(overlay)) {
            document.body.removeChild(overlay);
        }
    };

    // Hover ефекти
    closeButton.addEventListener("mouseenter", function() {
        closeButton.style.color = "#333";
    });
    closeButton.addEventListener("mouseleave", function() {
        closeButton.style.color = "#999";
    });

    // Обробники закриття
    closeButton.addEventListener("click", closeModal);
    overlay.addEventListener("click", closeModal);

    modal.appendChild(closeButton);

    // Додаємо до DOM
    document.body.appendChild(overlay);
    document.body.appendChild(modal);

    // Закриття по ESC
    const closeOnEsc = function(event) {
        if (event.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', closeOnEsc);
        }
    };
    document.addEventListener('keydown', closeOnEsc);
}

// Спостерігач за змінами DOM
const observer = new MutationObserver(function(mutations) {
    // Якщо елемент вже існує, не виконуємо перевірки
    if (document.querySelector('.primary-navigation .week-number')) {
        observer.disconnect();
        return;
    }

    mutations.forEach(function(mutation) {
        if (mutation.addedNodes.length) {
            const navExists = document.querySelector('.primary-navigation .moremenu');
            
            if (navExists && weekNumber) {
                addNavItem();
            }
        }
    });
});

// Запускаємо спостерігач
function startObserver() {
    if (document.body) {
        observer.observe(document.body, { 
            childList: true, 
            subtree: true 
        });
    } else {
        setTimeout(startObserver, 100);
    }
}

// Ініціалізація
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
} else {
    startObserver();
}
