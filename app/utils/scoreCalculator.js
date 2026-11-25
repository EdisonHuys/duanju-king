/**
 * 《漫剧大导演》核心拍摄质量评分、票房换算与结局判定引擎 (AC-MP-03.1)
 */

export function evaluateShootResult(script, choicePath, adBoosted = false) {
  const stats = { ...script.initialStats };
  let sumQualityBonus = 0;
  let highAbsurdCount = 0;
  let highThrillCount = 0;
  const unlockedCards = [];

  script.episodes.forEach((ep, idx) => {
    const pickedId = choicePath[idx];
    const choice = ep.choices.find((c) => c.choiceId === pickedId) || ep.choices[0];
    stats.thrill += choice.effects.thrill || 0;
    stats.absurd += choice.effects.absurd || 0;
    stats.persona += choice.effects.persona || 0;
    stats.budget += choice.effects.budget || 0;

    sumQualityBonus += choice.qualityBonus || 15;
    if ((choice.effects.absurd || 0) >= 30) highAbsurdCount++;
    if ((choice.effects.thrill || 0) >= 30) highThrillCount++;
    if (choice.unlockedCardId) {
      unlockedCards.push(choice.unlockedCardId);
    }
  });

  // 按 priority 从高到低匹配结局
  const sortedEndings = [...script.endings].sort((a, b) => a.priority - b.priority);
  let matchedEnding = sortedEndings[sortedEndings.length - 1];
  for (const end of sortedEndings) {
    const cond = end.condition || {};
    if (cond.default) {
      matchedEnding = end;
      break;
    }
    const passSpecial = !cond.specialChoice || choicePath.includes(cond.specialChoice);
    const passAbsurd = !cond.minAbsurd || stats.absurd >= cond.minAbsurd;
    const passThrill = !cond.minThrill || stats.thrill >= cond.minThrill;
    if (passSpecial && passAbsurd && passThrill) {
      matchedEnding = end;
      break;
    }
  }

  // 导演风格连击加成
  let styleComboBonus = 0;
  let styleTitle = '稳健派导演';
  if (highAbsurdCount >= 4) {
    styleComboBonus = 8.0;
    styleTitle = '荒诞派鬼才导演 (+8.0分)';
  } else if (highThrillCount >= 4) {
    styleComboBonus = 6.5;
    styleTitle = '爽片正统大师 (+6.5分)';
  } else if (highAbsurdCount >= 3 || highThrillCount >= 3) {
    styleComboBonus = 3.5;
    styleTitle = '节奏控场导演 (+3.5分)';
  } else {
    styleTitle = '端水大师 (无连击加成)';
  }

  // 微小暴击浮动 (-0.6 ~ +1.2)
  const jitter = Number(((Math.random() * 1.8) - 0.6).toFixed(2));
  const rawScore = 30 + (sumQualityBonus * 0.42) + styleComboBonus + (matchedEnding.baseScoreBonus || 10) + jitter;
  const qualityScore = Math.min(99.85, Math.max(66.5, Number(rawScore.toFixed(2))));

  // 换算模拟首日播放量
  let boxOffice = Math.round(Math.pow(Math.max(50, qualityScore - 40), 3.35) * 850);
  if (adBoosted) {
    boxOffice = Math.round(boxOffice * 1.25);
  }

  // 击败全国导演百分比
  const beatPercent = Math.min(99.9, Math.max(55.0, Number(((qualityScore - 50) * 1.02).toFixed(1))));

  unlockedCards.push(matchedEnding.endingId);

  return {
    stats,
    ending: matchedEnding,
    qualityScore,
    boxOffice,
    beatPercent,
    styleTitle,
    styleComboBonus,
    unlockedCards: Array.from(new Set(unlockedCards))
  };
}

export function formatBoxOffice(num) {
  const n = Number(num) || 0;
  if (n >= 100000000) {
    return (n / 100000000).toFixed(2) + ' 亿';
  }
  if (n >= 10000) {
    return (n / 10000).toFixed(0) + ' 万';
  }
  return n + ' 次';
}
