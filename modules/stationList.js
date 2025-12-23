// modules/stationList.js

// 全局变量保存原始数据
let originalStationsData = null;
let originalStations = null;
let currentContainerId = null;
let currentSortMode = 'default'; // 新增：保存当前排序模式

export function renderStationList(stations, containerId, stationsData) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`容器 #${containerId} 不存在`);
        return;
    }

    // 保存原始数据用于排序
    originalStations = stations;
    originalStationsData = stationsData;
    currentContainerId = containerId;

    // 根据当前排序模式决定如何渲染
    let displayStations = stations;
    let displayData = stationsData;

    if (currentSortMode === 'passengers' && stationsData) {
        // 如果当前是客流量排序，则应用排序
        const indices = stationsData
            .map((data, index) => ({ index, passengers: data.passengers || 0 }))
            .sort((a, b) => b.passengers - a.passengers)
            .map(item => item.index);
        
        displayStations = indices.map(i => stations[i]);
        displayData = indices.map(i => stationsData[i]);
    } else if (currentSortMode === 'reverse') {
        // 如果是反向排序，则反转数组
        displayStations = [...stations].reverse();
        displayData = stationsData ? [...stationsData].reverse() : null;
    }

    // 清空容器
    container.innerHTML = '';

    // 如果没有站点数据，显示提示
    if (!displayStations || displayStations.length === 0) {
        container.innerHTML = '<p class="no-data">暂无站点数据</p>';
        return;
    }

    // 辅助函数：根据拥堵等级获取带颜色的小人图标
    function getPeopleIcons(level, color) {
        // 检查是否为停运时段
        const currentTime = new Date();
        const currentHour = currentTime.getHours();
        const isOffService = currentHour >= 0 && currentHour < 6; // 00:00-06:00为停运时段

        // 如果是停运状态，显示灰色小人
        if (level === '已停运' || isOffService) {
            let icons = '';
            for (let i = 0; i < 1; i++) {
                icons += `<i class="fas fa-male" style="color: #64748b"></i>`;
            }
            return icons;
        }

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

        // 如果是停运时段，使用灰色
        const iconColor = isOffService ? '#64748b' : color;

        // 创建带颜色的小人图标
        let icons = '';
        for (let i = 0; i < count; i++) {
            icons += `<i class="fas fa-male" style="color: ${iconColor}"></i>`;
        }

        return icons;
    }

    // 为每个站点创建一个列表项
    displayStations.forEach((station, index) => {
        let stationName;

        if (typeof station === 'string') {
            stationName = station;
        } else if (station && typeof station === 'object' && station.name) {
            stationName = station.name;
        } else {
            stationName = String(station);
        }

        const stationItem = document.createElement('div');
        stationItem.className = 'station-item';
        stationItem.tabIndex = 0;
        stationItem.setAttribute('data-station-index', index);

        // 获取对应的实时数据
        let stationData = null;
        if (displayData && displayData[index]) {
            stationData = displayData[index];
        } else {
            stationData = {
                stationName: stationName,
                passengers: 0,
                congestion: { level: '未知', color: '#64748b' }
            };
        }

        if (!stationData.stationName) {
            stationData.stationName = stationName;
        }

        // 计算客流百分比用于进度条
        const passengerPercentage = Math.min(100, Math.floor((stationData.passengers / 2000) * 100));

        // 检查是否为停运状态
        const isOffService = stationData.isOffService || false;
        const displayLevel = isOffService ? '已停运' : stationData.congestion.level;
        const displayColor = isOffService ? '#64748b' : stationData.congestion.color;
        const passengerPercentageDisplay = isOffService ? 0 : passengerPercentage; // 停运时进度条为0

        // 获取带颜色的小人图标
        const peopleIcons = getPeopleIcons(displayLevel, displayColor);

        stationItem.innerHTML = `
            <div class="station-header">
                <div class="station-number">${index + 1} .</div>
                <div class="station-name">${stationData.stationName}</div>
                <div class="congestion-badge" style="background: ${displayColor}">
                    ${isOffService ? '🌙' : (stationData.congestion.emoji || '')} ${displayLevel}
                </div>
            </div>
            <div class="station-details">
                <div class="passenger-count">
                     <p>拥挤程度；</p>
                    <span class="passenger-level-icons">${peopleIcons}</span>
                </div>
                <div class="passenger-indicator">
                    <div class="passenger-level" style="width: ${passengerPercentageDisplay}%; background: ${displayColor}"></div>
                </div>
            </div>
        `;

        // 添加点击事件
        stationItem.addEventListener('click', () => {
            document.querySelectorAll('.station-item').forEach(item => {
                item.classList.remove('active');
            });
            stationItem.classList.add('active');
            console.log(`选中站点: ${stationData.stationName}, 拥挤程度: ${stationData.congestion.level}`);
        });

        // 添加键盘支持
        stationItem.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                stationItem.click();
            }
        });

        container.appendChild(stationItem);
    });

    // 默认选中第一个站点
    if (displayStations.length > 0) {
        const firstStation = container.querySelector('.station-item');
        if (firstStation) {
            firstStation.classList.add('active');
        }
    }
}

// 排序函数 - 按客流量排序
export function sortStationsByPassengers() {
    if (!originalStations || !originalStationsData || !currentContainerId) {
        console.warn('没有可排序的数据');
        return;
    }

    // 设置排序模式为客流量
    currentSortMode = 'passengers';

    // 重新渲染（renderStationList内部会根据currentSortMode自动排序）
    renderStationList(originalStations, currentContainerId, originalStationsData);
}

// 恢复默认排序
export function sortStationsDefault() {
    if (!originalStations || !originalStationsData || !currentContainerId) {
        console.warn('没有可排序的数据');
        return;
    }

    // 设置排序模式为默认
    currentSortMode = 'default';

    // 重新渲染
    renderStationList(originalStations, currentContainerId, originalStationsData);
}

// 下行排序（反转默认排序）
export function sortStationsReverse() {
    if (!originalStations || !originalStationsData || !currentContainerId) {
        console.warn('没有可排序的数据');
        return;
    }

    // 设置排序模式为反向
    currentSortMode = 'reverse';

    // 重新渲染
    renderStationList(originalStations, currentContainerId, originalStationsData);
}