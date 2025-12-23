export class RealtimeDataService {
    constructor() {
        this.config = {
            patterns: {
                weekday: {
                    '06:00-06:30': 0.15, '06:30-07:00': 0.3, '07:00-07:30': 0.6,
                    '07:30-08:00': 0.9, '08:00-08:30': 1.0, '08:30-09:00': 0.95,
                    '09:00-09:30': 0.6, '09:30-10:00': 0.45, '10:00-11:00': 0.4,
                    '11:00-12:00': 0.5, '12:00-13:00': 0.6, '13:00-14:00': 0.55,
                    '14:00-15:00': 0.45, '15:00-16:00': 0.5, '16:00-17:00': 0.65,
                    '17:00-17:30': 0.85, '17:30-18:00': 1.0, '18:00-18:30': 0.95,
                    '18:30-19:00': 0.8, '19:00-20:00': 0.55, '20:00-21:00': 0.45,
                    '21:00-22:00': 0.35, '22:00-23:00': 0.2, '23:00-24:00': 0.1,
                    '00:00-06:00': 0
                },
                weekend: {
                    '06:00-07:00': 0.1, '07:00-08:00': 0.15, '08:00-09:00': 0.25,
                    '09:00-10:00': 0.4, '10:00-11:00': 0.55, '11:00-12:00': 0.65,
                    '12:00-13:00': 0.7, '13:00-14:00': 0.75, '14:00-15:00': 0.8,
                    '15:00-16:00': 0.85, '16:00-17:00': 0.9, '17:00-18:00': 0.95,
                    '18:00-19:00': 1.0, '19:00-20:00': 0.95, '20:00-21:00': 0.85,
                    '21:00-22:00': 0.7, '22:00-23:00': 0.5, '23:00-24:00': 0.3,
                    '00:00-06:00': 0
                },
                holiday: {
                    '06:00-07:00': 0.15, '07:00-08:00': 0.2, '08:00-09:00': 0.35,
                    '09:00-10:00': 0.5, '10:00-11:00': 0.65, '11:00-12:00': 0.75,
                    '12:00-13:00': 0.8, '13:00-14:00': 0.85, '14:00-15:00': 0.9,
                    '15:00-16:00': 0.95, '16:00-17:00': 1.0, '17:00-18:00': 1.05,
                    '18:00-19:00': 1.1, '19:00-20:00': 1.0, '20:00-21:00': 0.9,
                    '21:00-22:00': 0.75, '22:00-23:00': 0.55, '23:00-24:00': 0.35,
                    '00:00-06:00': 0
                },
                springFestival: {
                    '06:00-07:00': 0.08, '07:00-08:00': 0.12, '08:00-09:00': 0.18,
                    '09:00-10:00': 0.25, '10:00-11:00': 0.32, '11:00-12:00': 0.38,
                    '12:00-13:00': 0.42, '13:00-14:00': 0.45, '14:00-15:00': 0.48,
                    '15:00-16:00': 0.5, '16:00-17:00': 0.52, '17:00-18:00': 0.5,
                    '18:00-19:00': 0.48, '19:00-20:00': 0.45, '20:00-21:00': 0.4,
                    '21:00-22:00': 0.32, '22:00-23:00': 0.25, '23:00-24:00': 0.18,
                    '00:00-06:00': 0
                }
            },
            lineWeights: {
                '1号线': 1.11, '2号线': 0.77, '3号线': 1.01, '4号线': 0.82, '5号线': 1.45,
                '6号线': 0.63, '6号线支线': 0.03, '7号线': 0.67, '8号线': 0.14, '9号线': 0.62,
                '10号线': 0.57, '11号线': 1.14, '12号线': 0.63, '13号线': 0.27, '14号线': 0.65,
                '16号线': 0.27, '20号线': 0.02
            },
            stationTypes: {
                '一级': 2.5,
                '二级': 1.5,
                '三级': 1.0
            },
            congestionLevels: [
                { threshold: 0, level: '已停运', color: '#64748b', emoji: '🌙' },
                { threshold: 200, level: '畅通', color: '#10b981', emoji: '😊' },
                { threshold: 500, level: '舒适', color: '#3b82f6', emoji: '😊' },
                { threshold: 1000, level: '繁忙', color: '#f59e0b', emoji: '😐' },
                { threshold: 2000, level: '拥挤', color: '#ef4444', emoji: '😰' },
                { threshold: Infinity, level: '拥堵', color: '#dc2626', emoji: '😱' }
            ]
        };

        this.specialEvents = [];
        this.previousPassengers = {};
        this.linesData = [];
        this.holidayCache = new Map();
    }

    setLinesData(linesData) {
        this.linesData = linesData;
    }

    async isHoliday(date) {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        const cacheKey = `${year}-${month}-${day}`;

        if (this.holidayCache.has(cacheKey)) {
            const cachedResult = this.holidayCache.get(cacheKey);
            console.log(`📅 [节假日检测] 从缓存获取 ${dateStr}: ${cachedResult.isHoliday ? '是节假日' : '不是节假日'} ${cachedResult.holidayName ? '(' + cachedResult.holidayName + ')' : ''}`);
            return cachedResult;
        }

        console.log(`📅 [节假日检测] 正在调用API查询 ${dateStr}...`);
        try {
            const response = await fetch(`http://timor.tech/api/holiday/info/${dateStr}`);
            const data = await response.json();

            console.log(`📅 [节假日检测] API返回数据:`, data);

            if (data.code === 0) {
                const isHoliday = data.holiday && data.holiday.holiday;
                const holidayName = data.holiday ? data.holiday.name : null;
                const result = { isHoliday, holidayName };
                this.holidayCache.set(cacheKey, result);
                console.log(`📅 [节假日检测] API查询结果 ${dateStr}: ${isHoliday ? '是节假日' : '不是节假日'} ${holidayName ? '(' + holidayName + ')' : ''}`);
                return result;
            }
        } catch (error) {
            console.warn('📅 [节假日检测] 获取节假日信息失败，使用默认判断:', error);
        }

        const fallbackResult = this.getFallbackHoliday(date);
        console.log(`📅 [节假日检测] 备用判断结果 ${dateStr}: ${fallbackResult.isHoliday ? '是节假日' : '不是节假日'} ${fallbackResult.holidayName ? '(' + fallbackResult.holidayName + ')' : ''}`);
        return fallbackResult;
    }

    getFallbackHoliday(date) {
        const year = date.getFullYear();
        const month = date.getMonth() + 1;
        const day = date.getDate();
        const dateStr = `${month.toString().padStart(2, '0')}${day.toString().padStart(2, '0')}`;

        const holidays2025 = {
            '元旦': ['0101'],
            '春节': ['0128', '0129', '0130', '0131', '0201', '0202', '0203', '0204'],
            '清明节': ['0404', '0405', '0406'],
            '劳动节': ['0501', '0502', '0503', '0504', '0505'],
            '端午节': ['0531', '0601', '0602'],
            '中秋节': ['1006', '1007', '1008'],
            '国庆节': ['1001', '1002', '1003', '1004', '1005', '1006', '1007', '1008']
        };

        for (const [holidayName, dates] of Object.entries(holidays2025)) {
            if (dates.includes(dateStr)) {
                return { isHoliday: true, holidayName };
            }
        }

        return { isHoliday: false, holidayName: null };
    }

    async calculateStationPassengers(stationName, lineName, stationIndex, totalStations) {
        const currentTime = new Date();
        const currentHour = currentTime.getHours();

        if (currentHour >= 0 && currentHour < 6) {
            return {
                stationName: stationName,
                passengers: 0,
                congestion: this.config.congestionLevels[0],
                isOffService: true
            };
        }

        return await this.calculateNormalPassengers(stationName, lineName, stationIndex, totalStations, currentTime);
    }

    async calculateNormalPassengers(stationName, lineName, stationIndex, totalStations, currentTime) {
        const stationKey = `${lineName}-${stationName}`;
        const timeFactor = await this.getTimeFactor(currentTime);
        const positionFactor = this.calculatePositionFactor(stationIndex, totalStations);
        const stationType = this.determineStationType(stationName);
        const stationTypeFactor = this.config.stationTypes[stationType] || 1.0;
        const eventFactor = this.getEventFactor(stationName);
        const lineWeight = this.config.lineWeights[lineName] || 1.0;

        const basePassengers = 2000;
        let finalPassengers = basePassengers * timeFactor * positionFactor *
            stationTypeFactor * eventFactor * lineWeight;

        finalPassengers = Math.max(0, Math.round(finalPassengers));

        const randomFluctuation = 0.975 + Math.random() * 0.05;
        finalPassengers = Math.round(finalPassengers * randomFluctuation);

        if (this.previousPassengers[stationKey] !== undefined) {
            const prevPassengers = this.previousPassengers[stationKey];
            const maxChange = Math.round(prevPassengers * 0.05);
            const minPassengers = Math.max(0, prevPassengers - maxChange);
            const maxPassengers = prevPassengers + maxChange;
            finalPassengers = Math.max(minPassengers, Math.min(maxPassengers, finalPassengers));
        }

        this.previousPassengers[stationKey] = finalPassengers;

        return {
            stationName: stationName,
            passengers: finalPassengers,
            congestion: this.getCongestionLevel(finalPassengers),
            isOffService: false
        };
    }

    async getTimeFactor(currentTime) {
        const hour = currentTime.getHours();
        const minute = currentTime.getMinutes();
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
        const dayOfWeek = currentTime.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const holidayInfo = await this.isHoliday(currentTime);
        const isHoliday = holidayInfo.isHoliday;
        const holidayName = holidayInfo.holidayName;
        
        let pattern;
        let patternName;
        
        if (isHoliday && holidayName === '春节') {
            pattern = this.config.patterns.springFestival;
            patternName = '春节';
        } else if (isHoliday) {
            pattern = this.config.patterns.holiday;
            patternName = '节假日';
        } else if (isWeekend) {
            pattern = this.config.patterns.weekend;
            patternName = '周末';
        } else {
            pattern = this.config.patterns.weekday;
            patternName = '工作日';
        }

        console.log(`⏰ [时间权重] ${timeString} - ${patternName}模式`);

        let factor = 0.5;

        const toMinutes = (time) => {
            const [h, m] = time.split(':').map(Number);
            return h * 60 + m;
        };

        const currentMin = toMinutes(timeString);

        for (const [timeRange, rangeFactor] of Object.entries(pattern)) {
            const [start, end] = timeRange.split('-');
            const startMin = toMinutes(start);
            const endMin = toMinutes(end);

            const inRange = startMin < endMin ?
                (currentMin >= startMin && currentMin < endMin) :
                (currentMin >= startMin || currentMin < endMin);

            if (inRange) {
                factor = rangeFactor;
                break;
            }
        }

        if (!isHoliday && !isWeekend && ((hour >= 7 && hour < 9) || (hour >= 17 && hour < 19))) {
            factor *= 1.2;
        }

        return factor;
    }

    calculatePositionFactor(index, total) {
        const position = index / total;
        let factor = -4 * Math.pow(position - 0.5, 2) + 1;
        return Math.max(0.5, Math.min(1.5, factor));
    }

    determineStationType(stationName) {
        if (typeof stationName !== 'string') {
            stationName = stationName?.name || '未知站点';
        }

        let lineCount = 0;

        for (const line of this.linesData) {
            if (line.stations && line.stations.length > 0) {
                for (const station of line.stations) {
                    const currentStationName = typeof station === 'string' ? station : station.name;
                    if (currentStationName === stationName) {
                        lineCount++;
                        break;
                    }
                }
            }
        }

        if (lineCount >= 3) {
            return '一级';
        } else if (lineCount >= 2) {
            return '二级';
        } else {
            return '三级';
        }
    }

    getCongestionLevel(passengers) {
        for (const level of this.config.congestionLevels) {
            if (passengers <= level.threshold) {
                return level;
            }
        }
        return this.config.congestionLevels[this.config.congestionLevels.length - 1];
    }

    getEventFactor(stationName) {
        if (this.specialEvents.length === 0) return 1.0;

        const now = new Date();
        const events = this.specialEvents.filter(event => {
            const eventDate = new Date(event.date);
            const sameDay = eventDate.toDateString() === now.toDateString();
            const affectsStation = event.stations.includes(stationName) || event.stations.includes('all');
            return sameDay && affectsStation;
        });

        return events.length > 0 ? Math.max(...events.map(e => e.factor)) : 1.0;
    }
}

export const realtimeDataService = new RealtimeDataService();
