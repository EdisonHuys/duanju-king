<template>
  <div class="app-container">
    <el-form :model="queryParams" :inline="true">
      <el-form-item label="所属剧本">
        <el-select v-model="queryParams.scriptId" placeholder="全部剧本" clearable @change="getList">
          <el-option label="《赘婿龙王：三年之期》" value="script_01_zhuixu" />
          <el-option label="《真假千金：DNA动了》" value="script_02_qianjin" />
          <el-option label="《霸总逼我签协议：带球跑》" value="script_03_bazong" />
          <el-option label="《重生之我在豪门当保姆》" value="script_04_baomu" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Refresh" @click="getList">刷新榜单</el-button>
      </el-form-item>
    </el-form>

    <el-table v-loading="loading" :data="rankList" border>
      <el-table-column label="排名" type="index" width="70" align="center" />
      <el-table-column label="剧本编码" prop="scriptId" width="150" />
      <el-table-column label="导演昵称" prop="nickname" width="140" />
      <el-table-column label="自定义主演名" prop="actorName" width="140">
        <template #default="scope">
          <el-tag type="warning">{{ scope.row.actorName }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="达成结局" prop="endingTitle" min-width="200" />
      <el-table-column label="拍摄质量评分" prop="qualityScore" width="130" align="center">
        <template #default="scope">
          <strong style="color:#F56C6C;font-size:16px;">{{ scope.row.qualityScore }} 分</strong>
        </template>
      </el-table-column>
      <el-table-column label="展示状态" width="100" align="center">
        <template #default="scope">
          <el-tag :type="scope.row.status === '0' ? 'success' : 'info'">
            {{ scope.row.status === '0' ? '正常在榜' : '已下榜' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="风控操作" width="240" align="center">
        <template #default="scope">
          <el-button link type="warning" @click="handleModerate(scope.row, 'resetName')">重置主演名</el-button>
          <el-button
            v-if="scope.row.status === '0'"
            link
            type="danger"
            @click="handleModerate(scope.row, 'remove')"
          >一键下榜</el-button>
          <el-button
            v-else
            link
            type="success"
            @click="handleModerate(scope.row, 'restore')"
          >恢复上榜</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script setup name="DuanjuLeaderboard">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { listLeaderboard, moderateLeaderboard } from '@/api/duanju';

const loading = ref(false);
const rankList = ref([]);
const queryParams = ref({ scriptId: '' });

async function getList() {
  loading.value = true;
  const res = await listLeaderboard(queryParams.value);
  rankList.value = res.rows || [];
  loading.value = false;
}

async function handleModerate(row, action) {
  await moderateLeaderboard({ rankId: row.rankId, action });
  ElMessage.success('风控操作已生效');
  getList();
}

onMounted(() => {
  getList();
});
</script>
