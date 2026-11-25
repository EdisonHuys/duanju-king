<template>
  <div class="app-container">
    <el-card shadow="never" header="🛡️ 微信小程序提审、商业化广告与内容安全风控配置">
      <el-form :model="configForm" label-width="220px" style="max-width:780px;">
        <el-form-item label="微信提审纯净模式 (audit_mode)">
          <el-switch v-model="configForm.auditMode" />
          <div style="font-size:12px;color:#909399;line-height:1.4;margin-top:4px;">
            开启后，小程序端自动隐藏「全服神剧跑马灯」与「诱导好友PK分享按钮」，确保100%稳过微信官方审核；过审后关闭即可恢复完整裂变体验。
          </div>
        </el-form-item>

        <el-form-item label="流量主激励广告开关 (ad_enabled)">
          <el-switch v-model="configForm.adEnabled" />
          <div style="font-size:12px;color:#909399;line-height:1.4;margin-top:4px;">
            控制局内「导演喊卡·重选」与结算页「追加宣发经费+25%播放量」激励广告位。
          </div>
        </el-form-item>

        <el-form-item label="排行榜紧急净网开关">
          <el-switch v-model="configForm.emergencyCleanName" />
          <div style="font-size:12px;color:#909399;line-height:1.4;margin-top:4px;">
            开启后，全服排行榜立即隐藏所有玩家的自定义主演名，统一展示剧本默认主角名（如“叶辰”“林晚晚”）。
          </div>
        </el-form-item>

        <el-form-item label="主演改名敏感词黑名单">
          <el-input
            v-model="sensitiveWordsStr"
            type="textarea"
            :rows="4"
            placeholder="以英文逗号分隔的违禁词，配合微信 security.msgSecCheck 双重拦截"
          />
        </el-form-item>

        <el-form-item>
          <el-button type="primary" @click="handleSave">保存全局配置（小程序端实时生效）</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup name="DuanjuConfig">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { getDuanjuConfig, updateDuanjuConfig } from '@/api/duanju';

const configForm = ref({
  auditMode: false,
  adEnabled: true,
  emergencyCleanName: false,
  sensitiveWords: []
});
const sensitiveWordsStr = ref('');

async function loadConfig() {
  const res = await getDuanjuConfig();
  if (res.data) {
    configForm.value = res.data;
    sensitiveWordsStr.value = (res.data.sensitiveWords || []).join(',');
  }
}

async function handleSave() {
  const words = sensitiveWordsStr.value
    .split(/[,，]/)
    .map((s) => s.trim())
    .filter(Boolean);
  await updateDuanjuConfig({
    ...configForm.value,
    sensitiveWords: words
  });
  ElMessage.success('风控与提审配置保存成功，小程序端已实时生效！');
}

onMounted(() => {
  loadConfig();
});
</script>
