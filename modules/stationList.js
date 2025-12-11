// modules/stationList.js

/**
 * 站点列表模块
 * 职责：渲染指定线路的站点列表，支持实时客流数据
 */
export function renderStationList(stations, containerId, realtimeData = null) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`容器 #${containerId} 不存在`);
        return;
    }

    // 清空容器
    container.innerHTML = '';

    if (!stations || stations.length === 0) {
        container.innerHTML = `
            <div class="no-stations">
                <i class="fas fa-subway"></i>
                <p>暂无站点数据</p>
            </div>
        `;
        return;
    }

    // 创建站点元素
    stations.forEach((station, index) => {
        const stationElement = document.createElement('div');
        stationElement.className = 'station-item';
        stationElement.tabIndex = 0;

        // 如果有实时数据，使用实时数据，否则使用随机模拟
        let passengers, congestion;
        if (realtimeData && realtimeData[index]) {
            passengers = realtimeData[index].passengers;
            congestion = realtimeData[index].congestion;
        } else {
            passengers = generateRealisticPassengerCount(index);
            congestion = getCongestionLevel(passengers);
        }

        // 计算客流百分比用于进度条
        const passengerPercentage = Math.min(100, Math.floor((passengers / 2000) * 100));

        stationElement.innerHTML = `
            <div class="station-header">
                <div class="station-number">${index + 1}</div>
                <div class="station-name">${station}</div>
                <div class="congestion-badge" style="background: ${congestion.color}">
                    ${congestion.emoji} ${congestion.level}
                </div>
            </div>
            <div class="station-details">
                <div class="passenger-count">
                    <i class="fas fa-users"></i> 
                    <span class="passenger-number">${passengers.toLocaleString()}</span> 人
                </div>
                <div class="passenger-indicator">
                    <div class="passenger-level" style="width: ${passengerPercentage}%; background: ${congestion.color}"></div>
                </div>

            </div>
        `;

        container.appendChild(stationElement);
    });
}

// 辅助函数：根据乘客数量获取拥堵等级
function getCongestionLevel(passengers) {
    if (passengers < 500) return { level: '畅通', color: '#10b981', emoji: '😊' };
    if (passengers < 1000) return { level: '舒适', color: '#3b82f6', emoji: '😊' };
    if (passengers < 2000) return { level: '繁忙', color: '#f59e0b', emoji: '😐' };
    if (passengers < 3000) return { level: '拥挤', color: '#ef4444', emoji: '😰' };
    return { level: '拥堵', color: '#dc2626', emoji: '😱' };
}

// 辅助函数：根据站点位置生成更真实的乘客数量
function generateRealisticPassengerCount(stationIndex) {
    // 基础客流量，根据站点位置调整
    let basePassengers = 0;
    
    // 模拟不同类型的站点（换乘站、中心站、普通站）
    const stationTypes = [
        '普通站', '普通站', '普通站', '普通站', '普通站', '普通站', '普通站', '普通站',
        '换乘站', '换乘站', '换乘站', '换乘站', '换乘站', '换乘站', '换乘站', '换乘站',
        '中心站', '中心站', '中心站', '中心站', '中心站', '中心站', '中心站', '中心站'
    ];
    
    const stationType = stationTypes[stationIndex % stationTypes.length];
    
    // 根据站点类型设置基础客流量
    switch(stationType) {
        case '普通站':
            basePassengers = 500 + Math.floor(Math.random() * 500);
            break;
        case '换乘站':
            basePassengers = 1500 + Math.floor(Math.random() * 1000);
            break;
        case '中心站':
            basePassengers = 2500 + Math.floor(Math.random() * 1500);
            break;
    }
    
    // 添加时间因素，模拟早晚高峰
    const timeFactor = 1 + (Math.sin(Date.now() / 10000) * 0.5);
    
    // 添加随机波动
    const randomFactor = 1 + (Math.random() - 0.5) * 0.3;
    
    // 计算最终客流量
    return Math.floor(basePassengers * timeFactor * randomFactor);
}