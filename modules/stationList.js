/**
 * 站点列表模块
 * 职责：渲染指定线路的站点列表
 */
export function renderStationList(stations, containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`容器 #${containerId} 不存在`);
        return;
    }

    // 清空容器
    container.innerHTML = '';

    // 如果没有站点，显示提示
    if (!stations || stations.length === 0) {
        container.innerHTML = '<p class="no-stations">暂无站点数据</p>';
        return;
    }

    // 创建站点元素
    stations.forEach((station, index) => {
        const stationElement = document.createElement('div');
        stationElement.className = 'station-item';

        // 添加站点序号
        const stationNumber = document.createElement('div');
        stationNumber.className = 'station-number';
        stationNumber.textContent = `${index + 1}`;

        // 添加站点名称
        const stationName = document.createElement('div');
        stationName.className = 'station-name';
        stationName.textContent = station;

        // 添加客流模拟数据
        const passengerCount = Math.floor(Math.random() * 1000);
        const passengerElement = document.createElement('div');
        passengerElement.className = 'passenger-count';
        passengerElement.innerHTML = `<i class="fas fa-user"></i> ${passengerCount}`;

        stationElement.appendChild(stationNumber);
        stationElement.appendChild(stationName);
        stationElement.appendChild(passengerElement);

        container.appendChild(stationElement);
    });
}