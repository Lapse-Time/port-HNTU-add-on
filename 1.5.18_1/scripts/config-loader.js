// config-loader.js - Універсальний завантажувач конфігурації для розширення

class ConfigLoader {
    constructor() {
        this.config = null;
        this.universityCode = 'kntu'; // Можна зробити конфігурованим або отримувати з storage
    }

    // Завантаження повної конфігурації
    async loadConfig() {
        if (this.config) {
            return this.config; // Кешована версія
        }

        try {
            const configPath = `settings/universities/${this.universityCode}/config.json`;
            const response = await fetch(chrome.runtime.getURL(configPath));
            
            if (!response.ok) {
                throw new Error(`Не вдалося завантажити конфігурацію: ${response.status}`);
            }
            
            this.config = await response.json();
            console.log('Конфігурація успішно завантажена:', this.config.university.name);
            return this.config;
        } catch (error) {
            console.error('Помилка завантаження конфігурації:', error);
            return this.getDefaultConfig();
        }
    }

    // Базова конфігурація як fallback
    getDefaultConfig() {
        return {
            university: {
                code: 'kntu',
                name: 'Херсонський національний технічний університет',
                shortName: 'ХНТУ',
                website: 'https://kntu.net.ua/ukr',
                timeZone: 'Europe/Kiev'
            },
            schedule: {
                bellSchedule: [
                    { number: 1, start: "08:30", end: "09:50" },
                    { number: 2, start: "10:05", end: "11:25" },
                    { number: 3, start: "11:40", end: "13:00" },
                    { number: 4, start: "13:15", end: "14:35" },
                    { number: 5, start: "14:50", end: "16:10" },
                    { number: 6, start: "16:25", end: "17:45" },
                    { number: 7, start: "18:00", end: "19:20" }
                ],
                workingDays: [1, 2, 3, 4, 5]
            },
            notifications: {
                settings: {
                    preWarningMinutes: 5,
                    defaultVolume: 0.8
                }
            },
            api: {
                baseUrl: "https://sheduleapi.kntu.pp.ua/api"
            }
        };
    }

    // === МЕТОДИ ДЛЯ РОБОТИ З УНІВЕРСИТЕТОМ ===
    async getUniversityInfo() {
        const config = await this.loadConfig();
        return config.university;
    }

    async getUniversityName() {
        const info = await this.getUniversityInfo();
        return info.name;
    }

    async getUniversityWebsite() {
        const info = await this.getUniversityInfo();
        return info.website;
    }

    async getTimeZone() {
        const info = await this.getUniversityInfo();
        return info.timeZone || 'Europe/Kiev';
    }

    // === МЕТОДИ ДЛЯ РОБОТИ З РОЗКЛАДОМ ===
    async getBellSchedule() {
        const config = await this.loadConfig();
        return config.schedule?.bellSchedule || [];
    }

    async getScheduleInMinutes() {
        const schedule = await this.getBellSchedule();
        return schedule.map(period => ({
            startMinutes: this.timeStringToMinutes(period.start),
            endMinutes: this.timeStringToMinutes(period.end),
            number: period.number
        }));
    }

    async getScheduleForHTML() {
        const schedule = await this.getBellSchedule();
        return schedule.map(period => ({
            ...period,
            displayText: `${period.number}. ${period.start} - ${period.end}`,
            dataStart: period.start,
            dataEnd: period.end
        }));
    }

    async getScheduleWithBreaks() {
        const schedule = await this.getBellSchedule();
        const result = [];
        
        schedule.forEach((period, index) => {
            result.push({
                type: 'lesson',
                number: period.number,
                start: period.start,
                end: period.end,
                displayText: `${period.number}. ${period.start} - ${period.end}`
            });
            
            if (index < schedule.length - 1) {
                const nextPeriod = schedule[index + 1];
                result.push({
                    type: 'break',
                    start: period.end,
                    end: nextPeriod.start
                });
            }
        });
        
        return result;
    }

    async getLessonTimesArray() {
        const schedule = await this.getBellSchedule();
        return schedule.map(period => 
            `${period.number}. ${period.start} - ${period.end}`
        );
    }

    async getWorkingDays() {
        const config = await this.loadConfig();
        return config.schedule?.workingDays || [1, 2, 3, 4, 5];
    }

    async getAcademicYear() {
        const config = await this.loadConfig();
        return config.schedule?.academicYear || {
            startDate: "2026-08-31",
            endDate: "2027-08-29"
        };
    }


    // === МЕТОДИ ДЛЯ РОБОТИ З СПОВІЩЕННЯМИ ===
    async getNotificationSettings() {
        const config = await this.loadConfig();
        return config.notifications?.settings || {
            preWarningMinutes: 5,
            defaultVolume: 0.8,
            enabledByDefault: {
                bellSounds: false,
                preWarnings: false
            }
        };
    }

    async getSoundFiles() {
        const config = await this.loadConfig();
        return config.notifications?.sounds || {
            bell: "sounds/bell.mp3",
            preNotification: "sounds/pre_notification.mp3"
        };
    }

    async getRandomSounds() {
        const config = await this.loadConfig();
        return config.notifications?.sounds?.random || [];
    }

    // === МЕТОДИ ДЛЯ РОБОТИ З UI ===
    async getUIConfig() {
        const config = await this.loadConfig();
        return config.ui || {};
    }

    async getDefaultUISettings() {
        const ui = await this.getUIConfig();
        return ui.defaultSettings || {
            showSupportMessage: true
        };
    }

    async getMascotImages() {
        const ui = await this.getUIConfig();
        return ui.popup?.mascotImages || ["img/raccoon1.jpg"];
    }

    async getRandomMascotImage() {
        const images = await this.getMascotImages();
        const randomIndex = Math.floor(Math.random() * images.length);
        return images[randomIndex];
    }

    async getColors() {
        const ui = await this.getUIConfig();
        return ui.colors || {
            primary: "#7FC3E8",
            secondary: "#9DEADA",
            accent: "#0077cc",
            background: "#E7ECEF"
        };
    }

    async getSocialLinks() {
        const ui = await this.getUIConfig();
        return ui.socialLinks || [];
    }

    async getScheduleUIConfig() {
        const ui = await this.getUIConfig();
        return ui.schedule || {
            highlightCurrentDay: true,
            highlightCurrentLesson: true,
            showBreakIndicator: true,
            autoRefreshInterval: 30000
        };
    }

    async getScheduleHighlightSettings() {
        const scheduleUI = await this.getScheduleUIConfig();
        return {
            highlightCurrentDay: scheduleUI.highlightCurrentDay !== false,
            highlightCurrentLesson: scheduleUI.highlightCurrentLesson !== false,
            showBreakIndicator: scheduleUI.showBreakIndicator !== false,
            autoRefreshInterval: scheduleUI.autoRefreshInterval || 30000
        };
    }

    async getCurrentDayStyle() {
        const scheduleUI = await this.getScheduleUIConfig();
        return scheduleUI.currentDayStyle || {
            gradientStart: "#667eea",
            gradientEnd: "#764ba2"
        };
    }

    async getCurrentLessonStyle() {
        const scheduleUI = await this.getScheduleUIConfig();
        return scheduleUI.currentLessonStyle || {
            backgroundColor: "#e3f2fd",
            borderColor: "#4688F1"
        };
    }

    async getBreakIndicatorStyle() {
        const scheduleUI = await this.getScheduleUIConfig();
        return scheduleUI.breakIndicatorStyle || {
            backgroundColor: "#fff3cd",
            textColor: "#856404",
            borderColor: "#ffc107"
        };
    }

    // === МЕТОДИ ДЛЯ РОБОТИ З API ===
    async getAPIConfig() {
        const config = await this.loadConfig();
        return config.api || { baseUrl: "https://sheduleapi.kntu.pp.ua/api" };
    }

    async getAPIBaseUrl() {
        const api = await this.getAPIConfig();
        return api.baseUrl;
    }

    async getAPIEndpoints() {
        const api = await this.getAPIConfig();
        return api.endpoints || {};
    }

    async getFullAPIUrl(endpointName) {
        const baseUrl = await this.getAPIBaseUrl();
        const endpoints = await this.getAPIEndpoints();
        const endpoint = endpoints[endpointName];
        
        if (!endpoint) {
            throw new Error(`Endpoint '${endpointName}' не знайдено в конфігурації`);
        }
        
        return baseUrl + endpoint;
    }

    // === МЕТОДИ ДЛЯ РОБОТИ З АУТЕНТИФІКАЦІЄЮ ===
    async getAuthConfig() {
        const config = await this.loadConfig();
        return config.authentication || {
            moodleCookieName: "MOODLEID1_",
            moodleDomain: "mdl.kntu.net.ua"
        };
    }

    // === МЕТОДИ ДЛЯ РОБОТИ З ФУНКЦІЯМИ ===
    async getFeatures() {
        const config = await this.loadConfig();
        return config.features || {};
    }

    async isFeatureEnabled(featureName) {
        const features = await this.getFeatures();
        return features[featureName] === true;
    }

    // === МЕТОДИ ДЛЯ AI-ASSISTANT ===
    async isAIAssistantEnabled() {
        return await this.isFeatureEnabled('aiAssistant');
    }

    // === ДОПОМІЖНІ МЕТОДИ ===
    async isWorkingDay(date = new Date()) {
        const workingDays = await this.getWorkingDays();
        const timeZone = await this.getTimeZone();
        const options = { timeZone };
        const localDate = new Date(date.toLocaleString('en-US', options));
        const dayOfWeek = localDate.getDay();
        return workingDays.includes(dayOfWeek);
    }

    timeStringToMinutes(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        return hours * 60 + minutes;
    }

    async generateScheduleHTML() {
        const scheduleWithBreaks = await this.getScheduleWithBreaks();
        let html = '';
        
        scheduleWithBreaks.forEach(item => {
            if (item.type === 'lesson') {
                html += `<li data-start="${item.start}" data-end="${item.end}">${item.displayText}</li>`;
            } else if (item.type === 'break') {
                html += `<li class="break" data-start="${item.start}" data-end="${item.end}"></li>`;
            }
        });
        
        return html;
    }

    // Оновлення конфігурації (скидання кешу)
    reloadConfig() {
        this.config = null;
        return this.loadConfig();
    }

    // Зміна університету (для майбутнього використання)
    setUniversity(universityCode) {
        this.universityCode = universityCode;
        this.config = null; // Скидаємо кеш
    }

    // === МЕТОДИ ДЛЯ РОБОТИ З НОМЕРОМ ТИЖНЯ ===
    async getMaxWeekNumber() {
        const config = await this.loadConfig();
        return config.schedule?.maxWeekNumber || 52;
    }

    async calculateWeekNumber(date = new Date()) {
        const academicYear = await this.getAcademicYear();
        const maxWeeks = await this.getMaxWeekNumber();
        const startDate = new Date(academicYear.startDate);
        
        const oneWeek = 7 * 24 * 60 * 60 * 1000;
        const weekNumber = Math.ceil((date - startDate) / oneWeek);
        
        if (weekNumber < 1) {
            return "0";
        } else if (weekNumber > maxWeeks) {
            return "навчальний рік закінчено";
        } else {
            return weekNumber.toString();
        }
    }
}

// Експортуємо єдиний екземпляр
export const config = new ConfigLoader();