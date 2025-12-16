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

    // 为每个站点创建一个列表项
    stations.forEach((station, index) => {
        // 从station参数中提取站点名称
        let stationName;

        if (typeof station === 'string') {
            // 如果station是字符串，直接使用
            stationName = station;
        } else if (station && typeof station === 'object' && station.name) {
            // 如果station是对象且有name属性
            stationName = station.name;
        } else {
            // 其他情况，尝试转换为字符串
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
            // 如果没有实时数据，创建默认数据
            stationData = {
                stationName: stationName,
                passengers: 0,
                congestion: { level: '未知', color: '#64748b' }
            };
        }

        // 确保stationData中有stationName
        if (!stationData.stationName) {
            stationData.stationName = stationName;
        }

        // 计算客流百分比用于进度条
        const passengerPercentage = Math.min(100, Math.floor((stationData.passengers / 2000) * 100));

        stationItem.innerHTML = `
            <div class="station-header">
                <div class="station-number">${index + 1}</div>
                <div class="station-name">${stationData.stationName}</div>
                <div class="congestion-badge" style="background: ${stationData.congestion.color}">
                    ${stationData.congestion.emoji || ''} ${stationData.congestion.level}
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

        // 添加点击事件
        stationItem.addEventListener('click', () => {
            // 高亮选中的站点
            document.querySelectorAll('.station-item').forEach(item => {
                item.classList.remove('active');
            });
            stationItem.classList.add('active');

            // 可以在这里添加其他点击处理逻辑
            console.log(`选中站点: ${stationData.stationName}, 客流量: ${stationData.passengers}`);
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