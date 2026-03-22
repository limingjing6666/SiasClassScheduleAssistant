<template>
  <view class="cal-overlay" @click="close">
    <view class="cal-card" @click.stop>
      <!-- 月份导航 -->
      <view class="cal-header">
        <view class="cal-nav-btn" @click="calPrevMonth">
          <text class="cal-nav-arrow">❮</text>
        </view>
        <text class="cal-month-text">{{ calYear }}年{{ String(calMonth).padStart(2, '0') }}月</text>
        <view class="cal-nav-btn" @click="calNextMonth">
          <text class="cal-nav-arrow">❯</text>
        </view>
      </view>
      <!-- 星期标题 -->
      <view class="cal-weekdays">
        <text class="cal-weekday" v-for="w in ['日','一','二','三','四','五','六']" :key="w">{{ w }}</text>
      </view>
      <!-- 日期网格 -->
      <view class="cal-grid">
        <view
          v-for="(cell, idx) in calendarCells"
          :key="idx"
          class="cal-cell"
          :class="{
            'cal-cell-empty': !cell.day,
            'cal-cell-today': cell.isToday,
            'cal-cell-selected': cell.isSelected,
            'cal-cell-other': cell.otherMonth
          }"
          @click="cell.day && selectCalDate(cell)"
        >
          <text class="cal-cell-text" v-if="cell.day">{{ cell.day }}</text>
        </view>
      </view>
      <!-- 底部操作 -->
      <view class="cal-footer">
        <view class="cal-footer-btn" @click="calSelectToday">
          <text class="cal-footer-btn-text">今天</text>
        </view>
        <view class="cal-footer-btn cal-footer-btn-primary" @click="close">
          <text class="cal-footer-btn-text cal-footer-primary-text">关闭</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';

const props = defineProps<{
  initialDate: string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'select-date', date: string): void;
}>();

const calYear = ref(new Date().getFullYear());
const calMonth = ref(new Date().getMonth() + 1);

onMounted(() => {
  const d = new Date(props.initialDate);
  if (!Number.isNaN(d.getTime())) {
    calYear.value = d.getFullYear();
    calMonth.value = d.getMonth() + 1;
  }
});

function close() {
  emit('close');
}

function calPrevMonth() {
  if (calMonth.value === 1) {
    calMonth.value = 12;
    calYear.value--;
  } else {
    calMonth.value--;
  }
}

function calNextMonth() {
  if (calMonth.value === 12) {
    calMonth.value = 1;
    calYear.value++;
  } else {
    calMonth.value++;
  }
}

interface CalCell {
  day: number | null;
  year: number;
  month: number;
  isToday: boolean;
  isSelected: boolean;
  otherMonth: boolean;
}

const calendarCells = computed((): CalCell[] => {
  const y = calYear.value;
  const m = calMonth.value;
  const firstDay = new Date(y, m - 1, 1).getDay();
  const daysInMonth = new Date(y, m, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const selectedStr = props.initialDate;

  const cells: CalCell[] = [];

  const prevDays = new Date(y, m - 1, 0).getDate();
  for (let i = 0; i < firstDay; i++) {
    const d = prevDays - firstDay + 1 + i;
    const pm = m === 1 ? 12 : m - 1;
    const py = m === 1 ? y - 1 : y;
    cells.push({ day: d, year: py, month: pm, isToday: false, isSelected: false, otherMonth: true });
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({
      day: d,
      year: y,
      month: m,
      isToday: dateStr === todayStr,
      isSelected: dateStr === selectedStr,
      otherMonth: false
    });
  }

  const remaining = 42 - cells.length;
  for (let i = 1; i <= remaining; i++) {
    const nm = m === 12 ? 1 : m + 1;
    const ny = m === 12 ? y + 1 : y;
    cells.push({ day: i, year: ny, month: nm, isToday: false, isSelected: false, otherMonth: true });
  }

  return cells;
});

function selectCalDate(cell: CalCell) {
  if (!cell.day) return;
  const dateStr = `${cell.year}-${String(cell.month).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`;
  emit('select-date', dateStr);
  
  if (cell.otherMonth) {
    calYear.value = cell.year;
    calMonth.value = cell.month;
  }
}

function calSelectToday() {
  const today = new Date();
  const dateStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  emit('select-date', dateStr);
  calYear.value = today.getFullYear();
  calMonth.value = today.getMonth() + 1;
}
</script>

<style scoped>
/* 极简日历样式 */
.cal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 900;
  animation: fade-in 0.2s ease;
}

.cal-card {
  width: 88%;
  max-width: 640rpx;
  background: #FFFFFF;
  border-radius: 16rpx;
  overflow: hidden;
  box-shadow: 0 16rpx 48rpx rgba(0, 0, 0, 0.1);
  padding: 40rpx 32rpx;
  animation: slide-up 0.2s ease;
}

.cal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 8rpx 32rpx;
}

.cal-nav-btn {
  width: 64rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8rpx;
  background: #F5F5F5;
}

.cal-nav-arrow {
  font-size: 24rpx;
  color: #000000;
  font-weight: 700;
}

.cal-month-text {
  font-size: 32rpx;
  font-weight: 700;
  color: #000000;
  letter-spacing: 2rpx;
}

.cal-weekdays {
  display: flex;
  padding: 16rpx 0;
  border-bottom: 1rpx solid #F0F0F0;
}

.cal-weekday {
  flex: 1;
  text-align: center;
  font-size: 22rpx;
  color: #888888;
  font-weight: 600;
}

.cal-grid {
  display: flex;
  flex-wrap: wrap;
  padding-top: 16rpx;
}

.cal-cell {
  width: 14.2857%;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 80rpx;
}

.cal-cell-text {
  width: 64rpx;
  height: 64rpx;
  line-height: 64rpx;
  text-align: center;
  font-size: 26rpx;
  color: #000000;
  font-weight: 500;
  border-radius: 8rpx;
  transition: all 0.2s;
}

.cal-cell-other .cal-cell-text {
  color: #CCCCCC;
}

.cal-cell-today .cal-cell-text {
  background: #F0F0F0;
  color: #000000;
  font-weight: 700;
}

.cal-cell-selected .cal-cell-text {
  background: #000000 !important;
  color: #FFFFFF !important;
  font-weight: 700;
}

.cal-footer {
  display: flex;
  gap: 20rpx;
  margin-top: 32rpx;
  padding-top: 32rpx;
  border-top: 1rpx solid #F0F0F0;
}

.cal-footer-btn {
  flex: 1;
  height: 80rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8rpx;
  background: #F5F5F5;
}

.cal-footer-btn-primary {
  background: #000000;
}

.cal-footer-btn-text {
  font-size: 28rpx;
  color: #000000;
  font-weight: 600;
}

.cal-footer-primary-text {
  color: #FFFFFF;
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slide-up {
  from { opacity: 0; transform: translateY(20rpx); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
