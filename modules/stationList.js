// modules/stationList.js

export function renderStationList(stations, containerId, stationsData) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`容器 #${containerId} 不存在`);
        return;
    }

    // 清空容器
    container.innerHTML = '';

    // 如果没有站点数据，显示提示
    if (!stations || stations.length === 0) {
        container.innerHTML = '<p class="no-data">暂无站点数据</p>';
        return;
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

    // 为每个站点创建一个列表项
    stations.forEach((station, index) => {
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
        if (stationsData && stationsData[index]) {
            stationData = stationsData[index];
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

        // 获取带颜色的小人图标
        const peopleIcons = getPeopleIcons(stationData.congestion.level, stationData.congestion.color);

        stationItem.innerHTML = `
            <div class="station-header">
                <div class="station-number">${index + 1} .</div>
                <div class="station-name">${stationData.stationName}</div>
                <div class="congestion-badge" style="background: ${stationData.congestion.color}">
                    ${stationData.congestion.emoji || ''} ${stationData.congestion.level}
                </div>
            </div>
            <div class="station-details">
                <div class="passenger-count">
                     <p>拥挤程度；</p>
                    <span class="passenger-level-icons">${peopleIcons}</span>
                </div>
                <div class="passenger-indicator">
                    <div class="passenger-level" style="width: ${passengerPercentage}%; background: ${stationData.congestion.color}"></div>
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
    if (stations.length > 0) {
        const firstStation = container.querySelector('.station-item');
        if (firstStation) {
            firstStation.classList.add('active');
        }
    }
}