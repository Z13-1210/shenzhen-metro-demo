/**
 * 主入口文件
 * 职责：初始化应用，协调各模块
 */
import { loadLinesData } from './modules/dataLoader.js';
import { renderLineList } from './modules/lineList.js';
import { renderStationList } from './modules/stationList.js';

// 应用状态
let currentLines = [];
let currentSelectedLine = null;

// 初始化函数
async function initApp() {
    console.log('正在初始化深圳地铁应用...');

    // 1. 更新时间显示
    updateTime();

    // 2. 加载线路数据
    currentLines = await loadLinesData();

    if (currentLines.length === 0) {
        document.getElementById('line-list').innerHTML =
            '<p class="error">数据加载失败，请检查网络连接或刷新页面</p>';
        return;
    }

    // 3. 渲染线路列表
    renderLineList(currentLines, 'line-list', (selectedLine) => {
        currentSelectedLine = selectedLine;
        // 4. 渲染站点列表
        renderStationList(selectedLine.stations, 'station-list');

        // 5. 更新页面标题
        updatePageTitle(selectedLine.name);
    });

    // 6. 初始化搜索功能
    initSearch();

    // 7. 初始化热力图
    initHeatmap();
}

// 更新时间显示
function updateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('zh-CN');
    document.getElementById('update-time').textContent = timeString;

    // 更新年份
    document.getElementById('current-year').textContent = now.getFullYear();

    // 每秒更新一次时间
    setTimeout(updateTime, 1000);
}

// 更新页面标题
function updatePageTitle(lineName) {
    const titleElement = document.querySelector('header h1');
    titleElement.innerHTML = `<i class="fas fa-subway"></i> 深圳地铁实时客流模拟系统 <span class="current-line">| ${lineName}</span>`;
}

// 初始化搜索功能
function initSearch() {
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');

    if (!searchInput) return;

    // 简单防抖函数
    let timeoutId;
    searchInput.addEventListener('input', () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            performSearch(searchInput.value.trim());
        }, 300);
    });

    function performSearch(query) {
        if (!query) {
            searchResults.innerHTML = '';
            return;
        }

        // 收集所有线路的所有站点
        const allStations = [];
        currentLines.forEach(line => {
            line.stations.forEach(station => {
                if (station.includes(query)) {
                    allStations.push({
                        name: station,
                        line: line.name,
                        color: line.color
                    });
                }
            });
        });

        // 显示搜索结果
        if (allStations.length === 0) {
            searchResults.innerHTML = `<p class="no-results">未找到包含"${query}"的站点</p>`;
        } else {
            let html = `<p class="results-count">找到 ${allStations.length} 个匹配站点</p>`;
            allStations.forEach(item => {
                html += `
                    <div class="search-result-item">
                        <span class="station-name">${item.name}</span>
                        <span class="line-badge" style="background:${item.color}">${item.line}</span>
                    </div>
                `;
            });
            searchResults.innerHTML = html;
        }
    }
}

// 初始化热力图（简易版）
function initHeatmap() {
    const canvas = document.getElementById('heatmap-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // 绘制一个简单的渐变色背景
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
    gradient.addColorStop(0, '#2E8B57');
    gradient.addColorStop(0.5, '#FFD700');
    gradient.addColorStop(1, '#DC143C');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 添加文字
    ctx.fillStyle = 'white';
    ctx.font = 'bold 20px "Segoe UI"';
    ctx.textAlign = 'center';
    ctx.fillText('客流热力图（模拟数据）', canvas.width/2, canvas.height/2);

    ctx.font = '16px "Segoe UI"';
    ctx.fillText('左侧：畅通 | 中部：繁忙 | 右侧：拥堵', canvas.width/2, canvas.height/2 + 30);
}

// 添加一些额外的CSS到页面
function addDynamicStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .current-line {
            color: #FF5722;
            font-size: 1.8rem;
        }
        .no-stations, .no-results, .error {
            color: #999;
            text-align: center;
            padding: 20px;
        }
        .station-number {
            font-weight: bold;
            color: #0078D7;
            margin-bottom: 5px;
        }
        .station-name {
            font-size: 1.1rem;
            font-weight: 500;
            margin-bottom: 5px;
        }
        .passenger-count {
            color: #666;
            font-size: 0.9rem;
        }
        .search-result-item {
            padding: 8px 12px;
            border-bottom: 1px solid #eee;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .line-badge {
            color: white;
            padding: 2px 8px;
            border-radius: 10px;
            font-size: 0.8rem;
        }
        .results-count {
            color: #666;
            font-size: 0.9rem;
            margin-bottom: 10px;
        }
    `;
    document.head.appendChild(style);
}

// 启动应用
addDynamicStyles();
initApp();

// 将全局函数暴露给控制台，方便调试
window.debugApp = {
    reloadData: () => initApp(),
    getCurrentLines: () => currentLines,
    getSelectedLine: () => currentSelectedLine
};