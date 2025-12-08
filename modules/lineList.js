/**
 * 线路列表模块
 * 职责：渲染线路列表，并处理线路点击事件
 */
export function renderLineList(lines, containerId, onLineClick) {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`容器 #${containerId} 不存在`);
        return;
    }

    // 清空容器
    container.innerHTML = '';

    // 为每条线路创建一个按钮
    lines.forEach( line => {
        const lineButton = document.createElement('div');       //动态创建DOM元素
        lineButton.className = 'line-item';
        lineButton.textContent = line.name;
        lineButton.style.backgroundColor = line.color;

        // 存储线路ID以便后续使用
        lineButton.dataset.lineId = line.id;        //JavaScript中的 dataset.lineId → HTML中的 data-line-id

        lineButton.addEventListener('click', () => {
            // 移除之前活跃的线路
            document.querySelectorAll('.line-item.active').forEach(item => {
                item.classList.remove('active');
            });
            // 标记当前线路为活跃
            lineButton.classList.add('active');

            // 触发回调函数，传递被点击的线路数据
            if (typeof onLineClick === 'function') {        //typeof: 检查 onLineClick是否是函数类型
                onLineClick(line);
            }
        });

        container.appendChild(lineButton);
    });

    // 默认选中第一条线路
    if (lines.length > 0) {
        const firstLineButton = container.querySelector('.line-item');      //querySelector 本质上就是选择找到的第一个css类
        if (firstLineButton) {
            firstLineButton.click();        // 模拟一次点击
        }
    }
}