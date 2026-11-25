<template>
  <div class="app-container">
    <!-- 搜索与操作栏 -->
    <el-form :model="queryParams" ref="queryRef" :inline="true">
      <el-form-item label="剧本名称" prop="title">
        <el-input v-model="queryParams.title" placeholder="请输入剧本名称" clearable @keyup.enter="handleQuery" />
      </el-form-item>
      <el-form-item label="上架状态" prop="status">
        <el-select v-model="queryParams.status" placeholder="全部状态" clearable>
          <el-option label="正常上架" value="0" />
          <el-option label="已下架" value="1" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" icon="Search" @click="handleQuery">搜索</el-button>
        <el-button type="success" icon="Plus" @click="handleAdd">新增剧本</el-button>
      </el-form-item>
    </el-form>

    <!-- 剧本列表表格 -->
    <el-table v-loading="loading" :data="scriptList" border>
      <el-table-column label="剧本编码" prop="scriptId" width="160" />
      <el-table-column label="剧本标题" prop="title" min-width="180" />
      <el-table-column label="题材标签" prop="tag" width="110" align="center">
        <template #default="scope">
          <el-tag type="danger">{{ scope.row.tag }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="集数/结局" width="120" align="center">
        <template #default="scope">
          {{ scope.row.totalEpisodes }}集 / {{ scope.row.endingCount }}结局
        </template>
      </el-table-column>
      <el-table-column label="默认主演" prop="defaultProtagonist" width="110" align="center" />
      <el-table-column label="热更版本" prop="version" width="95" align="center">
        <template #default="scope">
          <el-tag type="info">v{{ scope.row.version }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="累计开拍" prop="playCount" width="110" align="center" />
      <el-table-column label="上架状态" width="100" align="center">
        <template #default="scope">
          <el-switch
            v-model="scope.row.status"
            active-value="0"
            inactive-value="1"
            @change="handleStatusChange(scope.row)"
          />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" align="center">
        <template #default="scope">
          <el-button link type="primary" icon="Edit" @click="handleEdit(scope.row)">编辑6集分镜</el-button>
        </template>
      </el-table-column>
    </el-table>

    <!-- 剧本与6集分镜可视化编辑抽屉 -->
    <el-drawer v-model="openDrawer" :title="form.title ? `编辑剧本：${form.title}` : '新增剧本'" size="65%">
      <el-form :model="form" label-width="110px">
        <el-form-item label="剧本编码">
          <el-input v-model="form.scriptId" placeholder="如 script_05_new" />
        </el-form-item>
        <el-form-item label="剧本标题">
          <el-input v-model="form.title" />
        </el-form-item>
        <el-form-item label="题材标签">
          <el-input v-model="form.tag" />
        </el-form-item>
        <el-form-item label="默认主角名">
          <el-input v-model="form.defaultProtagonist" />
        </el-form-item>
        <el-form-item label="剧情梗概">
          <el-input v-model="form.synopsis" type="textarea" :rows="3" />
        </el-form-item>

        <el-divider content-position="left">[电影] 6 集分镜与选项配置</el-divider>
        <el-collapse v-model="activeEpNames">
          <el-collapse-item
            v-for="(ep, epIdx) in form.episodes"
            :key="ep.ep"
            :title="`${ep.title}`"
            :name="epIdx"
          >
            <el-form-item label="分集标题">
              <el-input v-model="ep.title" />
            </el-form-item>
            <el-form-item label="场景正文">
              <el-input v-model="ep.sceneDesc" type="textarea" :rows="2" />
            </el-form-item>
            <div v-for="ch in ep.choices" :key="ch.choiceId" style="padding:10px;border:1px dashed #dcdfe6;margin-bottom:8px;border-radius:6px;">
              <strong>选项 {{ ch.label }} ({{ ch.styleTag }}) - 质量分 +{{ ch.qualityBonus }}</strong>
              <el-input v-model="ch.text" style="margin:6px 0;" placeholder="选项文案" />
              <el-input v-model="ch.feedback" placeholder="导演回放点评反馈" />
            </div>
          </el-collapse-item>
        </el-collapse>

        <div style="margin-top:20px;text-align:right;">
          <el-button @click="openDrawer = false">取消</el-button>
          <el-button type="primary" @click="submitForm">保存并发布热更</el-button>
        </div>
      </el-form>
    </el-drawer>
  </div>
</template>

<script setup name="DuanjuScript">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { listScripts, saveScript, changeScriptStatus } from '@/api/duanju';

const loading = ref(false);
const scriptList = ref([]);
const openDrawer = ref(false);
const activeEpNames = ref([0]);
const queryParams = ref({ title: '', status: '' });
const form = ref({ episodes: [], endings: [] });

async function getList() {
  loading.value = true;
  const res = await listScripts(queryParams.value);
  scriptList.value = res.rows || [];
  loading.value = false;
}

function handleQuery() {
  getList();
}

function handleAdd() {
  form.value = {
    scriptId: 'script_new_' + Date.now().toString().slice(-3),
    title: '新短剧剧本',
    tag: '爽文逆袭',
    recommend: true,
    totalEpisodes: 6,
    endingCount: 4,
    coverTheme: '#FF6B9E',
    defaultProtagonist: '匿名主角',
    synopsis: '请输入剧情梗概...',
    initialStats: { thrill: 20, absurd: 15, persona: 50, budget: 15 },
    episodes: [],
    endings: []
  };
  openDrawer.value = true;
}

function handleEdit(row) {
  form.value = JSON.parse(JSON.stringify(row));
  openDrawer.value = true;
}

async function handleStatusChange(row) {
  await changeScriptStatus(row.scriptId, row.status);
  ElMessage.success(row.status === '0' ? '剧本已上架' : '剧本已下架');
}

async function submitForm() {
  await saveScript(form.value);
  ElMessage.success('保存成功，版本号已递增，小程序端已热更新！');
  openDrawer.value = false;
  getList();
}

onMounted(() => {
  getList();
});
</script>
