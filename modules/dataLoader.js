export async function loadLinesData() {
    //打包一个异步函数，用来加载地铁路线数据，然后给main.js

    try{
        const response = await fetch('./data/lines.json')
        // 在lines.json 中获得 地铁线路数据，然后存在 response 里 ， await 表示必须要真实获得了数据

        if(!response.ok){   //如果没有真实正确获得数据，那么抛出一个错误
            throw new Error(`网络请求失败！状态码：${response.status}`)
        }
        const lines = await response.json()
        // 吧response获得的json数据 转换为 js 对象 存在 lines 里
        console.log('🎉 数据加载成功！共', lines.length, '条线路')
        return lines

    }catch(error){
        console.error('❌ 加载数据时出错：', error)
        return []
        //返回空数组，避免程序崩溃
    }

}