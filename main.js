// main.js

/**
 * 主入口文件
 * 职责：初始化应用，协调各模块
 */
import {loadLinesData} from './modules/dataLoader.js'
import {renderLineList} from './modules/lineList.js'
import {renderStationList} from './modules/stationList.js'
import {realtimeDataService} from './modules/realtimeData.js'
import Heatmap from './modules/heatmap.js'

// 全局拥堵等级颜色映射
const CONGESTION_COLORS = {
    '畅通': '#10b981',  // 绿色
    '舒适': '#3b82f6',  // 蓝色
    '繁忙': '#f59e0b',  // 橙色
    '拥挤': '#ef4444',  // 红色
    '拥堵': '#dc2626',  // 深红色
    '未知': '#64748b'   // 灰色
};

// 应用状态
let currentLines = [];
let currentSelectedLine = null;
let realtimeData = {};
let updateInterval = null;
let isAppInitialized = false;
let currentView = 'line'; // 跟踪当前视图是线路('line')还是站点('station')
let currentDisplayedStation = null; // 跟踪当前显示的站点信息

let stationsDataCache = null;// 热力图相关缓存变量

let heatmap = null;// 新增：热力图实例

// 检查DOM是否已加载完成
function checkDOMReady() {
    return new Promise((resolve) => {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', resolve);
        } else {
            resolve();
        }
    });
}

// 显示加载动画
function showLoadingScreen() {
    // 检查是否已经存在加载屏幕
    if (document.getElementById('loading-screen')) return;

    const loadingScreen = document.createElement('div');
    loadingScreen.id = 'loading-screen';
    loadingScreen.innerHTML = `
        <div class="loader"></div>
        <div class="loading-text">正在加载深圳地铁数据...</div>
    `;
    document.body.appendChild(loadingScreen);

    // 添加CSS动画
    if (!document.getElementById('loader-style')) {
        const style = document.createElement('style');
        style.id = 'loader-style';
        style.textContent = `
            #loading-screen {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: var(--dark-bg);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                z-index: 9999;
                transition: opacity 0.5s ease-out;
            }
            
            .loader {
                width: 50px;
                height: 50px;
                border: 3px solid rgba(255,255,255,0.3);
                border-radius: 50%;
                border-top-color: white;
                animation: spin 1s ease-in-out infinite;
                margin-bottom: 20px;
            }
            
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
            
            .loading-text {
                color: white;
font-size: 1.2rem;
                font-weight: 500;
            }
        `;
        document.head.appendChild(style);
    }
}

// 隐藏加载动画
function hideLoadingScreen() {
    setTimeout(() => {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            loadingScreen.style.opacity = '0';
            setTimeout(() => {
                if (loadingScreen.parentNode) {
                    loadingScreen.parentNode.removeChild(loadingScreen);
                }
            }, 500);
        }
    }, 500);
}

// 显示错误信息
function showErrorMessage(message) {
    const lineList = document.getElementById('line-list');
    if (lineList) {
        lineList.innerHTML = `<p class="error-message">${message}</p>`;
    }

    // 添加错误信息样式
    const style = document.createElement('style');
    style.textContent = `
        .error-message {
            color: var(--danger-color);
            text-align: center;
            padding: 20px;
            font-size: 1rem;
            background: rgba(239, 68, 68, 0.1);
            border-radius: 8px;
            border: 1px solid rgba(239, 68, 68, 0.2);
        }
    `;
    document.head.appendChild(style);
}

// 更新时间显示
function updateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('zh-CN');
    const dateString = now.toLocaleDateString('zh-CN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long'
    });

    const updateTimeElement = document.getElementById('update-time');
    const currentDateElement = document.getElementById('current-date');

    if (updateTimeElement) {
        updateTimeElement.textContent = timeString;
    }

    if (currentDateElement) {
        currentDateElement.textContent = dateString;
    }

    // 每秒更新一次时间
    setTimeout(updateTime, 1000);
}

// 更新指定线路的实时数据
function updateRealtimeDataForLine(line) {
    if (!line || !line.stations) return;

    // 计算每个站点的实时数据
    const stationsData = line.stations.map((station, index) => {
        let stationName;
        if (typeof station === 'string') {
            stationName = station;
        } else if (station && typeof station === 'object') {
            stationName = station.name || station.Name || String(station);
        } else {
            stationName = String(station);
        }

        return realtimeDataService.calculateStationPassengers(
            stationName,
            line.name,
            index,
            line.stations.length
        );
    });

    // 保存实时数据
    realtimeData[line.id] = stationsData;

    // 更新站点列表显示
    renderStationList(line.stations, 'station-list', stationsData);

    // 更新热力图（使用新的Heatmap类）
    if (heatmap) {
        const stats = heatmap.draw(stationsData, line);

        // 【修改点】使用新增的 updateHeatmapStatsUI 函数
        updateHeatmapStatsUI(stats || calculateHeatmapStats(stationsData));
    } else {
        // 如果热力图未初始化，手动计算并显示统计数据
        updateHeatmapStatsUI(calculateHeatmapStats(stationsData));
    }
}

// 【新增】计算热力图统计数据
function calculateHeatmapStats(stationsData) {
    if (!stationsData || stationsData.length === 0) {
        return { total: 0, avg: 0, peak: 0 };
    }

    const passengers = stationsData.map(data => data.passengers || 0);
    const total = passengers.reduce((sum, p) => sum + p, 0);
    const avg = Math.round(total / passengers.length);
    const peak = Math.max(...passengers);

    return { total, avg, peak };
}

// 【新增】更新热力图统计数据的UI显示
function updateHeatmapStatsUI(stats) {
    console.log('更新统计数据:', stats);

    const totalEl = document.getElementById('total-passengers');
    const avgEl = document.getElementById('avg-passengers');
    const peakEl = document.getElementById('peak-passengers');

    if (totalEl) {
        totalEl.textContent = stats.total ? stats.total.toLocaleString() : '0';
    } else {
        console.warn('未找到总客流元素 #total-passengers');
    }

    if (avgEl) {
        avgEl.textContent = stats.avg ? stats.avg.toLocaleString() : '0';
    } else {
        console.warn('未找到平均客流元素 #avg-passengers');
    }

    if (peakEl) {
        peakEl.textContent = stats.peak ? stats.peak.toLocaleString() : '0';
    } else {
        console.warn('未找到峰值客流元素 #peak-passengers');
    }
}

// 开始实时更新
function startRealtimeUpdates() {
    // 清除已有定时器
    if (updateInterval) clearInterval(updateInterval);

    // 每15秒更新一次数据
    updateInterval = setInterval(() => {
        if (currentSelectedLine && currentView === 'line') {
            updateRealtimeDataForLine(currentSelectedLine);
        }
    }, 1000);

    // 立即更新一次
    if (currentSelectedLine && currentView === 'line') {
        updateRealtimeDataForLine(currentSelectedLine);
    }
}
// 更新页面标题
function updatePageTitle(lineName, lineColor) {
    const titleElement = document.querySelector('header h1');
    if (titleElement) {
        titleElement.innerHTML = `
            <i class="fas fa-subway"></i> 深圳地铁实时客流模拟系统 
            <span class="current-line" style="color: ${lineColor}">| ${lineName}</span>
        `;
    }
}

function showSingleStationOnly(stationInfo) {
    console.log('显示单个站点信息（搜索功能）:', stationInfo);

    const stationContainer = document.getElementById('station-list');
    if (!stationContainer) return;

    // 设置视图为单站点视图
    currentView = 'station';
    currentDisplayedStation = stationInfo;

    // 使用当前应用中的实时数据服务
    const realtimeService = realtimeDataService;

    // 为这个站点计算新的实时数据
    let totalPassengers = 0;
    let calculatedStations = 0;

    // 遍历该站点的所有线路
    if (stationInfo.lines && stationInfo.lines.length > 0) {
        console.log('计算站点客流，所属线路数:', stationInfo.lines.length);

        stationInfo.lines.forEach((line, index) => {
            // 获取线路信息 - 从当前应用的线路数据中查找
            const lineInfo = currentLines.find(l =>
                l.id === line.id || l.name === line.name
            );

            if (!lineInfo || !lineInfo.stations) {
                console.warn(`未找到线路数据: ${line.name || line.id}`);
                return;
            }

            console.log(`处理线路 ${lineInfo.name}，站点数: ${lineInfo.stations.length}`);

            // 找到该站点在线路中的索引
            let stationIndex = -1;
            let stationObject = null;

            // 在站点数组中查找匹配的站点
            for (let i = 0; i < lineInfo.stations.length; i++) {
                const station = lineInfo.stations[i];

                // 站点可能是字符串或对象
                if (typeof station === 'string') {
                    if (station === stationInfo.name) {
                        stationIndex = i;
                        stationObject = { name: station };
                        break;
                    }
                } else if (station && typeof station === 'object') {
                    if (station.name === stationInfo.name ||
                        station.id === stationInfo.id ||
                        (station.stationName && station.stationName === stationInfo.name)) {
                        stationIndex = i;
                        stationObject = station;
                        break;
                    }
                }
            }

            if (stationIndex !== -1) {
                console.log(`在线路 ${lineInfo.name} 中找到站点 ${stationInfo.name}，索引: ${stationIndex}`);

                try {
                    // 使用实时数据服务计算该站点的客流
                    const stationData = realtimeService.calculateStationPassengers(
                        stationInfo.name,
                        lineInfo.name,
                        stationIndex,
                        lineInfo.stations.length
                    );

                    totalPassengers += stationData.passengers || 0;
                    calculatedStations++;

                    console.log(`线路 ${lineInfo.name} 客流: ${stationData.passengers}, 累计: ${totalPassengers}`);
                } catch (error) {
                    console.error('计算客流时出错:', error);
                }
            } else {
                console.warn(`在线路 ${lineInfo.name} 中未找到站点 ${stationInfo.name}`);
            }
        });
    }

    // 如果没有找到任何线路数据，使用默认值
    if (calculatedStations === 0) {
        console.log('未找到站点数据，使用默认值');
        totalPassengers = Math.floor(Math.random() * 800) + 200; // 200-1000人的合理范围
    }

    console.log(`站点 ${stationInfo.name} 总客流: ${totalPassengers}, 来自 ${calculatedStations} 条线路`);

    // 辅助函数：根据客流人数计算拥堵等级
    function calculateCongestion(passengers) {
        if (passengers <= 200) {
            return { level: '畅通', color: '#10b981', emoji: '😌' };
        } else if (passengers <= 500) {
            return { level: '舒适', color: '#3b82f6', emoji: '😊' };
        } else if (passengers <= 1000) {
            return { level: '繁忙', color: '#f59e0b', emoji: '😐' };
        } else if (passengers <= 2000) {
            return { level: '拥挤', color: '#ef4444', emoji: '😟' };
        } else {
            return { level: '拥堵', color: '#dc2626', emoji: '😫' };
        }
    }

    // 辅助函数：根据拥堵等级获取带颜色的小人图标
    function getPeopleIcons(level, color) {
        const mapping = {
            '畅通': 1,
            '舒适': 2,
            '繁忙': 3,
            '拥挤': 4,
            '拥堵': 5,
            '未知': 0
        };

        const count = mapping[level] || 0;
        if (count === 0) return '<span class="unknown-text">未知</span>';

        // 创建带颜色的小人图标
        let icons = '';
        for (let i = 0; i < count; i++) {
            icons += `<i class="fas fa-male" style="color: ${color}"></i>`;
        }

        return icons;
    }

    // 根据总客流量计算拥堵等级
    const congestion = calculateCongestion(totalPassengers);
    const congestionLevel = congestion.level;
    const congestionColor = congestion.color;
    const congestionEmoji = congestion.emoji;

    // 计算客流百分比（用于进度条显示）
    const passengerPercentage = Math.min(100, Math.floor((totalPassengers / 2500) * 100));

    // 获取带颜色的小人图标（使用重新计算的颜色）
    const peopleIcons = getPeopleIcons(congestionLevel, congestionColor);

    // 生成线路标识
    let lineBadgesHTML = '';
    if (stationInfo.lines && stationInfo.lines.length > 0) {
        lineBadgesHTML = `
            <div class="station-lines" style="margin-top: 10px;">
                <span style="color: #666; font-size: 14px; margin-right: 8px;">所属线路:</span>
                ${stationInfo.lines.map(line =>
            `<span class="line-badge" style="background: ${line.color}; color: white; padding: 2px 8px; border-radius: 12px; font-size: 12px; margin-right: 5px;">${line.name}</span>`
        ).join('')}
            </div>
        `;
    }

    // 添加客流来源说明（显示这是多条线路的总客流）
    let passengerSourceInfo = '';
    if (stationInfo.lines && stationInfo.lines.length > 1) {
        passengerSourceInfo = `
            <div class="passenger-source-info" style="margin-top: 8px; font-size: 12px; color: #666;">
                <i class="fas fa-info-circle"></i>
                此客流数据为 ${stationInfo.lines.length} 条线路的总客流
            </div>
        `;
    }

    // 清空容器
    stationContainer.innerHTML = '';

    // 创建单个站点的展示
    const stationItem = document.createElement('div');
    stationItem.className = 'station-item active';
    stationItem.innerHTML = `
        <div class="station-header">
            <div class="station-name">${stationInfo.name}</div>
            <div class="congestion-badge" style="background: ${congestionColor}">
                ${congestionEmoji} ${congestionLevel}
            </div>
        </div>
        <div class="station-details">
            <div class="passenger-count">
                <i class="fas fa-users"></i> 
                <span class="passenger-level-icons">${peopleIcons}</span>
                <span class="passenger-number" style="margin-left: 8px; font-weight: bold;">${totalPassengers}人</span>
            </div>
            <div class="passenger-indicator">
                <div class="passenger-level" style="width: ${passengerPercentage}%; background: ${congestionColor}"></div>
            </div>
            ${lineBadgesHTML}
            ${passengerSourceInfo}
            <div class="passenger-trend">
                <i class="fas fa-chart-line"></i>
                实时客流状态
            </div>
        </div>
    `;

    // 添加入场动画
    stationItem.style.opacity = '0';
    stationItem.style.transform = 'translateY(20px)';

    stationContainer.appendChild(stationItem);

    // 触发动画
    setTimeout(() => {
        stationItem.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        stationItem.style.opacity = '1';
        stationItem.style.transform = 'translateY(0)';
    }, 10);
}


// 初始化搜索功能
function initSearch() {
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');

    if (!searchInput) {
        console.warn('搜索输入框未找到');
        return;
    }

    // 确保搜索结果显示区域存在
    if (!searchResults) {
        console.warn('搜索结果容器未找到');
        return;
    }

    let timeoutId;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(timeoutId);
        const query = e.target.value.trim();

        // 如果搜索框为空，清空结果
        if (!query) {
            searchResults.innerHTML = '';
            searchResults.style.display = 'none';
            return;
        }

        timeoutId = setTimeout(() => {
            performSearch(query);
        }, 300);
    });

    // 点击页面其他地方时隐藏搜索结果
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !searchResults.contains(e.target)) {
            searchResults.style.display = 'none';
        }
    });

    // 搜索输入框获取焦点时显示之前的搜索结果
    searchInput.addEventListener('focus', () => {
        if (searchResults.innerHTML.trim() !== '') {
            searchResults.style.display = 'block';
        }
    });

// 修改 performSearch 函数中的站点分组逻辑
    function performSearch(query) {
        if (!currentLines || currentLines.length === 0) {
            console.warn('线路数据未加载，无法搜索');
            return;
        }

        const stationMap = new Map(); // 使用Map来按站点名称分组

        // 遍历所有线路的站点
        currentLines.forEach(line => {
            if (!line.stations || !Array.isArray(line.stations)) {
                console.warn(`线路 ${line.name} 没有站点数据`);
                return;
            }

            line.stations.forEach(station => {
                // 从站点对象中提取站点名称
                let stationName = '';

                if (typeof station === 'string') {
                    stationName = station;
                } else if (station && typeof station === 'object') {
                    stationName = station.name || station.Name || station.stationName || '';

                    if (!stationName && station.coordinates) {
                        return; // 跳过只有坐标没有名称的站点
                    }

                    if (!stationName) {
                        stationName = String(station);
                    }
                } else {
                    stationName = String(station);
                }

                // 检查是否匹配搜索词
                if (stationName && stationName.toLowerCase().includes(query.toLowerCase())) {
                    // 如果站点已经在map中，添加线路信息
                    if (stationMap.has(stationName)) {
                        const existingStation = stationMap.get(stationName);
                        // 检查是否已包含该线路，避免重复
                        if (!existingStation.lines.some(l => l.id === line.id)) {
                            existingStation.lines.push(line);
                        }
                    } else {
                        // 创建新的站点条目
                        stationMap.set(stationName, {
                            name: stationName,
                            lines: [line],
                            stationObj: station
                        });
                    }
                }
            });
        });

        // 将Map转换为数组
        const groupedStations = Array.from(stationMap.values());

        // 更新搜索结果
        if (groupedStations.length === 0) {
            searchResults.innerHTML = `
            <div class="search-result-item no-results">
                未找到包含 "${query}" 的站点
            </div>
        `;
        } else {
            // 限制显示数量，避免过多结果
            const displayStations = groupedStations.slice(0, 20);

            let html = `
            <div class="search-result-item results-count">
                找到 ${groupedStations.length} 个匹配站点
            </div>
        `;

            displayStations.forEach((item, index) => {
                // 生成所有线路的标签
                const lineBadges = item.lines.map(line =>
                    `<span class="line-badge" style="background:${line.color}">${line.name}</span>`
                ).join(' ');

                // 存储所有线路ID，用逗号分隔
                const lineIds = item.lines.map(line => line.id).join(',');

                html += `    
                <div class="search-result-item" data-lines="${lineIds}" data-station="${item.name}">
                    <span class="station-name" style="text-align: left">${item.name}</span>
                    <div class="line-badges-container">
                        ${lineBadges}
                    </div>
                </div>
            `;

                // 如果结果太多，添加提示
                if (index === 19 && groupedStations.length > 20) {
                    html += `<div class="search-result-item more-results">... 还有 ${groupedStations.length - 20} 个结果</div>`;
                }
            });

            searchResults.innerHTML = html;

            // 为搜索结果添加点击事件
            const searchResultItems = searchResults.querySelectorAll('.search-result-item[data-lines]');
            searchResultItems.forEach(item => {
                item.addEventListener('click', () => {
                    const lineIds = item.getAttribute('data-lines').split(',').map(id => parseInt(id));
                    const stationName = item.getAttribute('data-station');

                    // 找到对应的所有线路
                    const lines = currentLines.filter(l => lineIds.includes(l.id));
                    if (lines.length > 0) {
                        // 显示单个站点信息，传入所有线路
                        showSingleStationOnly({
                            name: stationName,
                            lines: lines,
                            color: lines[0].color // 使用第一条线路的颜色
                        });

                        // 隐藏搜索结果
                        searchResults.style.display = 'none';
                    }
                });
            });
        }

        // 显示搜索结果
        searchResults.style.display = 'block';
    }
}

// 添加动态样式
function addDynamicStyles() {
    if (document.getElementById('dynamic-styles')) return;

    const style = document.createElement('style');
    style.id = 'dynamic-styles';
    style.textContent = `
        .current-line {     
            padding: 5px 15px;
            font-weight: 600;
            margin-left: 10px;
        }   
        
        .congestion-badge {
            display: inline-block;
            padding: 4px 10px;
            border-radius: 15px;
            font-size: 0.8rem;
            color: white;
            font-weight: 600;
            margin-left: 10px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        }
        
        .station-header {
            display: flex;
            align-items: center;
            margin-bottom: 10px;
        }
        
        .station-details {
            margin-top: 10px;
        }
        
        .passenger-number {
            font-weight: bold;
            font-size: 1.1rem;
            color: var(--text-primary);
        }
        
        .passenger-total{
            color: var(--text-primary);    
       }
       
       .dark-mode .passenger-total{
            color: #fff;
       }
        
        .passenger-trend {
            font-size: 0.85rem;
            color: var(--text-secondary);
            margin-top: 5px;
            display: flex;
            align-items: center;
            gap: 5px;
        }
        
        /* 新增：热力图工具提示样式 */
        #heatmap-tooltip {
            pointer-events: none;
            transition: opacity 0.2s ease, transform 0.2s ease;
        }
        
        /* 移动端触摸反馈 */
        @media (hover: none) and (pointer: coarse) {
            .line-item:hover {
                opacity: 1;
                transform: scale(1);
            }
            
            .line-item:active {
                opacity: 0.9;
                transform: scale(1);
            }
            
            /* 移动端不显示tooltip */
            #heatmap-tooltip {
                display: none !important;
            }
        }
    `;
    document.head.appendChild(style);
}

// 添加移动端支持
function addMobileSupport() {
    // 为线路按钮添加触摸支持
    document.addEventListener('touchstart', function () {
    }, {passive: true});
}

// 主题切换功能
function initThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    const themeSlideToggle = document.getElementById('theme-slide-toggle');

    if (!themeToggle && !themeSlideToggle) return;

    // 检查本地存储的主题偏好
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        if (themeToggle) themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        if (themeSlideToggle) themeSlideToggle.innerHTML = '<i class="fas fa-sun"></i>';
    } else {
        if (themeSlideToggle) themeSlideToggle.innerHTML = '<i class="fas fa-moon"></i>';
    }

    // 顶部导航栏主题切换
    if (themeToggle) {
        themeToggle.addEventListener('click', () => {
            const isDarkMode = document.body.classList.contains('dark-mode');
            toggleTheme(!isDarkMode);
        });
    }

    // 右下角滑动主题切换
    if (themeSlideToggle) {
        themeSlideToggle.addEventListener('click', () => {
            const isDarkMode = document.body.classList.contains('dark-mode');
            toggleTheme(!isDarkMode);
        });
    }
}

// 切换主题的统一函数
function toggleTheme(isDarkMode) {
    const themeToggle = document.getElementById('theme-toggle');
    const themeSlideToggle = document.getElementById('theme-slide-toggle');

    if (isDarkMode) {
        // 切换到深色模式
        document.body.classList.add('dark-mode');
        if (themeToggle) themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        if (themeSlideToggle) themeSlideToggle.innerHTML = '<i class="fas fa-sun"></i>';
        localStorage.setItem('theme', 'dark');
    } else {
        // 切换到浅色模式
        document.body.classList.remove('dark-mode');
        if (themeToggle) themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
        if (themeSlideToggle) themeSlideToggle.innerHTML = '<i class="fas fa-moon"></i>';
        localStorage.setItem('theme', 'light');
    }
}

// 初始化回到顶部功能
function initBackToTop() {
    const backToTopButton = document.getElementById('back-to-top');

    if (!backToTopButton) return;

    // 监听滚动事件
    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 300) {
            backToTopButton.classList.add('visible');
        } else {
            backToTopButton.classList.remove('visible');
        }
    });

    // 回到顶部按钮点击事件
    backToTopButton.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// 初始化热力图模块
function initHeatmap() {
    try {
        // 创建热力图实例
        heatmap = new Heatmap('heatmap-canvas');
        console.log('热力图模块初始化成功');
    } catch (error) {
        console.error('热力图模块初始化失败:', error);
        // 如果热力图初始化失败，可以显示错误信息或使用备用方案
        const heatmapCanvas = document.getElementById('heatmap-canvas');
        if (heatmapCanvas) {
            const ctx = heatmapCanvas.getContext('2d');
            ctx.fillStyle = '#f8f9fa';
            ctx.fillRect(0, 0, heatmapCanvas.width, heatmapCanvas.height);

            ctx.fillStyle = '#6c757d';
            ctx.font = 'bold 20px Arial, "Microsoft YaHei", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('热力图加载失败', heatmapCanvas.width / 2, heatmapCanvas.height / 2);
        }
    }
}

// 初始化侧边栏功能
function initSidebar() {
    const hamburgerMenu = document.getElementById('hamburger-menu');
    const closeSidebar = document.getElementById('close-sidebar');
    const fixedSidebar = document.getElementById('fixed-sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    if (!hamburgerMenu || !fixedSidebar) return;

    // 打开侧边栏
    function openSidebar() {
        fixedSidebar.classList.add('active');
        sidebarOverlay.classList.add('active');
        document.body.style.overflow = 'hidden'; // 防止背景滚动
    }

    // 关闭侧边栏
    function closeSidebarFunc() {
        fixedSidebar.classList.remove('active');
        sidebarOverlay.classList.remove('active');
        document.body.style.overflow = ''; // 恢复滚动
    }

    // 汉堡菜单点击事件
    hamburgerMenu.addEventListener('click', openSidebar);

    // 关闭按钮点击事件
    if (closeSidebar) {
        closeSidebar.addEventListener('click', closeSidebarFunc);
    }

    // 遮罩层点击事件
    sidebarOverlay.addEventListener('click', closeSidebarFunc);

    // ESC键关闭侧边栏
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && fixedSidebar.classList.contains('active')) {
            closeSidebarFunc();
        }
    });

    // 点击线路项时自动关闭侧边栏（移动端）
    document.addEventListener('click', (e) => {
        if (e.target.closest('.line-item') && window.innerWidth <= 768) {
            setTimeout(closeSidebarFunc, 300);
        }
    });
}

// 初始化函数
async function initApp() {
    console.log('正在初始化深圳地铁应用...');

    // 1. 显示加载动画
    showLoadingScreen();

    try {

        // 初始化侧边栏功能
        initSidebar();

        // 2. 实时更新的当前时间
        updateTime();

        // 3. 加载线路数据
        currentLines = await loadLinesData();

        if (!currentLines || currentLines.length === 0) {
            console.error('线路数据加载失败');
            showErrorMessage('数据加载失败，请检查网络连接或刷新页面');
            hideLoadingScreen();
            return;
        }

        console.log(`成功加载 ${currentLines.length} 条线路数据`);

        // 4. 初始化热力图模块（新增）
        initHeatmap();

        // 5. 渲染线路列表
        renderLineList(currentLines, 'line-list', (selectedLine) => {
            currentSelectedLine = selectedLine;
            currentView = 'line';

            // 立即更新实时数据并渲染站点列表
            updateRealtimeDataForLine(selectedLine);

            // 更新页面标题
            updatePageTitle(selectedLine.name, selectedLine.color);

            // 清空搜索框内容
            const searchInput = document.getElementById('search-input');
            if (searchInput) {
                searchInput.value = '';
            }

            // 清空搜索结果
            const searchResults = document.getElementById('search-results');
            if (searchResults) {
                searchResults.innerHTML = '';
                searchResults.style.display = 'none';
            }
        });

        // 6. 初始化搜索功能
        initSearch();

        // 7. 开始实时更新
        startRealtimeUpdates();

        // 8. 添加移动端触摸支持
        addMobileSupport();

        // 9. 设置应用状态
        isAppInitialized = true;

        // 10. 隐藏加载动画
        hideLoadingScreen();

        console.log('应用初始化完成');

    } catch (error) {
        console.error('应用初始化失败:', error);
        showErrorMessage('应用初始化失败，请刷新页面重试');
        hideLoadingScreen();
    }
}

// 启动应用
async function startApp() {
    try {
        // 等待DOM加载完成
        await checkDOMReady();

        console.log('DOM加载完成，开始初始化应用');

        // 初始化主题切换
        initThemeToggle();

        // 初始化回到顶部功能
        initBackToTop();

        // 添加动态样式
        addDynamicStyles();

        // 初始化应用
        await initApp();

    } catch (error) {
        console.error('应用启动失败:', error);
        showErrorMessage('应用启动失败，请刷新页面重试');
    }
}

// 启动应用
startApp();

// 将全局函数暴露给控制台，方便调试
window.debugApp = {
    reloadData: () => initApp(),
    getCurrentLines: () => currentLines,
    getSelectedLine: () => currentSelectedLine,
    getRealtimeData: () => realtimeData,
    getHeatmap: () => heatmap,
    getAppStatus: () => ({
        initialized: isAppInitialized,
        linesCount: currentLines.length,
        selectedLine: currentSelectedLine?.name,
        heatmapInitialized: !!heatmap
    })
};