// main.js

/**
 * 主入口文件
 * 职责：初始化应用，协调各模块
 */
import { loadLinesData } from './modules/dataLoader.js'
import { renderLineList } from './modules/lineList.js'
import { renderStationList } from './modules/stationList.js'
import { realtimeDataService } from './modules/realtimeData.js'

// 应用状态
let currentLines = [];
let currentSelectedLine = null;
let realtimeData = {};
let updateInterval = null;
let isAppInitialized = false;
let currentView = 'line'; // 新增：跟踪当前视图是线路('line')还是站点('station')
let currentDisplayedStation = null; // 新增：跟踪当前显示的站点信息

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

// 计算总站点数
function calculateTotalStations() {
    if (!currentLines || currentLines.length === 0) return 0;

    const uniqueStations = new Set();
    currentLines.forEach(line => {
        if (line.stations) {
            line.stations.forEach(station => uniqueStations.add(station));
        }
    });

    return uniqueStations.size;
}

// 更新指定线路的实时数据
function updateRealtimeDataForLine(line) {
    if (!line || !line.stations) return;

    // 计算每个站点的实时数据
    const stationsData = line.stations.map((station, index) => {
        return realtimeDataService.calculateStationPassengers(
            station,
            line.name,
            index,
            line.stations.length
        );
    });

    // 保存实时数据
    realtimeData[line.id] = stationsData;

    // 更新站点列表显示
    renderStationList(line.stations, 'station-list', stationsData);

    // 更新热力图
    updateHeatmapWithRealtimeData(stationsData);
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

// 更新热力图（基于实时数据）
function updateHeatmapWithRealtimeData(stationsData) {
    const canvas = document.getElementById('heatmap-canvas');
    if (!canvas) {
        console.warn('热力图画布元素未找到');
        return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        console.warn('无法获取画布上下文');
        return;
    }

    // 清空画布
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 计算平均客流
    let avgPassengers = 500; // 默认值
    if (stationsData && stationsData.length > 0) {
        avgPassengers = stationsData.reduce((sum, data) => sum + data.passengers, 0) / stationsData.length;
    }

    // 创建渐变色
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);

    // 根据平均客流调整渐变色
    if (avgPassengers < 200) {
        // 畅通 - 绿色为主
        gradient.addColorStop(0, '#10b981');
        gradient.addColorStop(0.5, '#34d399');
        gradient.addColorStop(1, '#10b981');
    } else if (avgPassengers < 500) {
        // 舒适 - 蓝色为主
        gradient.addColorStop(0, '#3b82f6');
        gradient.addColorStop(0.5, '#60a5fa');
        gradient.addColorStop(1, '#3b82f6');
    } else if (avgPassengers < 1000) {
        // 繁忙 - 黄色为主
        gradient.addColorStop(0, '#f59e0b');
        gradient.addColorStop(0.5, '#fbbf24');
        gradient.addColorStop(1, '#f59e0b');
    } else if (avgPassengers < 2000) {
        // 拥挤 - 橙色为主
        gradient.addColorStop(0, '#f97316');
        gradient.addColorStop(0.5, '#fb923c');
        gradient.addColorStop(1, '#f97316');
    } else {
        // 拥堵 - 红色为主
        gradient.addColorStop(0, '#ef4444');
        gradient.addColorStop(0.5, '#f87171');
        gradient.addColorStop(1, '#ef4444');
    }

    // 绘制热力图背景
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 添加热力图数据点
    if (stationsData && stationsData.length > 0) {
        const pointRadius = 8;
        const pointSpacing = canvas.width / (stationsData.length + 1);

        stationsData.forEach((data, index) => {
            const x = pointSpacing * (index + 1);
            const y = canvas.height / 2;
            const intensity = Math.min(1, data.passengers / 2000);

            // 绘制数据点
            ctx.beginPath();
            ctx.arc(x, y, pointRadius * intensity, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${0.3 + intensity * 0.7})`;
            ctx.fill();

            // 绘制数据点边框
            ctx.beginPath();
            ctx.arc(x, y, pointRadius * intensity, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.lineWidth = 1;
            ctx.stroke();
        });
    }
// 添加文字信息
    const total = stationsData ? stationsData.reduce((sum, data) => sum + data.passengers, 0) : 0;

    ctx.fillStyle = 'white';
    ctx.font = 'bold 20px "Segoe UI"';
    ctx.textAlign = 'center';
    ctx.fillText('实时客流热力图', canvas.width / 2, 30);

    ctx.font = '16px "Segoe UI"';
    ctx.fillText(`当前线路总客流：${(total / 1000).toFixed(1)}K`, canvas.width / 2, 60);

    ctx.font = '14px "Segoe UI"';
    ctx.fillText(`数据更新时间：${new Date().toLocaleTimeString()}`, canvas.width / 2, canvas.height - 20);
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

// 初始化搜索功能
function initSearch() {
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');

    if (!searchInput) {
        console.warn('搜索输入框未找到');
        return;
    }

    let timeoutId;
    searchInput.addEventListener('input', () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            performSearch(searchInput.value.trim());
        }, 300);
    });

    function performSearch(query) {
        if (!searchResults) return;

        if (!query) {
            searchResults.innerHTML = '';
            return;
        }

        const allStations = [];
        currentLines.forEach(line => {
            if (line.stations) {
                line.stations.forEach(station => {
                    if (station.includes(query)) {
                        allStations.push({
                            name: station,
                            line: line,
                            color: line.color
                        });
                    }
                });
            }
        });

        if (allStations.length === 0) {
            searchResults.innerHTML = `<p class="no-results">未找到包含"${query}"的站点</p>`;
        } else {
            let html = `<p class="results-count">找到 ${allStations.length} 个匹配站点</p>`;
            allStations.forEach((item, index) => {
                html += `    
                    <div class="search-result-item" data-index="${index}">
                        <span class="station-name">${item.name}</span>
                        <span class="line-badge" style="background:${item.color}">${item.line.name}</span>
                    </div>
                `;
            });
            searchResults.innerHTML = html;

            // 为搜索结果添加点击事件
            const searchResultItems = searchResults.querySelectorAll('.search-result-item');
            searchResultItems.forEach(item => {
                item.addEventListener('click', () => {
                    const index = parseInt(item.getAttribute('data-index'));
                    const selectedStation = allStations[index];
                    
                    // 显示单个站点信息
                    showSingleStation(selectedStation);
                });
            });
        }
    }

    // 显示单个站点信息的函数
    function showSingleStation(stationInfo) {
        const stationContainer = document.getElementById('station-list');
        if (!stationContainer) return;

        // 设置视图为单站点视图
        currentView = 'station';
        currentDisplayedStation = stationInfo;

        // 找到该站点在线路中的索引
        const line = stationInfo.line;
        const stationIndex = line.stations.indexOf(stationInfo.name);
        
        if (stationIndex === -1) return;

        // 生成该站点的实时数据
        const stationData = realtimeDataService.calculateStationPassengers(
            stationInfo.name,
            line.name,
            stationIndex,
            line.stations.length
        );

        // 清空容器
        stationContainer.innerHTML = '';

        // 创建站点元素
        const stationElement = document.createElement('div');
        stationElement.className = 'station-item';
        stationElement.tabIndex = 0;

        // 计算客流百分比用于进度条
        const passengerPercentage = Math.min(100, Math.floor((stationData.passengers / 2000) * 100));

        stationElement.innerHTML = `
            <div class="station-header">
                <div class="station-number">${stationIndex + 1}</div>
                <div class="station-name">${stationInfo.name}</div>
                <div class="congestion-badge" style="background: ${stationData.congestion.color}">
                    ${stationData.congestion.emoji} ${stationData.congestion.level}
                </div>
            </div>
            <div class="station-details">
                <div class="passenger-count">
                    <i class="fas fa-users"></i> 
                    <span class="passenger-number">${stationData.passengers.toLocaleString()}</span> 人
                </div>
                <div class="passenger-indicator">
                    <div class="passenger-level" style="width: ${passengerPercentage}%; background: ${stationData.congestion.color}"></div>
                </div>
            </div>
        `;

        stationContainer.appendChild(stationElement);
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
            border-radius: 50px;
            font-weight: 600;
            margin-left: 10px;
            backdrop-filter: blur(10px);
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
        
        .passenger-trend {
            font-size: 0.85rem;
            color: var(--text-secondary);
            margin-top: 5px;
            display: flex;
            align-items: center;
            gap: 5px;
        }
        
        /* 移动端触摸反馈 */
        @media (hover: none) and (pointer: coarse) {
            .line-item:hover {
                opacity: 1;
                transform: scale(1);
            }
            
            .line-item:active {
                opacity: 0.9;
                transform: scale(1); /* 修改这里，从1.05改为1，避免按钮放大 */
            }
            
            .station-item:hover {
                background: #f1f5f9;
                transform: translateX(0);
            }
            
            .station-item:active {
                background: #e2e8f0;
                transform: translateX(5px);
            }
            
            .panel:hover {
                transform: translateY(0);
            }
        }
    `;
    document.head.appendChild(style);
}

// 添加移动端支持
function addMobileSupport() {
    // 为线路按钮添加触摸支持
    document.addEventListener('touchstart', function() {}, { passive: true });
}

// 主题切换功能
function initThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) return;

    // 检查本地存储的主题偏好
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
    }

    themeToggle.addEventListener('click', () => {
        const isDarkMode = document.body.classList.contains('dark-mode');

        if (isDarkMode) {
            // 切换到浅色模式
            document.body.classList.remove('dark-mode');
            themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
            localStorage.setItem('theme', 'light');
        } else {
            // 切换到深色模式
            document.body.classList.add('dark-mode');
            themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
            localStorage.setItem('theme', 'dark');
        }
    });
}

// 初始化函数
async function initApp() {
    console.log('正在初始化深圳地铁应用...');

    // 1. 显示加载动画
    showLoadingScreen();

    try {
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

        // 在initApp函数中修改线路列表的点击处理
        // 4. 渲染线路列表
        renderLineList(currentLines, 'line-list', (selectedLine) => {
            currentSelectedLine = selectedLine;
            // 设置视图为线路视图
            currentView = 'line';
            // 立即更新实时数据并渲染站点列表
            updateRealtimeDataForLine(selectedLine);
        
            // 更新页面标题
            updatePageTitle(selectedLine.name, selectedLine.color);
            
            // 清除搜索框内容
            const searchInput = document.getElementById('search-input');
            if (searchInput) {
                searchInput.value = '';
            }
            
            // 清空搜索结果
            const searchResults = document.getElementById('search-results');
            if (searchResults) {
                searchResults.innerHTML = '';
            }
        });

        // 5. 初始化搜索功能
        initSearch();

        // 6. 开始实时更新
        startRealtimeUpdates();

        // 7. 添加移动端触摸支持
        addMobileSupport();

        // 8. 设置应用状态
        isAppInitialized = true;

        // 9. 隐藏加载动画
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
    getAppStatus: () => ({
        initialized: isAppInitialized,
        linesCount: currentLines.length,
        selectedLine: currentSelectedLine?.name
    })
};