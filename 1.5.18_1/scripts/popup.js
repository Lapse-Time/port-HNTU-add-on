import { config } from './config-loader.js';

document.addEventListener('DOMContentLoaded', async function() {
  // Завантажуємо іконку та назву університету з конфігурації
  await loadUniversityHeader();
  
  // Генеруємо розклад динамічно
  await generateScheduleHTML();
  highlightCurrentClass();
  
  // Створюємо AI-assistant кнопку тільки якщо увімкнена
  await createAIAssistantButton();
  
  // Перевіряємо налаштування відображення блоку підтримки
  await handleSupportBlockVisibility();
  
  // Завантажуємо налаштований URL сайту та встановлюємо його в посиланні
  const universityInfo = await config.getUniversityInfo();
  chrome.storage.sync.get({
    websiteUrl: universityInfo.website
  }, (settings) => {
    // Знаходимо посилання на сайт та оновлюємо його href
    const websiteLink = document.querySelector('.links.soc-icon a[href*="kntu.net.ua"]');
    if (websiteLink) {
      websiteLink.href = settings.websiteUrl;
    }
  });
  
  // Устанавливаем случайное изображение из конфигурации
  const randomImage = await config.getRandomMascotImage();
  var imageElement = document.getElementById('image');
  imageElement.innerHTML = '<img src="' + randomImage + '" height="100">';
  
  // Обработчик для кнопки "Розклад занять"
  var scheduleButton = document.getElementById('scheduleButton');
  if (scheduleButton) {
    scheduleButton.addEventListener('click', function() {
      // Перевіряємо авторизацію через storage (так как cookies API больше недоступен)
      chrome.storage.local.get('isAuthorized', function(data) {
        if (data.isAuthorized) {
          // Перевіряємо, чи налаштовано розклад
          chrome.storage.local.get(['userRole', 'selectedId'], function(settings) {
            if (settings.userRole && settings.selectedId) {
              // Відкриваємо сторінку розкладу
              chrome.tabs.create({ url: 'schedule.html' });
            } else {
              // Відкриваємо сторінку налаштувань
              chrome.tabs.create({ url: 'settings.html' });
            }
          });
        } else {
          alert("Для доступу до розкладу необхідно авторизуватись в Moodle. Вас буде перенаправлено на сторінку авторизації.");
          chrome.tabs.create({ url: 'https://mdl.kntu.net.ua/' });
        }
      });
    });
  }
  
  // Находим кнопку "Календар навчального року" по её уникальному id
  var calendarButton = document.getElementById('calendarButton');

  // Добавляем обработчик события клика на кнопку
  calendarButton.addEventListener('click', function() {
    // Открываем страницу в новом окне
    window.open('https://seojacky.github.io/pages/helper-kntu/calendar.html', '_blank', 'width=460,height=740');
  });

  var manifestData = chrome.runtime.getManifest();
  var version = manifestData.version;
  
  var currentDate = new Date();
  var weekNumber = await config.calculateWeekNumber(currentDate);

  var formattedDate = formatDate(currentDate);

  // Форматування тижня з парністю
  var weekNum = parseInt(weekNumber);
  var weekText;
  if (!isNaN(weekNum) && weekNum > 0) {
    var parity = weekNum % 2 === 0 ? "парний" : "непарний";
    weekText = `${weekNum} тиждень (${parity})`;
  } else {
    weekText = "Номер тижня: " + weekNumber;
  }
  var dateText = formattedDate;

  document.getElementById('weekNumber').textContent = weekText;
  document.getElementById('currentDate').textContent = dateText;
  
  var versionText = "єХНТУ v." + version;
  document.getElementById('version').textContent = versionText;
  
  chrome.action.setBadgeText({ text: weekNumber }); // обновляем текст на бейдже по клику
});

// Функція для завантаження іконки та назви університету
async function loadUniversityHeader() {
  const universityInfo = await config.getUniversityInfo();
  
  // Встановлюємо іконку університету
  const iconElement = document.getElementById('university-icon');
  if (iconElement) {
    iconElement.src = `settings/universities/${universityInfo.code}/icon32.png`;
  }
  
  // Встановлюємо назву університету
  const nameElement = document.getElementById('university-name');
  if (nameElement) {
    nameElement.textContent = universityInfo.name;
  }
}

// Функція для обробки видимості блоку підтримки
async function handleSupportBlockVisibility() {
  const defaultUISettings = await config.getDefaultUISettings();
  
  chrome.storage.sync.get({
    showSupportMessage: defaultUISettings.showSupportMessage
  }, (settings) => {
    const supportBlock = document.getElementById('supportBlock');
    if (supportBlock) {
      if (settings.showSupportMessage) {
        supportBlock.style.display = 'block';
      } else {
        supportBlock.style.display = 'none';
      }
    }
  });
}

// Нова функція для створення AI-assistant кнопки
async function createAIAssistantButton() {
  const isEnabled = await config.isAIAssistantEnabled();
  
  if (!isEnabled) {
    // Видаляємо кнопку якщо вона існує але функція вимкнена
    const existingButton = document.getElementById('playRandomSound');
    if (existingButton) {
      existingButton.remove();
    }
    return;
  }
  
  // Перевіряємо чи кнопка вже існує
  if (document.getElementById('playRandomSound')) {
    return; // Кнопка вже існує
  }
  
  // Створюємо кнопку з існуючим HTML
  const aiButton = document.createElement('button');
  aiButton.id = 'playRandomSound';
  aiButton.style.cssText = 'display:flex; align-items:center; justify-content:flex-start; margin-top: 5px; border-radius: 3px; border: 1px solid #b5b4b4; padding: 5px; cursor: pointer;';
  
  aiButton.innerHTML = `
    <img src="img/raccoon_2281230.png" style="height: 20px; width: 20px; margin-right: 8px;" alt="Raccoon Icon">
    AI-assistant
  `;
  
  // Вставляємо кнопку після зображення маскота
  const imageElement = document.getElementById('image');
  if (imageElement) {
    imageElement.parentNode.insertBefore(aiButton, imageElement.nextSibling);
  }
  
  // Додаємо обробник події (існуючий код)
  aiButton.addEventListener('click', async function() {
    const randomSounds = await config.getRandomSounds();
    if (randomSounds.length > 0) {
      const randomIndex = Math.floor(Math.random() * randomSounds.length);
      const randomSoundPath = randomSounds[randomIndex];
      
      var audio = new Audio(randomSoundPath);
      audio.play();
    }
  });
}

// Функція для генерації HTML розкладу з конфігурації
async function generateScheduleHTML() {
  const timetableElement = document.getElementById('timetable');
  const scheduleHTML = await config.generateScheduleHTML();
  timetableElement.innerHTML = scheduleHTML;
}

function formatDate(date) {
  var daysOfWeek = ["неділя", "понеділок", "вівторок", "середа", "четвер", "п'ятниця", "субота"];
  var months = ["січня", "лютого", "березня", "квітня", "травня", "червня", "липня", "серпня", "вересня", "жовтня", "листопада", "грудня"];
  
  var dayOfWeekIndex = date.getDay();
  var dayOfWeek = daysOfWeek[dayOfWeekIndex];
  
  var day = date.getDate();
  var monthIndex = date.getMonth();
  var year = date.getFullYear();

  return "Сьогодні " + dayOfWeek + ", " + day + " " + months[monthIndex] + " " + year;
}

async function highlightCurrentClass() {
  const scheduleItems = document.querySelectorAll('#schedule li');
  const currentTime = await getKyivCurrentTime();

  scheduleItems.forEach(item => {
    const startTime = item.getAttribute('data-start');
    const endTime = item.getAttribute('data-end');
    
    if (startTime && endTime) {
      const startTimeArray = startTime.split(':');
      const endTimeArray = endTime.split(':');
      const startMinutes = parseInt(startTimeArray[0]) * 60 + parseInt(startTimeArray[1]);
      const endMinutes = parseInt(endTimeArray[0]) * 60 + parseInt(endTimeArray[1]);

      if (currentTime >= startMinutes && currentTime < endMinutes) {
        if (item.classList.contains('break')) {
          item.classList.add('current-break');
          item.style.backgroundColor = '#3A65B1';
        } else {
          item.classList.add('current-class');
          item.style.backgroundColor = 'white';
        }
      } else {
        item.classList.remove('current-class', 'current-break');
        item.style.backgroundColor = 'transparent';
      }
    }
  });
}

/**
 * getKyivCurrentTime
 * 
 * Функція повертає поточний час у хвилинах з початку дня (00:00) 
 * для часового поясу з конфігурації.
 * 
 * @returns {number} Кількість хвилин, що минули з опівночі в часовому поясі університету.
 * 
 * Приклад:
 * Якщо зараз у Києві 14:30, функція поверне 870 (14 * 60 + 30).
 */
async function getKyivCurrentTime() {
  const timeZone = await config.getTimeZone();
  
  const options = {
    timeZone: timeZone,
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

document.getElementById('open-settings').addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
});