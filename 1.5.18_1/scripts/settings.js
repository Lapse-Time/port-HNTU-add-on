import { config } from './config-loader.js';

// Функції для отримання даних з API
async function getFaculties() {
  try {
    const apiUrl = await config.getFullAPIUrl('faculties');
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error('Помилка отримання факультетів');
    }
    return await response.json();
  } catch (error) {
    showError('Не вдалося завантажити список факультетів: ' + error.message);
    return [];
  }
}

function showError(message) {
  // Перевіряємо, чи вже існує повідомлення про помилку
  let errorDiv = document.querySelector('.error-message');
  
  if (!errorDiv) {
    // Створюємо новий елемент для відображення помилки
    errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    document.querySelector('.container').insertBefore(errorDiv, document.querySelector('.role-select'));
  }
  
  errorDiv.textContent = message;
  
  // Автоматично ховаємо повідомлення через 5 секунд
  setTimeout(() => {
    errorDiv.remove();
  }, 5000);
}

async function getGroupsByFaculty(idFaculty) {
  try {
    const baseUrl = await config.getAPIBaseUrl();
    const endpoints = await config.getAPIEndpoints();
    const apiUrl = `${baseUrl}${endpoints.groups}?idFaculty=${idFaculty}`;
    
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error('Немає доступних груп для цього факультету');
    }
    return data;
  } catch (error) {
    showError(`Помилка отримання груп: ${error.message}`);
    return [];
  }
}

async function getCafedrasByFaculty(idFaculty) {
  try {
    const baseUrl = await config.getAPIBaseUrl();
    const endpoints = await config.getAPIEndpoints();
    const apiUrl = `${baseUrl}${endpoints.cafedras}?idFaculty=${idFaculty}`;
    
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error('Помилка отримання кафедр');
    }
    return await response.json();
  } catch (error) {
    showError('Не вдалося завантажити список кафедр: ' + error.message);
    return [];
  }
}

async function getInstructorsByCafedra(idCafedra) {
  try {
    const baseUrl = await config.getAPIBaseUrl();
    const endpoints = await config.getAPIEndpoints();
    const apiUrl = `${baseUrl}${endpoints.instructors}?idCafedra=${idCafedra}`;
    
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error('Помилка отримання викладачів');
    }
    return await response.json();
  } catch (error) {
    showError('Не вдалося завантажити список викладачів: ' + error.message);
    return [];
  }
}

// Елементи інтерфейсу
const roleSelect = document.getElementById('roleSelect');
const studentFlow = document.getElementById('studentFlow');
const teacherFlow = document.getElementById('teacherFlow');
const facultySelect = document.getElementById('facultySelect');
const groupSelect = document.getElementById('groupSelect');
const teacherFacultySelect = document.getElementById('teacherFacultySelect');
const cafedraSelect = document.getElementById('cafedraSelect');
const teacherSelect = document.getElementById('teacherSelect');
const saveButton = document.getElementById('saveButton');

// Обробники подій
roleSelect.addEventListener('change', async () => {
  const role = roleSelect.value;
  
  // Приховуємо всі селекти
  studentFlow.classList.add('hidden');
  teacherFlow.classList.add('hidden');
  facultySelect.classList.add('hidden');
  groupSelect.classList.add('hidden');
  teacherFacultySelect.classList.add('hidden');
  cafedraSelect.classList.add('hidden');
  teacherSelect.classList.add('hidden');
  
  if (role === 'student') {
    studentFlow.classList.remove('hidden');
    facultySelect.classList.remove('hidden');
    const faculties = await getFaculties();
    populateSelect(facultySelect, faculties, 'idFaculty', 'name');
  } else if (role === 'teacher') {
    teacherFlow.classList.remove('hidden');
    teacherFacultySelect.classList.remove('hidden');
    const faculties = await getFaculties();
    populateSelect(teacherFacultySelect, faculties, 'idFaculty', 'name');
  }
  
  // Скидаємо стан кнопки
  saveButton.disabled = true;
});

facultySelect.addEventListener('change', async () => {
  const idFaculty = facultySelect.value;
  if (idFaculty) {
    groupSelect.classList.remove('hidden');
    const groups = await getGroupsByFaculty(idFaculty);
    populateSelect(groupSelect, groups, 'id', 'name');
  } else {
    groupSelect.classList.add('hidden');
  }
  checkFormCompletion();
});

teacherFacultySelect.addEventListener('change', async () => {
  const idFaculty = teacherFacultySelect.value;
  if (idFaculty) {
    cafedraSelect.classList.remove('hidden');
    const cafedras = await getCafedrasByFaculty(idFaculty);
    populateSelect(cafedraSelect, cafedras, 'idCafedra', 'name');
  } else {
    cafedraSelect.classList.add('hidden');
    teacherSelect.classList.add('hidden');
  }
  checkFormCompletion();
});

cafedraSelect.addEventListener('change', async () => {
  const idCafedra = cafedraSelect.value;
  if (idCafedra) {
    teacherSelect.classList.remove('hidden');
    const teachers = await getInstructorsByCafedra(idCafedra);
    populateSelect(teacherSelect, teachers, 'id', 'name');
  } else {
    teacherSelect.classList.add('hidden');
  }
  checkFormCompletion();
});

groupSelect.addEventListener('change', checkFormCompletion);
teacherSelect.addEventListener('change', checkFormCompletion);

// Функція для заповнення select-елементів
function populateSelect(selectElement, items, valueField, textField) {
  selectElement.innerHTML = '<option value="">-- Оберіть значення --</option>';
  if (Array.isArray(items)) {
    items.forEach(item => {
      const option = document.createElement('option');
      option.value = item[valueField];
      option.textContent = item[textField];
      selectElement.appendChild(option);
    });
  }
}

// Перевірка заповнення всіх полів
function checkFormCompletion() {
  const role = roleSelect.value;
  if (role === 'student') {
    saveButton.disabled = !(role && facultySelect.value && groupSelect.value);
  } else if (role === 'teacher') {
    saveButton.disabled = !(role && teacherFacultySelect.value && cafedraSelect.value && teacherSelect.value);
  } else {
    saveButton.disabled = true;
  }
}

// Зберігання налаштувань
saveButton.addEventListener('click', () => {
  const role = roleSelect.value;
  const settings = {
    userRole: role,
    selectedId: role === 'student' ? groupSelect.value : teacherSelect.value,
    roleName: role === 'student' ? 
      groupSelect.options[groupSelect.selectedIndex].textContent : 
      teacherSelect.options[teacherSelect.selectedIndex].textContent
  };
  
  chrome.storage.local.set(settings, () => {
    alert('Налаштування збережено');
    
    // Перевіряємо чи відкрито з попап
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('fromPopup')) {
      window.close(); // Закриваємо вікно, якщо відкрито з попап
    } else {
      // Інакше повертаємося на попередню сторінку або перенаправляємо на розклад
      window.location.href = 'schedule.html';
    }
  });
});

// Ініціалізація: завантажуємо збережені налаштування
document.addEventListener('DOMContentLoaded', async () => {
  chrome.storage.local.get(['userRole', 'selectedId'], async (data) => {
    if (data.userRole && data.selectedId) {
      roleSelect.value = data.userRole;
      
      // Імітуємо зміну ролі для завантаження відповідних списків
      const event = new Event('change');
      roleSelect.dispatchEvent(event);
      
      // Чекаємо завантаження факультетів
      setTimeout(async () => {
        if (data.userRole === 'student') {
          // Для студентів ми не можемо автоматично вибрати факультет,
          // тому просто інформуємо користувача
          showError('Будь ласка, оберіть факультет та групу заново');
        } else if (data.userRole === 'teacher') {
          // Для викладачів також потрібно обрати факультет і кафедру заново
          showError('Будь ласка, оберіть факультет, кафедру та викладача заново');
        }
      }, 500);
    }
  });

  // Перевіряємо чи авторизований користувач
  chrome.storage.local.get('isAuthorized', async (data) => {
    if (!data.isAuthorized) {
      const universityInfo = await config.getUniversityInfo();
      document.body.innerHTML = `
        <div style="padding: 20px; text-align: center;">
          <h2>Доступ заборонено</h2>
          <p>Для доступу до налаштувань розкладу необхідно авторизуватись в Moodle.</p>
          <a href="${universityInfo.moodleUrl}" target="_blank" 
             style="display: inline-block; padding: 10px 20px; background-color: #4688F1; 
                    color: white; text-decoration: none; border-radius: 4px; margin-top: 10px;">
              Перейти до Moodle
          </a>
        </div>`;
    }
  });
});