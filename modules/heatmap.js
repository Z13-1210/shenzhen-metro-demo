// modules/heatmap.js

/**
 * 热力图模块
 * 职责：管理热力图的绘制、交互和数据可视化
 */
export class Heatmap {
    constructor(canvasId) {
        // Canvas 元素和上下文
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error(`未找到ID为"${canvasId}"的Canvas元素`);
            return;
        }
        this.ctx = this.canvas.getContext('2d');

        // 热力图配置
        this.config = {
            padding: { top: 80, right: 60, bottom: 80, left: 60 },
            stationRadius: 8,
            lineWidth: 3,
            hoverRadius: 12,
            colors: {
                background: '#ffffff',
                gridLine: 'rgba(0, 0, 0, 0.05)',
                text: '#333333',
                legendText: '#666666'
            }
        };

        // 状态管理
        this.stationsData = [];          // 站点数据
        this.stationPositions = [];      // 站点绘制位置
        this.hoveredStation = null;      // 当前悬停的站点
        this.tooltipElement = null;      // 工具提示元素
        this.currentLine = null;         // 当前显示的线路
        this.isInitialized = false;      // 是否已初始化

        // 初始化
        this.init();
    }

    /**
     * 初始化热力图
     */
    init() {
        if (this.isInitialized) return;

        // 创建工具提示元素
        this.createTooltipElement();

        // 绑定事件监听器
        this.bindEvents();

        // 初始调整大小
        this.resizeCanvas();

        // 标记为已初始化
        this.isInitialized = true;
        console.log('热力图模块初始化完成');
    }

    /**
     * 创建工具提示元素
     */
    createTooltipElement() {
        // 如果已存在，先移除
        if (this.tooltipElement && this.tooltipElement.parentNode) {
            this.tooltipElement.parentNode.removeChild(this.tooltipElement);
        }

        // 创建新的工具提示元素
        this.tooltipElement = document.createElement('div');
        this.tooltipElement.id = 'heatmap-tooltip';
        this.tooltipElement.className = 'heatmap-tooltip';
        this.tooltipElement.style.cssText = `
            position: fixed;
            display: none;
            background: rgba(0, 0, 0, 0.85);
            color: white;
            padding: 12px 16px;
            border-radius: 8px;
            font-size: 16px;
            pointer-events: none;
            z-index: 1000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            backdrop-filter: blur(4px);
            border: 1px solid rgba(255,255,255,0.1);
            max-width: 200px;
            opacity: 0;
            transition: opacity 0.2s ease;
        `;
        document.body.appendChild(this.tooltipElement);
    }

    /**
     * 绑定事件监听器
     */
    bindEvents() {
        if (!this.canvas) return;

        // 鼠标移动事件
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));

        // 鼠标离开事件
        this.canvas.addEventListener('mouseleave', this.handleMouseLeave.bind(this));

        // 点击事件
        this.canvas.addEventListener('click', this.handleClick.bind(this));

        // 窗口大小变化时重新调整Canvas
        window.addEventListener('resize', this.handleResize.bind(this));
    }

    /**
     * 处理鼠标移动事件
     */
    handleMouseMove(event) {
        if (!this.stationPositions.length) return;

        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;

        // 计算鼠标在Canvas坐标中的位置
        const mouseX = (event.clientX - rect.left) * scaleX;
        const mouseY = (event.clientY - rect.top) * scaleY;

        // 查找鼠标悬停的站点
        const foundStation = this.findStationAtPosition(mouseX, mouseY);

        if (foundStation) {
            // 显示工具提示
            this.showTooltip(event.clientX, event.clientY, foundStation);
            this.hoveredStation = foundStation;
        } else {
            // 隐藏工具提示
            this.hideTooltip();
            this.hoveredStation = null;
        }
    }

    /**
     * 处理鼠标离开事件
     */
    handleMouseLeave() {
        this.hideTooltip();
        this.hoveredStation = null;
    }

    /**
     * 处理点击事件
     */
    handleClick(event) {
        if (this.hoveredStation) {
            // 可以在这里添加点击站点的处理逻辑
            console.log('点击了站点:', this.hoveredStation.stationData.stationName);
            // 如果需要，可以触发自定义事件
            this.canvas.dispatchEvent(new CustomEvent('stationClick', {
                detail: { station: this.hoveredStation.stationData }
            }));
        }
    }

    /**
     * 处理窗口大小变化
     */
    handleResize() {
        this.resizeCanvas();
        if (this.currentLine && this.stationsData.length) {
            this.draw(this.stationsData, this.currentLine);
        }
    }

    /**
     * 调整Canvas大小以适应容器
     */
    resizeCanvas() {
        if (!this.canvas) return;

        const container = this.canvas.parentElement;
        if (!container) return;

        // 保存当前显示尺寸
        const displayWidth = container.clientWidth;
        const displayHeight = container.clientHeight;

        // 检查尺寸是否变化
        if (this.canvas.width !== displayWidth || this.canvas.height !== displayHeight) {
            // 设置Canvas的实际像素尺寸
            this.canvas.width = displayWidth;
            this.canvas.height = displayHeight;

            console.log(`Canvas大小调整为: ${displayWidth}x${displayHeight}`);
        }
    }

    /**
     * 在指定位置查找站点
     */
    findStationAtPosition(x, y) {
        for (const pos of this.stationPositions) {
            const distance = Math.sqrt(
                Math.pow(x - pos.x, 2) + Math.pow(y - pos.y, 2)
            );

            if (distance <= this.config.stationRadius + 2) { // 加2px的悬停容差
                return {
                    stationData: pos.stationData,
                    canvasX: pos.x,
                    canvasY: pos.y
                };
            }
        }
        return null;
    }

    /**
     * 显示工具提示
     */
    showTooltip(x, y, stationInfo) {
        if (!this.tooltipElement || !stationInfo) return;

        const stationData = stationInfo.stationData;
        if (!stationData || !stationData.stationName) return;

        // 获取客流数据
        const passengers = stationData.passengers !== undefined ?
            stationData.passengers : 0;
        const congestionLevel = stationData.congestion ?
            stationData.congestion.level : '未知';
        const congestionColor = stationData.congestion ?
            stationData.congestion.color : '#999999';

        // 【修改点1】获取线路颜色
        const lineColor = this.currentLine?.color || congestionColor;

        // 【修改点2】重新设计tooltip内容，合并客流等级和状态
        this.tooltipElement.innerHTML = `
        <div class="tooltip-content">
            <div class="station-name" style="color: #fff; font-size: 20px; font-weight: bold; margin-bottom: 8px; text-shadow: ">
                ${stationData.stationName}
            </div>
            <div class="station-stats" style="display: flex; justify-content: space-between; margin-bottom: 8px;">
                <div class="passenger-count">
                    <span style="color: #ccc;font-size: 16px">客流量：<span style="font-weight: bold; font-size: 18px; color: #fff;">${passengers.toLocaleString()}</span> 人</span>
                </div>
            </div>
            <div class="station-status" style="display: flex; align-items: center; gap: 8px;">
           <span style="font-size: 16px">状态:</span>
                <div style="width: 16px; height: 16px; background: ${congestionColor}; border-radius: 50%;"></div>
                <span style="color: ${congestionColor}; font-size: 16px">${congestionLevel}</span>
            </div>
        </div>
    `;

        // 显示工具提示
        this.tooltipElement.style.display = 'block';

        // 计算位置（避免超出视口）
        const tooltipRect = this.tooltipElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // 【修改点3】调整位置，让tooltip显示在鼠标右下方
        let left = x + 20;  // 稍微向右偏移
        let top = y + 20;   // 稍微向下偏移

        // 水平方向：如果超出右侧边界，显示在鼠标左侧
        if (left + tooltipRect.width > viewportWidth) {
            left = x - tooltipRect.width - 15;
        }

        // 垂直方向：如果超出底部边界，显示在鼠标上方
        if (top + tooltipRect.height > viewportHeight) {
            top = y - tooltipRect.height - 15;
        }

        // 确保不超出视口顶部
        if (top < 10) {
            top = 10;
        }

        // 应用位置
        this.tooltipElement.style.left = left + 'px';
        this.tooltipElement.style.top = top + 'px';
        this.tooltipElement.style.opacity = '1';
    }

    /**
     * 隐藏工具提示
     */
    hideTooltip() {
        if (!this.tooltipElement) return;

        this.tooltipElement.style.opacity = '0';
        setTimeout(() => {
            if (this.tooltipElement) {
                this.tooltipElement.style.display = 'none';
            }
        }, 200);
    }

    /**
     * 设置热力图数据并绘制
     */
    draw(stationsData, lineInfo) {
        if (!this.canvas || !this.ctx) {
            console.warn('Canvas未初始化');
            return null;
        }

        // 保存数据
        this.stationsData = this.ensureAllStationsHaveData(stationsData);
        this.currentLine = lineInfo;

        // 清空画布
        this.clear();

        // 如果没有数据，显示空状态
        if (!this.stationsData.length || !lineInfo) {
            this.drawEmptyState();
            this.stationPositions = [];
            return this.calculateStats();  // 【重要】返回空数据的统计数据
        }

        // 重新计算Canvas大小
        this.resizeCanvas();

        // 计算站点位置
        this.calculateStationPositions();

        // 绘制热力图
        this.drawBackground();
        this.drawLine();
        this.drawStations();
        this.drawLabels();
        this.drawLegend();

        // 返回统计数据
        return this.calculateStats();
    }

    /**
     * 确保所有站点都有完整的数据
     */
    ensureAllStationsHaveData(stationsData) {
        if (!stationsData || !Array.isArray(stationsData)) return [];

        return stationsData.map((station, index) => {
            // 创建数据副本
            const stationCopy = { ...station };

            // 确保有站点名称
            if (!stationCopy.stationName) {
                stationCopy.stationName = `站点${index + 1}`;
            }

            // 确保有客流数据
            if (typeof stationCopy.passengers !== 'number' || isNaN(stationCopy.passengers)) {
                stationCopy.passengers = 100 + Math.floor(Math.random() * 900);
            }

            // 确保有拥堵等级
            if (!stationCopy.congestion) {
                const passengers = stationCopy.passengers;
                let level, color;

                if (passengers <= 200) { level = '畅通'; color = '#10b981'; }
                else if (passengers <= 500) { level = '舒适'; color = '#3b82f6'; }
                else if (passengers <= 1000) { level = '繁忙'; color = '#f59e0b'; }
                else if (passengers <= 2000) { level = '拥挤'; color = '#ef4444'; }
                else { level = '拥堵'; color = '#dc2626'; }

                stationCopy.congestion = { level, color };
            }

            return stationCopy;
        });
    }

    /**
     * 清空画布
     */
    clear() {
        if (!this.ctx) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    /**
     * 计算站点绘制位置
     */
    calculateStationPositions() {
        const { padding } = this.config;
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        const plotWidth = canvasWidth - padding.left - padding.right;
        const plotHeight = canvasHeight - padding.top - padding.bottom;

        const numStations = this.stationsData.length;
        this.stationPositions = [];

        if (numStations === 0) return;

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

            this.stationPositions.push({
                x,
                y,
                stationData: this.stationsData[i]
            });
        }
    }

    /**
     * 绘制背景和网格
     */
    drawBackground() {
        const { ctx } = this;
        const { width, height } = this.canvas;
        const { colors } = this.config;

        // 绘制白色背景
        ctx.fillStyle = colors.background;
        ctx.fillRect(0, 0, width, height);

        // 绘制网格线
        ctx.strokeStyle = colors.gridLine;
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

    /**
     * 绘制地铁线路
     */
    drawLine() {
        const { ctx } = this;
        const { lineWidth } = this.config;
        const positions = this.stationPositions;

        if (positions.length < 2) return;

        // 开始绘制路径
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

        // 设置线路样式
        ctx.strokeStyle = this.currentLine?.color || '#10b981';
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
    }

    /**
     * 绘制站点圆点
     */
    drawStations() {
        const { ctx } = this;
        const { stationRadius } = this.config;

        this.stationPositions.forEach((pos) => {
            const { x, y, stationData } = pos;
            const congestionColor = stationData.congestion?.color || '#999999';

            // 绘制站点圆点
            ctx.beginPath();
            ctx.arc(x, y, stationRadius, 0, Math.PI * 2);
            ctx.fillStyle = congestionColor;
            ctx.fill();

            // 绘制白色边框
            ctx.beginPath();
            ctx.arc(x, y, stationRadius, 0, Math.PI * 2);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.stroke();

            // 如果当前悬停在此站点，绘制悬停效果
            if (this.hoveredStation &&
                this.hoveredStation.stationData === stationData) {
                ctx.beginPath();
                ctx.arc(x, y, stationRadius + 4, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        });
    }

    /**
     * 绘制站点标签
     */
    drawLabels() {
        const { ctx } = this;
        const { colors } = this.config;

        this.stationPositions.forEach((pos, index) => {
            const { x, y, stationData } = pos;

            // 根据站点索引决定标签位置（交替显示，避免拥挤）
            const labelPosition = index % 4;
            let labelY, textBaseline;

            switch (labelPosition) {
                case 0: // 上方
                    labelY = y - 20;
                    textBaseline = 'bottom';
                    break;
                case 1: // 下方
                    labelY = y + 20;
                    textBaseline = 'top';
                    break;
                case 2: // 更上方
                    labelY = y - 30;
                    textBaseline = 'bottom';
                    break;
                case 3: // 更下方
                    labelY = y + 30;
                    textBaseline = 'top';
                    break;
            }

            // 绘制站点名称
            ctx.fillStyle = colors.text;
            ctx.font = '16px Arial, "Microsoft YaHei", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = textBaseline;
            ctx.fillText(stationData.stationName, x, labelY);
        });
    }

    /**
     * 绘制图例
     */
    drawLegend() {
        const { ctx } = this;
        const { width, height } = this.canvas;
        const { colors } = this.config;

        const legendX = 100;
        const legendY = height - 50;

        const congestionLevels = [
            { level: '畅通', color: '#10b981' },
            { level: '舒适', color: '#3b82f6' },
            { level: '繁忙', color: '#f59e0b' },
            { level: '拥挤', color: '#ef4444' },
            { level: '拥堵', color: '#dc2626' }
        ];

        // 绘制图例标题
        ctx.fillStyle = colors.text;
        ctx.font = 'bold 16px Arial, "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('客流等级:', 20, legendY);

        // 绘制图例项
        const itemSpacing = 80;

        congestionLevels.forEach((level, index) => {
            const x = legendX + index * itemSpacing;

            // 绘制颜色方块
            ctx.fillStyle = level.color;
            ctx.beginPath();
            ctx.arc(x + 6, legendY - 2, 6, 0, Math.PI * 2);
            ctx.fill();

            // 绘制标签
            ctx.fillStyle = colors.legendText;
            ctx.font = '16px Arial, "Microsoft YaHei", sans-serif';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(level.level, x + 18, legendY);
        });
    }

    /**
     * 绘制空状态
     */
    drawEmptyState() {
        const { ctx } = this;
        const { width, height } = this.canvas;

        // 绘制灰色背景
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, width, height);

        // 绘制提示文本
        ctx.fillStyle = '#6c757d';
        ctx.font = 'bold 20px Arial, "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('请选择一条线路查看热力图', width / 2, height / 2);
    }

    /**
     * 计算统计数据
     */
    calculateStats() {
        if (!this.stationsData.length) {
            return { total: 0, avg: 0, peak: 0 };
        }

        const passengers = this.stationsData.map(data => data.passengers);
        const total = passengers.reduce((sum, p) => sum + p, 0);
        const avg = Math.round(total / passengers.length);
        const peak = Math.max(...passengers);

        return { total, avg, peak };
    }

    /**
     * 更新统计数据UI（这个方法可能需要从外部调用）
     */
    updateStatsUI(totalElementId, avgElementId, peakElementId) {
        const stats = this.calculateStats();

        const totalEl = document.getElementById(totalElementId);
        const avgEl = document.getElementById(avgElementId);
        const peakEl = document.getElementById(peakElementId);

        if (totalEl) totalEl.textContent = stats.total.toLocaleString();
        if (avgEl) avgEl.textContent = stats.avg.toLocaleString();
        if (peakEl) peakEl.textContent = stats.peak.toLocaleString();

        return stats;
    }

    /**
     * 销毁热力图实例，清理资源
     */
    destroy() {
        // 移除事件监听器
        if (this.canvas) {
            this.canvas.removeEventListener('mousemove', this.handleMouseMove);
            this.canvas.removeEventListener('mouseleave', this.handleMouseLeave);
            this.canvas.removeEventListener('click', this.handleClick);
        }

        window.removeEventListener('resize', this.handleResize);

        // 移除工具提示元素
        if (this.tooltipElement && this.tooltipElement.parentNode) {
            this.tooltipElement.parentNode.removeChild(this.tooltipElement);
        }

        // 清空引用
        this.canvas = null;
        this.ctx = null;
        this.tooltipElement = null;
        this.isInitialized = false;

        console.log('热力图模块已销毁');
    }
}

// 导出Heatmap类
export default Heatmap;