/**
 * 同步全部 9 部精品短剧剧本至远程宝塔 MySQL 数据库 (ry_duanju.dj_script)
 * 严格遵循阿里 Java/MyBatis 规范与 RuoYi 结构
 * 零 Emoji，纯净企业级配置
 */

const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');

const FULL_DATA_PATH = path.resolve(__dirname, '../ruoyi-app/static/scripts/FULL_GAME_DATA.json');
const fullData = JSON.parse(fs.readFileSync(FULL_DATA_PATH, 'utf-8'));

// 9部剧本的元数据映射表
const SCRIPT_METAS = [
  {
    genreId: 'dragon',
    scriptId: 'script_01_zhuixu',
    title: '赘婿龙王：三年之期',
    subtitle: '三年之期已到，恭迎龙王归位！',
    tag: '逆袭打脸',
    recommend: '1',
    coverTheme: '#FFE600',
    coverImage: '/static/art/covers/cover-dragon.jpg',
    defaultProtagonist: '歪嘴龙王',
    synopsis: '三年忍让只为守住老街食堂，龙纹令牌却被当成购物卡，今日一声令下十万将士齐聚寿宴！'
  },
  {
    genreId: 'heiress',
    scriptId: 'script_02_qianjin',
    title: '真假千金：DNA动了',
    subtitle: '抱错豪门二十年，真千金开着拖拉机回来了！',
    tag: '豪门真假',
    recommend: '1',
    coverTheme: '#2CD3E1',
    coverImage: '/static/art/covers/cover-heiress.jpg',
    defaultProtagonist: '沈栀',
    synopsis: '豪门认亲晚宴，假千金还在装柔弱拼名牌，真千金已经掀桌出示千亿矿产产权证！'
  },
  {
    genreId: 'landlady',
    scriptId: 'script_03_bazong',
    title: '霸总追妻：夫人她是拆迁办的',
    subtitle: '封少：给你五百万离开我。她：给你五千万把你公司拆了！',
    tag: '打脸追妻',
    recommend: '1',
    coverTheme: '#FF9F43',
    coverImage: '/static/art/covers/cover-landlady.jpg',
    defaultProtagonist: '陆晚晚',
    synopsis: '霸道总裁以为她只是个普通租客，殊不知整个CBD核心商业街半数地皮都在她名下。'
  },
  {
    genreId: 'marriage',
    scriptId: 'script_04_baomu',
    title: '闪婚首富：盲盒老公是千亿霸总',
    subtitle: '领证当天民政局门口被拉去相亲，闪婚对象竟是全城首富！',
    tag: '都市甜宠',
    recommend: '1',
    coverTheme: '#FF6292',
    coverImage: '/static/art/covers/cover-marriage.jpg',
    defaultProtagonist: '顾思思',
    synopsis: '本想随便抓个顺眼的应付催婚，谁知抓到了全城身价最高的那位，隐婚日常天天打脸渣亲戚。'
  },
  {
    genreId: 'reborn',
    scriptId: 'script_05_reborn',
    title: '重生复仇：前夫哥给爷爬',
    subtitle: '重回渣男求婚前一天，这辈子我要拿回属于我的一切！',
    tag: '重生逆袭',
    recommend: '0',
    coverTheme: '#9D4EDD',
    coverImage: '/static/art/covers/cover-reborn.jpg',
    defaultProtagonist: '林若雪',
    synopsis: '上一世被害惨死，重生归来直接撕破渣男伪善面具，手握预知剧情大杀四方，夺回家族商业帝国。'
  },
  {
    genreId: 'transmig',
    scriptId: 'script_06_transmig',
    title: '穿书女配：我把主角团带偏了',
    subtitle: '刚穿成活不过三章的恶毒女配，系统却天天让我搞抽象！',
    tag: '穿书爆笑',
    recommend: '0',
    coverTheme: '#38D9A9',
    coverImage: '/static/art/covers/cover-transmig.jpg',
    defaultProtagonist: '苏小暖',
    synopsis: '穿成反派女配，决定不再参与男女主爱恨纠葛，安心搞钱吃瓜，谁料全员反常求带飞！'
  },
  {
    genreId: 'veteran',
    scriptId: 'script_07_veteran',
    title: '战神归来：一声令下十万将士',
    subtitle: '战神卸甲归田，丈母娘竟然逼我扫厕所！',
    tag: '战神无敌',
    recommend: '0',
    coverTheme: '#4A69BD',
    coverImage: '/static/art/covers/cover-veteran.jpg',
    defaultProtagonist: '楚天行',
    synopsis: '北方境主低调隐姓埋名，谁料反派步步紧逼，十万将士瞬间集结，恭迎天王！'
  },
  {
    genreId: 'healer',
    scriptId: 'script_08_healer',
    title: '神医下山：专治各种不服',
    subtitle: '奉师命下山退婚，却被各路豪门争抢续命！',
    tag: '神医都市',
    recommend: '0',
    coverTheme: '#00B894',
    coverImage: '/static/art/covers/cover-healer.jpg',
    defaultProtagonist: '叶凡',
    synopsis: '九位师娘亲授通天医术与武学，银针一出阎王退避，各方大佬跪求一针千金！'
  },
  {
    genreId: 'palace',
    scriptId: 'script_09_palace',
    title: '穿越宫斗：娘娘她靠整活封后',
    subtitle: '进宫第一天，我把贵妃的茶话会办成了脱口秀！',
    tag: '穿越宫斗',
    recommend: '0',
    coverTheme: '#E056FD',
    coverImage: '/static/art/covers/cover-palace.jpg',
    defaultProtagonist: '甄小鬟',
    synopsis: '现代打工人穿进深宫，不想争宠只想苟命，靠一手现代段子与营销智慧笑冠后宫。'
  }
];

async function main() {
  const mysqlHost = process.env.MYSQL_HOST || '127.0.0.1';
  const mysqlPort = Number(process.env.MYSQL_PORT) || 3306;
  const mysqlDb = process.env.MYSQL_DATABASE || 'ry_duanju';
  console.log(`[Migration] 正在连接 MySQL (${mysqlHost}:${mysqlPort}/${mysqlDb})...`);
  const conn = await mysql.createConnection({
    host: mysqlHost,
    port: mysqlPort,
    user: process.env.MYSQL_USER || 'ry_duanju',
    password: process.env.MYSQL_PASSWORD || '',
    database: mysqlDb
  });
  console.log('[Migration] 数据库连接成功！准备同步 9 部剧本...');

  for (let i = 0; i < SCRIPT_METAS.length; i++) {
    const meta = SCRIPT_METAS[i];
    const genre = fullData.genres.find(g => g.id === meta.genreId);
    if (!genre) {
      console.warn(`[Migration] 未找到 genreId: ${meta.genreId}`);
      continue;
    }

    // 格式化 6 集剧本数据：双向兼容管理后台字段 (ep, title, sceneDesc, sceneImage, choices) 与小程序端 (panels, choices)
    const formattedEpisodes = genre.episodes.map((ep, eIdx) => {
      const epNum = ep.number || (eIdx + 1);
      // 提取场景独白旁白描述
      const monologueText = (ep.panels && ep.panels.length > 0)
        ? ep.panels.map(p => (p.speaker && p.speaker !== '旁白' ? `${p.speaker}：${p.text}` : p.text)).join('\n')
        : (ep.sceneDesc || `${meta.title} 第 ${epNum} 集开场场景独白。`);

      // 分镜插画
      let sceneImage = ep.sceneImage || '';
      if (!sceneImage) {
        if (meta.genreId === 'heiress') {
          sceneImage = eIdx === 0 ? '/static/generated_scenes/heiress/heiress_ep1_p1.jpg'
            : (eIdx === 1 ? '/static/generated_scenes/heiress/heiress_ep2_p1.jpg' : '/static/generated_scenes/heiress/heiress_ep1_p2.jpg');
        } else {
          sceneImage = meta.coverImage;
        }
      }

      // 格式化选项
      const choices = (ep.choices || []).map((ch, cIdx) => {
        const choiceLetter = ch.id || (cIdx === 0 ? 'A' : (cIdx === 1 ? 'B' : 'C'));
        const choiceText = ch.label || ch.text || `选项 ${choiceLetter}`;
        const feedback = ch.outcome || ch.feedback || `你选择了【${choiceText}】，剧情产生了戏剧性反转！`;
        const qualityBonus = ch.qualityBonus || (cIdx === 1 ? 18 : (cIdx === 2 ? 15 : 12));
        const styleTag = ch.styleTag || (cIdx === 0 ? '经典套路' : (cIdx === 1 ? '离谱反套路' : '打工人觉醒'));

        return {
          choiceId: `${meta.genreId}_e${epNum}_c${cIdx + 1}`,
          id: choiceLetter,
          label: choiceLetter,
          text: choiceText,
          styleTag: styleTag,
          feedback: feedback,
          outcome: feedback,
          qualityBonus: qualityBonus,
          effects: ch.effects || { pleasure: 10, drama: 15, anger: 5, evidence: 1, subversion: 1 }
        };
      });

      return {
        ep: epNum,
        number: epNum,
        id: ep.id || `${meta.genreId}.ep${epNum}`,
        title: ep.title ? (ep.title.includes('第') ? ep.title : `第 ${epNum} 集：${ep.title}`) : `第 ${epNum} 集`,
        sceneDesc: monologueText,
        sceneImage: sceneImage,
        panels: ep.panels || [{ speaker: '旁白', text: monologueText }],
        choices: choices
      };
    });

    const endingsJson = JSON.stringify(genre.endings || []);
    const episodesJson = JSON.stringify(formattedEpisodes);
    const initialStatsJson = JSON.stringify(fullData.initialStats || { pleasure: 10, drama: 25, anger: 10, evidence: 0, subversion: 0 });

    // 检查是否已存在
    const [existing] = await conn.query('SELECT id, version FROM dj_script WHERE script_id = ?', [meta.scriptId]);

    if (existing.length > 0) {
      // 更新已有剧本
      await conn.query(`
        UPDATE dj_script SET
          title = ?,
          subtitle = ?,
          tag = ?,
          recommend = ?,
          total_episodes = 6,
          ending_count = 4,
          cover_theme = ?,
          cover_image = ?,
          default_protagonist = ?,
          synopsis = ?,
          initial_stats_json = ?,
          episodes_json = ?,
          endings_json = ?,
          sort_order = ?,
          status = '0',
          update_time = NOW()
        WHERE script_id = ?
      `, [
        meta.title,
        meta.subtitle,
        meta.tag,
        meta.recommend,
        meta.coverTheme,
        meta.coverImage,
        meta.defaultProtagonist,
        meta.synopsis,
        initialStatsJson,
        episodesJson,
        endingsJson,
        i + 1,
        meta.scriptId
      ]);
      console.log(`[Migration] [已更新] ${meta.scriptId} - 《${meta.title}》`);
    } else {
      // 插入新剧本
      await conn.query(`
        INSERT INTO dj_script (
          script_id, title, subtitle, tag, recommend, difficulty,
          total_episodes, ending_count, cover_theme, cover_image,
          default_protagonist, synopsis, initial_stats_json, episodes_json, endings_json,
          version, sort_order, status, play_count, finish_count, del_flag,
          create_by, create_time, update_by, update_time
        ) VALUES (
          ?, ?, ?, ?, ?, 1,
          6, 4, ?, ?,
          ?, ?, ?, ?, ?,
          1, ?, '0', 1200, 1100, '0',
          'admin', NOW(), 'admin', NOW()
        )
      `, [
        meta.scriptId,
        meta.title,
        meta.subtitle,
        meta.tag,
        meta.recommend,
        meta.coverTheme,
        meta.coverImage,
        meta.defaultProtagonist,
        meta.synopsis,
        initialStatsJson,
        episodesJson,
        endingsJson,
        i + 1
      ]);
      console.log(`[Migration] [已新增] ${meta.scriptId} - 《${meta.title}》`);
    }
  }

  // 验证当前总剧本数
  const [allScripts] = await conn.query('SELECT script_id, title, tag, cover_image FROM dj_script WHERE del_flag = "0" ORDER BY sort_order ASC');
  console.log(`[Migration] 同步完成！当前 MySQL 数据库中有效剧本总数: ${allScripts.length}`);
  allScripts.forEach((s, idx) => {
    console.log(`  [${idx+1}] ${s.script_id}: 《${s.title}》 | 封面: ${s.cover_image}`);
  });

  await conn.end();
}

main().catch(err => {
  console.error('[Migration Error]:', err);
  process.exit(1);
});
