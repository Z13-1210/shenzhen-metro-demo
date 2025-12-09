/**
 * 主入口文件
 * 职责：初始化应用，协调各模块
 */
import {loadLinesData} from './modules/dataLoader.js'
import {renderLineList} from './modules/lineList.js'
import {renderStationList} from './modules/stationList.js'

// 应用状态
let currentLines = [];
let currentSelectedLine = null;     //在用户做出选择之前，没有任何一条线路被选中。

// 初始化函数
async function initApp() {          //函数里用了 await 这个函数就必须要加 async
    console.log('正在初始化深圳地铁应用...');

    // 实时更新的当前时间
    updateTime();

    // 加载线路数据
    currentLines = await loadLinesData();

    if (currentLines.length === 0) {
        document.getElementById('line-list').innerHTML =
            '<p class="error">数据加载失败，请检查网络连接或刷新页面</p>';
        return;     //直接结束函数
    }

    // 3. 渲染线路列表
    renderLineList(currentLines, 'line-list', (selectedLine) => {   //这个回调函数在用户点击后触发
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
    const timeString = now.toLocaleTimeString('zh-CN');     //格式化为中文格式的“时:分:秒”
    document.getElementById('update-time').textContent = timeString;

    // 2. 更新日期部分（新增或替换原来的年份显示）
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const date = now.getDate();
    const dateString = `${year}年${month}月${date}日`; // 生成日期字符串
    // 替换原来只显示年份的元素内容

    document.getElementById('current-date').textContent = dateString;

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

    // 防抖函数，避免用户连续输入时，触发多次搜索，造成性能浪费
    let timeoutId;
    searchInput.addEventListener('input', () => {    //当用户输入时，触发监听函数
        clearTimeout(timeoutId);                                 //清除之前的待定的，还未执行的计时(如果有)
        timeoutId = setTimeout(() => {                   //设置一个新的计时器，300毫秒后执行搜索
            performSearch(searchInput.value.trim());
        }, 300);
    });

    function performSearch(query) {
        if (!query) {
            searchResults.innerHTML = '';       //如果搜索框是空的，就清空搜索结果
            return;                             // 直接结束函数
        }

        //准备一个空数组，用来装所有线路的所有站点
        const allStations = [];
        currentLines.forEach(line => {          //查找所有地铁线路
            line.stations.forEach(station => {  //查找这条线路上的每个车站
                if (station.includes(query)) {  //检查车站名是否包含用户输入的文字
                    allStations.push({          //push() 就是往数组末尾添加新东西
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
            allStations.forEach(item => {   //对每个找到的车站（item），都往盒子里添加一些内容
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

    const ctx = canvas.getContext('2d');        //ctx 相当于画笔，让我们可以在canvas上画画，这里主要是2D绘图

    // 绘制一个简单的渐变色背景
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);   //创建一个从左到右的线性渐变对象。
    //                                      0, 0：渐变起点（画布左上角）  canvas.width, 0：渐变终点（画布右上角）


    //addColorStop主要用来定义渐变中不同位置的颜色
    gradient.addColorStop(0, '#2E8B57');    //在渐变的最左边（位置0）添加深绿色。
    gradient.addColorStop(0.5, '#FFD700');  //在渐变的中间（位置0.5）添加金黄色。
    gradient.addColorStop(1, '#DC143C');    //在渐变的最右边（位置1）添加深红色。

    ctx.fillStyle = gradient;                                //把画笔的填充颜色设置为刚才创建的渐变。
    //fillRect是画一个填充颜色的矩形的方法
    ctx.fillRect(0, 0, canvas.width, canvas.height);   //用渐变颜色画一个覆盖整个画布的矩形。
    //0, 0：矩形左上角位置（从画布左上角开始画）,canvas.width, canvas.height：矩形的宽高（和画布一样大）

    // 添加文字
    ctx.fillStyle = 'white';//把画笔的填充颜色改成白色(用来写文字)，这里覆盖了之前的渐变设置，只影响后面的文字绘制。
    ctx.font = 'bold 20px "Segoe UI"';
    ctx.textAlign = 'center';
    //fillText是在画布上写文字的方法
    ctx.fillText('客流热力图（模拟数据）', canvas.width / 2, canvas.height / 2);
    //在画布中心写第一行文字。

    ctx.font = '16px "Segoe UI"';
    ctx.fillText('左侧：畅通 | 中部：繁忙 | 右侧：拥堵', canvas.width / 2, canvas.height / 2 + 30);
    //在第一行文字下面30像素的位置写第二行文字。
}

// 添加一些额外的CSS到页面
function addDynamicStyles() {
    const style = document.createElement('style');      //创建一个新的 <style> 标签元素。
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