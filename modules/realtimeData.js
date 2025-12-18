// modules/realtimeData.js

/**
 * 深圳地铁实时客流模拟与预测模块
 * 结合历史数据、时间因素、线路特点进行智能模拟
 */

export class RealtimeDataService {
    constructor() {
        this.historicalPatterns = {
            // 工作日模式
            weekday: {
                '06:00-07:00': 0.3,  // 清晨
                '07:00-09:00': 0.9,  // 早高峰
                '09:00-12:00': 0.4,  // 上午平峰
                '12:00-14:00': 0.6,  // 午间小高峰
                '14:00-17:00': 0.4,  // 下午平峰
                '17:00-19:00': 0.9,  // 晚高峰
                '19:00-22:00': 0.6,  // 晚间
                '22:00-24:00': 0.3,  // 夜间
                '00:00-06:00': 0     //非运营时间
            },
            // 周末模式
            weekend: {
                '06:00-09:00': 0.2,
                '09:00-12:00': 0.7,  // 周末出行高峰
                '12:00-17:00': 0.8,  // 全天高峰
                '17:00-20:00': 0.6,
                '20:00-22:00': 0.4,
                '22:00-24:00': 0.1,
            }
        };

        // 线路权重（基于深圳地铁官方数据）
        this.lineWeights = {
            '1号线': 1.5,
            '2号线': 1.0,
            '3号线': 1.2,
            '4号线': 1.0,
            '5号线': 1.8, // 最繁忙
            '6号线': 0.8,
            '6号线支线': 0.1,
            '7号线': 0.9,
            '8号线': 0.1,
            '9号线': 0.9,
            '10号线': 0.8,
            '11号线': 1.5,
            '12号线': 0.9,
            '13号线': 0.6,
            '14号线': 0.9,
            '16号线': 0.3,
            '20号线': 0.1
        };

        // 站点类型权重
        this.stationTypes = {
            '枢纽站': 1.5,      // 如深圳北站、车公庙
            '换乘站': 1.3,      // 多线换乘站
            '商务区': 1.4,      // 如福田、会展中心
            '商业区': 1.2,      // 如华强北、老街
            '居住区': 0.9,      // 居民区站点
            '景区站': 1.0,      // 如世界之窗
            '交通枢纽': 1.6,    // 机场、火车站
            '普通站': 0.8
        };

        this.weatherImpact = {
            '晴': 1.0,
            '多云': 0.95,
            '阴': 0.9,
            '小雨': 0.85,
            '大雨': 0.7,
            '暴雨': 0.5
        };

        this.currentWeather = '晴';
        this.specialEvents = [];

        // 初始化天气
        this.initWeather();
    }

    /**
     * 初始化天气（随机模拟）
     */
    initWeather() {
        const weatherOptions = ['晴', '多云', '阴', '小雨', '大雨'];
        const weights = [0.4, 0.3, 0.15, 0.1, 0.05]; // 晴天概率最高

        let random = Math.random();
        let cumulativeWeight = 0;

        for (let i = 0; i < weatherOptions.length; i++) {
            cumulativeWeight += weights[i];
            if (random < cumulativeWeight) {
                this.currentWeather = weatherOptions[i];
                break;
            }
        }
    }

    /**
     * 获取当前时间段的客流系数
     */
    getTimeFactor() {
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();
        const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

        // 判断是工作日还是周末
        const dayOfWeek = now.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const pattern = isWeekend ? this.historicalPatterns.weekend : this.historicalPatterns.weekday;

        // 找到当前时间段
        let currentFactor = 0.5; // 默认值
        for (const [timeRange, factor] of Object.entries(pattern)) {
            const [start, end] = timeRange.split('-');
            if (this.isTimeInRange(timeString, start, end)) {
                currentFactor = factor;
                break;
            }
        }

        // 早晚高峰加强
        if ((hour >= 7 && hour < 9) || (hour >= 17 && hour < 19)) {
            currentFactor *= 1.2;
        }

        return currentFactor;
    }

    /**
     * 判断时间是否在范围内
     */
    isTimeInRange(current, start, end) {
        const toMinutes = (time) => {
            const [h, m] = time.split(':').map(Number);
            return h * 60 + m;
        };

        const currentMin = toMinutes(current);
        const startMin = toMinutes(start);
        const endMin = toMinutes(end);

        if (startMin < endMin) {
            return currentMin >= startMin && currentMin < endMin;
        } else {
            // 跨夜时间段
            return currentMin >= startMin || currentMin < endMin;
        }
    }

    /**
     * 计算站点实时客流
     */
    calculateStationPassengers(stationName, lineName, stationIndex, totalStations) {
        let base = 1000;    //2000人基础客流，更符合实际

        // 时间系数
        const timeFactor = this.getTimeFactor();

        // 线路权重
        const lineWeight = this.lineWeights[lineName] || 1.0;

        // 站点类型系数
        const stationType = this.determineStationType(stationName, lineName);
        const stationFactor = this.stationTypes[stationType] || 1.0;

        // 位置系数（线路两端的站点通常人流较少）
        const positionFactor = this.calculatePositionFactor(stationIndex, totalStations);

        // 天气影响
        const weatherFactor = this.weatherImpact[this.currentWeather] || 1.0;

        // 随机波动 (±15%)
        const randomFactor = 0.85 + Math.random() * 0.3;

        // 特殊事件影响
        const eventFactor = this.getEventFactor(stationName);

        // 最终计算
        const passengers = Math.round(
            base * timeFactor * lineWeight * stationFactor *
            positionFactor * weatherFactor * randomFactor * eventFactor
        );

        return {
            passengers,
            congestion: this.getCongestionLevel(passengers),
            trend: this.getPassengerTrend(),
            lastUpdate: new Date().toISOString()
        };
    }

    /**
     * 判断站点类型
     */
    determineStationType(stationName, lineName) {
        // 确保 stationName 是字符串
        if (typeof stationName !== 'string') {
            console.warn('stationName 不是字符串，尝试获取 name 属性:', stationName);
            if (stationName && stationName.name) {
                stationName = stationName.name;
            } else {
                // 明确记录错误
                console.error('无法获取站点名称，对象结构不符合预期:', stationName);
                stationName = '未知站点';
            }
        }

        // 枢纽站判断
        const hubStations = [
            '深圳北站', '福田', '车公庙', '会展中心', '老街',
            '世界之窗', '宝安中心', '布吉', '大运', '岗厦北', '前海湾'
        ];

        if (hubStations.includes(stationName)) return '枢纽站';

        // 换乘站判断
        const transferStations = [
            '大剧院', '购物公园', '少年宫', '黄贝岭', '前海湾',
            '红树湾', '安托山', '华强北', '石厦', '福田口岸'
        ];

        if (transferStations.includes(stationName)) return '换乘站';

        // 特殊站点判断
        const airportStations = ['机场东', '机场', '机场北', '福永'];
        const trainStations = ['深圳北站', '福田高铁站'];
        const businessStations = ['福田', '会展中心', '市民中心', '华强路', '南山'];
        const commercialStations = ['老街', '东门', '华强北', '海岸城', '后海'];
        const scenicStations = ['世界之窗', '华侨城', '深圳湾公园', '大梅沙', '小梅沙'];

        if (airportStations.some(s => stationName.includes(s))) return '交通枢纽';
        if (trainStations.includes(stationName)) return '交通枢纽';
        if (businessStations.includes(stationName)) return '商务区';
        if (commercialStations.includes(stationName)) return '商业区';
        if (scenicStations.includes(stationName)) return '景区站';

        // 居民区判断（特定区域）
        const residentialKeywords = ['村', '苑', '园', '城', '里', '湾', '湖', '山', '围'];
        if (residentialKeywords.some(keyword => stationName.includes(keyword))) {
            return '居住区';
        }

        return '普通站';
    }

    /**
     * 计算位置系数
     */
    calculatePositionFactor(index, total) {
        const position = index / total;

        // 抛物线分布：中间站点人流多，两端少
        // y = -4(x-0.5)² + 1
        let factor = -4 * Math.pow(position - 0.5, 2) + 1;

        // 确保在合理范围内
        return Math.max(0.5, Math.min(1.5, factor));
    }

    /**
     * 获取拥堵等级
     */
    getCongestionLevel(passengers) {
        if (passengers < 200) return { level: '畅通', color: '#10b981', emoji: '😊' };
        if (passengers < 500) return { level: '舒适', color: '#3b82f6', emoji: '😊' };
        if (passengers < 1000) return { level: '繁忙', color: '#f59e0b', emoji: '😐' };
        if (passengers < 2000) return { level: '拥挤', color: '#ef4444', emoji: '😰' };
        return { level: '拥堵', color: '#dc2626', emoji: '😱' };
    }

    /**
     * 获取客流趋势
     */
    getPassengerTrend() {
        const hour = new Date().getHours();
        let trend;

        if (hour >= 5 && hour < 7) trend = '快速上升';
        else if (hour >= 7 && hour < 9) trend = '高峰上升';
        else if (hour >= 9 && hour < 12) trend = '缓慢下降';
        else if (hour >= 12 && hour < 14) trend = '平稳';
        else if (hour >= 14 && hour < 17) trend = '缓慢上升';
        else if (hour >= 17 && hour < 19) trend = '高峰上升';
        else if (hour >= 19 && hour < 22) trend = '缓慢下降';
        else trend = '低位运行';

        return trend;
    }

    /**
     * 获取事件影响系数
     */
    getEventFactor(stationName) {
        if (this.specialEvents.length === 0) return 1.0;

        const now = new Date();
        const events = this.specialEvents.filter(event => {
            const eventDate = new Date(event.date);
            const sameDay = eventDate.toDateString() === now.toDateString();
            const affectsStation = event.stations.includes(stationName) || event.stations.includes('all');
            return sameDay && affectsStation;
        });

        if (events.length === 0) return 1.0;

        // 取最大影响
        return Math.max(...events.map(e => e.factor));
    }

    /**
     * 获取全线路总客流（模拟）
     */
    getTotalSystemPassengers() {
        const hour = new Date().getHours();
        let base = 3000000; // 300万基准

        const timeFactor = this.getTimeFactor();
        const weatherFactor = this.weatherImpact[this.currentWeather] || 1.0;

        // 周末客流量增加
        const dayOfWeek = new Date().getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const weekendFactor = isWeekend ? 1.1 : 1.0;

        return Math.round(base * timeFactor * weatherFactor * weekendFactor);
    }

    /**
     * 获取当前天气
     */
    getCurrentWeather() {
        return this.currentWeather;
    }

    /**
     * 获取系统运行状态
     */
    getSystemStatus() {
        const hour = new Date().getHours();
        if (hour >= 6 && hour < 23) {
            return { status: '正常运营', color: '#10b981' };
        } else {
            return { status: '夜间停运', color: '#64748b' };
        }
    }

    /**
     * 添加特殊事件
     */
    addEvent(event) {
        this.specialEvents.push(event);
    }

    /**
     * 计算线路统计数据
     */
    calculateLineStats(line, stationsData) {
        if (!stationsData || stationsData.length === 0) {
            return {
                totalPassengers: 0,
                avgPassengers: 0,
                maxPassengers: 0,
                minPassengers: 0,
                congestionLevel: '未知',
                busiestStation: null,
                quietestStation: null
            };
        }

        const passengers = stationsData.map(data => data.passengers);
        const totalPassengers = passengers.reduce((sum, p) => sum + p, 0);
        const avgPassengers = Math.round(totalPassengers / passengers.length);
        const maxPassengers = Math.max(...passengers);
        const minPassengers = Math.min(...passengers);
        const maxIndex = passengers.indexOf(maxPassengers);
        const minIndex = passengers.indexOf(minPassengers);

        // 线路拥堵级别
        const congestionLevel = this.getLineCongestionLevel(avgPassengers);

        return {
            totalPassengers,
            avgPassengers,
            maxPassengers,
            minPassengers,
            congestionLevel,
            busiestStation: {
                name: line.stations[maxIndex],
                passengers: maxPassengers
            },
            quietestStation: {
                name: line.stations[minIndex],
                passengers: minPassengers
            },
            stationsCount: stationsData.length,
            lastUpdate: new Date().toISOString()
        };
    }

    /**
     * 获取线路拥堵级别
     */
    getLineCongestionLevel(avgPassengers) {
        if (avgPassengers < 200) return { level: '非常畅通', color: '#10b981', emoji: '😊' };
        if (avgPassengers < 400) return { level: '畅通', color: '#34d399', emoji: '😊' };
        if (avgPassengers < 600) return { level: '正常', color: '#3b82f6', emoji: '😐' };
        if (avgPassengers < 800) return { level: '繁忙', color: '#f59e0b', emoji: '😐' };
        if (avgPassengers < 1000) return { level: '拥挤', color: '#f97316', emoji: '😰' };
        return { level: '非常拥挤', color: '#ef4444', emoji: '😱' };
    }

    /**
     * 计算线路运营信息
     */
    getLineOperationInfo(line) {
        const now = new Date();
        const hour = now.getHours();

        // 模拟线路运营时间
        let operationStatus = '正常运营';
        let nextTrain = '3分钟';

        if (hour >= 23 || hour < 6) {
            operationStatus = '已停运';
            nextTrain = '06:00';
        } else if (hour >= 22) {
            operationStatus = '末班车时段';
            nextTrain = '10-15分钟';
        }

        // 计算线路长度（模拟数据，基于站点数）
        const length = Math.round(line.stations.length * 1.5);

        return {
            operationStatus,
            nextTrain,
            length,
            stationsCount: line.stations.length,
            avgSpeed: Math.floor(Math.random() * 20) + 60, // 60-80km/h
            startTime: '06:00',
            endTime: '23:00'
        };
    }
}

// 导出单例
export const realtimeDataService = new RealtimeDataService();

