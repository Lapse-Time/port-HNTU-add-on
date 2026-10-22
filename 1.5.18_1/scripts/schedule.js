import { config } from './config-loader.js';

// Елементи інтерфейсу
const datePicker = document.getElementById('datePicker');
const refreshButton = document.getElementById('refreshButton');
const errorMessage = document.getElementById('errorMessage');
const loading = document.getElementById('loading');
const scheduleInfo = document.getElementById('scheduleInfo');
const scheduleTableBody = document.getElementById('scheduleTableBody');
const weeklyScheduleBody = document.getElementById('weeklyScheduleBody');
const dayView = document.getElementById('dayView');
const weekView = document.getElementById('weekView');
const viewModeInputs = document.querySelectorAll('input[name="viewMode"]');

// Функції для роботи з датами
function formatDateForAPI(date) {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
}

function getWeekDates(date) {
    const current = new Date(date);
    const dayOfWeek = current.getDay();
    const diff = current.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const monday = new Date(current.setDate(diff));
    
    const weekDates = [];
    for (let i = 0; i < 5; i++) {
        const day = new Date(monday);
        day.setDate(monday.getDate() + i);
        weekDates.push(day);
    }
    return weekDates;
}

function formatDateForDisplay(date) {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(date).toLocaleDateString('uk-UA', options);
}

function setDefaultDate() {
    const today = new Date();
    datePicker.value = today.toISOString().split('T')[0];
}

// Функції для роботи з API
async function getSchedule(settings, date) {
    const apiConfig = await config.getAPIConfig();
    const endpoints = await config.getAPIEndpoints();
    
    const formattedDate = formatDateForAPI(date);
    const endpoint = settings.userRole === 'student' 
        ? `${apiConfig.baseUrl}${endpoints.scheduleGroup}?groupId=${settings.selectedId}&date=${formattedDate}`
        : `${apiConfig.baseUrl}${endpoints.scheduleInstructor}?instructorId=${settings.selectedId}&date=${formattedDate}`;

    try {
        const response = await fetch(endpoint);
        if (!response.ok) {
            throw new Error(`Помилка отримання розкладу (HTTP ${response.status})`);
        }
        return await response.json();
    } catch (error) {
        throw new Error('Не вдалося завантажити розклад: ' + error.message);
    }
}

// Відображення денного розкладу
async function displayDaySchedule(data) {
    scheduleInfo.textContent = `${data.group || data.instructor} | ${data.day}`;
    scheduleTableBody.innerHTML = '';

    // Отримуємо часи пар з конфігурації
    const lessonTimes = await config.getLessonTimesArray();

    // Визначаємо максимальний номер пари в розкладі
    let maxLessonNumber = 5; // Мінімум 5 пар
    if (data.schedule && Object.keys(data.schedule).length > 0) {
        const lessonNumbers = Object.keys(data.schedule).map(Number);
        const maxInSchedule = Math.max(...lessonNumbers);
        if (maxInSchedule > 5) {
            maxLessonNumber = maxInSchedule;
        }
    }

    // Створюємо рядки для кожної пари від 1 до maxLessonNumber
    for (let lessonNum = 1; lessonNum <= maxLessonNumber; lessonNum++) {
        const row = document.createElement('tr');
        row.setAttribute('data-lesson-number', lessonNum);
        const lesson = data.schedule && data.schedule[lessonNum];

        // Додаємо колонку з часом
        const timeCell = document.createElement('td');
        timeCell.textContent = lessonTimes[lessonNum - 1] || `${lessonNum} пара`;
        timeCell.style.fontWeight = 'bold';
        row.appendChild(timeCell);

        if (lesson) {
            // Визначаємо тип заняття і відповідний клас
            let typeClass = '';
            if (lesson.type) {
                typeClass = lesson.type.toLowerCase();
                if (typeClass.includes('лекц')) typeClass = 'lecture';
                else if (typeClass.includes('практ')) typeClass = 'practice';
                else if (typeClass.includes('лаб')) typeClass = 'lab';
            }

            const titleTd = document.createElement('td');
            titleTd.textContent = lesson.title || '-';
            row.appendChild(titleTd);

            const instructorTd = document.createElement('td');
            instructorTd.textContent = lesson.instructorName || lesson.group || '-';
            row.appendChild(instructorTd);

            const typeTd = document.createElement('td');
            const typeSpan = document.createElement('span');
            typeSpan.className = `type-label type-${typeClass}`;
            typeSpan.textContent = lesson.type || '-';
            typeTd.appendChild(typeSpan);
            row.appendChild(typeTd);

            const weeksTd = document.createElement('td');
            const weeksSpan = document.createElement('span');
            weeksSpan.className = 'weeks-info';
            weeksSpan.textContent = `${lesson.weeks || '-'}${lesson.evenOrOdd ? ` (${lesson.evenOrOdd})` : ''}`;
            weeksTd.appendChild(weeksSpan);
            row.appendChild(weeksTd);
        } else {
            // Порожня пара - додаємо порожні клітинки
            for (let i = 0; i < 4; i++) {
                const td = document.createElement('td');
                td.textContent = '-';
                row.appendChild(td);
            }
        }

        scheduleTableBody.appendChild(row);
    }
}

// Відображення тижневого розкладу
async function displayWeekSchedule(settings) {
    const weekDates = getWeekDates(datePicker.value);
    weeklyScheduleBody.innerHTML = '';
    
    // Отримуємо часи пар з конфігурації
    const lessonTimes = await config.getLessonTimesArray();
    
    // Створюємо рядки для кожної пари (1-7)
    for (let lessonNum = 1; lessonNum <= 7; lessonNum++) {
        const row = document.createElement('tr');
        
        // Додаємо колонку з часом
        const timeCell = document.createElement('td');
        timeCell.textContent = lessonTimes[lessonNum - 1] || `${lessonNum} пара`;
        timeCell.style.fontWeight = 'bold';
        row.appendChild(timeCell);
        
        // Додаємо комірки для кожного дня тижня
        for (const date of weekDates) {
            const cell = document.createElement('td');
            
            try {
                const dayData = await getSchedule(settings, date);
                const lesson = dayData.schedule && dayData.schedule[lessonNum];
                
                if (lesson) {
                    // Визначаємо тип заняття і відповідний клас
                    let typeClass = '';
                    if (lesson.type) {
                        typeClass = lesson.type.toLowerCase();
                        if (typeClass.includes('лекц')) typeClass = 'lecture';
                        else if (typeClass.includes('практ')) typeClass = 'practice';
                        else if (typeClass.includes('лаб')) typeClass = 'lab';
                    }
                    
                    const block = document.createElement('div');
                    block.className = 'lesson-block';

                    const titleDiv = document.createElement('div');
                    const titleStrong = document.createElement('strong');
                    titleStrong.textContent = lesson.title || '-';
                    titleDiv.appendChild(titleStrong);
                    block.appendChild(titleDiv);

                    const typeDiv = document.createElement('div');
                    const typeSpan = document.createElement('span');
                    typeSpan.className = `type-label type-${typeClass}`;
                    typeSpan.textContent = lesson.type || '-';
                    typeDiv.appendChild(typeSpan);
                    block.appendChild(typeDiv);

                    const instructorDiv = document.createElement('div');
                    instructorDiv.textContent = lesson.instructorName || lesson.group || '-';
                    block.appendChild(instructorDiv);

                    const weeksDiv = document.createElement('div');
                    weeksDiv.className = 'weeks-info';
                    weeksDiv.textContent = `${lesson.weeks || '-'}${lesson.evenOrOdd ? ` (${lesson.evenOrOdd})` : ''}`;
                    block.appendChild(weeksDiv);

                    cell.appendChild(block);
                }
            } catch (error) {
                console.error('Помилка завантаження розкладу:', error);
            }
            
            row.appendChild(cell);
        }
        
        weeklyScheduleBody.appendChild(row);
    }
    
    // Додаємо інформацію про тиждень у заголовок
    const startDate = formatDateForDisplay(weekDates[0]);
    const endDate = formatDateForDisplay(weekDates[4]);
    scheduleInfo.textContent = `${settings.roleName} | ${startDate} - ${endDate}`;
}

// === ФУНКЦІЇ ДЛЯ ПІДСВІЧУВАННЯ ПОТОЧНОГО ДНЯ ТА ПАРИ ===

// Отримати поточний час у хвилинах з початку дня в часовому поясі університету
async function getCurrentTimeInMinutes() {
    const timeZone = await config.getTimeZone();
    const now = new Date();

    const options = {
        timeZone: timeZone,
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
    };

    const formatter = new Intl.DateTimeFormat([], options);
    const parts = formatter.formatToParts(now);

    const hours = parseInt(parts.find(part => part.type === 'hour').value);
    const minutes = parseInt(parts.find(part => part.type === 'minute').value);

    return hours * 60 + minutes;
}

// Визначити поточну пару або перерву
async function getCurrentLesson() {
    const currentMinutes = await getCurrentTimeInMinutes();
    const bellSchedule = await config.getBellSchedule();

    for (let i = 0; i < bellSchedule.length; i++) {
        const lesson = bellSchedule[i];
        const startMinutes = config.timeStringToMinutes(lesson.start);
        const endMinutes = config.timeStringToMinutes(lesson.end);

        // Перевіряємо чи зараз пара
        if (currentMinutes >= startMinutes && currentMinutes < endMinutes) {
            return {
                type: 'lesson',
                number: lesson.number,
                start: lesson.start,
                end: lesson.end
            };
        }

        // Перевіряємо чи зараз перерва
        if (i < bellSchedule.length - 1) {
            const nextLesson = bellSchedule[i + 1];
            const breakStart = endMinutes;
            const breakEnd = config.timeStringToMinutes(nextLesson.start);

            if (currentMinutes >= breakStart && currentMinutes < breakEnd) {
                return {
                    type: 'break',
                    currentLessonNumber: lesson.number,
                    nextLessonNumber: nextLesson.number,
                    nextLessonStart: nextLesson.start
                };
            }
        }
    }

    return null;
}

// Підсвітити поточний день тижня
async function highlightCurrentDay() {
    const settings = await config.getScheduleHighlightSettings();
    if (!settings.highlightCurrentDay) return;

    // Очищаємо попередню підсвітку
    document.querySelectorAll('.weekly-table th.current-day').forEach(th => {
        th.classList.remove('current-day');
    });

    // Перевіряємо чи обраний тиждень є поточним
    const weekDates = getWeekDates(datePicker.value);
    const today = new Date();
    const isCurrentWeek = weekDates.some(date =>
        date.toDateString() === today.toDateString()
    );

    if (!isCurrentWeek) return;

    // Отримуємо поточний день тижня (1-5 для Пн-Пт)
    const currentDayOfWeek = today.getDay();
    if (currentDayOfWeek === 0 || currentDayOfWeek === 6) return; // Вихідні

    // Знаходимо і підсвічуємо <th> з відповідним data-day
    const th = document.querySelector(`.weekly-table th[data-day="${currentDayOfWeek}"]`);
    if (th) {
        th.classList.add('current-day');

        // Застосовуємо кастомні стилі з config
        const dayStyle = await config.getCurrentDayStyle();
        th.style.background = `linear-gradient(135deg, ${dayStyle.gradientStart} 0%, ${dayStyle.gradientEnd} 100%)`;
    }
}

// Підсвітити поточну пару
async function highlightCurrentLesson() {
    const settings = await config.getScheduleHighlightSettings();
    if (!settings.highlightCurrentLesson) return;

    const currentViewMode = document.querySelector('input[name="viewMode"]:checked')?.value;

    // Очищаємо попередню підсвітку для обох режимів
    document.querySelectorAll('.weekly-table td.current-lesson').forEach(td => {
        td.classList.remove('current-lesson');
        td.style.backgroundColor = '';
        td.style.border = '';
    });
    document.querySelectorAll('.schedule-table tr.current-lesson').forEach(tr => {
        tr.classList.remove('current-lesson');
        tr.style.backgroundColor = '';
    });

    const currentLesson = await getCurrentLesson();
    if (!currentLesson || currentLesson.type !== 'lesson') return;

    const today = new Date();
    const currentDayOfWeek = today.getDay();
    if (currentDayOfWeek === 0 || currentDayOfWeek === 6) return;

    if (currentViewMode === 'week') {
        // Логіка для тижневого режиму
        const weekDates = getWeekDates(datePicker.value);
        const isCurrentWeek = weekDates.some(date =>
            date.toDateString() === today.toDateString()
        );

        if (!isCurrentWeek) return;

        // Знаходимо рядок з поточною парою
        const rows = document.querySelectorAll('#weeklyScheduleBody tr');
        const lessonRow = rows[currentLesson.number - 1];

        if (lessonRow) {
            // Знаходимо комірку для поточного дня (індекс = currentDayOfWeek, бо перша колонка - це час)
            const lessonCell = lessonRow.children[currentDayOfWeek];

            if (lessonCell) {
                lessonCell.classList.add('current-lesson');

                // Застосовуємо кастомні стилі з config
                const lessonStyle = await config.getCurrentLessonStyle();
                lessonCell.style.backgroundColor = lessonStyle.backgroundColor;
                lessonCell.style.border = `2px solid ${lessonStyle.borderColor}`;
            }
        }
    } else if (currentViewMode === 'day') {
        // Логіка для денного режиму
        const selectedDate = new Date(datePicker.value);
        const isToday = selectedDate.toDateString() === today.toDateString();

        if (!isToday) return;

        // Знаходимо рядок з поточною парою в денному розкладі
        const lessonRow = document.querySelector(`#scheduleTableBody tr[data-lesson-number="${currentLesson.number}"]`);

        if (lessonRow) {
            lessonRow.classList.add('current-lesson');

            // Застосовуємо кастомні стилі з config
            const lessonStyle = await config.getCurrentLessonStyle();
            lessonRow.style.backgroundColor = lessonStyle.backgroundColor;
        }
    }
}

// Показати індикатор перерви
async function showBreakIndicator() {
    const settings = await config.getScheduleHighlightSettings();
    const breakIndicator = document.getElementById('breakIndicator');
    const breakIndicatorText = document.getElementById('breakIndicatorText');

    if (!settings.showBreakIndicator || !breakIndicator) return;

    const currentLesson = await getCurrentLesson();

    if (currentLesson && currentLesson.type === 'break') {
        breakIndicatorText.textContent = `Зараз перерва. Наступна пара (${currentLesson.nextLessonNumber}) о ${currentLesson.nextLessonStart}`;
        breakIndicator.style.display = 'block';

        // Застосовуємо кастомні стилі з config
        const breakStyle = await config.getBreakIndicatorStyle();
        breakIndicator.style.backgroundColor = breakStyle.backgroundColor;
        breakIndicator.style.color = breakStyle.textColor;
        breakIndicator.style.borderLeftColor = breakStyle.borderColor;
    } else {
        breakIndicator.style.display = 'none';
    }
}

// Оновити всі підсвітки
async function updateHighlights() {
    const currentViewMode = document.querySelector('input[name="viewMode"]:checked')?.value;

    if (currentViewMode === 'week') {
        await highlightCurrentDay();
        await highlightCurrentLesson();
        await showBreakIndicator();
    } else if (currentViewMode === 'day') {
        // Для денного режиму - тільки підсвічування поточної пари
        await highlightCurrentLesson();
    }
}

// Запустити автоматичне оновлення підсвічування
let highlightRefreshInterval = null;

async function startAutoRefresh() {
    const settings = await config.getScheduleHighlightSettings();

    // Очищаємо попередній інтервал якщо є
    if (highlightRefreshInterval) {
        clearInterval(highlightRefreshInterval);
    }

    // Запускаємо автоматичне оновлення
    highlightRefreshInterval = setInterval(async () => {
        await updateHighlights();
    }, settings.autoRefreshInterval);
}

// Керування відображенням
async function toggleView(mode) {
    if (mode === 'day') {
        dayView.style.display = 'block';
        weekView.style.display = 'none';
        // Ховаємо індикатор перерви в денному режимі
        const breakIndicator = document.getElementById('breakIndicator');
        if (breakIndicator) breakIndicator.style.display = 'none';
        // Оновлюємо підсвітку при перемиканні на денний режим
        await updateHighlights();
    } else {
        dayView.style.display = 'none';
        weekView.style.display = 'block';
        // Оновлюємо підсвітку при перемиканні на тижневий режим
        await updateHighlights();
    }
    // Зберігаємо вибраний режим
    chrome.storage.local.set({ viewMode: mode });
}

// Оновлення розкладу
async function updateSchedule() {
    setLoading(true);
    errorMessage.style.display = 'none';

    try {
        const settings = await new Promise((resolve) => {
            chrome.storage.local.get(['userRole', 'selectedId', 'roleName'], resolve);
        });

        if (!settings.userRole || !settings.selectedId) {
            throw new Error('Налаштування не знайдено. Будь ласка, налаштуйте розширення.');
        }

        const currentViewMode = document.querySelector('input[name="viewMode"]:checked').value;

        if (currentViewMode === 'day') {
            const scheduleData = await getSchedule(settings, datePicker.value);
            await displayDaySchedule(scheduleData);
            // Оновлюємо підсвічування після завантаження розкладу
            await updateHighlights();
        } else {
            await displayWeekSchedule(settings);
            // Оновлюємо підсвічування після завантаження розкладу
            await updateHighlights();
        }
    } catch (error) {
        showError(error.message);
    } finally {
        setLoading(false);
    }
}

// Обробка помилок і стану завантаження
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    
    // Автоматично ховаємо повідомлення через 5 секунд
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 5000);
}

function setLoading(isLoading) {
    loading.style.display = isLoading ? 'block' : 'none';
    refreshButton.disabled = isLoading;
}

// Ініціалізація сторінки
function initializePage() {
    setDefaultDate();
    
    // Відновлюємо збережений режим перегляду
    chrome.storage.local.get('viewMode', (data) => {
    const savedMode = data.viewMode || 'week'; 
    const radioInput = document.querySelector(`input[name="viewMode"][value="${savedMode}"]`);
    if (radioInput) {
        radioInput.checked = true;
        toggleView(savedMode);
    }
});
    
    // Додавання обробників подій
    refreshButton.addEventListener('click', updateSchedule);
    datePicker.addEventListener('change', updateSchedule);
    
    viewModeInputs.forEach(input => {
        input.addEventListener('change', (e) => {
            toggleView(e.target.value);
            updateSchedule();
        });
    });

    updateSchedule();

    // Запускаємо автоматичне оновлення підсвічування
    startAutoRefresh();

    // === Обробники для календарного плану ===
    const calendarPlanButton = document.getElementById('calendarPlanButton');
    const calendarPlanModal = document.getElementById('calendarPlanModal');
    const modalClose = document.querySelector('.modal-close');
    const closeCalendarPlanBtn = document.getElementById('closeCalendarPlanBtn');
    const copyCalendarPlanBtn = document.getElementById('copyCalendarPlanBtn');
    const disciplineSelect = document.getElementById('disciplineSelect');

    // Відкрити модальне вікно
    if (calendarPlanButton) {
        calendarPlanButton.addEventListener('click', openCalendarPlanModal);
    }

    // Закрити модальне вікно (хрестик)
    if (modalClose) {
        modalClose.addEventListener('click', closeCalendarPlanModal);
    }

    // Закрити модальне вікно (кнопка Закрити)
    if (closeCalendarPlanBtn) {
        closeCalendarPlanBtn.addEventListener('click', closeCalendarPlanModal);
    }

    // Закрити модальне вікно при кліку поза ним
    if (calendarPlanModal) {
        calendarPlanModal.addEventListener('click', (e) => {
            if (e.target === calendarPlanModal) {
                closeCalendarPlanModal();
            }
        });
    }

    // Копіювати текст
    if (copyCalendarPlanBtn) {
        copyCalendarPlanBtn.addEventListener('click', copyCalendarPlanToClipboard);
    }

    // При виборі дисципліни - згенерувати план
    if (disciplineSelect) {
        disciplineSelect.addEventListener('change', async (e) => {
            const disciplineTitle = e.target.value;
            const resultArea = document.getElementById('calendarPlanResult');

            if (!disciplineTitle) {
                resultArea.value = 'Оберіть дисципліну зі списку';
                return;
            }

            resultArea.value = 'Генерація календарного плану...';

            try {
                const plan = await generateCalendarPlan(disciplineTitle);
                resultArea.value = plan;
            } catch (error) {
                console.error('Помилка генерації плану:', error);
                resultArea.value = `Помилка: ${error.message}`;
            }
        });
    }
}

// === ФУНКЦІЇ ДЛЯ КАЛЕНДАРНОГО ПЛАНУ ===

// Глобальна змінна для збережених дисциплін
let allDisciplines = null;

// Зібрати всі дисципліни з поточного тижня (5 запитів)
async function collectDisciplinesFromWeek(settings, selectedDate) {
    const weekDates = getWeekDates(selectedDate);
    const disciplines = new Map(); // key: title, value: {lessons: [...]}

    let loadedDays = 0;

    for (const date of weekDates) {
        try {
            const dayData = await getSchedule(settings, date);
            const dayOfWeek = date.getDay(); // 1-5 для Пн-Пт
            const dayName = ['', 'Понеділок', 'Вівторок', 'Середа', 'Четвер', 'П\'ятниця'][dayOfWeek];

            loadedDays++;
            updateCalendarPlanProgress(`Завантаження розкладу... ${loadedDays}/5`);

            if (dayData.schedule) {
                Object.entries(dayData.schedule).forEach(([lessonNumber, lesson]) => {
                    const title = lesson.title;

                    if (!disciplines.has(title)) {
                        disciplines.set(title, {
                            title: title,
                            lessons: []
                        });
                    }

                    disciplines.get(title).lessons.push({
                        lessonNumber: parseInt(lessonNumber),
                        type: lesson.type,
                        weeks: lesson.weeks,
                        evenOrOdd: lesson.evenOrOdd,
                        dayOfWeek: dayOfWeek,
                        dayName: dayName,
                        instructorName: lesson.instructorName
                    });
                });
            }
        } catch (error) {
            console.error(`Помилка завантаження розкладу для ${formatDateForDisplay(date)}:`, error);
        }
    }

    return disciplines;
}

// Парсинг поля weeks ("1-16", "2,4,6", "1-8,10-16")
function parseWeeks(weeksString) {
    const weeks = [];
    const parts = weeksString.split(',');

    parts.forEach(part => {
        part = part.trim();
        if (part.includes('-')) {
            const [start, end] = part.split('-').map(n => parseInt(n.trim()));
            for (let i = start; i <= end; i++) {
                weeks.push(i);
            }
        } else {
            weeks.push(parseInt(part));
        }
    });

    return weeks.sort((a, b) => a - b);
}

// Перевірка парності тижня
function matchesEvenOdd(weekNumber, evenOrOdd) {
    if (!evenOrOdd || evenOrOdd === 'всі') return true;
    if (evenOrOdd.includes('парн')) return weekNumber % 2 === 0;
    if (evenOrOdd.includes('непарн')) return weekNumber % 2 !== 0;
    return true;
}

// Розрахунок дати для конкретного тижня і дня
function calculateDateForWeek(startDate, weekNumber, dayOfWeek) {
    const start = new Date(startDate);

    // Знаходимо понеділок першого тижня
    const dayOfWeekStart = start.getDay() || 7; // Неділя = 7
    const daysToMonday = dayOfWeekStart === 1 ? 0 : (8 - dayOfWeekStart) % 7;
    const firstMonday = new Date(start);
    firstMonday.setDate(start.getDate() + daysToMonday);

    // Додаємо (weekNumber - 1) тижнів + (dayOfWeek - 1) днів
    const targetDate = new Date(firstMonday);
    targetDate.setDate(firstMonday.getDate() + (weekNumber - 1) * 7 + (dayOfWeek - 1));

    return targetDate;
}

// Форматування дати в dd.MM.yy
function formatDateShort(date) {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    return `${day}.${month}.${year}`;
}

// Визначення семестру
function determineSemester(date) {
    const month = date.getMonth() + 1; // 1-12
    const year = date.getFullYear();

    if (month >= 9 || month <= 1) {
        return `Осінній семестр ${year}`;
    } else {
        return `Весняний семестр ${year}`;
    }
}

// Генерація календарного плану для обраної дисципліни
async function generateCalendarPlan(disciplineTitle) {
    if (!allDisciplines || !allDisciplines.has(disciplineTitle)) {
        return 'Помилка: дисципліна не знайдена';
    }

    const discipline = allDisciplines.get(disciplineTitle);
    const academicYear = await config.getAcademicYear();
    const startDate = new Date(academicYear.startDate);
    const semester = determineSemester(startDate);

    // Збираємо всі заняття з датами, групуючи по (тиждень + дата)
    const weekGroups = new Map(); // key: "weekNumber_dateStr", value: [lessons]

    discipline.lessons.forEach(lesson => {
        const weeks = parseWeeks(lesson.weeks);

        weeks.forEach(weekNumber => {
            if (matchesEvenOdd(weekNumber, lesson.evenOrOdd)) {
                const date = calculateDateForWeek(startDate, weekNumber, lesson.dayOfWeek);
                const dateStr = formatDateShort(date);
                const key = `${weekNumber}_${dateStr}`;

                if (!weekGroups.has(key)) {
                    weekGroups.set(key, []);
                }

                weekGroups.get(key).push({
                    date: date,
                    dateStr: dateStr,
                    weekNumber: weekNumber,
                    lessonNumber: lesson.lessonNumber,
                    dayName: lesson.dayName,
                    type: lesson.type
                });
            }
        });
    });

    // Тепер обробляємо кожну групу та розподіляємо типи
    const allEvents = [];
    const counters = {}; // Окремі лічильники для Л, ЛР, ПР
    const labPairCounters = {}; // Для відстеження пар лабораторних
    const alternatingCounters = {}; // Для чергування типів по тижням (для однієї пари)

    // Сортуємо групи по даті
    const sortedGroups = Array.from(weekGroups.entries()).sort((a, b) => {
        const [keyA, lessonsA] = a;
        const [keyB, lessonsB] = b;
        return lessonsA[0].date - lessonsB[0].date;
    });

    sortedGroups.forEach(([key, groupLessons]) => {
        // Сортуємо пари в групі за номером пари
        groupLessons.sort((a, b) => a.lessonNumber - b.lessonNumber);

        // Перевіряємо чи є змішаний тип (напр. "лекц, лаб")
        const firstLesson = groupLessons[0];
        const typeStr = firstLesson.type.toLowerCase();
        const hasMixedType = typeStr.includes(',');

        if (hasMixedType && groupLessons.length === 1) {
            // Одна пара зі змішаним типом - чергування по тижням
            const types = typeStr.split(',').map(t => t.trim());
            const lesson = groupLessons[0];

            // Створюємо ключ для чергування
            const altKey = typeStr;
            if (!alternatingCounters[altKey]) {
                alternatingCounters[altKey] = 0;
            }

            // Визначаємо поточний тип за чергуванням
            const currentTypeIndex = alternatingCounters[altKey] % types.length;
            const currentType = types[currentTypeIndex];
            alternatingCounters[altKey]++;

            let typeCode = '';
            if (currentType.includes('лекц')) {
                typeCode = 'Л';
            } else if (currentType.includes('лаб')) {
                typeCode = 'ЛР';
            } else if (currentType.includes('практ')) {
                typeCode = 'ПР';
            } else {
                typeCode = currentType.substring(0, 2).toUpperCase();
            }

            // Ініціалізуємо лічильник
            if (!counters[typeCode]) {
                counters[typeCode] = 0;
            }

            // Для лабораторних (ЛР) - 2 пари на одну роботу
            if (typeCode === 'ЛР') {
                if (!labPairCounters[typeCode]) {
                    labPairCounters[typeCode] = 1;
                    counters[typeCode] = 1;
                } else {
                    labPairCounters[typeCode]++;
                    if (labPairCounters[typeCode] > 2) {
                        labPairCounters[typeCode] = 1;
                        counters[typeCode]++;
                    }
                }
            } else {
                // Для лекцій (Л) і практичних (ПР) - 1 пара на заняття
                counters[typeCode]++;
            }

            allEvents.push({
                date: lesson.date,
                dateStr: lesson.dateStr,
                weekNumber: lesson.weekNumber,
                lessonNumber: lesson.lessonNumber,
                dayName: lesson.dayName,
                typeCode: typeCode,
                typeNumber: counters[typeCode],
                label: `${typeCode}${counters[typeCode]}`
            });

            // Якщо це лабораторна, додаємо віртуальну другу пару
            if (typeCode === 'ЛР' && labPairCounters[typeCode] === 1) {
                allEvents.push({
                    date: lesson.date,
                    dateStr: lesson.dateStr,
                    weekNumber: lesson.weekNumber,
                    lessonNumber: lesson.lessonNumber + 1,
                    dayName: lesson.dayName,
                    typeCode: typeCode,
                    typeNumber: counters[typeCode],
                    label: `${typeCode}${counters[typeCode]}`
                });
            }
        } else if (hasMixedType && groupLessons.length > 1) {
            // Декілька пар зі змішаним типом - розподіл по парам
            // Розбираємо змішаний тип на окремі частини
            const types = typeStr.split(',').map(t => t.trim());

            // Розподіляємо типи по парам
            groupLessons.forEach((lesson, index) => {
                let typeCode = '';

                if (index < types.length) {
                    const currentType = types[index];
                    if (currentType.includes('лекц')) {
                        typeCode = 'Л';
                    } else if (currentType.includes('лаб')) {
                        typeCode = 'ЛР';
                    } else if (currentType.includes('практ')) {
                        typeCode = 'ПР';
                    } else {
                        typeCode = currentType.substring(0, 2).toUpperCase();
                    }
                } else {
                    // Якщо пар більше ніж типів, беремо останній тип
                    const lastType = types[types.length - 1];
                    if (lastType.includes('лаб')) {
                        typeCode = 'ЛР';
                    } else {
                        typeCode = 'Л';
                    }
                }

                // Ініціалізуємо лічильник
                if (!counters[typeCode]) {
                    counters[typeCode] = 0;
                }

                // Для лабораторних (ЛР) - 2 пари на одну роботу
                if (typeCode === 'ЛР') {
                    if (!labPairCounters[typeCode]) {
                        labPairCounters[typeCode] = 1;
                        counters[typeCode] = 1;
                    } else {
                        labPairCounters[typeCode]++;
                        if (labPairCounters[typeCode] > 2) {
                            labPairCounters[typeCode] = 1;
                            counters[typeCode]++;
                        }
                    }
                } else {
                    // Для лекцій (Л) і практичних (ПР) - 1 пара на заняття
                    counters[typeCode]++;
                }

                allEvents.push({
                    date: lesson.date,
                    dateStr: lesson.dateStr,
                    weekNumber: lesson.weekNumber,
                    lessonNumber: lesson.lessonNumber,
                    dayName: lesson.dayName,
                    typeCode: typeCode,
                    typeNumber: counters[typeCode],
                    label: `${typeCode}${counters[typeCode]}`
                });

                // Якщо це перша пара лабораторної (ЛР), додаємо віртуальну другу пару
                if (typeCode === 'ЛР' && labPairCounters[typeCode] === 1) {
                    allEvents.push({
                        date: lesson.date,
                        dateStr: lesson.dateStr,
                        weekNumber: lesson.weekNumber,
                        lessonNumber: lesson.lessonNumber + 1,
                        dayName: lesson.dayName,
                        typeCode: typeCode,
                        typeNumber: counters[typeCode],
                        label: `${typeCode}${counters[typeCode]}`
                    });
                }
            });
        } else {
            // Не змішаний тип - обробляємо як раніше
            groupLessons.forEach(lesson => {
                let typeCode = '';
                const type = lesson.type.toLowerCase();

                if (type.includes('лекц')) {
                    typeCode = 'Л';
                } else if (type.includes('лаб')) {
                    typeCode = 'ЛР';
                } else if (type.includes('практ')) {
                    typeCode = 'ПР';
                } else {
                    typeCode = lesson.type.substring(0, 2).toUpperCase();
                }

                // Ініціалізуємо лічільник
                if (!counters[typeCode]) {
                    counters[typeCode] = 0;
                }

                // Для лабораторних (ЛР) - 2 пари на одну роботу
                if (typeCode === 'ЛР') {
                    if (!labPairCounters[typeCode]) {
                        labPairCounters[typeCode] = 1;
                        counters[typeCode] = 1;
                    } else {
                        labPairCounters[typeCode]++;
                        if (labPairCounters[typeCode] > 2) {
                            labPairCounters[typeCode] = 1;
                            counters[typeCode]++;
                        }
                    }
                } else {
                    // Для лекцій (Л) і практичних (ПР) - 1 пара на заняття
                    counters[typeCode]++;
                }

                allEvents.push({
                    date: lesson.date,
                    dateStr: lesson.dateStr,
                    weekNumber: lesson.weekNumber,
                    lessonNumber: lesson.lessonNumber,
                    dayName: lesson.dayName,
                    typeCode: typeCode,
                    typeNumber: counters[typeCode],
                    label: `${typeCode}${counters[typeCode]}`
                });
            });
        }
    });

    // Сортуємо по даті та номеру пари
    allEvents.sort((a, b) => {
        if (a.date.getTime() !== b.date.getTime()) {
            return a.date - b.date;
        }
        return a.lessonNumber - b.lessonNumber;
    });

    // Формуємо текст календарного плану
    let plan = `Календарний план з дисципліни "${disciplineTitle}"\n`;
    plan += `${semester}\n\n`;

    allEvents.forEach(event => {
        plan += `${event.dateStr} - ${event.label}  (${event.weekNumber} тиждень, ${event.lessonNumber} пара)\n`;
    });

    return plan;
}

// Оновлення прогресу завантаження
function updateCalendarPlanProgress(message) {
    const resultArea = document.getElementById('calendarPlanResult');
    if (resultArea) {
        resultArea.value = message;
    }
}

// Відкрити модальне вікно календарного плану
async function openCalendarPlanModal() {
    const modal = document.getElementById('calendarPlanModal');
    const select = document.getElementById('disciplineSelect');
    const resultArea = document.getElementById('calendarPlanResult');

    if (!modal || !select || !resultArea) return;

    // Показуємо модальне вікно
    modal.style.display = 'flex';

    // Очищаємо попередні дані
    select.innerHTML = '<option value="">-- Оберіть дисципліну --</option>';
    resultArea.value = 'Завантаження розкладу...';

    try {
        // Отримуємо налаштування
        const settings = await new Promise((resolve) => {
            chrome.storage.local.get(['userRole', 'selectedId', 'roleName'], resolve);
        });

        if (!settings.userRole || !settings.selectedId) {
            resultArea.value = 'Помилка: налаштування не знайдено';
            return;
        }

        // Збираємо дисципліни з поточного тижня
        allDisciplines = await collectDisciplinesFromWeek(settings, datePicker.value);

        // Заповнюємо dropdown
        if (allDisciplines.size === 0) {
            resultArea.value = 'На обраному тижні не знайдено жодної дисципліни.\nОберіть інший тиждень в розкладі.';
            return;
        }

        allDisciplines.forEach((discipline, title) => {
            const option = document.createElement('option');
            option.value = title;
            option.textContent = title;
            select.appendChild(option);
        });

        resultArea.value = 'Оберіть дисципліну зі списку';

    } catch (error) {
        console.error('Помилка завантаження дисциплін:', error);
        resultArea.value = `Помилка: ${error.message}`;
    }
}

// Закрити модальне вікно
function closeCalendarPlanModal() {
    const modal = document.getElementById('calendarPlanModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// Копіювати текст в буфер обміну
async function copyCalendarPlanToClipboard() {
    const resultArea = document.getElementById('calendarPlanResult');
    if (!resultArea || !resultArea.value) return;

    try {
        await navigator.clipboard.writeText(resultArea.value);

        // Показуємо повідомлення про успіх
        const btn = document.getElementById('copyCalendarPlanBtn');
        const originalText = btn.textContent;
        btn.textContent = '✓ Скопійовано!';
        btn.style.backgroundColor = '#4caf50';

        setTimeout(() => {
            btn.textContent = originalText;
            btn.style.backgroundColor = '';
        }, 2000);
    } catch (error) {
        console.error('Помилка копіювання:', error);
        alert('Не вдалося скопіювати текст');
    }
}

// Запуск ініціалізації
document.addEventListener('DOMContentLoaded', async () => {
    chrome.storage.local.get('isAuthorized', async (data) => {
        if (!data.isAuthorized) {
            const universityInfo = await config.getUniversityInfo();
            document.body.innerHTML = `
                <div style="padding: 20px; text-align: center;">
                    <h2>Доступ заборонено</h2>
                    <p>Для доступу до розкладу необхідно авторизуватись в Moodle.</p>
                    <a href="${universityInfo.moodleUrl}" target="_blank" 
                       style="display: inline-block; padding: 10px 20px; background-color: #4688F1; 
                              color: white; text-decoration: none; border-radius: 4px; margin-top: 10px;">
                        Перейти до Moodle
                    </a>
                </div>`;
            return;
        }
        
        // Перевіряємо чи є налаштування
        chrome.storage.local.get(['userRole', 'selectedId'], (settings) => {
            if (!settings.userRole || !settings.selectedId) {
                document.body.innerHTML = `
                    <div style="padding: 20px; text-align: center;">
                        <h2>Налаштування не знайдено</h2>
                        <p>Для перегляду розкладу необхідно налаштувати розширення.</p>
                        <a href="settings.html" 
                           style="display: inline-block; padding: 10px 20px; background-color: #4688F1; 
                                  color: white; text-decoration: none; border-radius: 4px; margin-top: 10px;">
                            Перейти до налаштувань
                        </a>
                    </div>`;
                return;
            }
            
            initializePage();
        });
    });
});