// main.js

/**
 * 主入口文件
 * 职责：初始化应用，协调各模块
 */
import {loadLinesData} from './modules/dataLoader.js'
import {renderLineList} from './modules/lineList.js'
import {renderStationList} from './modules/stationList.js'
import {realtimeDataService} from './modules/realtimeData.js'

// 应用状态
let currentLines = [];
let currentSelectedLine = null;
let realtimeData = {};
let updateInterval = null;
let isAppInitialized = false;
let currentView = 'line'; // 新增：跟踪当前视图是线路('line')还是站点('station')
let currentDisplayedStation = null; // 新增：跟踪当前显示的站点信息
let currentTooltip = null;
let hoveredStation = null;
let tooltipTimeout = null;

// 热力图相关缓存变量
let stationsDataCache = null;
let stationPositionsCache = []; // 缓存站点位置用于鼠标交互

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
// 更新指定线路的实时数据
function updateRealtimeDataForLine(line) {
    if (!line || !line.stations) return;

    // 计算每个站点的实时数据
    const stationsData = line.stations.map((station, index) => {
        // 获取站点名称 - 根据您的 lines.json 结构进行调整
        let stationName;
        if (typeof station === 'string') {
            // 如果是字符串，直接使用
            stationName = station;
        } else if (station && typeof station === 'object') {
            // 如果是对象，提取 name 属性
            stationName = station.name || station.Name || String(station);
        } else {
            // 其他情况转换为字符串
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

    // 更新热力图
    updateHeatmapWithRealtimeData(stationsData, line);

    // 缓存站点数据用于鼠标交互
    stationsDataCache = stationsData;  // 这行很重要
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

// ==================== 热力图模块 ====================

// 更新热力图（基于实时数据）
function updateHeatmapWithRealtimeData(stationsData, selectedLine) {
    const canvas = document.getElementById('heatmap-canvas');
    if (!canvas) {
        console.warn('热力图canvas元素不存在');
        return;
    }

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 如果没有选中的线路或没有站点数据
    if (!selectedLine || !stationsData || stationsData.length === 0) {
        drawEmptyState(ctx, canvas);
        return;
    }

    // 计算统计数据
    const stats = calculateHeatmapStats(stationsData);
    updateHeatmapStatsUI(stats);

    // 设置画布参数
    const padding = { top: 80, right: 60, bottom: 80, left: 60 };
    const canvasWidth = canvas.width;
    const canvasHeight = canvas.height;
    const plotWidth = canvasWidth - padding.left - padding.right;
    const plotHeight = canvasHeight - padding.top - padding.bottom;

    // 计算每个站点的位置
    const stationPositions = calculateOptimizedStationPositions(
        stationsData,
        padding,
        plotWidth,
        plotHeight
    );

    // 绘制背景
    drawSimplifiedBackground(ctx, canvasWidth, canvasHeight);

    // 绘制线路
    drawSimplifiedLine(ctx, stationPositions, selectedLine.color);

    // 绘制站点
    drawSimplifiedStations(ctx, stationPositions, stationsData);

    // 绘制站点标签
    drawOptimizedLabels(ctx, stationPositions, stationsData);

    // 绘制图例
    drawSimplifiedLegend(ctx, canvasWidth, canvasHeight);

    // 缓存站点位置用于鼠标交互
    cacheStationPositions(stationPositions, stationsData);
}

// 计算优化后的站点位置
function calculateOptimizedStationPositions(stationsData, padding, plotWidth, plotHeight) {
    const numStations = stationsData.length;
    const positions = [];

    if (numStations === 0) return positions;

    // 中心线Y位置
    const centerY = padding.top + plotHeight / 2;

    // 站点间距
    const spacing = plotWidth / Math.max(1, numStations - 1);

    for (let i = 0; i < numStations; i++) {
        const x = padding.left + i * spacing;

        // 轻微的自然弯曲
        const waveAmplitude = plotHeight * 0.2;
        const t = i / Math.max(1, numStations - 1);
        const y = centerY + waveAmplitude * Math.sin(t * Math.PI * 1.5);

        positions.push({
            x,
            y,
            stationIndex: i
        });
    }

    return positions;
}

// 绘制简化背景
function drawSimplifiedBackground(ctx, width, height) {
    // 绘制白色背景
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // 绘制网格线
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.lineWidth = 1;

    // 水平网格线
    for (let y = 20; y < height; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
    }

    // 垂直网格线
    for (let x = 20; x < width; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
    }
}

// 绘制简化线路
function drawSimplifiedLine(ctx, positions, lineColor) {
    if (positions.length < 2) return;

    ctx.beginPath();

    // 使用贝塞尔曲线连接站点
    for (let i = 0; i < positions.length - 1; i++) {
        const current = positions[i];
        const next = positions[i + 1];

        if (i === 0) {
            ctx.moveTo(current.x, current.y);
        }

        const cpDist = (next.x - current.x) * 0.3;
        const cp1x = current.x + cpDist;
        const cp1y = current.y;
        const cp2x = next.x - cpDist;
        const cp2y = next.y;

        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, next.x, next.y);
    }

    // 线路样式
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
}

// 绘制简化站点
function drawSimplifiedStations(ctx, positions, stationsData) {
    positions.forEach((pos, index) => {
        const stationData = stationsData[index];
        if (!stationData) return;

        const { x, y } = pos;
        const congestionColor = stationData.congestion.color;

        // 绘制简单的圆点
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fillStyle = congestionColor;
        ctx.fill();

        // 细白色边框
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
    });
}

// 绘制优化标签
function drawOptimizedLabels(ctx, positions, stationsData) {
    const numStations = positions.length;

    positions.forEach((pos, index) => {
        const stationData = stationsData[index];
        if (!stationData) return;

        const { x, y } = pos;

        // 根据站点索引决定标签位置
        // 交替显示在上方和下方，避免拥挤
        const labelPosition = index % 4; // 0,1,2,3
        let labelY, textBaseline;

        switch (labelPosition) {
            case 0: // 上方
                labelY = y - 15;
                textBaseline = 'bottom';
                break;
            case 1: // 下方
                labelY = y + 15;
                textBaseline = 'top';
                break;
            case 2: // 更上方
                labelY = y - 25;
                textBaseline = 'bottom';
                break;
            case 3: // 更下方
                labelY = y + 25;
                textBaseline = 'top';
                break;
        }

        // 绘制站点名称
        ctx.fillStyle = '#333333';
        ctx.font = '12px Arial, "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = textBaseline;
        ctx.fillText(stationData.stationName, x, labelY);
    });
}

// 绘制简化图例
function drawSimplifiedLegend(ctx, width, height) {
    const legendX = 100;
    const legendY = height - 40;

    const congestionLevels = [
        { level: '畅通', color: '#10b981' },
        { level: '舒适', color: '#3b82f6' },
        { level: '繁忙', color: '#f59e0b' },
        { level: '拥挤', color: '#ef4444' },
        { level: '拥堵', color: '#dc2626' }
    ];

    // 绘制图例标题
    ctx.fillStyle = '#333333';
    ctx.font = 'bold 12px Arial, "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('客流等级:', 20, legendY);

    // 绘制图例项
    const itemSpacing = 60;

    congestionLevels.forEach((level, index) => {
        const x = legendX + index * itemSpacing;

        // 绘制简单颜色方块
        ctx.fillStyle = level.color;
        ctx.fillRect(x, legendY - 6, 10, 10);

        // 绘制标签
        ctx.fillStyle = '#666666';
        ctx.font = '12px Arial, "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(level.level, x + 15, legendY);
    });
}

// 缓存站点位置用于鼠标交互
function cacheStationPositions(positions, stationsData) {
    stationPositionsCache = positions.map((pos, index) => {
        const stationData = stationsData[index];
        if (!stationData) return null;

        return {
            stationData: stationData,
            x: pos.x,
            y: pos.y,
            stationIndex: pos.stationIndex
        };
    }).filter(item => item !== null);
}

// 其他辅助函数保持不变
function calculateHeatmapStats(stationsData) {
    if (!stationsData || stationsData.length === 0) {
        return { total: 0, avg: 0, peak: 0 };
    }

    const passengers = stationsData.map(data => data.passengers);
    const total = passengers.reduce((sum, p) => sum + p, 0);
    const avg = Math.round(total / passengers.length);
    const peak = Math.max(...passengers);

    return { total, avg, peak };
}

function updateHeatmapStatsUI(stats) {
    const totalEl = document.getElementById('total-passengers');
    const avgEl = document.getElementById('avg-passengers');
    const peakEl = document.getElementById('peak-passengers');

    if (totalEl) totalEl.textContent = stats.total.toLocaleString();
    if (avgEl) avgEl.textContent = stats.avg.toLocaleString();
    if (peakEl) peakEl.textContent = stats.peak.toLocaleString();
}

function drawEmptyState(ctx, canvas) {
    ctx.fillStyle = '#f8f9fa';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#6c757d';
    ctx.font = 'bold 20px Arial, "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('请选择一条线路查看热力图', canvas.width / 2, canvas.height / 2);
}

// 热力图鼠标事件
// 热力图鼠标事件
function initHeatmapMouseEvents() {
    const heatmapCanvas = document.getElementById('heatmap-canvas');
    if (!heatmapCanvas) {
        console.warn('热力图canvas元素未找到');
        return;
    }

    // 鼠标移动事件
    heatmapCanvas.addEventListener('mousemove', (e) => {
        if (!stationPositionsCache || stationPositionsCache.length === 0) {
            return;
        }

        const rect = heatmapCanvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // 检查鼠标是否在站点圆点上
        let hoveredStation = null;

        stationPositionsCache.forEach((pos) => {
            if (!pos) return;

            const distance = Math.sqrt(
                Math.pow(mouseX - pos.x, 2) +
                Math.pow(mouseY - pos.y, 2)
            );

            if (distance <= 10) { // 10px半径内
                hoveredStation = pos;
            }
        });

        // 显示tooltip
        if (hoveredStation && hoveredStation.stationData) {
            const stationData = hoveredStation.stationData;
            showSimplifiedTooltip(e.clientX, e.clientY, stationData);
        } else {
            hideStationTooltip();
        }
    });

    // 鼠标离开画布时隐藏tooltip
    heatmapCanvas.addEventListener('mouseleave', hideStationTooltip);
}

// 隐藏站点提示框
function hideStationTooltip() {
    if (currentTooltip) {
        if (currentTooltip.parentNode) {
            currentTooltip.parentNode.removeChild(currentTooltip);
        }
        currentTooltip = null;
    }
    hoveredStation = null;
}

// 显示简化tooltip
function showSimplifiedTooltip(x, y, stationData) {
    hideStationTooltip();

    const tooltip = document.createElement('div');
    tooltip.className = 'station-tooltip';
    tooltip.innerHTML = `
        <div class="tooltip-header">${stationData.stationName}</div>
        <div class="tooltip-content">客流量: ${stationData.passengers.toLocaleString()}人</div>
    `;

    document.body.appendChild(tooltip);
    currentTooltip = tooltip;

    // 计算位置
    const tooltipRect = tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let left = x + 15;
    let top = y - 50;

    if (left + tooltipRect.width > viewportWidth) {
        left = x - tooltipRect.width - 15;
    }
    if (top < 0) {
        top = y + 15;
    }
    if (top + tooltipRect.height > viewportHeight) {
        top = y - tooltipRect.height - 15;
    }

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';

    // 5秒后自动隐藏
    tooltipTimeout = setTimeout(hideStationTooltip, 5000);
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

/**
 * 只显示单个站点信息（搜索功能专用）
 * 与 showSingleStation 不同，这个函数不切换线路视图
 */
function showSingleStationOnly(stationInfo) {
    console.log('显示单个站点信息（搜索功能）:', stationInfo);

    const stationContainer = document.getElementById('station-list');
    if (!stationContainer) return;

    // 设置视图为单站点视图
    currentView = 'station';
    currentDisplayedStation = stationInfo;

    // 找到该站点在线路中的索引
    const line = stationInfo.line;
    let stationIndex = -1;
    let stationObj = null;

    // 搜索站点在线路中的位置
    for (let i = 0; i < line.stations.length; i++) {
        const station = line.stations[i];
        let stationName = '';

        if (typeof station === 'string') {
            stationName = station;
        } else if (station && typeof station === 'object') {
            stationName = station.name || station.Name || station.stationName || '';
        } else {
            stationName = String(station);
        }

        if (stationName === stationInfo.name) {
            stationIndex = i;
            stationObj = station;
            break;
        }
    }

    if (stationIndex === -1) {
        console.warn(`未在线路 ${line.name} 中找到站点 ${stationInfo.name}`);
        return;
    }

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
                ${stationData.congestion.emoji || '🚇'} ${stationData.congestion.level}
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
        <div class="station-meta">
            <div class="station-line">
                <span class="line-badge" style="background: ${line.color}">${line.name}</span>
            </div>
        </div>
    `;

    stationContainer.appendChild(stationElement);

    // 【新增】更新页面标题，显示当前查看的站点
    const titleElement = document.querySelector('header h1');
    if (titleElement) {
        titleElement.innerHTML = `
            <i class="fas fa-subway"></i> 深圳地铁实时客流模拟系统 
            <span class="current-station" style="color: ${line.color}">| ${stationInfo.name} (${line.name})</span>
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

    function performSearch(query) {
        if (!currentLines || currentLines.length === 0) {
            console.warn('线路数据未加载，无法搜索');
            return;
        }

        const allStations = [];

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
                    // 尝试从不同可能的属性中获取站点名称
                    stationName = station.name || station.Name || station.stationName || '';

                    // 如果是坐标对象但没有名称，跳过
                    if (!stationName && station.coordinates) {
                        return; // 跳过只有坐标没有名称的站点
                    }

                    // 如果还是没有名称，尝试转换为字符串
                    if (!stationName) {
                        stationName = String(station);
                    }
                } else {
                    stationName = String(station);
                }

                // 检查是否匹配搜索词
                if (stationName && stationName.toLowerCase().includes(query.toLowerCase())) {
                    allStations.push({
                        name: stationName,
                        line: line,
                        color: line.color,
                        stationObj: station
                    });
                }
            });
        });

        // 更新搜索结果
        if (allStations.length === 0) {
            searchResults.innerHTML = `
                <div class="search-result-item no-results">
                    未找到包含 "${query}" 的站点
                </div>
            `;
        } else {
            // 限制显示数量，避免过多结果
            const displayStations = allStations.slice(0, 20);

            let html = `
                <div class="search-result-item results-count">
                    找到 ${allStations.length} 个匹配站点
                </div>
            `;

            displayStations.forEach((item, index) => {
                html += `    
                    <div class="search-result-item" data-line="${item.line.id}" data-station="${item.name}">
                        <span class="station-name">${item.name}</span>
                        <span class="line-badge" style="background:${item.color}">${item.line.name}</span>
                    </div>
                `;

                // 如果结果太多，添加提示
                if (index === 19 && allStations.length > 20) {
                    html += `<div class="search-result-item more-results">... 还有 ${allStations.length - 20} 个结果</div>`;
                }
            });

            searchResults.innerHTML = html;

            // 为搜索结果添加点击事件
            const searchResultItems = searchResults.querySelectorAll('.search-result-item[data-line]');
            searchResultItems.forEach(item => {
                item.addEventListener('click', () => {
                    const lineId = parseInt(item.getAttribute('data-line'));
                    const stationName = item.getAttribute('data-station');

                    // 找到对应的线路
                    const line = currentLines.find(l => l.id === lineId);
                    if (line) {
                        // 【修改点1】显示单个站点信息
                        showSingleStationOnly({
                            name: stationName,
                            line: line,
                            color: line.color
                        });

                        // 【修改点2】不自动切换线路，保持当前视图
                        // 不清空搜索框，让用户可以看到搜索的关键词

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
    document.addEventListener('touchstart', function () {
    }, {passive: true});
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

        // 4. 渲染线路列表
        renderLineList(currentLines, 'line-list', (selectedLine) => {
            currentSelectedLine = selectedLine;
            // 设置视图为线路视图
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

        // 5. 初始化搜索功能
        initSearch();

        // 6. 初始化热力图鼠标事件
        initHeatmapMouseEvents();

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