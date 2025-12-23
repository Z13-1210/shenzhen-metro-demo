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

        // 移动端响应式配置
        this.updateResponsiveConfig();

        // 状态管理
        this.stationsData = [];          // 站点数据
        this.stationPositions = [];      // 站点绘制位置
        this.hoveredStation = null;      // 当前悬停的站点
        this.tooltipElement = null;      // 工具提示元素
        this.currentLine = null;         // 当前显示的线路
        this.isInitialized = false;      // 是否已初始化

        // 拖动相关状态
        this.isDragging = false;         // 是否正在拖动
        this.dragStartX = 0;             // 拖动起始X坐标
        this.dragStartY = 0;             // 拖动起始Y坐标
        this.scrollX = 0;                // 水平滚动偏移量
        this.scrollY = 0;                // 垂直滚动偏移量
        this.minStationSpacing = 80;     // 移动端最小站点间距
        this.isMobile = window.innerWidth <= 768;  // 是否为移动端

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
     * 更新响应式配置
     */
    updateResponsiveConfig() {
        const isSmallMobile = window.innerWidth <= 480;
        const isMobile = window.innerWidth <= 768;
        const isTablet = window.innerWidth <= 1024;

        // 更新设备标志
        this.isMobile = isMobile;
        this.isTablet = isTablet;

        // 更新基础配置（保持与网页端一致的padding和站点大小）
        this.config = {
            ...this.config,
            padding: { top: 80, right: 60, bottom: 80, left: 60 },
            stationRadius: 8,
            lineWidth: 3,
            hoverRadius: 12
        };

        // 字体大小保持固定，不随窗口大小变化
        this.fontSizes = {
            stationName: 16,
            legendText: 14
        };
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

        // 鼠标按下事件（用于拖动）
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));

        // 鼠标松开事件（用于拖动）
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));

        // 触摸事件
        this.canvas.addEventListener('touchstart', this.handleTouchStart.bind(this));
        this.canvas.addEventListener('touchmove', this.handleTouchMove.bind(this));
        this.canvas.addEventListener('touchend', this.handleTouchEnd.bind(this));

        // 窗口大小变化时重新调整Canvas
        window.addEventListener('resize', this.handleResize.bind(this));
    }

    /**
     * 处理鼠标移动事件
     */
    handleMouseMove(event) {
        if (!this.stationPositions.length) return;

        // 如果正在拖动，处理拖动逻辑
        if (this.isDragging) {
            this.handleDragMove(event);
            return;
        }

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
        // 停止拖动
        this.isDragging = false;
    }

    /**
     * 处理鼠标按下事件（开始拖动）
     */
    handleMouseDown(event) {
        // 所有设备都启用拖动功能
        const rect = this.canvas.getBoundingClientRect();
        this.dragStartX = event.clientX - rect.left;
        this.dragStartY = event.clientY - rect.top;
        this.isDragging = true;
        this.canvas.style.cursor = 'grabbing';
    }

    /**
     * 处理鼠标松开事件（结束拖动）
     */
    handleMouseUp(event) {
        if (this.isDragging) {
            this.isDragging = false;
            this.canvas.style.cursor = 'default';
        }
    }

    /**
     * 处理拖动移动
     */
    handleDragMove(event) {
        const rect = this.canvas.getBoundingClientRect();
        const currentX = event.clientX - rect.left;
        const deltaX = currentX - this.dragStartX;

        // 计算内容总宽度
        const totalWidth = this.calculateTotalWidth();
        const canvasWidth = this.canvas.width;
        const maxScrollX = Math.max(0, totalWidth - canvasWidth);

        // 更新滚动偏移量（减去deltaX使拖动方向与实际移动方向一致）
        this.scrollX = Math.max(0, Math.min(this.scrollX - deltaX, maxScrollX));

        // 更新起始点
        this.dragStartX = currentX;

        // 重新计算站点位置并重绘
        this.calculateStationPositions();
        this.redraw();
    }

    /**
     * 计算内容总宽度
     */
    calculateTotalWidth() {
        const { padding } = this.config;
        const numStations = this.stationsData.length;
        
        // 所有设备使用固定间距
        const spacing = this.minStationSpacing;
        
        return padding.left + padding.right + (numStations - 1) * spacing;
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
     * 处理触摸移动事件
     */
    handleTouchMove(event) {
        event.preventDefault();
        
        if (!this.stationPositions.length || !event.touches.length) return;
        
        // 如果正在拖动，处理拖动逻辑
        if (this.isDragging) {
            this.handleTouchDragMove(event);
            return;
        }
        
        const touch = event.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        // 计算触摸在Canvas坐标中的位置
        const touchX = (touch.clientX - rect.left) * scaleX;
        const touchY = (touch.clientY - rect.top) * scaleY;
        
        // 查找触摸的站点
        const foundStation = this.findStationAtPosition(touchX, touchY);
        
        if (foundStation) {
            // 显示工具提示
            this.showTooltip(touch.clientX, touch.clientY, foundStation);
            this.hoveredStation = foundStation;
        } else {
            // 隐藏工具提示
            this.hideTooltip();
            this.hoveredStation = null;
        }
    }

    /**
     * 处理触摸拖动移动
     */
    handleTouchDragMove(event) {
        if (!event.touches.length) return;
        
        const touch = event.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const currentX = touch.clientX - rect.left;
        const deltaX = currentX - this.dragStartX;

        // 计算内容总宽度
        const totalWidth = this.calculateTotalWidth();
        const canvasWidth = this.canvas.width;
        const maxScrollX = Math.max(0, totalWidth - canvasWidth);

        // 更新滚动偏移量（减去deltaX使拖动方向与实际移动方向一致）
        this.scrollX = Math.max(0, Math.min(this.scrollX - deltaX, maxScrollX));

        // 更新起始点
        this.dragStartX = currentX;

        // 重新计算站点位置并重绘
        this.calculateStationPositions();
        this.redraw();
    }

    /**
     * 处理触摸结束事件
     */
    handleTouchEnd(event) {
        event.preventDefault();
        
        // 隐藏工具提示
        this.hideTooltip();
        this.hoveredStation = null;
    }

    /**
     * 处理触摸点击事件
     */
    handleTouchStart(event) {
        event.preventDefault();
        
        if (!this.stationPositions.length || !event.touches.length) return;
        
        const touch = event.touches[0];
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        // 计算触摸在Canvas坐标中的位置
        const touchX = (touch.clientX - rect.left) * scaleX;
        const touchY = (touch.clientY - rect.top) * scaleY;
        
        // 查找触摸的站点
        const foundStation = this.findStationAtPosition(touchX, touchY);
        
        if (foundStation) {
            // 显示工具提示
            this.showTooltip(touch.clientX, touch.clientY, foundStation);
            this.hoveredStation = foundStation;
            
            // 触发点击事件
            this.canvas.dispatchEvent(new CustomEvent('stationClick', {
                detail: { station: foundStation.stationData }
            }));
        } else {
            // 如果没有触摸到站点，开始拖动
            this.dragStartX = touch.clientX - rect.left;
            this.dragStartY = touch.clientY - rect.top;
            this.isDragging = true;
        }
    }

    /**
     * 处理窗口大小变化事件
     */
    handleResize() {
        // 更新响应式配置
        this.updateResponsiveConfig();
        this.resizeCanvas();
        
        // 重置滚动位置
        this.scrollX = 0;
        
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

        // 获取客流数据（用于计算拥堵等级）
        const passengers = stationData.passengers !== undefined ? stationData.passengers : 0;

        // 根据客流人数计算拥堵等级
        function calculateCongestion(passengers) {
            if(passengers === 0) return { level: '已停运', color: '#94a3b8' };
            if (passengers <= 200) {
                return { level: '畅通', color: '#10b981' };
            } else if (passengers <= 500) {
                return { level: '舒适', color: '#3b82f6' };
            } else if (passengers <= 1000) {
                return { level: '繁忙', color: '#f59e0b' };
            } else if (passengers <= 2000) {
                return { level: '拥挤', color: '#ef4444' };
            } else {
                return { level: '拥堵', color: '#dc2626' };
            }
        }

        // 使用计算出的拥堵等级，确保数据一致性
        const congestion = stationData.congestion || calculateCongestion(passengers);
        const congestionLevel = congestion.level;
        const congestionColor = congestion.color;

        // 辅助函数：根据拥堵等级获取小人图标
        const getPeopleIcons = (level) => {
            // 如果是停运状态，显示灰色小人
            if (level === '已停运') {
                let icons = '';
                for (let i = 0; i < 1; i++) {
                    icons += '<i class="fas fa-male" style="margin: 0 1px; color: #64748b"></i>';
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
            if (count === 0) return '<span style="color: #999;">未知</span>';

            // 使用Font Awesome的人物图标
            let icons = '';
            for (let i = 0; i < count; i++) {
                icons += '<i class="fas fa-male" style="margin: 0 1px; color: ' + congestionColor + '"></i>';
            }
            return icons;
        };

        const peopleIcons = getPeopleIcons(congestionLevel);
        
        // 检查是否为移动端
        const isMobile = window.innerWidth <= 768;
        const isSmallMobile = window.innerWidth <= 480;

        // 重新设计tooltip内容，根据屏幕大小调整样式
        this.tooltipElement.innerHTML = `
        <div class="tooltip-content">
            <div class="station-name" style="color: #fff; font-size: ${isSmallMobile ? '14px' : isMobile ? '16px' : '18px'}; font-weight: bold; margin-bottom: ${isSmallMobile ? '8px' : '12px'};">
                ${stationData.stationName}
            </div>
            <div class="station-stats" style="margin-bottom: ${isSmallMobile ? '6px' : '10px'};">
                <div class="congestion-level" style="display: flex; align-items: center; gap: ${isSmallMobile ? '6px' : '8px'}; margin-bottom: ${isSmallMobile ? '6px' : '8px'};">
                    <span style="color: #ccc; font-size: ${isSmallMobile ? '12px' : '14px'};">拥挤程度:</span>
                    <span style="font-weight: bold; font-size: ${isSmallMobile ? '14px' : isMobile ? '16px' : '18px'};">${peopleIcons}</span>
                </div>
            </div>
            <div class="station-status" style="display: flex; align-items: center; gap: ${isSmallMobile ? '6px' : '8px'};">
                <span style="color: #ccc; font-size: ${isSmallMobile ? '12px' : '14px'}">状态:</span>
                <div style="width: ${isSmallMobile ? '10px' : '12px'}; height: ${isSmallMobile ? '10px' : '12px'}; background: ${congestionColor}; border-radius: 50%;"></div>
                <span style="color: ${congestionColor}; font-size: ${isSmallMobile ? '12px' : '14px'}; font-weight: bold;">${congestionLevel}</span>
            </div>
        </div>
    `;

        // 显示工具提示
        this.tooltipElement.style.display = 'block';

        // 计算位置（避免超出视口）
        const tooltipRect = this.tooltipElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        // 调整位置，让tooltip显示在触摸点/鼠标的右下方
        let left = x + (isMobile ? 15 : 20);
        let top = y + (isMobile ? 15 : 20);

        // 水平方向：如果超出右侧边界，显示在左侧
        if (left + tooltipRect.width > viewportWidth) {
            left = x - tooltipRect.width - (isMobile ? 10 : 15);
        }

        // 垂直方向：如果超出底部边界，显示在上方
        if (top + tooltipRect.height > viewportHeight) {
            top = y - tooltipRect.height - (isMobile ? 10 : 15);
        }

        // 确保不超出视口顶部
        if (top < (isMobile ? 5 : 10)) {
            top = (isMobile ? 5 : 10);
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
            return this.calculateStats();
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
     * 重绘热力图（用于拖动等场景）
     */
    redraw() {
        if (!this.canvas || !this.ctx) return;

        // 清空画布
        this.clear();

        // 如果没有数据，显示空状态
        if (!this.stationsData.length || !this.currentLine) {
            this.drawEmptyState();
            this.stationPositions = [];
            return;
        }

        // 绘制热力图
        this.drawBackground();
        this.drawLine();
        this.drawStations();
        this.drawLabels();
        this.drawLegend();
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
        const canvasHeight = this.canvas.height;
        const plotHeight = canvasHeight - padding.top - padding.bottom;

        const numStations = this.stationsData.length;
        this.stationPositions = [];

        if (numStations === 0) return;

        // 中心线Y位置（所有站点在同一水平线上）
        const centerY = padding.top + plotHeight / 2;

        // 所有设备上使用固定间距，不再根据屏幕大小调整
        const spacing = this.minStationSpacing;

        for (let i = 0; i < numStations; i++) {
            // 计算基础X坐标（不考虑滚动偏移）
            const baseX = padding.left + i * spacing;

            // 应用滚动偏移量（所有设备都支持滚动）
            const x = baseX - this.scrollX;

            // 所有站点在同一水平线上
            const y = centerY;

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

        // 使用直线连接所有站点
        for (let i = 0; i < positions.length; i++) {
            const current = positions[i];
            if (i === 0) {
                ctx.moveTo(current.x, current.y);
            } else {
                ctx.lineTo(current.x, current.y);
            }
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

        // 显示所有站点标签，不根据设备类型过滤
        this.stationPositions.forEach((pos, index) => {
            const { x, y, stationData } = pos;

            // 根据站点索引决定标签位置（交替显示，避免拥挤）
            const labelPosition = index % 4;
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
            ctx.fillStyle = colors.text;
            ctx.font = `${this.fontSizes.stationName}px Arial, "Microsoft YaHei", sans-serif`;
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
        
        // 绘制图例标题
        ctx.fillStyle = colors.text;
        ctx.font = `${this.fontSizes.legendText}px Arial, "Microsoft YaHei", sans-serif`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText('客流等级:', 20, height - 40);
        
        // 计算图例标题的宽度，用于确定图例项的起始X坐标
        const titleWidth = ctx.measureText('客流等级:').width;
        
        // 针对不同设备类型设置基础图例参数
        const legendY = height - 40;
        
        // 确保图例项有足够的空间显示
        const maxTitleWidth = 100;
        const actualTitleWidth = Math.min(titleWidth, maxTitleWidth);
        const legendItemStartX = 20 + actualTitleWidth + 20;
        
        const congestionLevels = [
            { level: '畅通', color: '#10b981' },
            { level: '舒适', color: '#3b82f6' },
            { level: '繁忙', color: '#f59e0b' },
            { level: '拥挤', color: '#ef4444' },
            { level: '拥堵', color: '#dc2626' },
            { level: '已停运', color: '#94a3b8' }
        ];
        
        // 显示所有图例项，不根据设备类型过滤
        const visibleLevels = congestionLevels;
        const visibleCount = visibleLevels.length;
        
        // 计算可用空间
        const availableWidth = width - legendItemStartX - 20;
        
        // 动态计算每个图例项的宽度
        let totalLegendItemsWidth = 0;
        visibleLevels.forEach(level => {
            const textWidth = ctx.measureText(level.level).width;
            const itemWidth = textWidth + 24;
            totalLegendItemsWidth += itemWidth;
        });
        
        // 计算最小间距
        const minSpacing = 10;
        const requiredWidth = totalLegendItemsWidth + (visibleCount - 1) * minSpacing;
        
        // 如果需要，调整每个图例项的宽度
        let itemWidthAdjustment = 0;
        if (requiredWidth > availableWidth) {
            const excessWidth = requiredWidth - availableWidth;
            itemWidthAdjustment = excessWidth / visibleCount;
        }
        
        // 绘制图例项
        let currentX = legendItemStartX;
        visibleLevels.forEach((level, index) => {
            const textWidth = ctx.measureText(level.level).width;
            let itemWidth = textWidth + 24 - itemWidthAdjustment;
            
            itemWidth = Math.max(itemWidth, 30);
            
            ctx.fillStyle = level.color;
            ctx.beginPath();
            ctx.arc(currentX + 8, legendY, 6, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = colors.legendText;
            ctx.font = `${this.fontSizes.legendText}px Arial, "Microsoft YaHei", sans-serif`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            
            const maxTextWidth = itemWidth - 24;
            if (textWidth <= maxTextWidth) {
                ctx.fillText(level.level, currentX + 20, legendY);
            } else {
                const ellipsisWidth = ctx.measureText('...').width;
                let truncatedText = level.level;
                while (ctx.measureText(truncatedText).width > maxTextWidth - ellipsisWidth && truncatedText.length > 1) {
                    truncatedText = truncatedText.slice(0, -1);
                }
                ctx.fillText(truncatedText + '...', currentX + 20, legendY);
            }
            
            currentX += itemWidth + minSpacing;
        });
        
        // 添加操作说明
        ctx.fillStyle = colors.legendText;
        ctx.font = `${this.fontSizes.legendText - 1}px Arial, "Microsoft YaHei", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('拖动查看完整线路，悬停查看站点信息', width / 2, height - 10);
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
            this.canvas.removeEventListener('mousedown', this.handleMouseDown);
            this.canvas.removeEventListener('mouseup', this.handleMouseUp);
            // 移除触摸事件监听器
            this.canvas.removeEventListener('touchstart', this.handleTouchStart);
            this.canvas.removeEventListener('touchmove', this.handleTouchMove);
            this.canvas.removeEventListener('touchend', this.handleTouchEnd);
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