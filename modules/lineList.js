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
        const lineButton = document.createElement('div');
        lineButton.className = 'line-item';
        lineButton.textContent = line.name;
        lineButton.style.backgroundColor = line.color;

        // 存储线路ID以便后续使用
        lineButton.dataset.lineId = line.id;

        // 添加键盘支持，使元素可通过Tab键访问
        lineButton.tabIndex = 0;
        
        // 添加点击事件监听器
        lineButton.addEventListener('click', () => {
            // 移除之前活跃的线路
            document.querySelectorAll('.line-item.active').forEach(item => {
                item.classList.remove('active');
            });
            // 标记当前线路为活跃
            lineButton.classList.add('active');

            // 触发回调函数，传递被点击的线路数据
            if (typeof onLineClick === 'function') {
                onLineClick(line);
            }
        });
        
        // 添加键盘事件监听器，支持Enter键和空格键操作
        lineButton.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                lineButton.click();
            }
        });

        container.appendChild(lineButton);
    });

    // 默认选中第一条线路
    if (lines.length > 0) {
        const firstLineButton = container.querySelector('.line-item');
        if (firstLineButton) {
            firstLineButton.click();
        }
    }
}