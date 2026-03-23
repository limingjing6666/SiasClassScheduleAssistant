# 组件文档

> 西亚斯课表助手的Vue组件，包括CourseDetailModal、CustomCalendar、WeekSelector

## 📋 目录

- [CourseDetailModal](#coursedetailmodal)
- [CustomCalendar](#customcalendar)
- [WeekSelector](#weekselector)

## CourseDetailModal

课程详情模态框组件，显示课程的详细信息。

### 组件描述

显示课程详情的模态框，包含课程名称、教师、教室、具体时间段等信息。带有课程颜色横幅和关闭按钮，支持点击遮罩层关闭。

### Props

| 属性名 | 类型 | 必需 | 默认值 | 说明 |
|--------|------|------|--------|------|
| course | RenderCourse | 是 | - | 要显示的课程详情数据 |

### Events

| 事件名 | 参数 | 说明 |
|--------|------|------|
| close | 无 | 点击关闭按钮或遮罩层时触发 |

### 使用示例

```vue
<template>
  <view>
    <button @click="showDetail = true">查看详情</button>
    
    <CourseDetailModal
      v-if="showDetail && selectedCourse"
      :course="selectedCourse"
      @close="showDetail = false"
    />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { RenderCourse } from '@/types';
import CourseDetailModal from '@/components/CourseDetailModal.vue';

const showDetail = ref(false);
const selectedCourse = ref<RenderCourse | null>(null);

function handleCourseClick(course: RenderCourse) {
  selectedCourse.value = course;
  showDetail.value = true;
}
</script>
```

### 样式定制

组件使用scoped样式，可通过以下CSS变量定制：

```css
.detail-overlay {
  background: rgba(0, 0, 0, 0.4);  /* 遮罩层背景 */
}

.detail-card {
  width: 85%;                        /* 卡片宽度 */
  max-width: 600rpx;                 /* 最大宽度 */
  border-radius: 12rpx;              /* 圆角 */
  box-shadow: 0 16rpx 48rpx rgba(0, 0, 0, 0.1);  /* 阴影 */
}
```

## CustomCalendar

自定义日历组件，用于选择学期开始日期。

### 组件描述

自定义日历组件，支持月份导航、日期选择、今天高亮等功能。提供"今天"和"关闭"操作按钮，返回选中日期给父组件。

### Props

| 属性名 | 类型 | 必需 | 默认值 | 说明 |
|--------|------|------|--------|------|
| initialDate | string | 是 | - | 初始选中的日期字符串 (YYYY-MM-DD) |

### Events

| 事件名 | 参数 | 说明 |
|--------|------|------|
| close | 无 | 关闭日历时触发 |
| select-date | date: string | 选择日期时触发，返回格式化的日期字符串 |

### 使用示例

```vue
<template>
  <view>
    <button @click="showCalendar = true">设置开学日期</button>
    
    <CustomCalendar
      v-if="showCalendar"
      :initial-date="semesterStart"
      @close="showCalendar = false"
      @select-date="onSelectDate"
    />
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import CustomCalendar from '@/components/CustomCalendar.vue';
import { useScheduleStore } from '@/stores/schedule';

const scheduleStore = useScheduleStore();
const showCalendar = ref(false);
const semesterStart = computed(() => scheduleStore.semesterStart);

function onSelectDate(dateStr: string) {
  scheduleStore.setSemesterStart(dateStr);
  showCalendar.value = false;
  uni.showToast({ title: '开学日期已设置', icon: 'none' });
}
</script>
```

### 功能特性

1. **月份导航**：支持上个月/下个月切换
2. **日期选择**：点击日期即可选中
3. **今天高亮**：自动高亮今天的日期
4. **选中状态**：高亮显示当前选中的日期
5. **其他月份日期**：显示其他月份的日期，但颜色较浅

### 样式定制

```css
.cal-overlay {
  background: rgba(0, 0, 0, 0.4);  /* 遮罩层背景 */
}

.cal-card {
  width: 88%;                        /* 卡片宽度 */
  max-width: 640rpx;                 /* 最大宽度 */
  border-radius: 16rpx;              /* 圆角 */
  padding: 40rpx 32rpx;              /* 内边距 */
}

.cal-cell-selected .cal-cell-text {
  background: #000000 !important;    /* 选中日期背景 */
  color: #FFFFFF !important;         /* 选中日期文字 */
}
```

## WeekSelector

周次选择器组件，显示当前周次并提供下拉选择功能。

### 组件描述

周次选择器组件，显示当前周次，点击展开下拉列表选择其他周次。支持滚动查看所有周次选项，自动高亮当前选中的周次。

### Props

| 属性名 | 类型 | 必需 | 默认值 | 说明 |
|--------|------|------|--------|------|
| currentWeek | number | 是 | - | 当前选中的周次 |
| totalWeeks | number | 是 | - | 总周数 |

### Events

| 事件名 | 参数 | 说明 |
|--------|------|------|
| select-week | week: number | 选择周次时触发，返回周次数值 |

### 使用示例

```vue
<template>
  <view class="header">
    <WeekSelector 
      :current-week="currentWeek" 
      :total-weeks="totalWeeks" 
      @select-week="selectWeek" 
    />
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useScheduleStore } from '@/stores/schedule';
import WeekSelector from '@/components/WeekSelector.vue';

const scheduleStore = useScheduleStore();
const currentWeek = computed(() => scheduleStore.currentWeek);
const totalWeeks = computed(() => scheduleStore.totalWeeks);

function selectWeek(week: number) {
  scheduleStore.setCurrentWeek(week);
}
</script>
```

### 功能特性

1. **当前周显示**：显示"第X周"
2. **下拉列表**：点击展开周次选择列表
3. **滚动支持**：支持滚动查看所有周次
4. **高亮当前**：自动高亮当前选中的周次
5. **点击选择**：点击周次即可切换

### 样式定制

```css
.week-selector-container {
  position: relative;
}

.week-num-btn {
  background: #F5F5F5;               /* 按钮背景 */
  border-radius: 8rpx;               /* 圆角 */
  padding: 0 24rpx;                  /* 内边距 */
  height: 56rpx;                     /* 高度 */
}

.week-popup-dropdown {
  width: 240rpx;                     /* 下拉框宽度 */
  background: #FFFFFF;               /* 下拉框背景 */
  border: 1rpx solid #EAEAEA;        /* 边框 */
  border-radius: 8rpx;               /* 圆角 */
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.08);  /* 阴影 */
}

.week-popup-item.active {
  color: #FFFFFF;                    /* 选中项文字 */
  background: #000000;               /* 选中项背景 */
}
```

## 组件组合使用示例

```vue
<template>
  <view class="schedule-page">
    <!-- 头部 -->
    <view class="header">
      <WeekSelector 
        :current-week="currentWeek" 
        :total-weeks="totalWeeks" 
        @select-week="selectWeek" 
      />
    </view>
    
    <!-- 课程列表 -->
    <view class="courses">
      <view 
        v-for="course in displayCourses" 
        :key="course.name"
        @click="showCourseDetail(course)"
      >
        {{ course.name }}
      </view>
    </view>
    
    <!-- 课程详情弹窗 -->
    <CourseDetailModal
      v-if="showDetail && selectedCourse"
      :course="selectedCourse"
      @close="showDetail = false"
    />
    
    <!-- 日历弹窗 -->
    <CustomCalendar
      v-if="showCalendar"
      :initial-date="semesterStart"
      @close="showCalendar = false"
      @select-date="onSelectDate"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { useScheduleStore } from '@/stores/schedule';
import type { RenderCourse } from '@/types';
import WeekSelector from '@/components/WeekSelector.vue';
import CourseDetailModal from '@/components/CourseDetailModal.vue';
import CustomCalendar from '@/components/CustomCalendar.vue';

const scheduleStore = useScheduleStore();

const currentWeek = computed(() => scheduleStore.currentWeek);
const totalWeeks = computed(() => scheduleStore.totalWeeks);
const displayCourses = computed(() => scheduleStore.displayCourses);
const semesterStart = computed(() => scheduleStore.semesterStart);

const showDetail = ref(false);
const selectedCourse = ref<RenderCourse | null>(null);
const showCalendar = ref(false);

function selectWeek(week: number) {
  scheduleStore.setCurrentWeek(week);
}

function showCourseDetail(course: RenderCourse) {
  selectedCourse.value = course;
  showDetail.value = true;
}

function onSelectDate(dateStr: string) {
  scheduleStore.setSemesterStart(dateStr);
  showCalendar.value = false;
}
</script>
```
