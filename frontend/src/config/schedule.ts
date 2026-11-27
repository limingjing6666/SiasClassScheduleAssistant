// 课表基础配置文件
// 用于设定全局的默认参数，方便后续直接在此修改，无需寻找深层代码

export const SCHEDULE_CONFIG = {
    // 默认学期开始日期（第一周的周一，仅在首次冷启动且尚未获取到教务校历时兜底）
    // 格式：YYYY-MM-DD
    DEFAULT_SEMESTER_START: '2026-08-31',
    // 默认学期总周数（获取到校历后会自动覆盖为该学期真实总周数）
    DEFAULT_TOTAL_WEEKS: 20,
};
