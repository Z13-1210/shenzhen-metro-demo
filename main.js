/**
 * 主入口文件
 * 职责：初始化应用，协调各模块
 */
import {loadLinesData} from './modules/dataLoader.js'
import {renderLineList} from './modules/lineList.js'
import {renderStationList} from './modules/stationList.js'

// 应用状态
let currentLines = [];                  // 存储当前加载的地铁线路数据
let currentSelectedLine = null;         // 当前选中的地铁线路
let isDarkMode = false;                 // 深色模式状态标识

/**
 * 初始化函数
 * 应用启动时执行的主要初始化操作
 */
async function initApp() {
    console.log('正在初始化深圳地铁应用...');

    // 实时更新的当前时间
    updateTime();

    // 加载线路数据
    currentLines = await loadLinesData();

    if (currentLines.length === 0) {
        document.getElementById('line-list').innerHTML =
            '<p class="error">数据加载失败，请检查网络连接或刷新页面</p>';
        return;
    }

    // 渲染线路列表
    renderLineList(currentLines, 'line-list', (selectedLine) => {
        currentSelectedLine = selectedLine;
        // 渲染站点列表
        renderStationList(selectedLine.stations, 'station-list');

        // 更新页面标题
        updatePageTitle(selectedLine.name, selectedLine.color);
    });

    // 初始化搜索功能
    initSearch();

    // 初始化热力图
    initHeatmap();

    // 添加移动端触摸支持
    addMobileSupport();

    // 初始化深色模式切换
    initThemeToggle();
}

/**
 * 更新时间显示
 * 实时更新页面中的时间和日期信息
 */
function updateTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('zh-CN');
    document.getElementById('update-time').textContent = timeString;

    // 更新日期部分
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const dateString = `${year}年${month}月${date}日`;
    document.getElementById('current-date').textContent = dateString;

    // 每秒更新一次时间
    setTimeout(updateTime, 1000);
}

/**
 * 更新页面标题
 * 根据选中的线路更新页面标题，包括线路颜色
 * @param {string} lineName - 线路名称
 * @param {string} lineColor - 线路颜色
 */
function updatePageTitle(lineName, lineColor) {
    const titleElement = document.querySelector('header h1');
    titleElement.innerHTML = `<i class="fas fa-subway"></i> 深圳地铁实时客流模拟系统 <span class="current-line" style="color: ${lineColor}">| ${lineName}</span>`;
}

/**
 * 初始化搜索功能
 * 设置站点搜索功能，包括防抖处理
 */
function initSearch() {
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');

    if (!searchInput) return;

    // 防抖函数，避免用户连续输入时频繁触发搜索
    let timeoutId;
    searchInput.addEventListener('input', () => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            performSearch(searchInput.value.trim());
        }, 300);
    });

    /**
     * 执行搜索操作
     * @param {string} query - 搜索关键词
     */
    function performSearch(query) {
        if (!query) {
            searchResults.innerHTML = '';
            return;
        }

        // 准备一个空数组，用来装所有线路的所有站点
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

/**
 * 初始化热力图（简易版）
 * 绘制客流热力图
 */
function initHeatmap() {
    const canvas = document.getElementById('heatmap-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // 绘制一个简单的渐变色背景
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);

    // 定义渐变色 stops
    gradient.addColorStop(0, '#2E8B57');    // 畅通 - 深绿色
    gradient.addColorStop(0.5, '#FFD700');  // 繁忙 - 金黄色
    gradient.addColorStop(1, '#DC143C');    // 拥堵 - 深红色

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 添加文字说明
    ctx.fillStyle = 'white';
    ctx.font = 'bold 20px "Segoe UI"';
    ctx.textAlign = 'center';
    ctx.fillText('客流热力图（模拟数据）', canvas.width / 2, canvas.height / 2);

    ctx.font = '16px "Segoe UI"';
    ctx.fillText('左侧：畅通 | 中部：繁忙 | 右侧：拥堵', canvas.width / 2, canvas.height / 2 + 30);
}

/**
 * 添加动态样式
 * 通过JavaScript动态添加一些CSS样式
 */
function addDynamicStyles() {
    const style = document.createElement('style');
    style.textContent = ` 
        .current-line {
            font-size: 1.8rem;
        }
        .no-stations, .no-results, .error {
            color: #999;
            text-align: center;
            padding: 20px;
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
        
        /* 移动端触摸反馈 */
        @media (hover: none) and (pointer: coarse) {
            .line-item:hover {
                opacity: 1;
                transform: scale(1);
            }
            
            .line-item:active {
                opacity: 0.9;
                transform: scale(1.05);
            }
            
            .station-item:hover {
                background: #f1f5f9;
                transform: translateX(0);
            }
            
            body.dark-mode .station-item:hover {
                background: #334155;
                transform: translateX(0);
            }
            
            .station-item:active {
                background: #e2e8f0;
                transform: translateX(5px);
            }
            
            body.dark-mode .station-item:active {
                background: #475569;
                transform: translateX(5px);
            }
            
            .panel:hover, .full-width-panel:hover {
                transform: translateY(0);
            }
        }
    `;
    document.head.appendChild(style);
}

/**
 * 添加移动端支持
 * 为移动端设备添加必要的支持
 */
function addMobileSupport() {
    // 为线路按钮添加触摸支持
    document.addEventListener('touchstart', function() {}, { passive: true });
}

/**
 * 初始化主题切换
 * 设置深色模式切换功能
 */
function initThemeToggle() {
    const themeToggle = document.getElementById('theme-toggle');
    if (!themeToggle) return;

    // 检查用户之前是否选择了深色模式
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        toggleDarkMode();
    }

    themeToggle.addEventListener('click', () => {
        toggleDarkMode();
        // 保存用户的选择
        localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
    });
}

/**
 * 切换深色模式
 * 在浅色和深色模式之间切换
 */
function toggleDarkMode() {
    isDarkMode = !isDarkMode;
    document.body.classList.toggle('dark-mode', isDarkMode);
    
    // 更新图标
    const themeIcon = document.querySelector('#theme-toggle i');
    if (isDarkMode) {
        themeIcon.classList.remove('fa-moon');
        themeIcon.classList.add('fa-sun');
    } else {
        themeIcon.classList.remove('fa-sun');
        themeIcon.classList.add('fa-moon');
    }
    
    // 重新绘制热力图以适应主题变化
    initHeatmap();
}

// 启动应用
addDynamicStyles();
initApp();

// 将全局函数暴露给控制台，方便调试
window.debugApp = {
    reloadData: () => initApp(),
    getCurrentLines: () => currentLines,
    getSelectedLine: () => currentSelectedLine,
    toggleDarkMode: () => toggleDarkMode()
};